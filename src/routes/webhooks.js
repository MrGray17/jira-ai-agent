import { Router } from 'express';
import { pool, triageLogs } from '../db.js';
import { verifyJiraSignature } from '../middleware/auth.js';
import { triageTicket } from '../services/ai.js';
import { transitionIssueToInProgress } from '../services/jira.js';
import { getSlaHoursForRisk } from '../services/sla.js';

const router = Router();

router.post('/webhooks/jira', verifyJiraSignature, async (req, res) => {
  try {
    res.status(200).json({ status: 'received' });

    const payload = req.body;

    if (!payload.issue) {
      console.log('[Webhook Warning] Received payload without issue data.');
      return;
    }

    const ticketKey = payload.issue.key;
    const summary = payload.issue.fields.summary;
    const currentStatus = payload.issue.fields.status.name;

    console.log(`\n=========================================`);
    console.log(`[Ingest] Inbound Webhook Verified: ${ticketKey}`);
    console.log(`[Status] Currently: ${currentStatus}`);
    console.log(`[Summary] ${summary}`);
    console.log(`-----------------------------------------`);

    if (currentStatus.toLowerCase() !== 'to do' && currentStatus.toLowerCase() !== 'open') {
      console.log(`[Notice] Skipping automation for ${ticketKey}: Status is already advanced.`);
      console.log(`=========================================`);
      return;
    }

    console.log(`[AI Agent] Routing payload to Llama 3 Infrastructure...`);
    const triageResult = await triageTicket(summary);

    const finalLog = {
      ticketKey,
      summary,
      aiResponse: triageResult,
      timestamp: new Date().toISOString(),
    };
    triageLogs.unshift(finalLog);

    // Store in database
    try {
      await pool.query(
        'INSERT INTO triage_logs (ticket_key, summary, category, risk_level, justification, ai_model) VALUES ($1, $2, $3, $4, $5, $6)',
        [ticketKey, summary, triageResult.category, triageResult.risk, triageResult.justification, 'llama3'],
      );
      console.log(`[Database] Triage log stored for ${ticketKey}`);
    } catch (dbErr) {
      console.error('[Database] Failed to store triage log:', dbErr.message);
    }

    // SLA Tracking
    try {
      const slaHours = getSlaHoursForRisk(triageResult.risk);
      await pool.query(
        'INSERT INTO sla_tracking (ticket_key, first_seen_at, sla_hours) VALUES ($1, NOW(), $2) ON CONFLICT (ticket_key) DO NOTHING',
        [ticketKey, slaHours],
      );
      console.log(`[SLA] Tracking started for ${ticketKey} (SLA: ${slaHours}h)`);
    } catch (slaErr) {
      console.error('[SLA] Failed to track ticket:', slaErr.message);
    }

    await transitionIssueToInProgress(ticketKey);

    console.log(`=========================================`);
  } catch (error) {
    console.error('[System Error] Webhook parsing failed:', error.message);
  }
});

export default router;
