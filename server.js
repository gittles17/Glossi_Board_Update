const express = require('express');
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 5500;

// Database connection (Railway provides DATABASE_URL)
const useDatabase = !!process.env.DATABASE_URL;
let pool = null;

if (useDatabase) {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });
  console.log('Using PostgreSQL database');
} else {
  console.log('Using local file storage');
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
    console.log('Database initialized');
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
          const key = file.replace('.json', '').replace(/-/g, '_');
          data[key] = JSON.parse(fs.readFileSync(filePath, 'utf8'));
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
      
      console.log('Data saved to database');
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
      
      console.log('Data saved to files');
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error saving data:', error);
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
      console.log('Database reset to defaults');
    } else {
      // Reset files
      fs.writeFileSync(path.join(DATA_DIR, 'dashboard-data.json'), JSON.stringify(defaultData, null, 2));
      fs.writeFileSync(path.join(DATA_DIR, 'meetings.json'), '[]');
      console.log('Files reset to defaults');
    }
    
    res.json({ success: true, message: 'Data reset to defaults' });
  } catch (error) {
    console.error('Error resetting data:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Start server
async function start() {
  await initDatabase();
  
  const host = useDatabase ? '0.0.0.0' : '127.0.0.1';
  
  app.listen(PORT, host, () => {
    console.log('');
    console.log('╔════════════════════════════════════════════╗');
    console.log('║      Glossi Dashboard Server Running       ║');
    console.log('╠════════════════════════════════════════════╣');
    if (useDatabase) {
      console.log(`║  Running on port ${PORT} (production)         ║`);
      console.log('║  Data saves to: PostgreSQL                 ║');
    } else {
      console.log(`║  http://127.0.0.1:${PORT}                     ║`);
      console.log('║  Data saves to: ./data/                    ║');
    }
    console.log('║  Press Ctrl+C to stop                      ║');
    console.log('╚════════════════════════════════════════════╝');
    console.log('');
  });
}

start();
