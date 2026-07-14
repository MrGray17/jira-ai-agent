import { Router } from 'express';
import { pool, triageLogs } from '../db.js';

const router = Router();

router.get('/api/triage-logs', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM triage_logs ORDER BY processed_at DESC LIMIT 100');
    const dbLogs = result.rows.map((row) => ({
      ticketKey: row.ticket_key,
      summary: row.summary,
      aiResponse: {
        category: row.category,
        risk: row.risk_level,
        justification: row.justification,
      },
      timestamp: row.processed_at,
    }));
    res.json(dbLogs);
  } catch (err) {
    console.error('[Database] Failed to fetch triage logs:', err.message);
    res.json(triageLogs);
  }
});

router.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
  });
});

router.get('/api/sla-status', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        ticket_key,
        first_seen_at,
        transitioned_at,
        sla_hours,
        is_breached,
        EXTRACT(EPOCH FROM (NOW() - first_seen_at)) / 3600 as hours_elapsed
      FROM sla_tracking
      ORDER BY first_seen_at DESC
      LIMIT 50
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('[SLA] Failed to fetch SLA status:', err.message);
    res.json([]);
  }
});

export default router;
