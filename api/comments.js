const { Pool } = require('pg');

// Create connection pool using environment variable
const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

// Initialize database table on first run
async function initializeDatabase() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS comments (
        id SERIAL PRIMARY KEY,
        slide_number INTEGER NOT NULL,
        author VARCHAR(255),
        text TEXT NOT NULL,
        timestamp BIGINT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_slide_number ON comments(slide_number);
    `);
  } catch (error) {
    console.error('Database initialization error:', error);
  }
}

// Initialize on startup
initializeDatabase();

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    if (req.method === 'GET') {
      // Fetch comments for a specific slide
      const { slide } = req.query;

      if (!slide) {
        return res.status(400).json({ error: 'slide parameter required' });
      }

      const result = await pool.query(
        'SELECT id, author, text, timestamp FROM comments WHERE slide_number = $1 ORDER BY timestamp DESC',
        [parseInt(slide)]
      );

      return res.status(200).json(result.rows);
    }

    if (req.method === 'POST') {
      // Add a new comment
      const { slide, author, text, timestamp } = req.body;

      if (!slide || !text || !timestamp) {
        return res.status(400).json({ error: 'slide, text, and timestamp required' });
      }

      const result = await pool.query(
        'INSERT INTO comments (slide_number, author, text, timestamp) VALUES ($1, $2, $3, $4) RETURNING id, author, text, timestamp',
        [parseInt(slide), author || 'Anonymous', text, timestamp]
      );

      return res.status(201).json(result.rows[0]);
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('API error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
