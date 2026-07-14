import { pool } from '../db.js';

export async function transitionIssueToInProgress(issueKey) {
  const jiraUrl = `${process.env.JIRA_BASE_URL}/rest/api/2/issue/${issueKey}/transitions`;
  const authHeaders = {
    Authorization: `Bearer ${process.env.JIRA_DATA_CENTER_PAT}`,
    'Content-Type': 'application/json',
  };

  try {
    console.log(`[Jira API] Fetching available workflow transitions for ${issueKey}...`);

    const schemaResponse = await fetch(jiraUrl, {
      method: 'GET',
      headers: authHeaders,
    });

    if (!schemaResponse.ok) {
      throw new Error(`Failed fetching transitions schema: ${schemaResponse.status}`);
    }

    const schemaData = await schemaResponse.json();
    const transitions = schemaData.transitions || [];

    const targetTransition = transitions.find(
      (t) =>
        t.name.toLowerCase().includes('in progress') || t.name.toLowerCase().includes('start progress'),
    );

    if (!targetTransition) {
      console.log(`[Jira API] Mapping halted: No available 'In Progress' transition found for ${issueKey}.`);
      return;
    }

    console.log(`[Jira API] Target state mapped to transition ID ${targetTransition.id}. Executing...`);

    const transitionResponse = await fetch(jiraUrl, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ transition: { id: targetTransition.id } }),
    });

    if (transitionResponse.ok) {
      console.log(`[Jira API] Success: Ticket ${issueKey} moved to In Progress.`);
      try {
        await pool.query('UPDATE sla_tracking SET transitioned_at = NOW() WHERE ticket_key = $1', [issueKey]);
      } catch (err) {
        console.error('[SLA] Failed to record transition time:', err.message);
      }
    } else {
      console.log(`[Jira API] Server rejected state change transition: ${transitionResponse.status}`);
    }
  } catch (err) {
    console.error(`[Jira API Error] Loop failed for issue ${issueKey}:`, err.message);
  }
}
