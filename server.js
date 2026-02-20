const express = require('express');
const { Pool } = require('pg');
const multer = require('multer');
const pdfParse = require('pdf-parse');
const axios = require('axios');
const FormData = require('form-data');
const Parser = require('rss-parser');
const OAuth = require('oauth-1.0a');
const crypto = require('crypto');

const compression = require('compression');
const app = express();
const PORT = process.env.PORT || 5500;

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
});

// Database connection (Railway provides DATABASE_URL)
const useDatabase = !!process.env.DATABASE_URL;
let pool = null;

if (useDatabase) {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    connectionTimeoutMillis: 5000,
    query_timeout: 10000,
    idleTimeoutMillis: 30000
  });
}

// SSRF protection: validate URLs before server-side fetch
function isAllowedUrl(urlString) {
  try {
    const parsed = new URL(urlString);
    if (!['http:', 'https:'].includes(parsed.protocol)) return false;
    const host = parsed.hostname.toLowerCase();
    if (host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0' || host === '::1') return false;
    if (host.endsWith('.local') || host.endsWith('.internal')) return false;
    if (/^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|169\.254\.)/.test(host)) return false;
    return true;
  } catch {
    return false;
  }
}

// Database is required for all data persistence (PostgreSQL via DATABASE_URL)

// Outlet name normalization map (shared across endpoints)
const OUTLET_NAME_MAP = {
  'techcrunch.com': 'TechCrunch',
  'www.techcrunch.com': 'TechCrunch',
  'theverge.com': 'The Verge',
  'www.theverge.com': 'The Verge',
  'wired.com': 'WIRED',
  'www.wired.com': 'WIRED',
  'venturebeat.com': 'VentureBeat',
  'www.venturebeat.com': 'VentureBeat',
  'technologyreview.com': 'MIT Technology Review',
  'www.technologyreview.com': 'MIT Technology Review',
  'arstechnica.com': 'Ars Technica',
  'www.arstechnica.com': 'Ars Technica',
  'fastcompany.com': 'Fast Company',
  'www.fastcompany.com': 'Fast Company',
  'businessinsider.com': 'Business Insider',
  'www.businessinsider.com': 'Business Insider',
  'forbes.com': 'Forbes',
  'www.forbes.com': 'Forbes',
  'cnbc.com': 'CNBC',
  'www.cnbc.com': 'CNBC',
  'reuters.com': 'Reuters',
  'www.reuters.com': 'Reuters',
  'bloomberg.com': 'Bloomberg',
  'www.bloomberg.com': 'Bloomberg',
  'tldr.tech': 'TLDR',
  'www.tldr.tech': 'TLDR',
  'businessoffashion.com': 'Business of Fashion',
  'www.businessoffashion.com': 'Business of Fashion',
  'theinterline.com': 'The Interline',
  'www.theinterline.com': 'The Interline'
};

function normalizeOutletName(rawOutlet) {
  if (!rawOutlet) return 'Unknown';
  const cleaned = rawOutlet.toLowerCase().trim();
  return OUTLET_NAME_MAP[cleaned] || 
         OUTLET_NAME_MAP[cleaned.replace('www.', '')] || 
         rawOutlet;
}

// Initialize database table (with timeout so server always starts)
async function initDatabase() {
  if (!useDatabase) return;
  
  try {
    await Promise.race([
      (async () => {
        // Main app_data table
        await pool.query(`
          CREATE TABLE IF NOT EXISTS app_data (
            key VARCHAR(50) PRIMARY KEY,
            data JSONB NOT NULL,
            updated_at TIMESTAMP DEFAULT NOW()
          )
        `);
        
        // PR wizard responses
        await pool.query(`
          CREATE TABLE IF NOT EXISTS pr_wizard (
            id SERIAL PRIMARY KEY,
            data JSONB NOT NULL,
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW()
          )
        `);
        
        // PR sources
        await pool.query(`
          CREATE TABLE IF NOT EXISTS pr_sources (
            id VARCHAR(50) PRIMARY KEY,
            title TEXT NOT NULL,
            type VARCHAR(20) NOT NULL,
            content TEXT,
            url TEXT,
            file_name TEXT,
            folder VARCHAR(100),
            selected BOOLEAN DEFAULT true,
            created_at TIMESTAMP DEFAULT NOW()
          )
        `);
        
        // PR outputs (generated content)
        await pool.query(`
          CREATE TABLE IF NOT EXISTS pr_outputs (
            id VARCHAR(50) PRIMARY KEY,
            content_type VARCHAR(50) NOT NULL,
            title TEXT,
            content TEXT,
            sources JSONB,
            citations JSONB,
            strategy JSONB,
            status VARCHAR(20) DEFAULT 'draft',
            phase VARCHAR(20) DEFAULT 'edit',
            created_at TIMESTAMP DEFAULT NOW()
          )
        `);
        
        // Migration: Add phase column if it doesn't exist
        await pool.query(`
          DO $$ 
          BEGIN 
            IF NOT EXISTS (
              SELECT 1 FROM information_schema.columns 
              WHERE table_name='pr_outputs' AND column_name='phase'
            ) THEN
              ALTER TABLE pr_outputs ADD COLUMN phase VARCHAR(20) DEFAULT 'edit';
            END IF;
          END $$;
        `);
        
        // Migration: Add story_key, news_headline, drafts, content_plan_index columns
        await pool.query(`
          DO $$ 
          BEGIN 
            IF NOT EXISTS (
              SELECT 1 FROM information_schema.columns 
              WHERE table_name='pr_outputs' AND column_name='story_key'
            ) THEN
              ALTER TABLE pr_outputs ADD COLUMN story_key TEXT;
              ALTER TABLE pr_outputs ADD COLUMN news_headline TEXT;
              ALTER TABLE pr_outputs ADD COLUMN drafts JSONB;
              ALTER TABLE pr_outputs ADD COLUMN content_plan_index INTEGER;
            END IF;
          END $$;
        `);

        // Migration: Add archived column
        await pool.query(`
          DO $$ 
          BEGIN 
            IF NOT EXISTS (
              SELECT 1 FROM information_schema.columns 
              WHERE table_name='pr_outputs' AND column_name='archived'
            ) THEN
              ALTER TABLE pr_outputs ADD COLUMN archived BOOLEAN DEFAULT false;
            END IF;
          END $$;
        `);

        // Migration: Add distribution columns (media, hashtags, first_comment)
        await pool.query(`
          DO $$ 
          BEGIN 
            IF NOT EXISTS (
              SELECT 1 FROM information_schema.columns 
              WHERE table_name='pr_outputs' AND column_name='media_attachments'
            ) THEN
              ALTER TABLE pr_outputs ADD COLUMN media_attachments JSONB;
              ALTER TABLE pr_outputs ADD COLUMN hashtags JSONB;
              ALTER TABLE pr_outputs ADD COLUMN first_comment TEXT;
            END IF;
          END $$;
        `);

        // Migration: Add og_data column for persisted Open Graph metadata
        await pool.query(`
          DO $$ 
          BEGIN 
            IF NOT EXISTS (
              SELECT 1 FROM information_schema.columns 
              WHERE table_name='pr_outputs' AND column_name='og_data'
            ) THEN
              ALTER TABLE pr_outputs ADD COLUMN og_data JSONB;
            END IF;
          END $$;
        `);

        // Migration: Add category and is_custom columns for custom content sources
        await pool.query(`
          DO $$ 
          BEGIN 
            IF NOT EXISTS (
              SELECT 1 FROM information_schema.columns 
              WHERE table_name='pr_outputs' AND column_name='category'
            ) THEN
              ALTER TABLE pr_outputs ADD COLUMN category VARCHAR(50);
              ALTER TABLE pr_outputs ADD COLUMN is_custom BOOLEAN DEFAULT false;
            END IF;
          END $$;
        `);
        
        // Migration: Add angle_title and angle_narrative columns for custom content angle
        await pool.query(`
          DO $$ BEGIN
            ALTER TABLE pr_outputs ADD COLUMN IF NOT EXISTS angle_title TEXT;
            ALTER TABLE pr_outputs ADD COLUMN IF NOT EXISTS angle_narrative TEXT;
          END $$;
        `);

        // Migration: Add publish tracking columns
        await pool.query(`
          DO $$ BEGIN
            ALTER TABLE pr_outputs ADD COLUMN IF NOT EXISTS published_channel VARCHAR(30);
            ALTER TABLE pr_outputs ADD COLUMN IF NOT EXISTS tweet_url TEXT;
            ALTER TABLE pr_outputs ADD COLUMN IF NOT EXISTS tweet_id TEXT;
            ALTER TABLE pr_outputs ADD COLUMN IF NOT EXISTS tweet_ids JSONB;
            ALTER TABLE pr_outputs ADD COLUMN IF NOT EXISTS published_at TIMESTAMP;
            ALTER TABLE pr_outputs ADD COLUMN IF NOT EXISTS published_snapshot JSONB;
          END $$;
        `);

        // Media outlets (user-added customs)
        await pool.query(`
          CREATE TABLE IF NOT EXISTS pr_outlets (
            id VARCHAR(50) PRIMARY KEY,
            name VARCHAR(200) NOT NULL,
            url TEXT NOT NULL,
            tier VARCHAR(20),
            beats JSONB,
            notes TEXT,
            created_at TIMESTAMP DEFAULT NOW()
          )
        `);
        
        // Journalists
        await pool.query(`
          CREATE TABLE IF NOT EXISTS pr_journalists (
            id VARCHAR(50) PRIMARY KEY,
            name VARCHAR(200) NOT NULL,
            outlet VARCHAR(200),
            outlet_url TEXT,
            beat VARCHAR(200),
            recent_articles JSONB,
            email VARCHAR(200),
            twitter VARCHAR(200),
            linkedin TEXT,
            notes TEXT,
            last_pitched TIMESTAMP,
            status VARCHAR(20) DEFAULT 'new',
            created_at TIMESTAMP DEFAULT NOW()
          )
        `);
        
        // Pitches
        await pool.query(`
          CREATE TABLE IF NOT EXISTS pr_pitches (
            id VARCHAR(50) PRIMARY KEY,
            journalist_id VARCHAR(50),
            content_id VARCHAR(50),
            content_type VARCHAR(50),
            sent_date TIMESTAMP,
            follow_up_date TIMESTAMP,
            status VARCHAR(20) DEFAULT 'drafted',
            notes TEXT,
            coverage_url TEXT,
            created_at TIMESTAMP DEFAULT NOW()
          )
        `);
        
        // Calendar items
        await pool.query(`
          CREATE TABLE IF NOT EXISTS pr_calendar (
            id VARCHAR(50) PRIMARY KEY,
            date DATE NOT NULL,
            type VARCHAR(50) NOT NULL,
            title TEXT NOT NULL,
            content_id VARCHAR(50),
            pitch_id VARCHAR(50),
            status VARCHAR(20) DEFAULT 'not_started',
            notes TEXT,
            created_at TIMESTAMP DEFAULT NOW()
          )
        `);
        
        // News hooks cache
        await pool.query(`
          CREATE TABLE IF NOT EXISTS pr_news_hooks (
            id SERIAL PRIMARY KEY,
            headline TEXT NOT NULL,
            outlet VARCHAR(200),
            date DATE,
            url TEXT,
            summary TEXT,
            relevance TEXT,
            angle_title TEXT,
            angle_narrative TEXT,
            content_plan JSONB,
            fetched_at TIMESTAMP DEFAULT NOW()
          )
        `);
        
        // Migration: add angle columns if they don't exist (for existing databases)
        await pool.query(`
          DO $$ BEGIN
            ALTER TABLE pr_news_hooks ADD COLUMN IF NOT EXISTS angle_title TEXT;
            ALTER TABLE pr_news_hooks ADD COLUMN IF NOT EXISTS angle_narrative TEXT;
            ALTER TABLE pr_news_hooks ADD COLUMN IF NOT EXISTS content_plan JSONB;
          END $$;
        `);
        
        // Articles feed
        await pool.query(`
          CREATE TABLE IF NOT EXISTS pr_articles (
            id SERIAL PRIMARY KEY,
            title TEXT NOT NULL,
            outlet TEXT NOT NULL,
            url TEXT NOT NULL,
            summary TEXT,
            published_date TEXT,
            category TEXT,
            fetched_at TIMESTAMP DEFAULT NOW()
          )
        `);
        
        // PR settings (folders, preferences, UI state)
        await pool.query(`
          CREATE TABLE IF NOT EXISTS pr_settings (
            id SERIAL PRIMARY KEY,
            user_id VARCHAR(50) DEFAULT 'default',
            settings JSONB NOT NULL,
            updated_at TIMESTAMP DEFAULT NOW()
          )
        `);

        // Distribution settings (LinkedIn profile info, channel configs)
        await pool.query(`
          CREATE TABLE IF NOT EXISTS pr_distribution_settings (
            id SERIAL PRIMARY KEY,
            user_id VARCHAR(50) DEFAULT 'default',
            settings JSONB NOT NULL,
            updated_at TIMESTAMP DEFAULT NOW()
          )
        `);

        // Scheduled posts
        await pool.query(`
          CREATE TABLE IF NOT EXISTS pr_scheduled_posts (
            id VARCHAR(50) PRIMARY KEY,
            output_id VARCHAR(50) NOT NULL,
            channel VARCHAR(50) NOT NULL,
            scheduled_at TIMESTAMP NOT NULL,
            status VARCHAR(20) DEFAULT 'pending',
            published_at TIMESTAMP,
            created_at TIMESTAMP DEFAULT NOW()
          )
        `);

        // LinkedIn OAuth tokens
        await pool.query(`
          CREATE TABLE IF NOT EXISTS linkedin_tokens (
            id VARCHAR(50) PRIMARY KEY DEFAULT 'default',
            access_token TEXT NOT NULL,
            refresh_token TEXT,
            expires_at TIMESTAMP NOT NULL,
            org_id TEXT,
            org_name TEXT,
            created_at TIMESTAMP DEFAULT NOW()
          )
        `);

        // Favorites (news + custom cards)
        await pool.query(`
          CREATE TABLE IF NOT EXISTS pr_favorites (
            item_id TEXT PRIMARY KEY,
            item_type VARCHAR(20) NOT NULL DEFAULT 'news',
            created_at TIMESTAMP DEFAULT NOW()
          )
        `);
      })(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Database init timed out after 8s')), 8000)
      )
    ]);
  } catch (error) {
    console.error('Database init failed, will retry on first request:', error.message);
  }
}

// Middleware
app.use(compression({
  filter: (req, res) => {
    if (res.getHeader('Content-Type') === 'text/event-stream') return false;
    return compression.filter(req, res);
  }
}));
app.use(express.json({ limit: '10mb' }));

// Block sensitive paths from static serving
app.use((req, res, next) => {
  const blocked = ['/server.js', '/package.json', '/package-lock.json', '/railway.json', '/.env', '/.gitignore'];
  const lower = req.path.toLowerCase();
  if (blocked.includes(lower) || lower.startsWith('/data/') || lower.startsWith('/.')) {
    return res.status(404).send('Not found');
  }
  next();
});
app.use(express.static(__dirname));

// Shared content plan rules (single source of truth for all endpoints)
const CONTENT_PLAN_RULES = `CONTENT PLAN RULES:

CONTEXT: Glossi is a seed-stage startup building awareness with builders (devs, designers, PMs) and brand/marketing teams. The content voice is product-led, opinionated, and intentional (think Cursor, Linear, Canva). Never corporate. Never hype. Never generic startup marketing. Every piece should feel like it was worth writing.

ACTIVE CHANNELS: LinkedIn, Twitter/X, company blog, email list, press outreach. Only suggest content for these channels.

VALID CONTENT TYPES: tweet, linkedin_post, blog_post, email_blast, product_announcement, talking_points, investor_snippet

SELECTION HEURISTICS (pick based on article type, not a default template):
- Breaking/time-sensitive news: tweet + email_blast + linkedin_post
- Competitor or market shift: blog_post + tweet + linkedin_post
- Thought leadership / trend piece: blog_post + linkedin_post + tweet
- Product/feature relevance: product_announcement + blog_post + tweet
- Funding/business signal: investor_snippet + linkedin_post + email_blast
- Customer/industry story: blog_post + linkedin_post + email_blast
- Technical deep-dive: blog_post + tweet + talking_points
- "Everyone gets this wrong": tweet + blog_post + linkedin_post

DYNAMIC PLAN SIZE (based on relevance to Glossi):
- High relevance + high urgency: 4-5 content pieces
- Medium relevance: 3-4 content pieces
- Low relevance: 2 content pieces

DIVERSIFICATION: Do NOT default to linkedin_post + email_blast for every article. Look at the batch as a whole. If multiple articles would get the same lead type, vary them. Prioritize the content type that best fits each specific article's angle.

AUDIENCE TAG: Each content piece MUST include an "audience" field with one of: "builders", "brands", "investors", "press", "internal"

TONE FOR DESCRIPTIONS: Write content plan descriptions like a sharp comms lead, not a template. Instead of "Thought leadership post tied to this news" write something like "Founder take: why compositing beats generation for brand teams, told through this news hook." Be specific to the article.`;

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', database: useDatabase });
});

// API settings endpoint - returns API key availability without exposing keys
app.get('/api/settings', (req, res) => {
  res.json({
    hasAnthropicKey: !!process.env.ANTHROPIC_API_KEY,
    hasOpenAIKey: !!process.env.OPENAI_API_KEY,
    hasGeminiKey: !!process.env.GEMINI_API_KEY,
    hasMidjourneyKey: !!process.env.MIDJOURNEY_API_KEY,
    isProduction: useDatabase && process.env.NODE_ENV === 'production'
  });
});

// Proxy endpoint for Anthropic API calls (avoids CORS)
app.post('/api/chat', async (req, res) => {
  const { messages, system, model, max_tokens } = req.body;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      success: false,
      error: 'Anthropic API key not configured in environment variables'
    });
  }

  const maxRetries = 3;
  const retryableStatuses = [429, 502, 503, 529];

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await axios.post('https://api.anthropic.com/v1/messages', {
        model: model || 'claude-opus-4-6',
        max_tokens: max_tokens || 4096,
        system: system || '',
        messages
      }, {
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01'
        },
        timeout: 180000
      });

      return res.json(response.data);
    } catch (error) {
      const status = error.response?.status;
      const isRetryable = retryableStatuses.includes(status) || (!status && error.code === 'ECONNRESET');

      if (isRetryable && attempt < maxRetries) {
        const retryAfter = error.response?.headers?.['retry-after'];
        const delay = retryAfter ? parseInt(retryAfter, 10) * 1000 : Math.min(1000 * Math.pow(2, attempt), 8000);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }

      console.error('Chat API error:', error.response?.data || error.message);
      return res.status(status || 500).json({
        success: false,
        error: error.response?.data?.error?.message || error.message
      });
    }
  }
});

// Streaming proxy for Anthropic API (SSE)
app.post('/api/chat/stream', async (req, res) => {
  const { messages, system, model, max_tokens } = req.body;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ success: false, error: 'Anthropic API key not configured in environment variables' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const maxRetries = 3;
  const retryableStatuses = [429, 502, 503, 529];

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await axios.post('https://api.anthropic.com/v1/messages', {
        model: model || 'claude-opus-4-6',
        max_tokens: max_tokens || 4096,
        system: system || '',
        messages,
        stream: true
      }, {
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01'
        },
        timeout: 180000,
        responseType: 'stream'
      });

      let buffer = '';

      response.data.on('data', (chunk) => {
        buffer += chunk.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const jsonStr = line.slice(6).trim();
            if (!jsonStr) continue;
            try {
              const event = JSON.parse(jsonStr);
              if (event.type === 'content_block_delta' && event.delta?.text) {
                res.write(`data: ${JSON.stringify({ text: event.delta.text })}\n\n`);
              } else if (event.type === 'message_stop') {
                res.write('data: [DONE]\n\n');
              }
            } catch (e) { /* skip unparseable lines */ }
          }
        }
      });

      response.data.on('end', () => {
        if (!res.writableEnded) {
          res.write('data: [DONE]\n\n');
          res.end();
        }
      });

      response.data.on('error', (err) => {
        if (!res.writableEnded) {
          res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
          res.end();
        }
      });

      req.on('close', () => {
        response.data.destroy();
      });

      return;
    } catch (error) {
      const status = error.response?.status;
      const isRetryable = retryableStatuses.includes(status) || (!status && error.code === 'ECONNRESET');

      if (isRetryable && attempt < maxRetries) {
        const retryAfter = error.response?.headers?.['retry-after'];
        const delay = retryAfter ? parseInt(retryAfter, 10) * 1000 : Math.min(1000 * Math.pow(2, attempt), 8000);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }

      if (!res.writableEnded) {
        res.write(`data: ${JSON.stringify({ error: error.response?.data?.error?.message || error.message })}\n\n`);
        res.end();
      }
      return;
    }
  }
});

// Load all data
app.get('/api/data', async (req, res) => {
  try {
    if (!useDatabase) {
      return res.status(503).json({ success: false, error: 'Database not configured' });
    }
    
    const data = {};
    const result = await pool.query('SELECT key, data FROM app_data');
    result.rows.forEach(row => {
      data[row.key] = row.data;
    });
    
    res.json({ success: true, data });
  } catch (error) {
    console.error('Error loading data:', error.message);
    res.status(503).json({ success: false, error: 'Database unavailable' });
  }
});

// Save all data
app.post('/api/data', async (req, res) => {
  try {
    if (!useDatabase) {
      return res.status(503).json({ success: false, error: 'Database not configured' });
    }
    
    const { data, meetings, settings, pipelineHistory, statHistory, todos, teamMembers } = req.body;
    
    const saveData = async (key, value) => {
      if (value === undefined) return;
      await pool.query(`
        INSERT INTO app_data (key, data, updated_at)
        VALUES ($1, $2, NOW())
        ON CONFLICT (key) 
        DO UPDATE SET data = $2, updated_at = NOW()
      `, [key, JSON.stringify(value)]);
    };
    
    await saveData('dashboard_data', data);
    await saveData('meetings', meetings);
    await saveData('settings', settings);
    await saveData('pipeline_history', pipelineHistory);
    await saveData('stat_history', statHistory);
    await saveData('todos', todos);
    await saveData('team_members', teamMembers);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error saving data:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Clear quotes from database
app.post('/api/clear-quotes', async (req, res) => {
  try {
    if (!useDatabase) {
      return res.status(503).json({ success: false, error: 'Database not configured' });
    }
    
    const result = await pool.query("SELECT data FROM app_data WHERE key = 'dashboard_data'");
    if (result.rows.length > 0 && result.rows[0]?.data) {
      const data = result.rows[0].data;
      data.quotes = [];
      
      await pool.query(`
        UPDATE app_data SET data = $1, updated_at = NOW()
        WHERE key = 'dashboard_data'
      `, [JSON.stringify(data)]);
      
      res.json({ success: true, message: 'Quotes cleared' });
    } else {
      res.json({ success: true, message: 'No dashboard data found' });
    }
  } catch (error) {
    console.error('Error clearing quotes:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Reset all data to defaults
app.post('/api/reset', async (req, res) => {
  try {
    const defaultData = {
      company: {
        name: 'Glossi',
        tagline: 'AI-powered visuals. Pixel-perfect products.',
        description: 'Generate unlimited product images and videos without ever compromising your brand.',
        demoUrl: 'https://www.youtube.com/watch?v=kXbQqM35iHA'
      },
      pipeline: { totalValue: '$0', closestToClose: [], inProgress: [], partnerships: [], closed: [], exploring: '' },
      stats: [
        { id: 'pipeline', value: '$0', label: 'Pipeline', note: '' },
        { id: 'prospects', value: '0', label: 'Prospects', note: '' },
        { id: 'partnerships', value: '0', label: 'Partnerships', note: '' },
        { id: 'closed', value: '0', label: 'Closed', note: '$0 revenue' }
      ],
      moat: [],
      talkingPoints: [],
      talkingPointCategories: ['core', 'traction', 'market', 'testimonials'],
      quickLinks: [
        { id: 'website', name: 'Glossi.io', url: 'https://glossi.io', icon: 'globe', color: 'default', emailEnabled: true, emailLabel: 'Website' },
        { id: 'video', name: 'Pitch Video', url: 'https://www.youtube.com/watch?v=kXbQqM35iHA', icon: 'video', color: 'red', emailEnabled: true, emailLabel: 'Pitch Video' },
        { id: 'deck', name: 'Deck', url: 'https://docsend.com/view/sqmwqnjh9zk8pncu', icon: 'document', color: 'blue', emailEnabled: true, emailLabel: 'Deck' },
        { id: 'article', name: 'a16z Article', url: 'https://a16z.com/ai-is-learning-to-build-reality/', icon: 'book', color: 'purple', emailEnabled: true, emailLabel: 'a16z - AI World Models' },
        { id: 'link5', name: 'AI Won\'t Kill 3D', url: 'https://www.linkedin.com/pulse/why-ai-wont-kill-3d-jonathan-gitlin-krhyc/', icon: 'globe', color: 'default', emailEnabled: true, emailLabel: 'AI Won\'t Kill 3D' }
      ],
      thoughts: [],
      quotes: [],
      milestones: [],
      seedRaise: { target: '$500K', investors: [] },
      lastUpdated: new Date().toISOString()
    };

    if (!useDatabase) {
      return res.status(503).json({ success: false, error: 'Database not configured' });
    }
    
    await pool.query(`DELETE FROM app_data WHERE key IN ('dashboard_data', 'meetings', 'pipeline_history', 'stat_history')`);
    await pool.query(`
      INSERT INTO app_data (key, data, updated_at)
      VALUES ('dashboard_data', $1, NOW())
      ON CONFLICT (key) DO UPDATE SET data = $1, updated_at = NOW()
    `, [JSON.stringify(defaultData)]);
    await pool.query(`
      INSERT INTO app_data (key, data, updated_at)
      VALUES ('meetings', $1, NOW())
      ON CONFLICT (key) DO UPDATE SET data = $1, updated_at = NOW()
    `, [JSON.stringify([])]);
    
    res.json({ success: true, message: 'Data reset to defaults' });
  } catch (error) {
    console.error('Error resetting data:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// PR AGENT ENDPOINTS
// ============================================

// Get wizard data
app.get('/api/pr/wizard', async (req, res) => {
  try {
    if (!useDatabase) {
      return res.status(503).json({ success: false, error: 'Database not configured' });
    }
    
    const result = await pool.query('SELECT data FROM pr_wizard ORDER BY id DESC LIMIT 1');
    const wizardData = result.rows.length > 0 ? result.rows[0].data : null;
    
    res.json({ success: true, data: wizardData });
  } catch (error) {
    console.error('Error loading wizard data:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Save wizard data
app.post('/api/pr/wizard', async (req, res) => {
  try {
    const { data } = req.body;
    
    if (!useDatabase) {
      return res.status(503).json({ success: false, error: 'Database not configured' });
    }
    
    // Delete existing and insert new
    await pool.query('DELETE FROM pr_wizard');
    await pool.query('INSERT INTO pr_wizard (data) VALUES ($1)', [JSON.stringify(data)]);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error saving wizard data:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get PR settings
app.get('/api/pr/settings', async (req, res) => {
  try {
    if (!useDatabase) {
      return res.status(503).json({ success: false, error: 'Database not configured' });
    }
    
    const result = await pool.query('SELECT settings FROM pr_settings WHERE user_id = $1 ORDER BY id DESC LIMIT 1', ['default']);
    const settings = result.rows.length > 0 ? result.rows[0].settings : null;
    
    res.json({ success: true, settings });
  } catch (error) {
    console.error('Error loading PR settings:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Save PR settings
app.post('/api/pr/settings', async (req, res) => {
  try {
    const { settings } = req.body;
    
    if (!useDatabase) {
      return res.status(503).json({ success: false, error: 'Database not configured' });
    }
    
    // Delete existing and insert new for this user
    await pool.query('DELETE FROM pr_settings WHERE user_id = $1', ['default']);
    await pool.query('INSERT INTO pr_settings (user_id, settings, updated_at) VALUES ($1, $2, NOW())', ['default', JSON.stringify(settings)]);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error saving PR settings:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get all sources
app.get('/api/pr/sources', async (req, res) => {
  try {
    if (!useDatabase) {
      return res.status(503).json({ success: false, error: 'Database not configured' });
    }
    
    const result = await pool.query('SELECT * FROM pr_sources ORDER BY created_at DESC');
    res.json({ success: true, sources: result.rows });
  } catch (error) {
    console.error('Error loading sources:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create or update source
app.post('/api/pr/sources', async (req, res) => {
  try {
    const { id, title, type, content, url, file_name, folder, selected } = req.body;
    
    if (!useDatabase) {
      return res.status(503).json({ success: false, error: 'Database not configured' });
    }
    
    await pool.query(`
      INSERT INTO pr_sources (id, title, type, content, url, file_name, folder, selected, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
      ON CONFLICT (id) DO UPDATE SET
        title = $2, type = $3, content = $4, url = $5, file_name = $6, folder = $7, selected = $8
    `, [id, title, type, content, url, file_name, folder, selected !== false]);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error saving source:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete source
app.delete('/api/pr/sources/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!useDatabase) {
      return res.status(503).json({ success: false, error: 'Database not configured' });
    }
    
    await pool.query('DELETE FROM pr_sources WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting source:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get all outputs
app.get('/api/pr/outputs', async (req, res) => {
  try {
    if (!useDatabase) {
      return res.status(503).json({ success: false, error: 'Database not configured' });
    }
    
    const result = await pool.query('SELECT * FROM pr_outputs ORDER BY created_at DESC');
    res.json({ success: true, outputs: result.rows });
  } catch (error) {
    console.error('Error loading outputs:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Save output
app.post('/api/pr/outputs', async (req, res) => {
  try {
    const { id, content_type, title, content, sources, citations, strategy, status, phase, story_key, news_headline, drafts, content_plan_index, media_attachments, hashtags, first_comment, og_data, category, is_custom, angle_title, angle_narrative, published_channel, tweet_url, tweet_id, tweet_ids, published_at, published_snapshot } = req.body;
    
    if (!useDatabase) {
      return res.status(503).json({ success: false, error: 'Database not configured' });
    }
    
    await pool.query(`
      INSERT INTO pr_outputs (id, content_type, title, content, sources, citations, strategy, status, phase, story_key, news_headline, drafts, content_plan_index, media_attachments, hashtags, first_comment, og_data, category, is_custom, angle_title, angle_narrative, published_channel, tweet_url, tweet_id, tweet_ids, published_at, published_snapshot, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, NOW())
      ON CONFLICT (id) DO UPDATE SET
        content_type = $2, title = $3, content = $4, sources = $5, citations = $6, strategy = $7, status = $8, phase = $9,
        story_key = $10, news_headline = $11, drafts = $12, content_plan_index = $13, media_attachments = $14, hashtags = $15, first_comment = $16, og_data = $17, category = $18, is_custom = $19, angle_title = $20, angle_narrative = $21,
        published_channel = $22, tweet_url = $23, tweet_id = $24, tweet_ids = $25, published_at = $26, published_snapshot = $27
    `, [id, content_type, title, content, JSON.stringify(sources), JSON.stringify(citations), JSON.stringify(strategy), status, phase || 'edit', story_key || null, news_headline || null, JSON.stringify(drafts || null), content_plan_index != null ? content_plan_index : null, JSON.stringify(media_attachments || null), JSON.stringify(hashtags || null), first_comment || null, JSON.stringify(og_data || null), category || null, is_custom === true, angle_title || null, angle_narrative || null, published_channel || null, tweet_url || null, tweet_id || null, JSON.stringify(tweet_ids || null), published_at || null, JSON.stringify(published_snapshot || null)]);
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete output
app.delete('/api/pr/outputs/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!useDatabase) {
      return res.status(503).json({ success: false, error: 'Database not configured' });
    }
    
    await pool.query('DELETE FROM pr_outputs WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting output:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete all outputs for a story_key
app.delete('/api/pr/outputs/story/:storyKey', async (req, res) => {
  try {
    const { storyKey } = req.params;
    
    if (!useDatabase) {
      return res.status(503).json({ success: false, error: 'Database not configured' });
    }
    
    await pool.query('DELETE FROM pr_outputs WHERE story_key = $1', [storyKey]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Archive/unarchive outputs by story_key (single or bulk)
app.patch('/api/pr/outputs/archive', async (req, res) => {
  try {
    const { story_key, story_keys, archived } = req.body;
    
    if (!useDatabase) {
      return res.status(503).json({ success: false, error: 'Database not configured' });
    }

    const keys = story_keys || (story_key ? [story_key] : []);
    if (keys.length === 0) {
      return res.status(400).json({ success: false, error: 'No story keys provided' });
    }

    const placeholders = keys.map((_, i) => `$${i + 2}`).join(', ');
    await pool.query(
      `UPDATE pr_outputs SET archived = $1 WHERE story_key IN (${placeholders})`,
      [archived !== false, ...keys]
    );

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get all journalists
app.get('/api/pr/journalists', async (req, res) => {
  try {
    if (!useDatabase) {
      return res.status(503).json({ success: false, error: 'Database not configured' });
    }
    
    const result = await pool.query('SELECT * FROM pr_journalists ORDER BY created_at DESC');
    res.json({ success: true, journalists: result.rows });
  } catch (error) {
    console.error('Error loading journalists:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create or update journalist
app.post('/api/pr/journalists', async (req, res) => {
  try {
    const { id, name, outlet, outlet_url, beat, recent_articles, email, twitter, linkedin, notes, last_pitched, status } = req.body;
    
    if (!useDatabase) {
      return res.status(503).json({ success: false, error: 'Database not configured' });
    }
    
    await pool.query(`
      INSERT INTO pr_journalists (id, name, outlet, outlet_url, beat, recent_articles, email, twitter, linkedin, notes, last_pitched, status, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())
      ON CONFLICT (id) DO UPDATE SET
        name = $2, outlet = $3, outlet_url = $4, beat = $5, recent_articles = $6, email = $7, twitter = $8, linkedin = $9, notes = $10, last_pitched = $11, status = $12
    `, [id, name, outlet, outlet_url, beat, JSON.stringify(recent_articles), email, twitter, linkedin, notes, last_pitched, status || 'new']);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error saving journalist:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete journalist
app.delete('/api/pr/journalists/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!useDatabase) {
      return res.status(503).json({ success: false, error: 'Database not configured' });
    }
    
    await pool.query('DELETE FROM pr_journalists WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting journalist:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Discover journalists (Claude web search)
app.post('/api/pr/discover-journalists', async (req, res) => {
  try {
    const { outletName, outletUrl } = req.body;
    const apiKey = process.env.ANTHROPIC_API_KEY;
    
    if (!apiKey) {
      return res.status(500).json({ success: false, error: 'Anthropic API key not configured in environment variables' });
    }
    
    // Phase 1: Find articles and journalists
    const articlesPrompt = `Search for recent articles on ${outletUrl} about AI product visualization, 3D rendering, brand technology, or creative AI tools.

For each article found, extract:
- Article title
- Author name
- Publication date
- Article URL
- One-sentence summary of the article's angle

Return as structured JSON with this exact format:
{
  "articles": [
    {
      "title": "Article title",
      "author": "Author name",
      "date": "2024-01-15",
      "url": "https://...",
      "summary": "One sentence summary"
    }
  ]
}

Find up to 10 recent, relevant articles.`;

    const articlesResponse = await axios.post('https://api.anthropic.com/v1/messages', {
      model: 'claude-opus-4-6',
      max_tokens: 4096,
      system: 'You are a research assistant. Always return valid JSON.',
      messages: [{ role: 'user', content: articlesPrompt }]
    }, {
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      }
    });
    
    const articlesText = articlesResponse.data.content?.[0]?.text || '{}';
    let articlesData;
    try {
      const jsonMatch = articlesText.match(/\{[\s\S]*\}/);
      articlesData = jsonMatch ? JSON.parse(jsonMatch[0]) : { articles: [] };
    } catch {
      articlesData = { articles: [] };
    }
    
    // Group articles by author
    const journalistMap = {};
    (articlesData.articles || []).forEach(article => {
      if (!article.author || article.author === 'Unknown') return;
      
      if (!journalistMap[article.author]) {
        journalistMap[article.author] = {
          name: article.author,
          outlet: outletName,
          outletUrl: outletUrl,
          articles: []
        };
      }
      
      journalistMap[article.author].articles.push({
        title: article.title,
        url: article.url,
        date: article.date,
        summary: article.summary
      });
    });
    
    const journalists = Object.values(journalistMap).slice(0, 10);
    
    // Phase 2: Find contact info for each journalist (async)
    const contactPromises = journalists.map(async (journalist) => {
      try {
        const contactPrompt = `Find contact information for ${journalist.name} at ${outletName}:
- Email address (professional email if available)
- Twitter/X handle (just the handle, no @ symbol)
- LinkedIn profile URL

Search their recent articles, author pages, and social profiles.
Return as structured JSON with this exact format:
{
  "email": "email@domain.com or null",
  "twitter": "handle or null",
  "linkedin": "https://linkedin.com/in/... or null"
}`;

        const contactResponse = await axios.post('https://api.anthropic.com/v1/messages', {
          model: 'claude-opus-4-6',
          max_tokens: 1024,
          system: 'You are a research assistant. Always return valid JSON. Only return verified contact information.',
          messages: [{ role: 'user', content: contactPrompt }]
        }, {
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01'
          }
        });
        
        const contactText = contactResponse.data.content?.[0]?.text || '{}';
        let contactData;
        try {
          const jsonMatch = contactText.match(/\{[\s\S]*\}/);
          contactData = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
        } catch {
          contactData = {};
        }
        
        return {
          ...journalist,
          email: contactData.email || null,
          twitter: contactData.twitter || null,
          linkedin: contactData.linkedin || null,
          contactFound: !!(contactData.email || contactData.twitter || contactData.linkedin)
        };
      } catch (error) {
        console.error(`Error finding contact for ${journalist.name}:`, error.message);
        return {
          ...journalist,
          email: null,
          twitter: null,
          linkedin: null,
          contactFound: false
        };
      }
    });
    
    const journalistsWithContact = await Promise.all(contactPromises);
    
    res.json({ success: true, journalists: journalistsWithContact });
  } catch (error) {
    console.error('Error discovering journalists:', error);
    res.status(500).json({ success: false, error: error.response?.data?.error?.message || error.message });
  }
});

// Get all pitches
app.get('/api/pr/pitches', async (req, res) => {
  try {
    if (!useDatabase) {
      return res.status(503).json({ success: false, error: 'Database not configured' });
    }
    
    const result = await pool.query('SELECT * FROM pr_pitches ORDER BY created_at DESC');
    res.json({ success: true, pitches: result.rows });
  } catch (error) {
    console.error('Error loading pitches:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create or update pitch
app.post('/api/pr/pitches', async (req, res) => {
  try {
    const { id, journalist_id, content_id, content_type, sent_date, follow_up_date, status, notes, coverage_url } = req.body;
    
    if (!useDatabase) {
      return res.status(503).json({ success: false, error: 'Database not configured' });
    }
    
    await pool.query(`
      INSERT INTO pr_pitches (id, journalist_id, content_id, content_type, sent_date, follow_up_date, status, notes, coverage_url, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
      ON CONFLICT (id) DO UPDATE SET
        journalist_id = $2, content_id = $3, content_type = $4, sent_date = $5, follow_up_date = $6, status = $7, notes = $8, coverage_url = $9
    `, [id, journalist_id, content_id, content_type, sent_date, follow_up_date, status || 'drafted', notes, coverage_url]);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error saving pitch:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get calendar items
app.get('/api/pr/calendar', async (req, res) => {
  try {
    if (!useDatabase) {
      return res.status(503).json({ success: false, error: 'Database not configured' });
    }
    
    const result = await pool.query('SELECT * FROM pr_calendar ORDER BY date ASC');
    res.json({ success: true, items: result.rows });
  } catch (error) {
    console.error('Error loading calendar:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create or update calendar item
app.post('/api/pr/calendar', async (req, res) => {
  try {
    const { id, date, type, title, content_id, pitch_id, status, notes } = req.body;
    
    if (!useDatabase) {
      return res.status(503).json({ success: false, error: 'Database not configured' });
    }
    
    await pool.query(`
      INSERT INTO pr_calendar (id, date, type, title, content_id, pitch_id, status, notes, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
      ON CONFLICT (id) DO UPDATE SET
        date = $2, type = $3, title = $4, content_id = $5, pitch_id = $6, status = $7, notes = $8
    `, [id, date, type, title, content_id, pitch_id, status || 'not_started', notes]);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error saving calendar item:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete calendar item
app.delete('/api/pr/calendar/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!useDatabase) {
      return res.status(503).json({ success: false, error: 'Database not configured' });
    }
    
    await pool.query('DELETE FROM pr_calendar WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting calendar item:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Refresh news hooks (Tavily search + Claude analysis)
app.post('/api/pr/news-hooks', async (req, res) => {
  try {
    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    
    if (!anthropicKey) {
      return res.status(500).json({ success: false, error: 'Anthropic API key not configured in environment variables' });
    }
    
    // Clean up old news hooks before fetching new ones (by article date)
    if (useDatabase) {
      try {
        await pool.query(`
          DELETE FROM pr_news_hooks 
          WHERE date < NOW() - INTERVAL '30 days'
        `);
      } catch (cleanupError) {
        console.error('Error cleaning up old news:', cleanupError);
      }
    }
    
    const today = new Date().toISOString().split('T')[0];
    const sixtyDaysAgo = Date.now() - (60 * 24 * 60 * 60 * 1000);
    
    // Initialize RSS parser
    const parser = new Parser({
      timeout: 10000,
      headers: {'User-Agent': 'Glossi News Fetcher/1.0'}
    });
    
    // Step 1: Fetch RSS feeds from outlets
    console.log('Fetching RSS feeds from outlets...');
    
    const RSS_FEEDS = {
      'techcrunch.com': 'https://techcrunch.com/feed/',
      'www.theverge.com': 'https://www.theverge.com/rss/index.xml',
      'www.wired.com': 'https://www.wired.com/feed/rss',
      'arstechnica.com': 'https://feeds.arstechnica.com/arstechnica/index',
      'www.technologyreview.com': 'https://www.technologyreview.com/feed/',
      'venturebeat.com': 'http://feeds.venturebeat.com/VentureBeat',
      'www.forbes.com': 'https://www.forbes.com/innovation/feed2/',
      'www.cnbc.com': 'https://www.cnbc.com/id/19854910/device/rss/rss.html',
      'www.businessinsider.com': 'https://www.businessinsider.com/rss',
      'www.reuters.com': 'https://www.reuters.com/technology',
      'www.fastcompany.com': 'https://www.fastcompany.com/technology/rss',
      'www.bloomberg.com': 'https://feeds.bloomberg.com/technology/news.rss',
      'www.theinterline.com': 'https://www.theinterline.com/feed/'
    };
    
    let allArticles = [];
    
    // Fetch each RSS feed in parallel for speed
    const feedPromises = Object.entries(RSS_FEEDS).map(async ([domain, feedUrl]) => {
      try {
        const feed = await parser.parseURL(feedUrl);
        
        // Filter for articles from last 60 days
        const recentArticles = (feed.items || [])
          .filter(item => {
            const pubDate = new Date(item.pubDate || item.isoDate || Date.now());
            return pubDate.getTime() > sixtyDaysAgo;
          })
          .slice(0, 10)  // Top 10 per outlet
          .map(item => ({
            title: item.title,
            url: item.link,
            content: item.contentSnippet || item.summary || item.content || '',
            publishedDate: item.pubDate || item.isoDate,
            domain: domain
          }));
        
        console.log(`${domain}: ${recentArticles.length} articles`);
        return recentArticles;
        
      } catch (error) {
        console.log(`${domain}: ✗ ${error.message}`);
        return [];
      }
    });
    
    const results = await Promise.all(feedPromises);
    allArticles = results.flat();
    
    console.log(`RSS total: ${allArticles.length} articles from ${Object.keys(RSS_FEEDS).length} feeds`);
    
    // Remove duplicates by URL
    const uniqueResults = Array.from(new Map(allArticles.map(item => [item.url, item])).values());
    console.log(`After dedup: ${uniqueResults.length} unique articles`);
    
    // Log outlet breakdown
    const outletCounts = {};
    uniqueResults.forEach(item => {
      const domain = item.domain || 'Unknown';
      outletCounts[domain] = (outletCounts[domain] || 0) + 1;
    });
    console.log('Outlets found:', outletCounts);
    
    if (uniqueResults.length === 0) {
      console.log('⚠️  Warning: No articles found in RSS feeds');
      return res.status(503).json({ success: false, error: 'Database not configured' });
    }
    
    // Step 2: Diversify article selection across outlets
    const articlesByOutlet = {};
    uniqueResults.forEach(article => {
      const outlet = article.domain;
      if (!articlesByOutlet[outlet]) articlesByOutlet[outlet] = [];
      articlesByOutlet[outlet].push(article);
    });
    
    // Take 3 articles from each outlet for diversity
    const articlesToAnalyze = [];
    Object.values(articlesByOutlet).forEach(outletArticles => {
      articlesToAnalyze.push(...outletArticles.slice(0, 3));
    });
    
    // Limit to 30 total articles (Haiku 4.5 is fast enough)
    const finalArticles = articlesToAnalyze.slice(0, 30);
    console.log(`Sending ${finalArticles.length} articles from ${Object.keys(articlesByOutlet).length} outlets to Claude for analysis`);
    
    // Fetch talking points for strategic context
    let talkingPointsContext = '';
    if (useDatabase) {
      try {
        const dashResult = await pool.query("SELECT data FROM app_data WHERE key = 'dashboard_data'");
        if (dashResult.rows.length > 0 && dashResult.rows[0]?.data) {
          const dashData = typeof dashResult.rows[0].data === 'string' ? JSON.parse(dashResult.rows[0].data) : dashResult.rows[0].data;
          if (dashData.talkingPoints && dashData.talkingPoints.length > 0) {
            const grouped = {};
            dashData.talkingPoints.forEach(tp => {
              const cat = tp.category || 'general';
              if (!grouped[cat]) grouped[cat] = [];
              grouped[cat].push(tp.title + (tp.content ? ': ' + tp.content : ''));
            });
            talkingPointsContext = '\nCOMPANY TALKING POINTS (use these to shape content angles):\n' +
              Object.entries(grouped).map(([cat, points]) =>
                `${cat.toUpperCase()}:\n${points.map(p => '- ' + p).join('\n')}`
              ).join('\n') +
              '\nFavor content types that let these messages land naturally. If a talking point is relevant to the article, choose content formats that carry that argument well (op-ed, blog post) over surface-level formats.\n';
          }
        }
      } catch (tpError) {
        console.error('Error fetching talking points for context:', tpError.message);
      }
    }

    const analysisPrompt = `You are curating strategic news for Glossi, an AI-powered 3D product visualization platform.

GLOSSI'S MARKET:
- Product: AI + 3D engine that creates unlimited product photos (eliminates photoshoots)
- Customers: Enterprise brands (CPG, fashion, beauty, e-commerce)
- Buyers: CMOs, creative directors, e-commerce directors
- Use case: Product marketing, e-commerce catalogs, social media content
${talkingPointsContext}
INCLUDE ARTICLES ABOUT:

**CORE TOPICS (HIGHEST PRIORITY - aim for 8-10 articles from these):**
1. **AI creative/marketing tools** - Midjourney, Adobe Firefly, Canva AI, design automation, AI content generation
2. **E-commerce platforms & tech** - Shopify, Amazon, 3D/AR product views, visual commerce innovations
3. **Creative automation platforms** - Workflow tools, brand asset management, DAM/CMS systems
4. **AI image generation** - Midjourney, DALL-E, Stable Diffusion for commercial use

**SUPPORTING TOPICS (fill remaining 4-8 slots from these):**

Adjacent Tech:
5. **3D engines for commerce** - Unreal Engine, Unity applied to product visualization, browser 3D tech
6. **Digital twins & virtual showrooms** - Virtual product experiences, immersive brand environments
7. **Brand AI workflow implementation** - How companies deploy AI in creative/marketing operations

Customer Industries:
8. **DTC brand strategies** - Direct-to-consumer challenges, content production at scale, omnichannel
9. **Retail digital transformation** - Store tech, online merchandising, customer experience innovation
10. **Fashion tech** - Digital fashion, virtual samples, sustainability in fashion production

Buyer Insights:
11. **Creative operations** - Production workflows, bottlenecks, efficiency improvements
12. **Marketing tech stack** - Tool consolidation, integration trends, martech evolution
13. **Agency vs in-house** - Production model shifts, hybrid approaches

Market Signals:
14. **Funding/M&A in creative/martech** - Who's raising, acquisitions, market consolidation
15. **Pricing model evolution** - Consumption-based pricing, credit systems, enterprise deals
16. **Platform partnerships** - Shopify apps, marketplace integrations, ecosystem plays

STRONG EXCLUDE:
- Autonomous vehicles, robotics, IoT, drones
- Gaming (unless specifically about engines for product visualization)
- Celebrity profiles, entertainment IP, movies/TV
- Cybersecurity, developer tools (unless creative workflow related)
- Healthcare, biotech, fintech, crypto
- Manufacturing, supply chain, logistics (unless about product content)
- Hardware/chips (unless about rendering/AI acceleration)
- Space tech, infrastructure
- Generic AI research without clear business application
- Politics, policy, tariffs (unless directly impacting e-commerce/DTC brands)

TASK: Return ONLY 12-18 articles with direct relevance to Glossi's market. Be ruthlessly selective.

ARTICLES:
${finalArticles.map((article, i) => `
${i + 1}. TITLE: ${article.title}
   SOURCE: ${article.domain}
   DATE: ${article.publishedDate || 'Recent'}
   SNIPPET: ${article.content?.substring(0, 300) || 'No preview'}
`).join('\n')}

Return articles in this JSON format:
{
  "news": [
    {
      "headline": "Original article title",
      "outlet": "Source domain (use the raw domain from SOURCE field)",
      "date": "YYYY-MM-DD format",
      "url": "Original URL",
      "summary": "One sentence summary of the article",
      "relevance": "Topic #X: [explain connection]",
      "angle_title": "Short story angle name (3-6 words, e.g. 'AI Photography Goes Enterprise')",
      "angle_narrative": "1-2 sentences explaining the story angle AND how it connects to Glossi. Weave in the Glossi tie-in naturally, not as a separate thought. Example: 'As enterprise brands scramble to adopt AI for product content, Glossi's compositing-first approach solves the brand consistency problem that pure generation tools cannot.'",
      "content_plan": [
        {"type": "tweet", "description": "Quick reaction: what this means for product teams still relying on photoshoots", "priority": 1, "audience": "builders"},
        {"type": "blog_post", "description": "Deep dive on why compositing-first matters more after this news", "priority": 2, "audience": "brands"},
        {"type": "email_blast", "description": "Signal boost to subscriber list with the key insight", "priority": 3, "audience": "brands"}
      ]
    }
  ]
}

${CONTENT_PLAN_RULES}

CRITICAL: Only include articles you're recommending. Do NOT include articles with "EXCLUDED" or "Not relevant" in the relevance field. If you think an article should be excluded, simply don't add it to the JSON array.

Rules:
- CRITICAL: Return ONLY 5-10 EXCELLENT articles (quality over quantity)
- STRICT STANDARD: Every article must have DIRECT, OBVIOUS connection to Glossi's market
- Focus heavily on Core Topics (1-4) - these are the best articles
- Only include Supporting Topics (5-16) if they're exceptional

INCLUDE (specific examples):
✅ "Adobe launches Firefly Image 5" - Topic 1, direct competitor
✅ "Shopify adds 3D product viewer" - Topic 2, exact same use case
✅ "Canva raises AI tool pricing for enterprise" - Topic 1, market validation
✅ "Midjourney introduces business tier" - Topic 4, commercial AI generation
✅ "Instagram adds AR try-on for products" - Topic 2, visual commerce
✅ "Meta launches 3D ads for e-commerce" - Topic 2, direct market move

EXCLUDE (specific examples):
❌ "Anthropic CEO talks about AI adoption" - Too generic, not about creative tools
❌ "OpenAI launches coding chips" - Developer tools, not creative/marketing
❌ "Trade deal impacts tariffs" - Macro policy, too distant
❌ "Brand cancels partnership" - Corporate drama, not tech
❌ "Indian Hotels CEO outlook" - Not tech, not relevant
❌ "AI agent behavior study" - Research, not business application

- Remove duplicates (same story = pick best outlet)
- In 'relevance': state topic # and be brutally honest about connection quality
- Sort: Core topics (1-4) first, recency second
- If fewer than 5 articles meet standard, that's OK - quality over quantity
- Use exact domain from SOURCE field for outlet name`;

    const analysisResponse = await axios.post('https://api.anthropic.com/v1/messages', {
      model: 'claude-haiku-4-5',
      max_tokens: 8192,
      system: 'You are a strategic communications analyst. Return only valid JSON.',
      messages: [{ role: 'user', content: analysisPrompt }]
    }, {
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01'
      }
    });
    
    const analysisText = analysisResponse.data.content?.[0]?.text || '{}';
    console.log('Claude analysis complete');
    
    let newsData;
    try {
      // Remove markdown code fences if present
      let cleanedText = analysisText.trim();
      cleanedText = cleanedText.replace(/^```json\s*/i, '').replace(/\s*```$/i, '');
      
      const jsonMatch = cleanedText.match(/\{[\s\S]*\}/);
      newsData = jsonMatch ? JSON.parse(jsonMatch[0]) : { news: [] };
      console.log(`Claude returned ${newsData.news?.length || 0} articles`);
      
      if ((newsData.news?.length || 0) === 0 && uniqueResults.length > 0) {
        console.log(`⚠️  Warning: Claude filtered out all ${uniqueResults.length} articles from Tavily`);
        console.log('   Claude may be filtering too aggressively despite "inclusive" instructions');
      }
    } catch (error) {
      console.error('Failed to parse Claude analysis:', error);
      console.error('Claude raw response:', analysisText.substring(0, 500));
      newsData = { news: [] };
    }
    
    // Normalize dates, outlet names, and validate
    const normalizedNews = (newsData.news || []).map(item => {
      // Normalize outlet name using shared function
      item.outlet = normalizeOutletName(item.outlet);
      let articleDate = item.date;
      
      // Try to parse various date formats
      if (!articleDate || articleDate === 'Recent') {
        articleDate = today;
      } else if (!/^\d{4}-\d{2}-\d{2}$/.test(articleDate)) {
        // Try to parse and reformat
        try {
          const parsed = new Date(articleDate);
          if (!isNaN(parsed.getTime())) {
            articleDate = parsed.toISOString().split('T')[0];
          } else {
            articleDate = today;
          }
        } catch {
          articleDate = today;
        }
      }
      
      return {
        ...item,
        date: articleDate
      };
    });
    
    if (useDatabase) {
      // Accumulate articles: only insert new ones, skip duplicates (match by URL or headline)
      // Old articles are cleaned up by the 30-day retention policy on the GET endpoint
      let insertedCount = 0;
      let skippedCount = 0;
      
      for (const item of normalizedNews) {
        try {
          // Check for existing article by URL or headline
          const existing = await pool.query(
            `SELECT id FROM pr_news_hooks WHERE url = $1 OR headline = $2 LIMIT 1`,
            [item.url || '', item.headline || '']
          );
          
          if (existing.rows.length > 0) {
            skippedCount++;
            continue;
          }
          
          await pool.query(`
            INSERT INTO pr_news_hooks (headline, outlet, date, url, summary, relevance, angle_title, angle_narrative, content_plan, fetched_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
          `, [
            item.headline || 'No title',
            item.outlet || 'Unknown',
            item.date,
            item.url || '',
            item.summary || '',
            item.relevance || '',
            item.angle_title || '',
            item.angle_narrative || '',
            item.content_plan ? JSON.stringify(item.content_plan) : null
          ]);
          insertedCount++;
        } catch (error) {
          console.error('Error inserting article:', error.message, item.headline);
        }
      }
      
      if (skippedCount > 0) {
        console.log(`Skipped ${skippedCount} duplicate articles`);
      }
      
      console.log(`Inserted ${insertedCount} new, skipped ${skippedCount} duplicates out of ${normalizedNews.length} analyzed`);
      
      // Return ALL articles from DB (accumulated, not just new ones), excluding irrelevant
      const allNews = await pool.query(`
        SELECT * FROM pr_news_hooks 
        WHERE date > NOW() - INTERVAL '30 days'
          AND (relevance IS NULL OR (relevance NOT ILIKE '%EXCLUDED%' AND relevance NOT ILIKE '%Not relevant%'))
        ORDER BY date DESC, fetched_at DESC
      `);
      
      const allNormalized = allNews.rows.map(item => ({
        ...item,
        outlet: normalizeOutletName(item.outlet)
      }));
      
      console.log(`Returning ${allNormalized.length} total articles (${insertedCount} new)`);
      res.json({ success: true, news: allNormalized, newCount: insertedCount });
    } else {
      // No database, return just the fetched news
      res.json({ success: true, news: normalizedNews });
    }
    
    // Log final outlet distribution
    const finalOutletCounts = {};
    normalizedNews.forEach(item => {
      finalOutletCounts[item.outlet] = (finalOutletCounts[item.outlet] || 0) + 1;
    });
    console.log(`Analyzed ${normalizedNews.length} articles by outlet:`, JSON.stringify(finalOutletCounts, null, 2));
  } catch (error) {
    console.error('❌ Error fetching news hooks:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ 
      success: false, 
      error: error.response?.data?.error?.message || error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Get cached news hooks
app.get('/api/pr/news-hooks', async (req, res) => {
  try {
    if (!useDatabase) {
      return res.status(503).json({ success: false, error: 'Database not configured' });
    }
    
    // Only return news from the last 30 days, excluding irrelevant articles
    const result = await pool.query(`
      SELECT * FROM pr_news_hooks 
      WHERE date > NOW() - INTERVAL '30 days'
        AND (relevance IS NULL OR (relevance NOT ILIKE '%EXCLUDED%' AND relevance NOT ILIKE '%Not relevant%'))
      ORDER BY date DESC, fetched_at DESC
    `);
    
    // Normalize outlet names on read (handles old cached data with raw domains)
    const normalizedNews = result.rows.map(item => ({
      ...item,
      outlet: normalizeOutletName(item.outlet)
    }));
    
    res.json({ success: true, news: normalizedNews });
  } catch (error) {
    console.error('Error loading news hooks:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete excluded/irrelevant articles from the database
app.delete('/api/pr/news-hooks/excluded', async (req, res) => {
  try {
    if (!useDatabase) {
      return res.status(503).json({ success: false, error: 'Database not configured' });
    }
    
    const result = await pool.query(`
      DELETE FROM pr_news_hooks 
      WHERE relevance ILIKE '%EXCLUDED%' OR relevance ILIKE '%Not relevant%'
    `);
    
    res.json({ success: true, deleted: result.rowCount });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Regenerate content plans for existing articles
app.post('/api/pr/regenerate-plans', async (req, res) => {
  try {
    const { articles } = req.body;
    if (!articles || !Array.isArray(articles) || articles.length === 0) {
      return res.status(400).json({ success: false, error: 'articles array is required' });
    }

    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    if (!anthropicKey) {
      return res.status(500).json({ success: false, error: 'Anthropic API key not configured' });
    }

    const articlesList = articles.map((a, i) => `
${i + 1}. HEADLINE: ${a.headline}
   OUTLET: ${a.outlet}
   DATE: ${a.date || 'Recent'}
   SUMMARY: ${a.summary || ''}
   URL: ${a.url || ''}
`).join('\n');

    const prompt = `You are a PR strategist for Glossi, a seed-stage startup building AI-powered product photography tools. Given these news articles, generate a fresh content plan for EACH article.

ARTICLES:
${articlesList}

For each article, return a content_plan array with the right mix of content types. Most articles should have 3-5 content pieces.

Return JSON:
{
  "plans": [
    {
      "url": "the article URL",
      "angle_title": "Short story angle name (3-6 words, e.g. 'AI Photography Goes Enterprise')",
      "angle_narrative": "1-2 sentences explaining the story angle AND how it connects to Glossi. Weave in the Glossi tie-in naturally.",
      "content_plan": [
        {"type": "tweet", "description": "Quick reaction: what this means for product teams still relying on photoshoots", "priority": 1, "audience": "builders"},
        {"type": "blog_post", "description": "Deep dive on why compositing-first matters more after this news", "priority": 2, "audience": "brands"},
        {"type": "email_blast", "description": "Signal boost to subscriber list with the key insight", "priority": 3, "audience": "brands"}
      ]
    }
  ]
}

${CONTENT_PLAN_RULES}`;

    const response = await axios.post('https://api.anthropic.com/v1/messages', {
      model: 'claude-haiku-4-5',
      max_tokens: 8192,
      system: 'You are a strategic PR content planner. Always return valid JSON.',
      messages: [{ role: 'user', content: prompt }]
    }, {
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01'
      },
      timeout: 60000
    });

    const text = response.data?.content?.[0]?.text || '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return res.json({ success: false, error: 'AI response did not contain valid JSON' });
    }

    let parsed;
    try {
      parsed = JSON.parse(jsonMatch[0]);
    } catch (parseErr) {
      return res.json({ success: false, error: 'Failed to parse AI JSON response' });
    }
    const plans = parsed.plans || [];

    if (useDatabase && plans.length > 0) {
      for (const plan of plans) {
        if (!plan.url) continue;
        try {
          await pool.query(
            `UPDATE pr_news_hooks SET content_plan = $1, angle_title = $2, angle_narrative = $3 WHERE url = $4`,
            [JSON.stringify(plan.content_plan), plan.angle_title || null, plan.angle_narrative || null, plan.url]
          );
        } catch (dbErr) {
          // Continue even if individual update fails
        }
      }
    }

    res.json({ success: true, plans });
  } catch (error) {
    const msg = error.response?.data?.error?.message || error.message;
    res.status(500).json({ success: false, error: msg });
  }
});

// Delete old news hooks (cleanup endpoint)
app.delete('/api/pr/news-hooks/old', async (req, res) => {
  try {
    if (!useDatabase) {
      return res.status(503).json({ success: false, error: 'Database not configured' });
    }
    
    // Delete news older than 30 days (by article date)
    const result = await pool.query(`
      DELETE FROM pr_news_hooks 
      WHERE date < NOW() - INTERVAL '30 days'
    `);
    res.json({ success: true, deleted: result.rowCount });
  } catch (error) {
    console.error('Error deleting old news hooks:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Analyze a single article URL - fetch content, analyze with Claude, store as news hook
app.post('/api/pr/analyze-url', async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) {
      return res.status(400).json({ success: false, error: 'No URL provided' });
    }
    if (!isAllowedUrl(url)) {
      return res.status(400).json({ success: false, error: 'Invalid or blocked URL' });
    }

    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    if (!anthropicKey) {
      return res.status(500).json({ success: false, error: 'Anthropic API key not configured' });
    }

    // Check for duplicate
    if (useDatabase) {
      const existing = await pool.query('SELECT id FROM pr_news_hooks WHERE url = $1 LIMIT 1', [url]);
      if (existing.rows.length > 0) {
        return res.status(409).json({ success: false, error: 'This article is already in your news feed' });
      }
    }

    // Fetch article content
    const fetchResponse = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      timeout: 30000
    });

    const html = fetchResponse.data;
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const articleTitle = titleMatch ? titleMatch[1].trim() : new URL(url).hostname;

    // Extract text content
    let text = html;
    text = text.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
    text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
    text = text.replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '');
    text = text.replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '');
    text = text.replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '');
    text = text.replace(/<[^>]+>/g, ' ');
    text = text.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');
    text = text.replace(/\s+/g, ' ').trim();
    const articleContent = text.substring(0, 3000);

    // Extract domain for outlet name
    const domain = new URL(url).hostname.replace('www.', '');
    const outlet = normalizeOutletName(domain);

    // Analyze with Claude
    const analysisPrompt = `You are analyzing a single article for Glossi, an AI-powered 3D product visualization platform.

GLOSSI'S MARKET:
- Product: AI + 3D engine that creates unlimited product photos (eliminates photoshoots)
- Customers: Enterprise brands (CPG, fashion, beauty, e-commerce)
- Buyers: CMOs, creative directors, e-commerce directors

ARTICLE:
Title: ${articleTitle}
Source: ${outlet}
URL: ${url}
Content: ${articleContent}

Analyze this article and return a JSON object with:
{
  "headline": "The article's actual headline (clean it up if needed)",
  "summary": "One clear sentence summarizing the article",
  "angle_title": "Short story angle name for Glossi (3-6 words)",
  "angle_narrative": "1-2 sentences explaining the story angle AND how it connects to Glossi. Weave in the Glossi tie-in naturally.",
  "content_plan": [
    {"type": "tweet", "description": "Quick founder reaction: what this signals for AI product photography", "priority": 1, "audience": "builders"},
    {"type": "blog_post", "description": "Bylined take on why this validates compositing over pure generation", "priority": 2, "audience": "brands"},
    {"type": "email_blast", "description": "Key insight distilled for subscriber list", "priority": 3, "audience": "brands"}
  ],
  "relevance": "Topic connection explanation"
}

${CONTENT_PLAN_RULES}

Return ONLY valid JSON.`;

    const analysisResponse = await axios.post('https://api.anthropic.com/v1/messages', {
      model: 'claude-haiku-4-5',
      max_tokens: 2048,
      system: 'You are a strategic communications analyst. Return only valid JSON.',
      messages: [{ role: 'user', content: analysisPrompt }]
    }, {
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01'
      }
    });

    const analysisText = analysisResponse.data.content?.[0]?.text || '{}';
    let analysis;
    try {
      const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
      analysis = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
    } catch {
      analysis = {};
    }

    const today = new Date().toISOString().split('T')[0];
    const newsItem = {
      headline: analysis.headline || articleTitle,
      outlet: outlet,
      date: today,
      url: url,
      summary: analysis.summary || '',
      relevance: analysis.relevance || '',
      angle_title: analysis.angle_title || '',
      angle_narrative: analysis.angle_narrative || '',
      content_plan: analysis.content_plan || []
    };

    // Store in database
    if (useDatabase) {
      await pool.query(`
        INSERT INTO pr_news_hooks (headline, outlet, date, url, summary, relevance, angle_title, angle_narrative, content_plan, fetched_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
      `, [
        newsItem.headline,
        newsItem.outlet,
        newsItem.date,
        newsItem.url,
        newsItem.summary,
        newsItem.relevance,
        newsItem.angle_title,
        newsItem.angle_narrative,
        JSON.stringify(newsItem.content_plan)
      ]);
    }

    res.json({ success: true, article: newsItem });
  } catch (error) {
    console.error('Error analyzing URL:', error.message);
    res.status(500).json({
      success: false,
      error: error.response?.data?.error?.message || error.message || 'Failed to analyze article'
    });
  }
});

app.post('/api/pr/analyze-image', async (req, res) => {
  try {
    const { image, mediaType, fileName } = req.body;
    if (!image) {
      return res.status(400).json({ success: false, error: 'No image data provided' });
    }

    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    if (!anthropicKey) {
      return res.status(500).json({ success: false, error: 'Anthropic API key not configured' });
    }

    const visionPrompt = `Analyze this image thoroughly. Extract ALL text visible in the image (OCR). Then provide a detailed description of what the image contains.

Format your response as:

TITLE: [brief descriptive title, max 8 words]

TEXT CONTENT:
[All text found in the image, preserving structure]

SUMMARY: [1-2 sentence summary]

KEY POINTS:
- [key point 1]
- [key point 2]
- [key point 3 if applicable]`;

    const analysisResponse = await axios.post('https://api.anthropic.com/v1/messages', {
      model: 'claude-haiku-4-5',
      max_tokens: 4096,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: mediaType || 'image/png',
              data: image
            }
          },
          { type: 'text', text: visionPrompt }
        ]
      }]
    }, {
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01'
      }
    });

    const content = analysisResponse.data.content?.[0]?.text || '';
    res.json({ success: true, content, fileName });
  } catch (error) {
    console.error('Error analyzing image:', error.message);
    res.status(500).json({
      success: false,
      error: error.response?.data?.error?.message || error.message || 'Failed to analyze image'
    });
  }
});

// Fetch fresh articles (Claude web search)
app.post('/api/pr/articles', async (req, res) => {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    
    if (!apiKey) {
      return res.status(500).json({ success: false, error: 'Anthropic API key not configured in environment variables' });
    }
    
    const articlesPrompt = `Search major tech publications (TechCrunch, The Verge, Wired, VentureBeat, MIT Technology Review, Ars Technica, Protocol, Fast Company, Business Insider, Forbes Tech, CNBC Tech, Reuters Tech, Bloomberg Technology, TLDR Newsletter) for recent articles from the past 7 days about:

1. Glossi brand mentions or AI product visualization tools
2. AI-powered 3D rendering, product visualization, and e-commerce technology
3. Enterprise creative AI adoption, brand consistency, and marketing technology
4. Computer vision, image generation, and creative AI tools
5. Digital commerce and retail technology

Return the top 8 most relevant articles as JSON:
{
  "articles": [
    {
      "title": "Article headline",
      "outlet": "Publication name",
      "url": "https://...",
      "summary": "One sentence description",
      "published_date": "2026-02-12",
      "category": "brand OR industry OR opportunity"
    }
  ]
}

Categories:
- "brand" = mentions Glossi or similar tools
- "industry" = AI/3D/visualization tech news
- "opportunity" = trending topics Glossi could comment on

Only include articles from major tech publications. Maximum 8 results.`;

    const articlesResponse = await axios.post('https://api.anthropic.com/v1/messages', {
      model: 'claude-opus-4-6',
      max_tokens: 4096,
      system: 'You are a research assistant for Glossi, an AI-native 3D product visualization platform. Always return valid JSON.',
      messages: [{ role: 'user', content: articlesPrompt }]
    }, {
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      }
    });
    
    const articlesText = articlesResponse.data.content?.[0]?.text || '{}';
    let articlesData;
    try {
      const jsonMatch = articlesText.match(/\{[\s\S]*\}/);
      articlesData = jsonMatch ? JSON.parse(jsonMatch[0]) : { articles: [] };
    } catch {
      articlesData = { articles: [] };
    }
    
    if (useDatabase) {
      // Clear old articles and insert new
      await pool.query('DELETE FROM pr_articles');
      
      for (const item of (articlesData.articles || [])) {
        await pool.query(`
          INSERT INTO pr_articles (title, outlet, url, summary, published_date, category, fetched_at)
          VALUES ($1, $2, $3, $4, $5, $6, NOW())
        `, [item.title, item.outlet, item.url, item.summary, item.published_date, item.category]);
      }
    }
    
    res.json({ success: true, articles: articlesData.articles || [] });
  } catch (error) {
    console.error('Error fetching articles:', error);
    res.status(500).json({ success: false, error: error.response?.data?.error?.message || error.message });
  }
});

// Get cached articles
app.get('/api/pr/articles', async (req, res) => {
  try {
    if (!useDatabase) {
      return res.status(503).json({ success: false, error: 'Database not configured' });
    }
    
    const result = await pool.query('SELECT * FROM pr_articles ORDER BY fetched_at DESC LIMIT 5');
    res.json({ success: true, articles: result.rows });
  } catch (error) {
    console.error('Error loading articles:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// MEDIA & OG ENDPOINTS
// ============================================

// Upload image for distribution preview
app.post('/api/pr/upload-media', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }
    const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowed.includes(req.file.mimetype)) {
      return res.status(400).json({ success: false, error: 'Only JPEG, PNG, GIF, and WebP images are supported' });
    }
    const base64 = req.file.buffer.toString('base64');
    const dataUrl = `data:${req.file.mimetype};base64,${base64}`;
    res.json({
      success: true,
      url: dataUrl,
      filename: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// STYLE MOODBOARD
// ============================================

const MOODBOARD_DIR = path.join(__dirname, 'moodboard');

app.get('/api/pr/moodboard', (req, res) => {
  try {
    if (!fs.existsSync(MOODBOARD_DIR)) {
      return res.json({ success: true, images: [] });
    }
    const files = fs.readdirSync(MOODBOARD_DIR)
      .filter(f => /\.(jpe?g|png|gif|webp)$/i.test(f))
      .map(f => {
        const stat = fs.statSync(path.join(MOODBOARD_DIR, f));
        return { filename: f, url: `/moodboard/${f}`, size: stat.size, created: stat.birthtime };
      })
      .sort((a, b) => new Date(b.created) - new Date(a.created));
    res.json({ success: true, images: files });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/pr/moodboard', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }
    const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowed.includes(req.file.mimetype)) {
      return res.status(400).json({ success: false, error: 'Only JPEG, PNG, GIF, and WebP images are supported' });
    }
    if (!fs.existsSync(MOODBOARD_DIR)) fs.mkdirSync(MOODBOARD_DIR, { recursive: true });

    const ext = path.extname(req.file.originalname) || '.png';
    const filename = `mb-${Date.now()}-${crypto.randomUUID().slice(0, 8)}${ext}`;
    const filepath = path.join(MOODBOARD_DIR, filename);
    fs.writeFileSync(filepath, req.file.buffer);

    res.json({
      success: true,
      image: { filename, url: `/moodboard/${filename}`, size: req.file.size }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete('/api/pr/moodboard/:filename', (req, res) => {
  try {
    const filename = req.params.filename.replace(/[^a-zA-Z0-9._-]/g, '');
    const filepath = path.join(MOODBOARD_DIR, filename);
    if (fs.existsSync(filepath)) {
      fs.unlinkSync(filepath);
      res.json({ success: true });
    } else {
      res.status(404).json({ success: false, error: 'Image not found' });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

function getMoodboardImages() {
  if (!fs.existsSync(MOODBOARD_DIR)) return [];
  return fs.readdirSync(MOODBOARD_DIR)
    .filter(f => /\.(jpe?g|png|gif|webp)$/i.test(f))
    .map(f => ({ filename: f, filepath: path.join(MOODBOARD_DIR, f), url: `/moodboard/${f}` }));
}

// Shorten tweet text to fit within character limit
app.post('/api/pr/shorten-tweet', async (req, res) => {
  try {
    const { content, max_chars, tweet_format } = req.body;
    if (!content) {
      return res.status(400).json({ success: false, error: 'content is required' });
    }

    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    if (!anthropicKey) {
      return res.status(503).json({ success: false, error: 'ANTHROPIC_API_KEY not configured' });
    }

    const limit = max_chars || 280;
    const currentLength = content.length;

    const response = await axios.post('https://api.anthropic.com/v1/messages', {
      model: 'claude-haiku-4-5',
      max_tokens: 512,
      system: `You rewrite tweets to fit within a strict character limit. This is a HARD constraint. Your output MUST be ${limit} characters or fewer. Count carefully.

Rules:
- Preserve the single most important insight or claim.
- Cut everything else: parentheticals, secondary examples, filler words, qualifiers.
- Use shorter words. Compress phrasing aggressively.
- The result must be a complete, punchy thought that stands alone.
- Aim for well under the limit (target ~250 chars) to leave margin.
- NEVER use em dashes (\u2014), en dashes (\u2013), or double hyphens (--). Use commas, periods, or semicolons instead.
- Return ONLY the rewritten tweet text. No quotes, no explanation, no preamble, no character count.`,
      messages: [{ role: 'user', content: `This tweet is ${currentLength} characters but must be ${limit} or fewer. That means you need to cut at least ${currentLength - limit} characters. Rewrite it shorter.\n\nTweet: "${content}"` }]
    }, {
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01'
      },
      timeout: 30000
    });

    let shortened = response.data?.content?.[0]?.text?.trim();
    if (!shortened) {
      return res.json({ success: false, error: 'No shortened text generated' });
    }
    shortened = shortened.replace(/\u2014/g, ', ').replace(/\u2013/g, ' to ').replace(/--/g, ', ').replace(/, ,/g, ',').replace(/\s{2,}/g, ' ');

    res.json({ success: true, content: shortened, length: shortened.length });
  } catch (error) {
    const msg = error.response?.data?.error?.message || error.message;
    res.status(500).json({ success: false, error: msg });
  }
});

// Generate visual prompt via Claude (analyzes tweet text, produces optimal Gemini image prompt)
app.post('/api/pr/generate-visual-prompt', async (req, res) => {
  try {
    const { tweet_text, previous_prompt, feedback, reference_image, visual_mode } = req.body;
    if (!tweet_text) {
      return res.status(400).json({ success: false, error: 'tweet_text is required' });
    }

    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    if (!anthropicKey) {
      return res.status(503).json({ success: false, error: 'ANTHROPIC_API_KEY not configured' });
    }

    const mode = visual_mode || 'abstract';

    let systemPrompt = `You are a visual design director who creates image generation prompts for social media visuals. Your prompts will be sent to Gemini's image generation model.

You analyze tweet text and produce the single best image prompt that will create a scroll-stopping visual for X/Twitter.`;

    if (reference_image) {
      systemPrompt += `

REFERENCE IMAGE: A reference image has been provided. Analyze its visual style carefully: color palette, composition, texture, mood, and overall aesthetic. Your prompt MUST reproduce this exact art style. Override the default style rules below with whatever you observe in the reference image. The reference defines the look; the tweet text defines the content.`;
    }

    if (mode === 'chart') {
      systemPrompt += `

VISUAL MODE: CHART / DATA INFOGRAPHIC

ART DIRECTION:
- Dark minimal UI design system. Pure black background #000000.
- Thin white vector line art for axes, gridlines, and labels.
- Monochromatic grayscale palette with a single accent color: warm orange #E8512A.
- Scientific instrument aesthetic, brutalist grid composition, ultra high contrast white on black.

TYPOGRAPHY HIERARCHY (strict rules for maximum glanceability):
People scan, they do not read. Every text element must have a clear, distinct role. Use exactly 3 text sizes.

- LEVEL 1 (Headline): The largest text. Medium weight white (#FFFFFF), top-left aligned, clean sans-serif. 1-2 lines max. Appears exactly once. States the insight.
- LEVEL 2 (Data labels): Clearly smaller than headline. Medium weight, light gray (#999999). Used for chart labels, axis values, category names.
- LEVEL 3 (Supporting): The smallest text. Regular weight, muted gray (#666666). Used for footnotes, source attributions, secondary context.

DATA VISUALIZATION (the core of the infographic):
- Render actual data charts when the content involves numbers, comparisons, trends, or measurements.
- Chart types: vertical bar data visualizations, line charts, scatter plots, area charts.
- Two data colors only: warm orange (#E8512A) for the primary/highlighted series, and medium gray (#666666) for the secondary/comparison series.
- Thin white axis lines. Small, clean axis labels in muted gray.
- No gridlines or minimal dashed gridlines in dark gray. No chart borders. No 3D effects.
- Data points/bars should be clearly readable. Clean spacing between bars.
- Annotate key insights directly on the chart with small callouts in orange or white.
- Crisp anti-aliased vector strokes throughout.

WHEN THERE IS NO CHART DATA:
- If the tweet has no numeric data, create a typographic layout: one large medium-weight stat or pull quote in white, with a small supporting label underneath in gray.
- Keep to 2-3 lines of text maximum. The typography IS the visual.

LAYOUT:
- 1200x675 landscape (16:9). Generous margins on all sides.
- Headline at top-left. Chart/visualization centered below it.
- Small footnote or source at bottom-right if relevant.
- Even 2-column symmetric layouts when multiple data series are compared.
- Deep black void background. Extreme whitespace (dark space). Never crowd the canvas.

ANTI-PATTERNS (never do these):
- No light backgrounds. No cream, white, or gray backgrounds. Background MUST be pure black #000000.
- No gradients except grayscale sphere shading if using abstract elements.
- No borders around the image. No drop shadows. No 3D effects.
- No icons, emoji, logos, or decorative elements.
- No more than 3 colors total (black background, white text, orange+gray for data).
- No complex multi-panel layouts. One chart, one concept.
- No stock photos. No patterns besides data visualization.

MOOD: Technical data dashboard aesthetic, motion graphics still frame, scientific instrument readout. Designed to stop someone mid-scroll because the data is instantly readable against the dark background.`;
    } else {
      systemPrompt += `

VISUAL MODE: ABSTRACT / GENERATIVE ART

ART DIRECTION:
- Dark minimal UI design system. Pure black background #000000.
- Thin white vector line art. Monochromatic grayscale palette with a single accent color: warm orange #E8512A.
- Geometric abstract shapes: spheres with diagonal stripe patterns, wireframe orbs, pixel art icons, topographic contour line landscapes, particle scatter fields, spirograph geometric patterns, lemniscate orbital path diagrams, node-and-connector flowchart diagrams with branching tree structures, pill-shaped UI components, checkerboard gradient spheres, low-resolution pixel grid icons, hand-drawn sketch icon sets.
- Technical data dashboard layouts with status indicators as compositional elements (not real data).
- Crisp anti-aliased vector strokes. Scientific instrument aesthetic.
- Brutalist grid composition, even 2-column symmetric layouts.
- Deep black void backgrounds. No gradients except grayscale sphere shading.
- Ultra high contrast white on black. Motion graphics still frame aesthetic.
- Generative art + UI design crossover.

CHOOSING THE VISUAL:
- Read the tweet text carefully. Identify the core concept, theme, or metaphor.
- Choose abstract shapes and patterns that evoke that concept without being literal.
- For example: a tweet about growth could use ascending particle fields or expanding spirograph patterns. A tweet about connections could use node-and-connector diagrams. A tweet about data could use topographic contour lines or wireframe orbs.
- The visual should feel thematically resonant, not illustrative.

LAYOUT:
- 1200x675 landscape (16:9). Generous margins on all sides.
- The abstract art should fill the composition in a balanced, centered arrangement.
- No text in the image unless it is a UI element within the abstract design system (e.g., a status label, a node label as part of the composition).
- Deep black void background with art elements floating in space.

ANTI-PATTERNS (never do these):
- No light backgrounds. Background MUST be pure black #000000.
- No realistic objects, people, faces, hands, or photographs.
- No literal representations of the tweet content. Always abstract.
- No busy or cluttered compositions. Every element should breathe.
- No more than 3 colors: black background, white line art, and orange #E8512A accent.
- No stock art aesthetic. Think generative code art meets technical UI illustration.

MOOD: Minimal, technical, generative. Like a still frame from a motion graphics piece or a generative art installation. The visual should intrigue and create curiosity that makes someone stop scrolling and read the tweet.`;
    }

    systemPrompt += `

CRITICAL RULE: Your prompt must describe the VISUAL APPEARANCE only. Do NOT include any technical metadata, sizing annotations, pixel values, margin numbers, font-size numbers, or layout measurements. Never write things like "70px" or "15px". Describe sizes using relative terms only. The image model will render any numbers it sees as visible text on the image.

PROMPT CONSTRUCTION RULES:
- Include ALL style rules above directly in your prompt using natural visual language.
- Specify colors by hex code (these are for the rendering engine, not visible text).
- Specify the background color as pure black #000000 explicitly.
- Be extremely specific about WHAT to show but use relative terms for HOW BIG.
- NEVER include pixel values, margin sizes, or font sizes as numbers.

Return ONLY the image generation prompt text. No explanation, no preamble, no quotes around it. Just the prompt.`;

    let userText = `Tweet text: "${tweet_text}"`;
    if (previous_prompt && feedback) {
      userText = `Tweet text: "${tweet_text}"

The previous image prompt was:
"${previous_prompt}"

The user wants this adjustment: "${feedback}"

Generate an updated image prompt incorporating their feedback while maintaining all style rules.`;
    }

    let userContent;
    if (reference_image) {
      const refMatch = reference_image.match(/^data:(image\/\w+);base64,(.+)$/);
      if (refMatch) {
        userContent = [
          { type: 'image', source: { type: 'base64', media_type: refMatch[1], data: refMatch[2] } },
          { type: 'text', text: userText }
        ];
      } else {
        userContent = userText;
      }
    } else {
      userContent = userText;
    }

    const response = await axios.post('https://api.anthropic.com/v1/messages', {
      model: 'claude-opus-4-6',
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: 'user', content: userContent }]
    }, {
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01'
      },
      timeout: 60000
    });

    const prompt = response.data?.content?.[0]?.text?.trim();
    if (!prompt) {
      return res.json({ success: false, error: 'No prompt generated' });
    }

    res.json({ success: true, prompt });
  } catch (error) {
    const msg = error.response?.data?.error?.message || error.message;
    res.status(500).json({ success: false, error: msg });
  }
});

// Generate infographic via Gemini image generation
app.post('/api/pr/generate-infographic', async (req, res) => {
  try {
    const { prompt, reference_image } = req.body;
    if (!prompt) {
      return res.status(400).json({ success: false, error: 'prompt is required' });
    }

    const geminiKey = process.env.GEMINI_API_KEY;
    if (!geminiKey) {
      return res.status(503).json({ success: false, error: 'GEMINI_API_KEY not configured' });
    }

    const model = 'gemini-3-pro-image-preview';
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`;

    const parts = [];
    if (reference_image) {
      const refMatch = reference_image.match(/^data:(image\/\w+);base64,(.+)$/);
      if (refMatch) {
        parts.push({ inlineData: { mimeType: refMatch[1], data: refMatch[2] } });
        parts.push({ text: `Use the attached image as an art style reference. Match its visual style, color palette, composition, and aesthetic exactly. Here is what the infographic should contain:\n\n${prompt}` });
      } else {
        parts.push({ text: prompt });
      }
    } else {
      parts.push({ text: prompt });
    }

    const response = await axios.post(apiUrl, {
      contents: [{ role: 'user', parts }],
      generationConfig: {
        responseModalities: ['TEXT', 'IMAGE']
      }
    }, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 90000
    });

    const resParts = response.data?.candidates?.[0]?.content?.parts || [];
    const imagePart = resParts.find(p => p.inlineData);

    if (!imagePart) {
      return res.json({ success: false, error: 'No image generated. Try a different prompt.' });
    }

    const mimeType = imagePart.inlineData.mimeType || 'image/png';
    const dataUrl = `data:${mimeType};base64,${imagePart.inlineData.data}`;

    const textPart = resParts.find(p => p.text);
    const description = textPart?.text || '';

    res.json({ success: true, image: dataUrl, description });
  } catch (error) {
    const msg = error.response?.data?.error?.message || error.message;
    res.status(500).json({ success: false, error: msg });
  }
});

// Fetch Open Graph metadata from a URL
app.post('/api/pr/og-metadata', async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) {
      return res.status(400).json({ success: false, error: 'No URL provided' });
    }
    if (!isAllowedUrl(url)) {
      return res.status(400).json({ success: false, error: 'Invalid or blocked URL' });
    }

    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 10000,
      maxContentLength: 500000
    });

    const html = response.data;

    const getMetaContent = (property) => {
      const patterns = [
        new RegExp(`<meta[^>]+(?:property|name)=["']${property}["'][^>]+content=["']([^"']+)["']`, 'i'),
        new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${property}["']`, 'i')
      ];
      for (const pattern of patterns) {
        const match = html.match(pattern);
        if (match) return match[1];
      }
      return null;
    };

    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);

    const ogData = {
      title: getMetaContent('og:title') || getMetaContent('twitter:title') || (titleMatch ? titleMatch[1].trim() : ''),
      description: getMetaContent('og:description') || getMetaContent('twitter:description') || getMetaContent('description') || '',
      image: getMetaContent('og:image') || getMetaContent('twitter:image') || '',
      siteName: getMetaContent('og:site_name') || '',
      domain: new URL(url).hostname.replace('www.', ''),
      url: url
    };

    res.json({ success: true, og: ogData });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// OG Image HTML template (rendered by Puppeteer for screenshot)
app.get('/og-template', (req, res) => {
  const title = decodeURIComponent(req.query.title || 'Untitled');
  const bgId = req.query.bgId || '';
  const bgImage = bgId ? (ogBgStore.get(bgId) || '') : '';

  const escapeHtml = (str) => str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  const bgStyle = bgImage
    ? `background-image: url(${bgImage}); background-size: cover; background-position: center;`
    : 'background: #000000;';

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  @font-face { font-family: 'PP Mori'; src: url('/fonts/PPMori-Regular.otf') format('opentype'); font-weight: 400; font-style: normal; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: 1200px; height: 630px; overflow: hidden; }
  .og-wrap { width: 1200px; height: 630px; position: relative; ${bgStyle} }
  .og-accent { width: 100%; height: 3px; background: #E8512A; position: absolute; top: 0; left: 0; z-index: 3; }
  .og-title-safe { position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: radial-gradient(ellipse 120% 130% at 85% 85%, transparent 30%, rgba(0,0,0,0.4) 55%, rgba(0,0,0,0.75) 75%, #000000 100%); z-index: 1; }
  .og-title { position: absolute; top: 48px; left: 68px; font-family: 'PP Mori', -apple-system, BlinkMacSystemFont, sans-serif; font-weight: 400; font-size: 90px; line-height: 1.05; letter-spacing: -0.035em; color: #FFFFFF; max-width: 780px; z-index: 2; }
  .og-logo { position: absolute; bottom: 40px; right: 56px; width: 44px; height: 51px; z-index: 2; }
</style>
</head>
<body>
<div class="og-wrap">
  <div class="og-accent"></div>
  <div class="og-title-safe"></div>
  <div class="og-title">${escapeHtml(title)}</div>
  <svg class="og-logo" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 306.8 352.69"><path d="m306.8,166.33v73.65c0,8.39-6.83,15.11-15.22,15.11h-80.59c-7.05,0-13.43,1.23-17.91,3.81-4.25,2.35-6.49,5.6-6.49,10.52v68.28c0,8.28-6.72,15-15,15H14.66c-8.06,0-14.66-6.72-14.66-14.77V54.17c0-8.39,6.72-15.22,15.11-15.22h35.59c7.05,0,13.43-1.12,17.91-3.58,4.14-2.24,6.49-5.37,6.49-10.3v-9.96c0-8.39,6.83-15.11,15.11-15.11h126.26c8.39,0,15.11,6.72,15.11,15.11v15.11c0,8.39-6.72,15.11-15.11,15.11h-124.58c-5.37.11-10.75.56-14.66,2.46-1.79.89-3.13,2.13-4.14,3.69-1.01,1.68-1.79,4.03-1.79,7.72v185.58c0,2.24,1.79,3.92,3.92,3.92h95.7c5.26,0,10.3-.56,13.88-2.35,1.68-.9,2.91-2.01,3.81-3.58,1.01-1.57,1.68-3.81,1.68-7.28v-69.17c0-8.39,6.83-15.11,15.22-15.11h86.07c8.39,0,15.22,6.72,15.22,15.11Z" fill="#E8512A"/></svg>
</div>
</body>
</html>`;

  res.type('html').send(html);
});

// Temporary in-memory store for OG background images (avoids passing base64 in URL)
const ogBgStore = new Map();

// Temporary in-memory store for style reference images (served to Midjourney via public URL)
const srefStore = new Map();

app.get('/og-sref/:id', (req, res) => {
  const data = srefStore.get(req.params.id);
  if (!data) return res.status(404).end();
  const match = data.match(/^data:(image\/\w+);base64,(.+)$/);
  if (!match) return res.status(404).end();
  const buffer = Buffer.from(match[2], 'base64');
  res.set('Content-Type', match[1]);
  res.set('Cache-Control', 'no-store');
  res.send(buffer);
});

// OG card visual prompt system (shared by both providers)
const OG_VISUAL_SYSTEM_PROMPT = `You create image generation prompts for abstract OG card background visuals. The visual will appear behind a blog title on a 1200x630 card.

VISUAL IDENTITY (non-negotiable):
- Pure black background #000000. No gradients, no dark gray, no textures on the background itself.
- White monochrome line art with optional subtle warm orange #E8512A accents. No other colors.
- Crisp, thin vector strokes. 1-2px line weight feel. Anti-aliased. No brush textures, no grain, no noise.
- Scientific instrument aesthetic. Think oscilloscope displays, technical diagrams, data visualization stills.
- Ultra high contrast: pure white (#FFFFFF) elements on pure black (#000000). No midtones, no soft grays.

APPROVED MOTIF LIBRARY (choose 1-3 from this list, combine creatively):
- Wireframe spheres/orbs (with latitude-longitude grid lines or diagonal stripe shading)
- Checkerboard gradient spheres (half black, half checkerboard dissolving into pixels)
- Spirograph/lissajous geometric patterns (thin overlapping ellipses or orbital paths)
- Topographic contour line landscapes (flowing parallel lines suggesting terrain)
- Particle scatter fields (small dots distributed in organic clusters)
- Pixel art icons (8-bit style, small, used as accent elements)
- Node-and-connector diagrams (circles connected by thin lines, circuit-board feel)
- Pill-shaped UI toggle components (rounded rectangle outlines)
- Bar chart or data visualization shapes (abstract, no labels)
- Electromagnetic field line diagrams (symmetrical curved lines radiating from a center)
- Thin wireframe rectangles suggesting UI cards or panels (with faint inner detail)

Do NOT invent motifs outside this library. Variations and combinations of these motifs are encouraged, but the base shapes must come from this list.

COMPLEXITY AND NEGATIVE SPACE:
- Maximum 2-3 primary visual elements in the entire composition.
- At least 60% of the total image area must be pure black empty space.
- Less is more. A single well-placed wireframe orb is better than a busy collage.
- Elements should feel deliberately placed, like objects on a museum pedestal, not scattered randomly.
- Small accent elements (a few particles, a faint contour line) can support the primary shapes but should not compete for attention.

NEVER DO THIS:
- Never generate realistic objects, people, animals, buildings, or landscapes.
- Never generate photographs, painterly textures, watercolor, oil paint, or 3D renders.
- Never include text, words, letters, numbers, labels, or UI text of any kind.
- Never use color beyond white, black, and the single orange accent #E8512A.
- Never fill the frame. Never create wallpaper-like tiling patterns.
- Never use soft glows, lens flares, bloom effects, or atmospheric haze.
- Never describe "floating" or "ethereal" or "dreamlike" qualities. Keep it precise and mechanical.
- Never interpret the tweet content literally. Do not depict the subject matter of the tweet.

TWEET CONNECTION (required, not optional):
- Read the tweet carefully. Identify its core topic, argument, or emotion.
- Choose a motif that has a clear, intentional conceptual link to that core idea. The viewer should be able to look at the visual and the title together and feel they belong.
- The connection must be abstract (no literal depictions), but it must be deliberate, not random.
- Do NOT fall back to a generic motif. Every generation must reflect the specific tweet.

EXAMPLE MAPPINGS (use these as reasoning patterns, not rigid rules):
- Growth, scaling, momentum -> topographic contour lines rising, or a bar chart ascending
- Data, analytics, metrics -> particle scatter field, or abstract bar/line chart shapes
- Strategy, planning, roadmap -> node-and-connector diagram with directional flow
- Technology, product, engineering -> wireframe UI card panels, or pixel art icons
- Networking, connections, community -> node-and-connector web, multiple linked circles
- Focus, clarity, simplicity -> single wireframe sphere, clean and centered
- Disruption, change, breaking patterns -> spirograph with one broken/diverging orbital path
- Investment, funding, capital -> checkerboard gradient sphere (value/structure duality)
- Design, craft, aesthetics -> lissajous geometric pattern, precise and elegant
- Leadership, vision, direction -> electromagnetic field lines radiating outward from a point
- Competition, market dynamics -> two pill-shaped toggle elements in tension, or opposing particle fields
- Infrastructure, systems, operations -> wireframe rectangles arranged like a system diagram
- Storytelling, narrative, content -> topographic landscape with flowing contour lines (journey)
- Risk, uncertainty, volatility -> particle scatter field with uneven density and trailing wisps

COMPOSITION AND TEXT LEGIBILITY:
- A large white blog title will be overlaid in the top-left area (roughly left 60%, top 45%).
- Primary visual elements must be concentrated in the bottom-right quadrant, right edge, or bottom edge.
- Art may extend faintly into the text area, but must dissolve naturally (sparse particles thinning out, trailing line endings). No bright or dense elements in the top-left.
- The transition from art to empty black must be organic and gradual, not a hard rectangular cutoff.
- Text legibility is the highest priority.

PROCESS (follow this exact structure in your output):
1. THEME: In one sentence, state the core topic/emotion/argument of the tweet.
2. MOTIF: Name which motif(s) from the library you are selecting and why they connect to the theme.
3. PROMPT: Write the final image generation prompt as a flat, specific visual description. Describe exactly what shapes appear, where they are placed, their size, and stroke weight. Be concrete, not aspirational. Keep under 100 words.

OUTPUT FORMAT (use these exact labels):
THEME: [one sentence]
MOTIF: [motif name(s) and brief justification]
PROMPT: [the image generation prompt]`;

// Helper: generate image prompt via Claude
async function generateOgVisualPrompt(tweetText, refinement, referenceImage) {
  let systemPrompt = OG_VISUAL_SYSTEM_PROMPT;
  if (referenceImage) {
    systemPrompt += `\n\nREFERENCE IMAGE: A reference image has been provided. Analyze its visual style (colors, composition, texture, mood, aesthetic) and ensure your prompt reproduces that exact art style. The reference defines the look; you may override the default color and style rules with what you observe in the reference. HOWEVER, the COMPOSITION AND TEXT LEGIBILITY rules above are NON-NEGOTIABLE. Art must still fade naturally toward the top-left text area. Dense elements stay in the bottom-right; any art near the title must be very faint and sparse.`;
  }

  let userText = `Generate an abstract visual prompt for an OG card. Read the tweet below, identify its core theme, then choose a motif that clearly connects to that theme.\n\nTweet:\n"${tweetText}"`;
  if (refinement) {
    userText += `\n\nAdditional style direction from the user: ${refinement}`;
  }

  let userContent;
  if (referenceImage) {
    const refMatch = referenceImage.match(/^data:(image\/\w+);base64,(.+)$/);
    if (refMatch) {
      userContent = [
        { type: 'image', source: { type: 'base64', media_type: refMatch[1], data: refMatch[2] } },
        { type: 'text', text: userText }
      ];
    } else {
      userContent = userText;
    }
  } else {
    userContent = userText;
  }

  const promptRes = await axios.post('https://api.anthropic.com/v1/messages', {
    model: 'claude-sonnet-4-20250514',
    max_tokens: 500,
    system: systemPrompt,
    messages: [{ role: 'user', content: userContent }]
  }, {
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    timeout: 15000
  });

  const raw = promptRes.data?.content?.[0]?.text?.trim() || '';

  const themeMatch = raw.match(/THEME:\s*(.+?)(?=\nMOTIF:)/s);
  const motifMatch = raw.match(/MOTIF:\s*(.+?)(?=\nPROMPT:)/s);
  const promptMatch = raw.match(/PROMPT:\s*(.+)/s);

  const theme = themeMatch ? themeMatch[1].trim() : '';
  const motif = motifMatch ? motifMatch[1].trim() : '';
  const imagePrompt = promptMatch ? promptMatch[1].trim() : raw;

  return {
    imagePrompt,
    reasoning: { theme, motif },
    raw
  };
}

// Helper: generate image via Gemini
async function generateImageGemini(prompt, referenceImage) {
  const geminiKey = process.env.GEMINI_API_KEY;
  const model = 'gemini-3-pro-image-preview';
  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`;

  const stylePrefix = 'Generate a minimal vector illustration on a pure black #000000 background. Use only white #FFFFFF thin line art with optional sparse orange #E8512A accents. No gradients, no textures, no photorealism, no 3D rendering, no text or labels. Crisp anti-aliased strokes, scientific instrument aesthetic. At least 60% of the image must be empty black space. ';

  const parts = [];
  if (referenceImage) {
    const refMatch = referenceImage.match(/^data:(image\/\w+);base64,(.+)$/);
    if (refMatch) {
      parts.push({ inlineData: { mimeType: refMatch[1], data: refMatch[2] } });
      parts.push({ text: `Use the attached image as an art style reference. Match its visual style, color palette, composition, and aesthetic exactly. Here is what to generate:\n\n${stylePrefix}${prompt}` });
    } else {
      parts.push({ text: `${stylePrefix}${prompt}` });
    }
  } else {
    parts.push({ text: `${stylePrefix}${prompt}` });
  }

  const imageRes = await axios.post(apiUrl, {
    contents: [{ role: 'user', parts }],
    generationConfig: { responseModalities: ['TEXT', 'IMAGE'] }
  }, {
    headers: { 'Content-Type': 'application/json' },
    timeout: 90000
  });

  const resParts = imageRes.data?.candidates?.[0]?.content?.parts || [];
  const imagePart = resParts.find(p => p.inlineData);
  if (imagePart) {
    const mimeType = imagePart.inlineData.mimeType || 'image/png';
    return `data:${mimeType};base64,${imagePart.inlineData.data}`;
  }
  return '';
}

// Helper: generate image via Midjourney (legnext.ai)
async function generateImageMidjourney(prompt, srefUrl) {
  const mjKey = process.env.MIDJOURNEY_API_KEY;
  let mjPrompt = `${prompt}, minimal vector line art, pure black background, white wireframe strokes, scientific diagram aesthetic, ultra high contrast --v 7 --ar 40:21 --style raw --no photorealistic, gradient, colorful, text, words, letters, painting, 3d render, glow, bloom, lens flare, busy, cluttered`;
  if (srefUrl) mjPrompt += ` --sref ${srefUrl}`;

  const createRes = await axios.post('https://api.legnext.ai/api/v1/diffusion', {
    text: mjPrompt
  }, {
    headers: { 'x-api-key': mjKey, 'Content-Type': 'application/json' },
    timeout: 15000
  });

  const jobId = createRes.data?.job_id;
  if (!jobId) throw new Error('Midjourney job creation failed');

  const maxAttempts = 40;
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise(r => setTimeout(r, 3000));

    const statusRes = await axios.get(`https://api.legnext.ai/api/v1/job/${jobId}`, {
      headers: { 'x-api-key': mjKey },
      timeout: 10000
    });

    const status = statusRes.data?.status;
    if (status === 'completed') {
      const imageUrl = statusRes.data?.output?.image_urls?.[0] || statusRes.data?.output?.image_url;
      if (!imageUrl) throw new Error('Midjourney completed but no image URL');

      const imgRes = await axios.get(imageUrl, { responseType: 'arraybuffer', timeout: 30000 });
      const base64 = Buffer.from(imgRes.data).toString('base64');
      const contentType = imgRes.headers['content-type'] || 'image/png';
      return `data:${contentType};base64,${base64}`;
    }
    if (status === 'failed') {
      const errMsg = statusRes.data?.error?.message || 'Midjourney generation failed';
      throw new Error(errMsg);
    }
  }
  throw new Error('Midjourney generation timed out');
}

// Generate OG link preview image: AI abstract visual + Puppeteer composite
app.post('/api/pr/generate-og-image', async (req, res) => {
  let browser;
  try {
    const { title, custom_prompt, provider, reference_image } = req.body;
    if (!title) {
      return res.status(400).json({ success: false, error: 'title is required' });
    }
    if (!custom_prompt || !custom_prompt.trim()) {
      return res.status(400).json({ success: false, error: 'Enter a visual prompt to generate the image' });
    }

    let bgDataUrl = '';
    const useProvider = provider || 'gemini';
    const imagePrompt = custom_prompt.trim();
    const boardImages = getMoodboardImages();

    try {
      if (useProvider === 'midjourney' && process.env.MIDJOURNEY_API_KEY) {
        const srefUrls = [];
        const tempSrefIds = [];

        if (reference_image) {
          const srefId = crypto.randomUUID();
          srefStore.set(srefId, reference_image);
          setTimeout(() => srefStore.delete(srefId), 300000);
          tempSrefIds.push(srefId);
          srefUrls.push(`${APP_URL}/og-sref/${srefId}`);
        }

        for (const img of boardImages) {
          srefUrls.push(`${APP_URL}${img.url}`);
        }

        try {
          bgDataUrl = await generateImageMidjourney(imagePrompt, srefUrls.join(' '));
        } finally {
          tempSrefIds.forEach(id => srefStore.delete(id));
        }
      } else if (process.env.GEMINI_API_KEY) {
        let geminiRef = reference_image || '';
        if (!geminiRef && boardImages.length > 0) {
          const pick = boardImages[Math.floor(Math.random() * boardImages.length)];
          const buf = fs.readFileSync(pick.filepath);
          const ext = path.extname(pick.filename).toLowerCase();
          const mimeMap = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.gif': 'image/gif', '.webp': 'image/webp' };
          geminiRef = `data:${mimeMap[ext] || 'image/png'};base64,${buf.toString('base64')}`;
        }
        bgDataUrl = await generateImageGemini(imagePrompt, geminiRef);
      }
    } catch (aiErr) {
      return res.json({ success: false, error: aiErr.message || 'Image generation failed. Try again.' });
    }

    const puppeteer = require('puppeteer');
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1200, height: 630, deviceScaleFactor: 2 });

    let bgId = '';
    if (bgDataUrl) {
      bgId = crypto.randomUUID();
      ogBgStore.set(bgId, bgDataUrl);
      setTimeout(() => ogBgStore.delete(bgId), 60000);
    }

    const templateUrl = `http://127.0.0.1:${PORT}/og-template?title=${encodeURIComponent(title)}&bgId=${bgId}`;
    await page.goto(templateUrl, { waitUntil: 'networkidle0', timeout: 30000 });

    const screenshot = await page.screenshot({ type: 'png', clip: { x: 0, y: 0, width: 1200, height: 630 } });
    const base64 = screenshot.toString('base64');
    const dataUrl = `data:image/png;base64,${base64}`;

    res.json({ success: true, image: dataUrl });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
});

// ============================================
// LINKEDIN OAUTH & PUBLISHING
// ============================================

const LINKEDIN_CLIENT_ID = process.env.LINKEDIN_CLIENT_ID;
const LINKEDIN_CLIENT_SECRET = process.env.LINKEDIN_CLIENT_SECRET;
const APP_URL = process.env.APP_URL || `http://127.0.0.1:${PORT}`;
const LINKEDIN_REDIRECT_URI = `${APP_URL}/api/linkedin/callback`;
const LINKEDIN_API_VERSION = '202602';

// Helper: get valid LinkedIn tokens (with auto-refresh)
async function getLinkedInTokens() {
  if (!useDatabase) return null;
  const result = await pool.query('SELECT * FROM linkedin_tokens WHERE id = $1', ['default']);
  if (result.rows.length === 0) return null;
  const tokens = result.rows[0];

  // Check if expired and refresh if needed
  if (new Date(tokens.expires_at) <= new Date()) {
    if (!tokens.refresh_token) return null;
    try {
      const refreshRes = await axios.post('https://www.linkedin.com/oauth/v2/accessToken', null, {
        params: {
          grant_type: 'refresh_token',
          refresh_token: tokens.refresh_token,
          client_id: LINKEDIN_CLIENT_ID,
          client_secret: LINKEDIN_CLIENT_SECRET
        }
      });
      const newExpiry = new Date(Date.now() + refreshRes.data.expires_in * 1000);
      await pool.query(
        'UPDATE linkedin_tokens SET access_token = $1, refresh_token = COALESCE($2, refresh_token), expires_at = $3 WHERE id = $4',
        [refreshRes.data.access_token, refreshRes.data.refresh_token || null, newExpiry, 'default']
      );
      tokens.access_token = refreshRes.data.access_token;
      tokens.expires_at = newExpiry;
    } catch (e) {
      return null;
    }
  }
  return tokens;
}

// Start OAuth flow
app.get('/api/linkedin/connect', (req, res) => {
  if (!LINKEDIN_CLIENT_ID) {
    return res.status(500).send('LINKEDIN_CLIENT_ID not configured');
  }
  const state = Math.random().toString(36).substring(2, 15);
  const scopes = 'w_organization_social r_organization_social w_organization_social_feed r_organization_social_feed';
  const authUrl = `https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=${LINKEDIN_CLIENT_ID}&redirect_uri=${encodeURIComponent(LINKEDIN_REDIRECT_URI)}&scope=${encodeURIComponent(scopes)}&state=${state}`;
  res.redirect(authUrl);
});

// OAuth callback
app.get('/api/linkedin/callback', async (req, res) => {
  const { code, error } = req.query;
  if (error || !code) {
    return res.redirect('/pr.html?linkedin=error');
  }

  try {
    // Exchange code for tokens
    const tokenRes = await axios.post('https://www.linkedin.com/oauth/v2/accessToken', null, {
      params: {
        grant_type: 'authorization_code',
        code,
        redirect_uri: LINKEDIN_REDIRECT_URI,
        client_id: LINKEDIN_CLIENT_ID,
        client_secret: LINKEDIN_CLIENT_SECRET
      }
    });

    const { access_token, refresh_token, expires_in } = tokenRes.data;
    const expiresAt = new Date(Date.now() + expires_in * 1000);

    // Fetch organization admin access to find org ID
    let orgId = process.env.LINKEDIN_ORG_ID || null;
    let orgName = null;

    if (!orgId) {
      try {
        const orgRes = await axios.get('https://api.linkedin.com/rest/organizationAcls?q=roleAssignee&role=ADMINISTRATOR&projection=(elements*(organization~(localizedName),organization))', {
          headers: {
            'Authorization': `Bearer ${access_token}`,
            'LinkedIn-Version': LINKEDIN_API_VERSION,
            'X-Restli-Protocol-Version': '2.0.0'
          }
        });
        if (orgRes.data.elements && orgRes.data.elements.length > 0) {
          const orgUrn = orgRes.data.elements[0].organization;
          orgId = orgUrn.split(':').pop();
          orgName = orgRes.data.elements[0]['organization~']?.localizedName || null;
        }
      } catch (e) {
        // Org detection failed, user can set LINKEDIN_ORG_ID manually
      }
    }

    // Store tokens
    if (useDatabase) {
      await pool.query(`
        INSERT INTO linkedin_tokens (id, access_token, refresh_token, expires_at, org_id, org_name)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (id) DO UPDATE SET
          access_token = $2, refresh_token = $3, expires_at = $4, org_id = COALESCE($5, linkedin_tokens.org_id), org_name = COALESCE($6, linkedin_tokens.org_name)
      `, ['default', access_token, refresh_token || null, expiresAt, orgId, orgName]);
    }

    res.redirect('/pr.html?linkedin=connected');
  } catch (err) {
    res.redirect('/pr.html?linkedin=error');
  }
});

// Check connection status
app.get('/api/linkedin/status', async (req, res) => {
  try {
    const tokens = await getLinkedInTokens();
    if (tokens && tokens.access_token) {
      res.json({
        success: true,
        connected: true,
        org_id: tokens.org_id || null,
        org_name: tokens.org_name || null,
        expires_at: tokens.expires_at
      });
    } else {
      res.json({ success: true, connected: false });
    }
  } catch (error) {
    res.json({ success: true, connected: false });
  }
});

// Disconnect
app.post('/api/linkedin/disconnect', async (req, res) => {
  try {
    if (useDatabase) {
      await pool.query('DELETE FROM linkedin_tokens WHERE id = $1', ['default']);
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Publish post to LinkedIn
app.post('/api/linkedin/publish', async (req, res) => {
  try {
    const tokens = await getLinkedInTokens();
    if (!tokens || !tokens.access_token) {
      return res.status(401).json({ success: false, error: 'LinkedIn not connected. Please connect your account first.' });
    }

    const orgId = tokens.org_id || process.env.LINKEDIN_ORG_ID;
    if (!orgId) {
      return res.status(400).json({ success: false, error: 'Organization ID not found. Set LINKEDIN_ORG_ID in environment variables or reconnect your account.' });
    }

    const { content, hashtags } = req.body;
    if (!content) {
      return res.status(400).json({ success: false, error: 'Post content is required' });
    }

    let commentary = content;
    if (hashtags && hashtags.length > 0) {
      commentary += '\n\n' + hashtags.map(h => (h.startsWith('#') ? h : '#' + h)).join(' ');
    }

    const postPayload = {
      author: `urn:li:organization:${orgId}`,
      commentary,
      visibility: 'PUBLIC',
      distribution: {
        feedDistribution: 'MAIN_FEED',
        targetEntities: [],
        thirdPartyDistributionChannels: []
      },
      lifecycleState: 'PUBLISHED'
    };

    const postRes = await axios.post('https://api.linkedin.com/rest/posts', postPayload, {
      headers: {
        'Authorization': `Bearer ${tokens.access_token}`,
        'Content-Type': 'application/json',
        'LinkedIn-Version': LINKEDIN_API_VERSION,
        'X-Restli-Protocol-Version': '2.0.0'
      }
    });

    const postUrn = postRes.headers['x-restli-id'] || null;

    res.json({ success: true, post_urn: postUrn });
  } catch (error) {
    const errMsg = error.response?.data?.message || error.message;
    res.status(error.response?.status || 500).json({ success: false, error: errMsg });
  }
});

// ============================================
// X (TWITTER) API PUBLISHING
// ============================================

const X_API_KEY = (process.env.X_API_KEY || '').trim();
const X_API_KEY_SECRET = (process.env.X_API_KEY_SECRET || '').trim();
const X_ACCESS_TOKEN = (process.env.X_ACCESS_TOKEN || '').trim();
const X_ACCESS_TOKEN_SECRET = (process.env.X_ACCESS_TOKEN_SECRET || '').trim();

const xOauth = OAuth({
  consumer: { key: X_API_KEY || '', secret: X_API_KEY_SECRET || '' },
  signature_method: 'HMAC-SHA1',
  hash_function(baseString, key) {
    return crypto.createHmac('sha1', key).update(baseString).digest('base64');
  }
});

const xToken = { key: X_ACCESS_TOKEN || '', secret: X_ACCESS_TOKEN_SECRET || '' };

function xAuthHeader(request) {
  return xOauth.toHeader(xOauth.authorize(request, xToken));
}

function isXConfigured() {
  return !!(X_API_KEY && X_API_KEY_SECRET && X_ACCESS_TOKEN && X_ACCESS_TOKEN_SECRET);
}

app.get('/api/x/status', async (req, res) => {
  if (!isXConfigured()) {
    return res.json({ success: true, connected: false, reason: 'X API credentials not configured' });
  }
  try {
    const request = { url: 'https://api.twitter.com/2/users/me', method: 'GET' };
    const verifyRes = await axios.get(request.url, {
      headers: { ...xAuthHeader(request) },
      timeout: 8000
    });
    const user = verifyRes.data?.data;
    res.json({
      success: true,
      connected: true,
      username: user?.username || null,
      name: user?.name || null
    });
  } catch (error) {
    const status = error.response?.status;
    const detail = error.response?.data?.detail || error.response?.data?.errors?.[0]?.message || error.message;
    res.json({ success: true, connected: false, reason: detail });
  }
});

app.post('/api/x/publish', async (req, res) => {
  if (!isXConfigured()) {
    return res.status(400).json({ success: false, error: 'X API credentials not configured. Add X_API_KEY, X_API_KEY_SECRET, X_ACCESS_TOKEN, and X_ACCESS_TOKEN_SECRET to your environment.' });
  }

  try {
    const { content, thread_parts, media_url } = req.body;
    if (!content && (!thread_parts || thread_parts.length === 0)) {
      return res.status(400).json({ success: false, error: 'Post content is required' });
    }

    let mediaId = null;

    if (media_url) {
      try {
        let imageBuffer;
        let mimeType;

        if (media_url.startsWith('data:')) {
          const matches = media_url.match(/^data:([^;]+);base64,(.+)$/);
          if (!matches) throw new Error('Invalid data URL format');
          mimeType = matches[1];
          imageBuffer = Buffer.from(matches[2], 'base64');
        } else {
          const imageRes = await axios.get(media_url, { responseType: 'arraybuffer', timeout: 30000 });
          imageBuffer = Buffer.from(imageRes.data);
          mimeType = imageRes.headers['content-type'] || 'image/png';
        }

        const initRequest = {
          url: 'https://upload.twitter.com/1.1/media/upload.json',
          method: 'POST'
        };
        const initForm = new FormData();
        initForm.append('command', 'INIT');
        initForm.append('total_bytes', String(imageBuffer.length));
        initForm.append('media_type', mimeType);
        const initRes = await axios.post(initRequest.url, initForm, {
          headers: {
            ...xAuthHeader(initRequest),
            ...initForm.getHeaders()
          }
        });
        mediaId = initRes.data.media_id_string;

        const appendRequest = {
          url: 'https://upload.twitter.com/1.1/media/upload.json',
          method: 'POST'
        };
        const appendForm = new FormData();
        appendForm.append('command', 'APPEND');
        appendForm.append('media_id', mediaId);
        appendForm.append('segment_index', '0');
        appendForm.append('media_data', imageBuffer.toString('base64'));
        await axios.post(appendRequest.url, appendForm, {
          headers: {
            ...xAuthHeader(appendRequest),
            ...appendForm.getHeaders()
          }
        });

        const finalizeRequest = {
          url: 'https://upload.twitter.com/1.1/media/upload.json',
          method: 'POST'
        };
        const finalizeForm = new FormData();
        finalizeForm.append('command', 'FINALIZE');
        finalizeForm.append('media_id', mediaId);
        await axios.post(finalizeRequest.url, finalizeForm, {
          headers: {
            ...xAuthHeader(finalizeRequest),
            ...finalizeForm.getHeaders()
          }
        });
      } catch (mediaErr) {
        return res.status(400).json({ success: false, error: 'Media upload failed: ' + (mediaErr.response?.data?.errors?.[0]?.message || mediaErr.message) });
      }
    }

    const parts = thread_parts && thread_parts.length > 0 ? thread_parts : [content];
    const tweetIds = [];

    for (let i = 0; i < parts.length; i++) {
      const tweetPayload = { text: parts[i] };

      if (i === 0 && mediaId) {
        tweetPayload.media = { media_ids: [mediaId] };
      }

      if (i > 0 && tweetIds.length > 0) {
        tweetPayload.reply = { in_reply_to_tweet_id: tweetIds[tweetIds.length - 1] };
      }

      const tweetRequest = {
        url: 'https://api.twitter.com/2/tweets',
        method: 'POST'
      };
      const tweetRes = await axios.post(tweetRequest.url, tweetPayload, {
        headers: {
          ...xAuthHeader(tweetRequest),
          'Content-Type': 'application/json'
        }
      });

      const tweetId = tweetRes.data?.data?.id;
      if (tweetId) tweetIds.push(tweetId);
    }

    res.json({
      success: true,
      tweet_id: tweetIds[0] || null,
      tweet_ids: tweetIds,
      tweet_url: tweetIds[0] ? `https://x.com/i/status/${tweetIds[0]}` : null
    });
  } catch (error) {
    const errData = error.response?.data;
    const errMsg = errData?.detail || errData?.errors?.[0]?.message || errData?.title || error.message;
    res.status(error.response?.status || 500).json({ success: false, error: errMsg });
  }
});

app.delete('/api/x/tweet/:id', async (req, res) => {
  if (!isXConfigured()) {
    return res.status(400).json({ success: false, error: 'X API credentials not configured' });
  }
  try {
    const tweetId = req.params.id;
    const deleteRequest = {
      url: `https://api.twitter.com/2/tweets/${tweetId}`,
      method: 'DELETE'
    };
    await axios.delete(deleteRequest.url, {
      headers: { ...xAuthHeader(deleteRequest) }
    });
    res.json({ success: true });
  } catch (error) {
    const errMsg = error.response?.data?.detail || error.response?.data?.errors?.[0]?.message || error.message;
    res.status(error.response?.status || 500).json({ success: false, error: errMsg });
  }
});

// ============================================
// LINKEDIN: FETCH ORGANIZATION POSTS
// ============================================

app.get('/api/linkedin/posts', async (req, res) => {
  try {
    const tokens = await getLinkedInTokens();
    if (!tokens || !tokens.access_token) {
      return res.json({ success: true, posts: [], connected: false });
    }

    const orgId = tokens.org_id || process.env.LINKEDIN_ORG_ID;
    if (!orgId) {
      return res.json({ success: true, posts: [], connected: true, error: 'Organization ID not found' });
    }

    const count = Math.min(parseInt(req.query.count) || 50, 100);
    const authorUrn = encodeURIComponent(`urn:li:organization:${orgId}`);
    const postsUrl = `https://api.linkedin.com/rest/posts?author=${authorUrn}&q=author&count=${count}&sortBy=LAST_MODIFIED`;

    const liHeaders = {
      'Authorization': `Bearer ${tokens.access_token}`,
      'LinkedIn-Version': LINKEDIN_API_VERSION,
      'X-Restli-Protocol-Version': '2.0.0'
    };

    const postsRes = await axios.get(postsUrl, { headers: liHeaders, timeout: 15000 });
    const rawPosts = postsRes.data?.elements || [];

    const metadataMap = {};
    let metadataError = null;
    if (rawPosts.length > 0) {
      try {
        const urns = rawPosts.map(p => p.id).filter(Boolean);
        const concurrency = 5;
        for (let i = 0; i < urns.length; i += concurrency) {
          const chunk = urns.slice(i, i + concurrency);
          const results = await Promise.allSettled(
            chunk.map(urn =>
              axios.get(
                `https://api.linkedin.com/rest/socialMetadata/${encodeURIComponent(urn)}`,
                { headers: liHeaders, timeout: 8000 }
              ).then(r => ({ urn, data: r.data }))
            )
          );
          for (const result of results) {
            if (result.status !== 'fulfilled' || !result.value?.data) continue;
            const { urn, data } = result.value;
            let totalReactions = 0;
            if (data.reactionSummaries) {
              for (const r of Object.values(data.reactionSummaries)) {
                totalReactions += r.count || 0;
              }
            }
            metadataMap[urn] = {
              likes: totalReactions,
              comments: data.commentSummary?.topLevelCount || 0
            };
          }
        }
      } catch (metaErr) {
        metadataError = metaErr.response?.data?.message || metaErr.message;
      }
    }

    const posts = rawPosts.map(post => {
      const urn = post.id;
      const meta = metadataMap[urn] || {};
      const postUrl = `https://www.linkedin.com/feed/update/${urn}`;

      return {
        id: urn,
        channel: 'linkedin',
        text: post.commentary || '',
        created_at: post.publishedAt ? new Date(post.publishedAt).toISOString() : (post.createdAt ? new Date(post.createdAt).toISOString() : null),
        likes: meta.likes || 0,
        comments: meta.comments || 0,
        shares: 0,
        url: postUrl,
        media: post.content?.media?.id || null,
        visibility: post.visibility
      };
    });

    const response = { success: true, posts, connected: true };
    if (metadataError) response.metadataError = metadataError;
    res.json(response);
  } catch (error) {
    const errMsg = error.response?.data?.message || error.message;
    const status = error.response?.status;
    if (status === 401) {
      return res.json({ success: true, posts: [], connected: false, error: 'Token expired' });
    }
    res.status(500).json({ success: false, error: errMsg });
  }
});

// ============================================
// GLOSSI BLOG: FETCH FROM RESOURCES PAGE
// ============================================

async function scrapeCaseStudyDetails(url) {
  try {
    const res = await axios.get(url, { timeout: 8000 });
    const html = res.data;
    const stats = [];
    const statRegex = /<div class="cs-stat-label">([^<]*)<\/div>\s*<div class="cs-stat-num">([^<]*)<\/div>/g;
    let sm;
    while ((sm = statRegex.exec(html)) !== null) {
      stats.push({ label: sm[1].trim(), value: sm[2].trim().replace(/&mdash;/g, ',').replace(/&amp;/g, '&') });
    }
    const quoteMatch = html.match(/<blockquote>\s*<p>([^<]+)<\/p>\s*<\/blockquote>/);
    const quote = quoteMatch
      ? quoteMatch[1].replace(/&ldquo;|&rdquo;/g, '"').replace(/&mdash;/g, ',').replace(/&amp;/g, '&').trim()
      : null;
    const imgMatch = html.match(/<div class="cs-hero-image">\s*<img src="([^"]+)"/);
    const heroImage = imgMatch ? imgMatch[1] : null;
    const companyMatch = html.match(/<div class="cs-hero-tag">[^<]*<\/div>\s*<span[^>]*>([^<]*)<\/span>/);
    const company = companyMatch ? companyMatch[1].trim() : null;
    return { stats, quote, heroImage, company };
  } catch {
    return { stats: [], quote: null, heroImage: null, company: null };
  }
}

app.get('/api/blog/posts', async (req, res) => {
  try {
    const pageRes = await axios.get('https://www.glossi.io/resources.html', { timeout: 10000 });
    const html = pageRes.data;

    const posts = [];
    const cardRegex = /<a\s+href="([^"]+)"\s+class="card"\s+data-type="[^"]*"[^>]*>[\s\S]*?<span class="card-type">([^<]*)<\/span>\s*<h3>([^<]*)<\/h3>\s*<p>([^<]*)<\/p>\s*<span class="card-meta">([^<]*)<\/span>/g;

    let match;
    while ((match = cardRegex.exec(html)) !== null) {
      const [, href, category, title, description, dateStr] = match;
      const url = href.startsWith('http') ? href : `https://www.glossi.io${href}`;
      const slug = href.split('/').pop().replace('.html', '');

      let parsedDate = null;
      const fullDateMatch = dateStr.match(/([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})/);
      const monthYearMatch = dateStr.match(/([A-Za-z]+)\s+(\d{4})/);
      if (fullDateMatch) {
        parsedDate = new Date(`${fullDateMatch[1]} ${fullDateMatch[2]}, ${fullDateMatch[3]}`).toISOString();
      } else if (monthYearMatch) {
        parsedDate = new Date(`${monthYearMatch[1]} 1, ${monthYearMatch[2]}`).toISOString();
      }

      const isCaseStudy = category.trim().toLowerCase() === 'customer story'
        || href.includes('/customers/');

      posts.push({
        id: `blog-${slug}`,
        channel: 'blog',
        text: title.trim(),
        description: description.trim().replace(/&mdash;/g, ',').replace(/&amp;/g, '&'),
        category: category.trim(),
        is_case_study: isCaseStudy,
        created_at: parsedDate,
        date_display: dateStr.trim(),
        likes: 0,
        comments: 0,
        shares: 0,
        url,
        slug
      });
    }

    const caseStudies = posts.filter(p => p.is_case_study);
    const enrichments = await Promise.all(
      caseStudies.map(cs => scrapeCaseStudyDetails(cs.url))
    );
    caseStudies.forEach((cs, i) => {
      cs.case_study = enrichments[i];
    });

    res.json({ success: true, posts });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message, posts: [] });
  }
});

// ============================================
// X (TWITTER): FETCH USER TWEETS
// ============================================

app.get('/api/x/posts', async (req, res) => {
  if (!isXConfigured()) {
    return res.json({ success: true, posts: [], connected: false });
  }

  try {
    const meRequest = { url: 'https://api.twitter.com/2/users/me', method: 'GET' };
    const meRes = await axios.get(meRequest.url, {
      headers: { ...xAuthHeader(meRequest) },
      timeout: 8000
    });
    const userId = meRes.data?.data?.id;
    const username = meRes.data?.data?.username;
    if (!userId) {
      return res.json({ success: true, posts: [], connected: false, error: 'Could not determine user ID' });
    }

    const maxResults = Math.min(parseInt(req.query.count) || 50, 100);
    const tweetsUrl = `https://api.twitter.com/2/users/${userId}/tweets?max_results=${maxResults}&exclude=retweets&tweet.fields=created_at,public_metrics,text,entities`;
    const tweetsRequest = { url: tweetsUrl, method: 'GET' };
    const tweetsRes = await axios.get(tweetsRequest.url, {
      headers: { ...xAuthHeader(tweetsRequest) },
      timeout: 15000
    });

    const rawTweets = tweetsRes.data?.data || [];
    const posts = rawTweets.map(tweet => ({
      id: tweet.id,
      channel: 'x',
      text: tweet.text || '',
      created_at: tweet.created_at || null,
      likes: tweet.public_metrics?.like_count || 0,
      comments: tweet.public_metrics?.reply_count || 0,
      shares: tweet.public_metrics?.retweet_count || 0,
      impressions: tweet.public_metrics?.impression_count || 0,
      url: `https://x.com/${username}/status/${tweet.id}`,
      entities: tweet.entities || null
    }));

    res.json({ success: true, posts, connected: true, username });
  } catch (error) {
    const status = error.response?.status;
    const detail = error.response?.data?.detail || error.response?.data?.errors?.[0]?.message || error.message;
    if (status === 401 || status === 403) {
      return res.json({ success: true, posts: [], connected: false, error: detail });
    }
    res.status(500).json({ success: false, error: detail });
  }
});

// ============================================
// DISTRIBUTION ENDPOINTS
// ============================================

// Get distribution settings
app.get('/api/pr/distribution-settings', async (req, res) => {
  try {
    if (!useDatabase) {
      return res.status(503).json({ success: false, error: 'Database not configured' });
    }
    const result = await pool.query(
      'SELECT settings FROM pr_distribution_settings WHERE user_id = $1 ORDER BY id DESC LIMIT 1',
      ['default']
    );
    const settings = result.rows.length > 0 ? result.rows[0].settings : null;
    res.json({ success: true, settings });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Save distribution settings
app.post('/api/pr/distribution-settings', async (req, res) => {
  try {
    const { settings } = req.body;
    if (!useDatabase) {
      return res.status(503).json({ success: false, error: 'Database not configured' });
    }
    await pool.query('DELETE FROM pr_distribution_settings WHERE user_id = $1', ['default']);
    await pool.query(
      'INSERT INTO pr_distribution_settings (user_id, settings, updated_at) VALUES ($1, $2, NOW())',
      ['default', JSON.stringify(settings)]
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Schedule a post
app.post('/api/pr/schedule', async (req, res) => {
  try {
    const { id, output_id, channel, scheduled_at } = req.body;
    if (!useDatabase) {
      return res.status(503).json({ success: false, error: 'Database not configured' });
    }
    await pool.query(`
      INSERT INTO pr_scheduled_posts (id, output_id, channel, scheduled_at, status, created_at)
      VALUES ($1, $2, $3, $4, 'pending', NOW())
      ON CONFLICT (id) DO UPDATE SET
        output_id = $2, channel = $3, scheduled_at = $4, status = 'pending'
    `, [id, output_id, channel, scheduled_at]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get scheduled posts
app.get('/api/pr/scheduled', async (req, res) => {
  try {
    if (!useDatabase) {
      return res.status(503).json({ success: false, error: 'Database not configured' });
    }
    const result = await pool.query('SELECT * FROM pr_scheduled_posts ORDER BY scheduled_at ASC');
    res.json({ success: true, posts: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Cancel a scheduled post
app.delete('/api/pr/schedule/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!useDatabase) {
      return res.status(503).json({ success: false, error: 'Database not configured' });
    }
    await pool.query('DELETE FROM pr_scheduled_posts WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// PR FAVORITES ENDPOINTS
// ============================================

app.get('/api/pr/favorites', async (req, res) => {
  try {
    if (!useDatabase) {
      return res.status(503).json({ success: false, error: 'Database not configured' });
    }
    const result = await pool.query('SELECT item_id, item_type FROM pr_favorites ORDER BY created_at DESC');
    res.json({ success: true, favorites: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/pr/favorites', async (req, res) => {
  try {
    const { item_id, item_type } = req.body;
    if (!item_id) {
      return res.status(400).json({ success: false, error: 'item_id is required' });
    }
    if (!useDatabase) {
      return res.status(503).json({ success: false, error: 'Database not configured' });
    }
    await pool.query(
      `INSERT INTO pr_favorites (item_id, item_type, created_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (item_id) DO NOTHING`,
      [item_id, item_type || 'news']
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete('/api/pr/favorites/:itemId', async (req, res) => {
  try {
    const itemId = decodeURIComponent(req.params.itemId);
    if (!useDatabase) {
      return res.status(503).json({ success: false, error: 'Database not configured' });
    }
    await pool.query('DELETE FROM pr_favorites WHERE item_id = $1', [itemId]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// PR ANGLES ENDPOINTS
// ============================================

app.get('/api/pr/angles', async (req, res) => {
  try {
    if (!useDatabase) {
      return res.status(503).json({ success: false, error: 'Database not configured' });
    }
    
    const result = await pool.query(
      "SELECT data FROM app_data WHERE key = 'pr_angles' LIMIT 1"
    );
    const angles = result.rows.length > 0 ? result.rows[0].data : [];
    res.json({ success: true, angles });
  } catch (error) {
    console.error('Error loading angles:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/pr/angles', async (req, res) => {
  try {
    const { sources, newsHooks, pastOutputs, highlightedHook } = req.body;
    const anthropicKey = process.env.ANTHROPIC_API_KEY;

    if (!anthropicKey) {
      return res.status(400).json({
        success: false,
        error: 'Anthropic API key not configured'
      });
    }

    const sourcesContent = sources && sources.length > 0
      ? sources.map((s, i) => `SOURCE ${i + 1}: ${s.title}\n${s.content}`).join('\n\n')
      : 'No sources provided yet.';

    const hooksContent = newsHooks && newsHooks.length > 0
      ? JSON.stringify(newsHooks.slice(0, 5), null, 2)
      : 'No recent news hooks.';

    const pastOutputsList = pastOutputs && pastOutputs.length > 0
      ? pastOutputs.slice(0, 10).map(o => o.title || o.contentType).join(', ')
      : 'No content created yet.';

    const highlightedHookText = highlightedHook 
      ? `\n\nPRIORITY: User clicked "Build Angle" on this news hook: "${highlightedHook}". Make sure at least one angle directly addresses this news item.`
      : '';

    const prompt = `You are Glossi's PR strategist. Based on company source materials and the current news environment, recommend 3-4 story angles that would generate press coverage or social engagement right now.${highlightedHookText}

COMPANY SOURCES:
${sourcesContent}

CURRENT NEWS HOOKS:
${hooksContent}

CONTENT ALREADY CREATED (avoid repeating these angles):
${pastOutputsList}

Each angle should be a clear NARRATIVE, not a content type. Something a journalist or LinkedIn audience would find interesting.

For each angle, include a content plan: what specific pieces to create and where to publish them, in priority order.

${CONTENT_PLAN_RULES}

Return ONLY valid JSON in this exact structure:
{
  "angles": [
    {
      "title": "Short punchy name (5-8 words)",
      "narrative": "2-3 sentences describing the story",
      "tied_to_hook": "headline of the related news hook, or null",
      "urgency": "high" | "medium" | "low",
      "why_now": "One sentence on timing",
      "content_plan": [
        { "type": "tweet", "description": "Quick reaction: what everyone misses about world models and product viz", "target": "Twitter/X", "priority": 1, "audience": "builders" },
        { "type": "blog_post", "description": "Bylined piece on why compositing-first was the right architecture bet", "target": "Company blog", "priority": 2, "audience": "brands" },
        { "type": "email_blast", "description": "Pitch to AI reporters: Glossi built for the world model era before it arrived", "target": "TechCrunch", "priority": 3, "audience": "press" }
      ]
    }
  ]
}`;

    const response = await axios.post(
      'https://api.anthropic.com/v1/messages',
      {
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        messages: [{ role: 'user', content: prompt }]
      },
      {
        headers: {
          'x-api-key': anthropicKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json'
        }
      }
    );

    const content = response.data.content[0].text;
    let parsed;

    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      } else {
        parsed = JSON.parse(content);
      }
    } catch (parseError) {
      console.error('Failed to parse Claude response:', content);
      return res.status(500).json({
        success: false,
        error: 'Failed to parse angle recommendations'
      });
    }

    const angles = parsed.angles || [];
    angles.forEach(angle => {
      angle.id = 'angle_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
      angle.generatedAt = new Date().toISOString();
      angle.isDefault = false;
    });

    res.json({ success: true, angles });
  } catch (error) {
    console.error('Error generating angles:', error);
    res.status(500).json({
      success: false,
      error: error.response?.data?.error?.message || error.message
    });
  }
});

app.post('/api/pr/angles/save', async (req, res) => {
  try {
    if (!useDatabase) {
      return res.status(503).json({ success: false, error: 'Database not configured' });
    }
    
    const { angles } = req.body;

    await pool.query(
      `INSERT INTO app_data (key, data, updated_at)
       VALUES ('pr_angles', $1, NOW())
       ON CONFLICT (key) DO UPDATE SET data = $1, updated_at = NOW()`,
      [JSON.stringify(angles)]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Error saving angles:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete('/api/pr/angles/:id', async (req, res) => {
  try {
    if (!useDatabase) {
      return res.status(503).json({ success: false, error: 'Database not configured' });
    }
    
    const { id } = req.params;

    const result = await pool.query(
      "SELECT data FROM app_data WHERE key = 'pr_angles' LIMIT 1"
    );
    let angles = result.rows.length > 0 ? result.rows[0].data : [];

    angles = angles.filter(a => a.id !== id);

    await pool.query(
      `INSERT INTO app_data (key, data, updated_at)
       VALUES ('pr_angles', $1, NOW())
       ON CONFLICT (key) DO UPDATE SET data = $1, updated_at = NOW()`,
      [JSON.stringify(angles)]
    );

    res.json({ success: true, angles });
  } catch (error) {
    console.error('Error deleting angle:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// FILE PROCESSING ENDPOINTS
// ============================================

// Process PDF - extract text
app.post('/api/process-pdf', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }
    
    const data = await pdfParse(req.file.buffer);
    
    res.json({
      success: true,
      title: req.file.originalname.replace('.pdf', ''),
      content: data.text,
      pageCount: data.numpages,
      info: data.info
    });
  } catch (error) {
    console.error('PDF processing error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Fetch URL content
app.post('/api/fetch-url', async (req, res) => {
  try {
    const { url, type } = req.body;
    
    if (!url) {
      return res.status(400).json({ success: false, error: 'No URL provided' });
    }
    if (!isAllowedUrl(url)) {
      return res.status(400).json({ success: false, error: 'Invalid or blocked URL' });
    }
    
    // Fetch the URL using axios
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      timeout: 30000
    });
    
    const html = response.data;
    
    // Extract title
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    let title = titleMatch ? titleMatch[1].trim() : new URL(url).hostname;
    
    // Check if it's a Google Doc (published)
    const isGoogleDoc = url.includes('docs.google.com/document') || type === 'google-doc';
    
    let text;
    
    if (isGoogleDoc) {
      // Special handling for Google Docs to preserve structure
      // Extract the main content div
      const contentMatch = html.match(/<div[^>]*id="contents"[^>]*>([\s\S]*?)<\/div>\s*<div[^>]*id="footer"/i) ||
                          html.match(/<div[^>]*class="doc-content"[^>]*>([\s\S]*)/i) ||
                          [null, html];
      
      text = contentMatch[1] || html;
      
      // Remove script and style tags
      text = text.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
      text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
      
      // Convert headings to markdown-style
      text = text.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, '\n\n# $1\n\n');
      text = text.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, '\n\n## $1\n\n');
      text = text.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, '\n\n### $1\n\n');
      text = text.replace(/<h4[^>]*>([\s\S]*?)<\/h4>/gi, '\n\n#### $1\n\n');
      
      // Convert list items
      text = text.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '\n* $1');
      
      // Convert paragraphs
      text = text.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, '\n$1\n');
      
      // Convert line breaks
      text = text.replace(/<br\s*\/?>/gi, '\n');
      
      // Convert horizontal rules
      text = text.replace(/<hr[^>]*>/gi, '\n---\n');
      
      // Handle bold and italic
      text = text.replace(/<(b|strong)[^>]*>([\s\S]*?)<\/(b|strong)>/gi, '**$2**');
      text = text.replace(/<(i|em)[^>]*>([\s\S]*?)<\/(i|em)>/gi, '*$2*');
      
      // Remove remaining HTML tags
      text = text.replace(/<[^>]+>/g, '');
      
      // Clean title (remove " - Google Docs")
      title = title.replace(/\s*-\s*Google Docs$/i, '').trim();
    } else {
      // Standard HTML processing
      text = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
      text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
      text = text.replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '');
      text = text.replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '');
      text = text.replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '');
      text = text.replace(/<[^>]+>/g, ' ');
    }
    
    // Decode HTML entities
    text = text.replace(/&nbsp;/g, ' ');
    text = text.replace(/&amp;/g, '&');
    text = text.replace(/&lt;/g, '<');
    text = text.replace(/&gt;/g, '>');
    text = text.replace(/&quot;/g, '"');
    text = text.replace(/&#39;/g, "'");
    text = text.replace(/&rsquo;/g, "'");
    text = text.replace(/&lsquo;/g, "'");
    text = text.replace(/&rdquo;/g, '"');
    text = text.replace(/&ldquo;/g, '"');
    text = text.replace(/&mdash;/g, ', ');
    text = text.replace(/&ndash;/g, '-');
    text = text.replace(/&hellip;/g, '...');
    text = text.replace(/&#\d+;/g, '');
    
    // Clean up whitespace
    text = text.replace(/[ \t]+/g, ' ');
    text = text.replace(/\n\s*\n\s*\n/g, '\n\n');
    text = text.trim().substring(0, 200000);
    
    res.json({
      success: true,
      title,
      content: text,
      url
    });
  } catch (error) {
    console.error('URL fetch error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Transcribe audio using OpenAI Whisper
app.post('/api/transcribe', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }
    
    // Get OpenAI API key from settings
    let openaiKey = process.env.OPENAI_API_KEY;
    
    // Try to get from database if not in env
    if (!openaiKey && useDatabase) {
      const result = await pool.query("SELECT data FROM app_data WHERE key = 'settings'");
      if (result.rows.length > 0 && result.rows[0]?.data?.openaiApiKey) {
        openaiKey = result.rows[0].data.openaiApiKey;
      }
    }
    
    if (!openaiKey) {
      return res.status(400).json({ success: false, error: 'OpenAI API key not configured' });
    }
    
    // Create form data for OpenAI
    const formData = new FormData();
    formData.append('file', req.file.buffer, {
      filename: req.file.originalname,
      contentType: req.file.mimetype
    });
    formData.append('model', 'whisper-1');
    
    const response = await axios.post('https://api.openai.com/v1/audio/transcriptions', formData, {
      headers: {
        'Authorization': `Bearer ${openaiKey}`,
        ...formData.getHeaders()
      },
      maxContentLength: Infinity,
      maxBodyLength: Infinity
    });
    
    res.json({
      success: true,
      title: req.file.originalname.replace(/\.[^/.]+$/, ''),
      transcript: response.data.text,
      duration: null
    });
  } catch (error) {
    console.error('Transcription error:', error.response?.data || error.message);
    res.status(500).json({ success: false, error: error.response?.data?.error?.message || error.message });
  }
});

// Validate environment variables
function validateEnvironment() {
  const warnings = [];
  
  if (!process.env.ANTHROPIC_API_KEY) {
    warnings.push('⚠️  ANTHROPIC_API_KEY not set - AI features will not work');
  }
  
  if (!process.env.OPENAI_API_KEY) {
    warnings.push('⚠️  OPENAI_API_KEY not set - Audio transcription will not work');
  }
  
  if (!process.env.DATABASE_URL) {
    warnings.push('⚠️  DATABASE_URL not set - Using local file storage');
  }

  if (!process.env.LINKEDIN_CLIENT_ID || !process.env.LINKEDIN_CLIENT_SECRET) {
    warnings.push('⚠️  LINKEDIN_CLIENT_ID/SECRET not set - LinkedIn publishing disabled');
  }
  
  if (warnings.length > 0) {
    console.warn('\n' + warnings.join('\n') + '\n');
  } else {
    console.log('✓ All environment variables configured');
  }
}

// Start server
async function start() {
  validateEnvironment();
  await initDatabase();
  
  const host = useDatabase ? '0.0.0.0' : '127.0.0.1';
  
  app.listen(PORT, host, () => {
    console.log(`Server running on http://${host}:${PORT}`);
    console.log(`Database: ${useDatabase ? 'PostgreSQL' : 'Local files'}`);
  });
}

start();
