export function buildTriagePrompt(summary) {
  return `
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
}

export async function classifyWithAI(summary) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  const aiHost = process.env.AI_SERVICE_URL || 'http://127.0.0.1:11434';

  const aiResponse = await fetch(`${aiHost}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'llama3',
      prompt: buildTriagePrompt(summary),
      stream: false,
      options: { temperature: 0.0 },
    }),
    signal: controller.signal,
  });

  clearTimeout(timeoutId);
  const aiData = await aiResponse.json();

  const rawText = aiData.response;
  const sanitizedText = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();

  return JSON.parse(sanitizedText);
}

export function classifyLocally(summary) {
  const upperSummary = summary.toUpperCase();

  let result = {
    category: 'FEATURE_REQUEST',
    risk: 'LOW',
    justification: 'Standard non-breaking feature iteration or layout modifications.',
  };

  if (
    upperSummary.includes('BUG') ||
    upperSummary.includes('CRASH') ||
    upperSummary.includes('FAIL') ||
    upperSummary.includes('ERROR')
  ) {
    result = { category: 'BUG', risk: 'MEDIUM', justification: 'Detected software malfunction indicator.' };
  }

  if (
    upperSummary.includes('VULNERABILITY') ||
    upperSummary.includes('INJECTION') ||
    upperSummary.includes('SECURITY') ||
    upperSummary.includes('CRITICAL')
  ) {
    result = {
      category: 'SECURITY_ALERT',
      risk: 'HIGH',
      justification: 'Threat vector indicators detected.',
    };
  }

  return result;
}

export async function triageTicket(summary) {
  try {
    const result = await classifyWithAI(summary);
    console.log('\n[Llama 3 Triage Parsed Object]:');
    console.log(result);
    return result;
  } catch {
    console.log('[Notice] AI Host offline or parsing failed. Activating Local Llama 3 Emulator...');
    const result = classifyLocally(summary);
    console.log('\n[Emulated Triage Parsed Object]:');
    console.log(result);
    return result;
  }
}
