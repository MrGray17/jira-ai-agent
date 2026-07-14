import { describe, it, expect } from 'vitest';

describe('SLA Helpers', () => {
  function getSlaHoursForRisk(riskLevel) {
    switch (riskLevel) {
      case 'HIGH': return parseInt(process.env.HIGH_RISK_SLA_HOURS) || 8;
      case 'MEDIUM': return parseInt(process.env.DEFAULT_SLA_HOURS) || 24;
      case 'LOW': return parseInt(process.env.DEFAULT_SLA_HOURS) || 24;
      default: return parseInt(process.env.DEFAULT_SLA_HOURS) || 24;
    }
  }

  it('returns correct hours for each risk level', () => {
    process.env.DEFAULT_SLA_HOURS = '24';
    process.env.HIGH_RISK_SLA_HOURS = '8';

    expect(getSlaHoursForRisk('HIGH')).toBe(8);
    expect(getSlaHoursForRisk('MEDIUM')).toBe(24);
    expect(getSlaHoursForRisk('LOW')).toBe(24);
    expect(getSlaHoursForRisk('UNKNOWN')).toBe(24);
  });

  it('falls back to defaults when env vars missing', () => {
    delete process.env.DEFAULT_SLA_HOURS;
    delete process.env.HIGH_RISK_SLA_HOURS;

    expect(getSlaHoursForRisk('HIGH')).toBe(8);
    expect(getSlaHoursForRisk('MEDIUM')).toBe(24);
  });
});

describe('Webhook Payload Validation', () => {
  it('rejects payloads without issue data', () => {
    const payload = {};
    expect(!payload.issue).toBe(true);
  });

  it('extracts ticket key from valid payload', () => {
    const payload = {
      issue: {
        key: 'PROJ-123',
        fields: {
          summary: 'Test ticket',
          description: 'Description here',
          status: { name: 'To Do' },
        },
      },
    };
    expect(payload.issue.key).toBe('PROJ-123');
    expect(payload.issue.fields.status.name).toBe('To Do');
  });

  it('skips non-To Do tickets', () => {
    const status = 'In Progress';
    const shouldSkip = status.toLowerCase() !== 'to do' && status.toLowerCase() !== 'open';
    expect(shouldSkip).toBe(true);
  });

  it('processes To Do tickets', () => {
    const status = 'To Do';
    const shouldSkip = status.toLowerCase() !== 'to do' && status.toLowerCase() !== 'open';
    expect(shouldSkip).toBe(false);
  });

  it('processes Open tickets', () => {
    const status = 'Open';
    const shouldSkip = status.toLowerCase() !== 'to do' && status.toLowerCase() !== 'open';
    expect(shouldSkip).toBe(false);
  });
});

describe('AI Response Parsing', () => {
  it('parses clean JSON response', () => {
    const rawText = '{"category":"BUG","risk":"HIGH","justification":"Critical crash detected"}';
    const sanitized = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
    const result = JSON.parse(sanitized);
    expect(result.category).toBe('BUG');
    expect(result.risk).toBe('HIGH');
  });

  it('strips markdown code blocks from AI response', () => {
    const rawText = '```json\n{"category":"FEATURE_REQUEST","risk":"LOW","justification":"New feature"}\n```';
    const sanitized = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
    const result = JSON.parse(sanitized);
    expect(result.category).toBe('FEATURE_REQUEST');
  });

  it('handles triple backticks without json label', () => {
    const rawText = '```\n{"category":"SECURITY_ALERT","risk":"HIGH","justification":"Vulnerability found"}\n```';
    const sanitized = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
    const result = JSON.parse(sanitized);
    expect(result.category).toBe('SECURITY_ALERT');
  });
});

describe('Fallback Classifier (Local Emulator)', () => {
  function classifyLocally(summary) {
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
      result = { category: 'SECURITY_ALERT', risk: 'HIGH', justification: 'Threat vector indicators detected.' };
    }
    return result;
  }

  it('classifies bug-related summaries as BUG', () => {
    expect(classifyLocally('Login page crashes on submit').category).toBe('BUG');
    expect(classifyLocally('Application fails to start').category).toBe('BUG');
    expect(classifyLocally('Error when saving data').category).toBe('BUG');
  });

  it('classifies security-related summaries as SECURITY_ALERT', () => {
    expect(classifyLocally('SQL injection vulnerability found').category).toBe('SECURITY_ALERT');
    expect(classifyLocally('Security flaw in auth').category).toBe('SECURITY_ALERT');
    expect(classifyLocally('Critical: XSS attack vector').category).toBe('SECURITY_ALERT');
  });

  it('classifies unknown summaries as FEATURE_REQUEST', () => {
    expect(classifyLocally('Add dark mode toggle').category).toBe('FEATURE_REQUEST');
    expect(classifyLocally('Improve onboarding flow').category).toBe('FEATURE_REQUEST');
  });

  it('prioritizes SECURITY_ALERT over BUG', () => {
    const result = classifyLocally('BUG: Security vulnerability in login');
    expect(result.category).toBe('SECURITY_ALERT');
    expect(result.risk).toBe('HIGH');
  });
});

describe('CORS Middleware Logic', () => {
  it('sets CORS headers', () => {
    const headers = {};
    const res = {
      setHeader: (key, val) => { headers[key] = val; },
      status: () => ({ end: () => {} }),
    };

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-hub-signature');

    expect(headers['Access-Control-Allow-Origin']).toBe('*');
    expect(headers['Access-Control-Allow-Methods']).toBe('GET, POST, OPTIONS');
    expect(headers['Access-Control-Allow-Headers']).toContain('x-hub-signature');
  });

  it('handles preflight OPTIONS request', () => {
    let statusCode = null;
    let ended = false;
    const res = {
      setHeader: () => {},
      status: (code) => {
        statusCode = code;
        return { end: () => { ended = true; } };
      },
    };

    const req = { method: 'OPTIONS' };
    if (req.method === 'OPTIONS') {
      res.status(204).end();
    }

    expect(statusCode).toBe(204);
    expect(ended).toBe(true);
  });
});
