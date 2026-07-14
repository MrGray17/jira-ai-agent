import pg from 'pg';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/jira_agent',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

// In-memory fallback for when database is unavailable
let triageLogs = [];

export async function initializeDatabase() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS triage_logs (
        id SERIAL PRIMARY KEY,
        ticket_key VARCHAR(50) NOT NULL,
        summary TEXT,
        category VARCHAR(50),
        risk_level VARCHAR(20),
        justification TEXT,
        ai_model VARCHAR(50),
        processed_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS sla_tracking (
        id SERIAL PRIMARY KEY,
        ticket_key VARCHAR(50) UNIQUE NOT NULL,
        first_seen_at TIMESTAMP DEFAULT NOW(),
        transitioned_at TIMESTAMP,
        sla_hours INTEGER DEFAULT 24,
        is_breached BOOLEAN DEFAULT FALSE
      )
    `);

    console.log('[Database] Tables initialized successfully.');
  } catch (err) {
    console.error('[Database] Table initialization failed:', err.message);
  }
}

export function testConnection() {
  pool.connect((err, client, release) => {
    if (err) {
      console.error('[Database] Connection failed:', err.message);
      console.log('[Database] Running in memory-only mode. Triage logs will not persist.');
    } else {
      console.log('[Database] Connected to PostgreSQL successfully.');
      release();
    }
  });
}

export { pool, triageLogs };
