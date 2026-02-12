const express = require('express');
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const multer = require('multer');
const pdfParse = require('pdf-parse');
const axios = require('axios');
const FormData = require('form-data');

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
} else {
}

// Data directory for local development
const DATA_DIR = path.join(__dirname, 'data');

// Ensure data directory exists (for local dev)
if (!useDatabase && !fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
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
            created_at TIMESTAMP DEFAULT NOW()
          )
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
            fetched_at TIMESTAMP DEFAULT NOW()
          )
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

// Load all data
app.get('/api/data', async (req, res) => {
  try {
    const data = {};
    
    if (useDatabase) {
      // Load from PostgreSQL
      const result = await pool.query('SELECT key, data FROM app_data');
      result.rows.forEach(row => {
        data[row.key] = row.data;
      });
    } else {
      // Load from files
      const files = ['dashboard-data.json', 'meetings.json', 'settings.json', 'pipeline-history.json', 'stat-history.json', 'todos.json', 'team-members.json'];
      
      files.forEach(file => {
        const filePath = path.join(DATA_DIR, file);
        if (fs.existsSync(filePath)) {
          try {
            const key = file.replace('.json', '').replace(/-/g, '_');
            data[key] = JSON.parse(fs.readFileSync(filePath, 'utf8'));
          } catch (e) {
            console.warn(`Failed to parse ${file}:`, e.message);
          }
        }
      });
    }
    
    res.json({ success: true, data });
  } catch (error) {
    console.error('Error loading data:', error.message);
    res.json({ success: true, data: {}, databaseUnavailable: true });
  }
});

// Save all data
app.post('/api/data', async (req, res) => {
  try {
    const { data, meetings, settings, pipelineHistory, statHistory, todos, teamMembers } = req.body;
    
    if (useDatabase) {
      // Save to PostgreSQL using upsert
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
      
    } else {
      // Save to files
      if (data) {
        fs.writeFileSync(
          path.join(DATA_DIR, 'dashboard-data.json'),
          JSON.stringify(data, null, 2)
        );
      }
      
      if (meetings) {
        fs.writeFileSync(
          path.join(DATA_DIR, 'meetings.json'),
          JSON.stringify(meetings, null, 2)
        );
      }
      
      if (settings) {
        fs.writeFileSync(
          path.join(DATA_DIR, 'settings.json'),
          JSON.stringify(settings, null, 2)
        );
      }
      
      if (pipelineHistory) {
        fs.writeFileSync(
          path.join(DATA_DIR, 'pipeline-history.json'),
          JSON.stringify(pipelineHistory, null, 2)
        );
      }
      
      if (statHistory) {
        fs.writeFileSync(
          path.join(DATA_DIR, 'stat-history.json'),
          JSON.stringify(statHistory, null, 2)
        );
      }
      
      if (todos) {
        fs.writeFileSync(
          path.join(DATA_DIR, 'todos.json'),
          JSON.stringify(todos, null, 2)
        );
      }
      
      if (teamMembers) {
        fs.writeFileSync(
          path.join(DATA_DIR, 'team-members.json'),
          JSON.stringify(teamMembers, null, 2)
        );
      }
      
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error saving data:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Clear quotes from database
app.post('/api/clear-quotes', async (req, res) => {
  try {
    if (useDatabase) {
      // Get current dashboard data
      const result = await pool.query("SELECT data FROM app_data WHERE key = 'dashboard_data'");
      if (result.rows.length > 0 && result.rows[0]?.data) {
        const data = result.rows[0].data;
        data.quotes = []; // Clear quotes
        
        // Save back
        await pool.query(`
          UPDATE app_data SET data = $1, updated_at = NOW()
          WHERE key = 'dashboard_data'
        `, [JSON.stringify(data)]);
        
        res.json({ success: true, message: 'Quotes cleared from PostgreSQL' });
      } else {
        res.json({ success: true, message: 'No dashboard data found' });
      }
    } else {
      // Clear from local file
      const filePath = path.join(DATA_DIR, 'dashboard-data.json');
      if (fs.existsSync(filePath)) {
        try {
          const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
          data.quotes = [];
          fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
          res.json({ success: true, message: 'Quotes cleared from local storage' });
        } catch (e) {
          console.error('Failed to parse dashboard file:', e.message);
          res.status(500).json({ success: false, error: 'Failed to parse dashboard file' });
        }
      } else {
        res.json({ success: true, message: 'No dashboard data file found' });
      }
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

    if (useDatabase) {
      // Clear database and set defaults
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
    } else {
      // Reset files
      fs.writeFileSync(path.join(DATA_DIR, 'dashboard-data.json'), JSON.stringify(defaultData, null, 2));
      fs.writeFileSync(path.join(DATA_DIR, 'meetings.json'), '[]');
    }
    
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
      return res.json({ success: true, data: null });
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
      return res.json({ success: true });
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
      return res.json({ success: true, settings: null });
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
      return res.json({ success: true });
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
      return res.json({ success: true, sources: [] });
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
      return res.json({ success: true });
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
      return res.json({ success: true });
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
      return res.json({ success: true, outputs: [] });
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
    const { id, content_type, title, content, sources, citations, strategy, status } = req.body;
    
    if (!useDatabase) {
      return res.json({ success: true });
    }
    
    await pool.query(`
      INSERT INTO pr_outputs (id, content_type, title, content, sources, citations, strategy, status, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
      ON CONFLICT (id) DO UPDATE SET
        content_type = $2, title = $3, content = $4, sources = $5, citations = $6, strategy = $7, status = $8
    `, [id, content_type, title, content, JSON.stringify(sources), JSON.stringify(citations), JSON.stringify(strategy), status]);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error saving output:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete output
app.delete('/api/pr/outputs/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!useDatabase) {
      return res.json({ success: true });
    }
    
    await pool.query('DELETE FROM pr_outputs WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting output:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get all journalists
app.get('/api/pr/journalists', async (req, res) => {
  try {
    if (!useDatabase) {
      return res.json({ success: true, journalists: [] });
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
      return res.json({ success: true });
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
      return res.json({ success: true });
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
    const { outletName, outletUrl, apiKey } = req.body;
    
    if (!apiKey) {
      return res.status(400).json({ success: false, error: 'API key required' });
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
      model: 'claude-opus-4-20250514',
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
          model: 'claude-opus-4-20250514',
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
      return res.json({ success: true, pitches: [] });
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
      return res.json({ success: true });
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
      return res.json({ success: true, items: [] });
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
      return res.json({ success: true });
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
      return res.json({ success: true });
    }
    
    await pool.query('DELETE FROM pr_calendar WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting calendar item:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Refresh news hooks (Claude web search)
app.post('/api/pr/news-hooks', async (req, res) => {
  try {
    const { apiKey } = req.body;
    
    if (!apiKey) {
      return res.status(400).json({ success: false, error: 'API key required' });
    }
    
    const newsPrompt = `Search for news from the past 7 days about:
- World models (Google Genie, World Labs, OpenAI)
- AI product visualization or 3D commerce
- Brand consistency and AI-generated content
- Enterprise adoption of AI creative tools
- 3D rendering in browser

For each result, return:
- Headline
- Outlet name
- Date
- URL
- One-sentence summary
- Relevance to Glossi (how Glossi could tie into this story)

Return as structured JSON with this exact format:
{
  "news": [
    {
      "headline": "Headline text",
      "outlet": "Outlet name",
      "date": "2024-01-15",
      "url": "https://...",
      "summary": "One sentence summary",
      "relevance": "How Glossi ties in"
    }
  ]
}

Maximum 10 results, sorted by relevance.`;

    const newsResponse = await axios.post('https://api.anthropic.com/v1/messages', {
      model: 'claude-opus-4-20250514',
      max_tokens: 4096,
      system: 'You are a news research assistant for Glossi, an AI-native 3D product visualization platform. Always return valid JSON.',
      messages: [{ role: 'user', content: newsPrompt }]
    }, {
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      }
    });
    
    const newsText = newsResponse.data.content?.[0]?.text || '{}';
    let newsData;
    try {
      const jsonMatch = newsText.match(/\{[\s\S]*\}/);
      newsData = jsonMatch ? JSON.parse(jsonMatch[0]) : { news: [] };
    } catch {
      newsData = { news: [] };
    }
    
    if (useDatabase) {
      // Clear old news and insert new
      await pool.query('DELETE FROM pr_news_hooks');
      
      for (const item of (newsData.news || [])) {
        await pool.query(`
          INSERT INTO pr_news_hooks (headline, outlet, date, url, summary, relevance, fetched_at)
          VALUES ($1, $2, $3, $4, $5, $6, NOW())
        `, [item.headline, item.outlet, item.date, item.url, item.summary, item.relevance]);
      }
    }
    
    res.json({ success: true, news: newsData.news || [] });
  } catch (error) {
    console.error('Error fetching news hooks:', error);
    res.status(500).json({ success: false, error: error.response?.data?.error?.message || error.message });
  }
});

// Get cached news hooks
app.get('/api/pr/news-hooks', async (req, res) => {
  try {
    if (!useDatabase) {
      return res.json({ success: true, news: [] });
    }
    
    const result = await pool.query('SELECT * FROM pr_news_hooks ORDER BY fetched_at DESC');
    res.json({ success: true, news: result.rows });
  } catch (error) {
    console.error('Error loading news hooks:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Fetch fresh articles (Claude web search)
app.post('/api/pr/articles', async (req, res) => {
  try {
    const { apiKey } = req.body;
    
    if (!apiKey) {
      return res.status(400).json({ success: false, error: 'API key required' });
    }
    
    const articlesPrompt = `Search major tech publications (TechCrunch, The Verge, Wired, VentureBeat, MIT Technology Review, Ars Technica, Protocol, Fast Company) for recent articles from the past 7 days about:

1. Glossi brand mentions or AI product visualization tools
2. AI-powered 3D rendering, product visualization, and e-commerce technology
3. Enterprise creative AI adoption, brand consistency, and marketing technology

Return the top 5 most relevant articles as JSON:
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

Only include articles from major tech publications. Maximum 5 results.`;

    const articlesResponse = await axios.post('https://api.anthropic.com/v1/messages', {
      model: 'claude-opus-4-20250514',
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
      return res.json({ success: true, articles: [] });
    }
    
    const result = await pool.query('SELECT * FROM pr_articles ORDER BY fetched_at DESC LIMIT 5');
    res.json({ success: true, articles: result.rows });
  } catch (error) {
    console.error('Error loading articles:', error);
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

// Start server
async function start() {
  await initDatabase();
  
  const host = useDatabase ? '0.0.0.0' : '127.0.0.1';
  
  app.listen(PORT, host, () => {
    if (useDatabase) {
    } else {
    }
  });
}

start();
