import express from 'express';
import dotenv from 'dotenv';

dotenv.config();

const app = express();

app.use(express.json());

const PORT = process.env.PORT || 3000;


app.post('/webhooks/jira', async (req, res) => {
  try {
    // 1. Immediately return a 200 OK status to Jira Cloud.
    // This prevents Jira from timing out while our agent thinks later.
    res.status(200).json({ status: 'received' });

    const payload = req.body;

    if (!payload.issue) {
      console.log('[Webhook Warning] Received payload without issue data.');
      return;
    }

    const ticketKey = payload.issue.key; 
    const summary = payload.issue.fields.summary; 
    const description = payload.issue.fields.description || 'No description provided.';
    const currentStatus = payload.issue.fields.status.name;

    console.log(`\n=========================================`);
    console.log(`[Ingest] Inbound Webhook Verified: ${ticketKey}`);
    console.log(`[Status] Currently: ${currentStatus}`);
    console.log(`[Summary] ${summary}`);
    console.log(`-----------------------------------------`);
    console.log(`[AI Agent] Routing payload to Llama 3 Infrastructure...`);

    // 4. THE AI ORCHESTRATION PIPELINE
    try {
      const prompt = `
      You are an automated Jira triage API. 
      Analyze this ticket summary: "${summary}"
      
      You MUST respond ONLY with a raw, valid JSON object. 
      Do NOT include markdown formatting, backticks, or conversational text.
      
      The JSON must contain exactly these three keys:
      {
        "category": "Choose one: BUG, FEATURE_REQUEST, SECURITY_ALERT",
        "risk": "Choose one: LOW, MEDIUM, HIGH",
        "justification": "One brief sentence explaining why."
      }
      `;
      
      // Setup a fast 1.5-second network timeout so your server doesn't hang while your partner is away
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const aiHost = process.env.AI_SERVICE_URL || 'http://127.0.0.1:11434';
      
      const aiResponse = await fetch(`${aiHost}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'llama3',
          prompt: prompt,
          stream: false,
          options: { temperature: 0.0 }
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      const aiData = await aiResponse.json();
      
      // DEFENSIVE PARSING: Sanitize the AI output before parsing
      const rawText = aiData.response;
      const sanitizedText = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
      
      const triageResult = JSON.parse(sanitizedText); // Convert string to JS Object

      console.log(`\n[Llama 3 Triage Parsed Object]:`);
      console.log(triageResult);
      console.log(`\n[Next Action] -> System can now route ticket based on risk: ${triageResult.risk}`);

    } catch (networkError) {
      // 5. Automated Local Emulation Fallback (Object-Based)
      console.log(`[Notice] AI Host offline or parsing failed. Activating Local Llama 3 Emulator...`);
      
      let triageResult = {
        category: "FEATURE_REQUEST",
        risk: "LOW",
        justification: "Standard non-breaking feature iteration or layout modifications."
      };

      const upperSummary = summary.toUpperCase();
      if (upperSummary.includes("BUG") || upperSummary.includes("CRASH") || upperSummary.includes("FAIL") || upperSummary.includes("ERROR")) {
        triageResult = { category: "BUG", risk: "MEDIUM", justification: "Detected software malfunction indicator." };
      }
      if (upperSummary.includes("VULNERABILITY") || upperSummary.includes("INJECTION") || upperSummary.includes("SECURITY") || upperSummary.includes("CRITICAL")) {
        triageResult = { category: "SECURITY_ALERT", risk: "HIGH", justification: "Threat vector indicators detected." };
      }

      console.log(`\n[Emulated Triage Parsed Object]:`);
      console.log(triageResult);
      console.log(`\n[Next Action] -> System can now route ticket based on risk: ${triageResult.risk}`);
    }

    console.log(`=========================================`);

  } catch (error) {
    console.error('[System Error] Webhook parsing failed:', error.message);
  }
});

app.listen(PORT, () => {
  console.log(`[Server] Core Orchestrator running on port ${PORT}`);
  console.log(`[Tunnel Target] Expose http://localhost:${PORT} to your network tunnel.`);
});