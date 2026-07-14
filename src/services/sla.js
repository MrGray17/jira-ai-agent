import { pool } from '../db.js';

export function getSlaHoursForRisk(riskLevel) {
  switch (riskLevel) {
    case 'HIGH':
      return parseInt(process.env.HIGH_RISK_SLA_HOURS) || 8;
    case 'MEDIUM':
      return parseInt(process.env.DEFAULT_SLA_HOURS) || 24;
    case 'LOW':
      return parseInt(process.env.DEFAULT_SLA_HOURS) || 24;
    default:
      return parseInt(process.env.DEFAULT_SLA_HOURS) || 24;
  }
}

export async function checkSlaBreaches() {
  try {
    const result = await pool.query(`
      UPDATE sla_tracking
      SET is_breached = TRUE
      WHERE is_breached = FALSE
        AND EXTRACT(EPOCH FROM (NOW() - first_seen_at)) / 3600 > sla_hours
      RETURNING ticket_key
    `);
    if (result.rows.length > 0) {
      console.log(`[SLA] Breach detected for: ${result.rows.map((r) => r.ticket_key).join(', ')}`);
    }
  } catch (err) {
    console.error('[SLA] Breach check failed:', err.message);
  }
}

export function startSlaMonitor(intervalMs = 60000) {
  setInterval(checkSlaBreaches, intervalMs);
  console.log(`[SLA] Breach monitor started (interval: ${intervalMs}ms)`);
}
