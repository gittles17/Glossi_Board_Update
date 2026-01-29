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
