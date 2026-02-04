const express = require('express');
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const multer = require('multer');
const pdfParse = require('pdf-parse');
const axios = require('axios');
const FormData = require('form-data');

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
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });
} else {
}

// Data directory for local development
const DATA_DIR = path.join(__dirname, 'data');

// Ensure data directory exists (for local dev)
if (!useDatabase && !fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Initialize database table
async function initDatabase() {
  if (!useDatabase) return;
  
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS app_data (
        key VARCHAR(50) PRIMARY KEY,
        data JSONB NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
  } catch (error) {
    console.error('Error initializing database:', error);
  }
}

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.static(__dirname));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', database: useDatabase });
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
      const files = ['dashboard-data.json', 'meetings.json', 'settings.json', 'pipeline-history.json', 'stat-history.json'];
      
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
    console.error('Error loading data:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Save all data
app.post('/api/data', async (req, res) => {
  try {
    const { data, meetings, settings, pipelineHistory, statHistory } = req.body;
    
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
