const express = require('express');
const { Pool } = require('pg');
const multer = require('multer');
const pdfParse = require('pdf-parse');
const axios = require('axios');
const FormData = require('form-data');
const Parser = require('rss-parser');

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
app.use(compression());
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

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', database: useDatabase });
});

// API settings endpoint - returns API key availability without exposing keys
app.get('/api/settings', (req, res) => {
  res.json({
    hasAnthropicKey: !!process.env.ANTHROPIC_API_KEY,
    hasOpenAIKey: !!process.env.OPENAI_API_KEY,
    isProduction: useDatabase && process.env.NODE_ENV === 'production'
  });
});

// Proxy endpoint for Anthropic API calls (avoids CORS)
app.post('/api/chat', async (req, res) => {
  try {
    const { messages, system, model, max_tokens } = req.body;
    
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ 
        success: false, 
        error: 'Anthropic API key not configured in environment variables' 
      });
    }
    
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
    
    res.json(response.data);
  } catch (error) {
    console.error('Chat API error:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({
      success: false,
      error: error.response?.data?.error?.message || error.message
    });
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
    const { id, content_type, title, content, sources, citations, strategy, status, phase, story_key, news_headline, drafts, content_plan_index, media_attachments, hashtags, first_comment } = req.body;
    
    if (!useDatabase) {
      return res.status(503).json({ success: false, error: 'Database not configured' });
    }
    
    await pool.query(`
      INSERT INTO pr_outputs (id, content_type, title, content, sources, citations, strategy, status, phase, story_key, news_headline, drafts, content_plan_index, media_attachments, hashtags, first_comment, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, NOW())
      ON CONFLICT (id) DO UPDATE SET
        content_type = $2, title = $3, content = $4, sources = $5, citations = $6, strategy = $7, status = $8, phase = $9,
        story_key = $10, news_headline = $11, drafts = $12, content_plan_index = $13, media_attachments = $14, hashtags = $15, first_comment = $16
    `, [id, content_type, title, content, JSON.stringify(sources), JSON.stringify(citations), JSON.stringify(strategy), status, phase || 'edit', story_key || null, news_headline || null, JSON.stringify(drafts || null), content_plan_index != null ? content_plan_index : null, JSON.stringify(media_attachments || null), JSON.stringify(hashtags || null), first_comment || null]);
    
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
        {"type": "hot_take", "description": "Quick reaction: what this means for product teams still relying on photoshoots", "priority": 1, "audience": "builders"},
        {"type": "blog_post", "description": "Deep dive on why compositing-first matters more after this news", "priority": 2, "audience": "brands"},
        {"type": "email_blast", "description": "Signal boost to subscriber list with the key insight", "priority": 3, "audience": "brands"}
      ]
    }
  ]
}

CONTENT PLAN RULES:

CONTEXT: Glossi is a seed-stage startup building awareness with builders (devs, designers, PMs) and brand/marketing teams. The content voice is product-led, opinionated, and intentional (think Cursor, Linear, Canva). Never corporate. Never hype. Never generic startup marketing. Every piece should feel like it was worth writing.

ACTIVE CHANNELS: LinkedIn, Twitter/X, company blog, email list, press outreach. Only suggest content for these channels.

VALID CONTENT TYPES: linkedin_post, media_pitch, blog_post, press_release, tweet_thread, founder_quote, talking_points, briefing_doc, product_announcement, op_ed, email_blast, investor_snippet, hot_take

SELECTION HEURISTICS (pick based on article type, not a default template):
- Breaking/time-sensitive news: media_pitch + hot_take + email_blast
- Competitor or market shift: op_ed + tweet_thread + linkedin_post
- Thought leadership / trend piece: op_ed + linkedin_post + blog_post
- Product/feature relevance: product_announcement + blog_post + email_blast
- Funding/business signal: investor_snippet + press_release + linkedin_post
- Customer/industry story: blog_post + linkedin_post + founder_quote
- Technical deep-dive: blog_post + tweet_thread + hot_take
- "Everyone gets this wrong": hot_take + op_ed + tweet_thread

DYNAMIC PLAN SIZE (based on relevance to Glossi):
- High relevance + high urgency: 4-5 content pieces
- Medium relevance: 3-4 content pieces
- Low relevance: 2 content pieces

DIVERSIFICATION: Do NOT default to linkedin_post + media_pitch for every article. Look at the batch as a whole. If multiple articles would get the same lead type, vary them. Prioritize the content type that best fits each specific article's angle.

AUDIENCE TAG: Each content piece MUST include an "audience" field with one of: "builders", "brands", "investors", "press", "internal"

TONE FOR DESCRIPTIONS: Write content plan descriptions like a sharp comms lead, not a template. Instead of "Thought leadership post tied to this news" write something like "Founder take: why compositing beats generation for brand teams, told through this news hook." Be specific to the article.

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
      
      // Return ALL articles from DB (accumulated, not just new ones)
      const allNews = await pool.query(`
        SELECT * FROM pr_news_hooks 
        WHERE date > NOW() - INTERVAL '30 days'
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
    
    // Only return news from the last 30 days (by article date, not fetch date)
    const result = await pool.query(`
      SELECT * FROM pr_news_hooks 
      WHERE date > NOW() - INTERVAL '30 days'
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
    {"type": "hot_take", "description": "Quick founder reaction: what this signals for AI product photography", "priority": 1, "audience": "builders"},
    {"type": "op_ed", "description": "Bylined take on why this validates compositing over pure generation", "priority": 2, "audience": "brands"},
    {"type": "email_blast", "description": "Key insight distilled for subscriber list", "priority": 3, "audience": "brands"}
  ],
  "relevance": "Topic connection explanation"
}

CONTENT PLAN RULES:
- Glossi is seed-stage, building awareness with builders and brand teams. Voice is product-led, opinionated, intentional. Not corporate, not hype, not generic.
- Active channels: LinkedIn, Twitter/X, blog, email, press.
- Valid types: linkedin_post, media_pitch, blog_post, press_release, tweet_thread, founder_quote, talking_points, briefing_doc, product_announcement, op_ed, email_blast, investor_snippet, hot_take
- Include 2-4 pieces. More for high-relevance articles, fewer for tangential ones.
- Each piece MUST have an "audience" field: "builders", "brands", "investors", "press", or "internal"
- Do NOT default to linkedin_post + media_pitch. Pick types that fit THIS specific article.
- Write specific descriptions, not templates. Example: "Founder take: why this proves compositing beats generation" not "Thought leadership post."

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

CONTENT PLAN RULES:
- Glossi is seed-stage, building awareness with builders (devs, designers, PMs) and brand teams. Voice is product-led, opinionated, intentional (think Cursor, Linear, Canva). Not corporate, not hype, not generic.
- Active channels: LinkedIn, Twitter/X, company blog, email list, press outreach.
- Valid types: linkedin_post, media_pitch, blog_post, press_release, tweet_thread, founder_quote, talking_points, briefing_doc, product_announcement, op_ed, email_blast, investor_snippet, hot_take
- High urgency angles: 4-5 content pieces. Medium: 3-4. Low: 2-3.
- Each piece MUST have an "audience" field: "builders", "brands", "investors", "press", or "internal"
- Do NOT default to linkedin_post + media_pitch for every angle. Vary the mix across angles.
- Write specific, sharp descriptions. Not "Founder perspective on..." but "Why world models prove compositing was the right bet, told from the builder's POV."

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
        { "type": "hot_take", "description": "Quick reaction: what everyone misses about world models and product viz", "target": "Twitter/X", "priority": 1, "audience": "builders" },
        { "type": "op_ed", "description": "Bylined piece on why compositing-first was the right architecture bet", "target": "Company blog", "priority": 2, "audience": "brands" },
        { "type": "media_pitch", "description": "Pitch to AI reporters: Glossi built for the world model era before it arrived", "target": "TechCrunch", "priority": 3, "audience": "press" }
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
