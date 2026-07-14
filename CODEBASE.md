# JIRA AI AGENT - COMPLETE CODEBASE

## Project Structure

```
jira-ai-agent/
  index.js                          (Backend - Node.js/Express)
  package.json                      (Backend dependencies)
  .env                              (Environment config - NOT in git)
  .env.example                      (Environment template)
  .gitignore
  jira-ai-dashboard/
    package.json                    (Frontend dependencies)
    src/
      index.html
      main.ts
      app/
        app.ts                      (Main Angular component)
        app.html                    (Dashboard template)
        app.css                     (SOC-themed styles)
        app.config.ts               (Angular config)
        triage.ts                   (API service)
        app.spec.ts                 (Component test)
        triage.spec.ts              (Service test)
```

---

## FILE: index.js (Backend)

```javascript
import express from 'express';
import dotenv from 'dotenv';
import crypto from 'crypto';
import pg from 'pg';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// PostgreSQL Connection
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/jira_agent',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Test database connection
pool.connect((err, client, release) => {
  if (err) {
    console.error('[Database] Connection failed:', err.message);
    console.log('[Database] Running in memory-only mode. Triage logs will not persist.');
  } else {
    console.log('[Database] Connected to PostgreSQL successfully.');
    release();
  }
});

app.use(express.json({
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));

// In-memory fallback for when database is unavailable
let triageLogs = [];

// Initialize database tables
async function initializeDatabase() {
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

// Initialize tables on startup
initializeDatabase();

/**
 * Verification Gate: Validates corporate HMAC-SHA256 webhook signatures
 */
function verifyJiraSignature(req, res, next) {
  if (process.env.NODE_ENV === 'development') {
    console.log('[Security Gate] NODE_ENV is set to development. Skipping signature verification.');
    return next();
  }

  const signature = req.headers['x-hub-signature'];
  if (!signature) {
    console.error('[Security Warning] Dropping request: Missing x-hub-signature header.');
    return res.status(401).send('Unauthorized');
  }

  const computedHash = 'sha256=' + crypto
    .createHmac('sha256', process.env.JIRA_WEBHOOK_SECRET || 'SECRET_KEY_NOT_SET')
    .update(req.rawBody)
    .digest('hex');

  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(computedHash))) {
    console.error('[Security Warning] Dropping request: Signature hash mismatch.');
    return res.status(403).send('Forbidden');
  }

  next();
}

/**
 * Automates the issue state shift to 'In Progress' via Jira REST API
 */
async function transitionIssueToInProgress(issueKey) {
  const jiraUrl = `${process.env.JIRA_BASE_URL}/rest/api/2/issue/${issueKey}/transitions`;
  const authHeaders = {
    'Authorization': `Bearer ${process.env.JIRA_DATA_CENTER_PAT}`,
    'Content-Type': 'application/json'
  };

  try {
    console.log(`[Jira API] Fetching available workflow transitions for ${issueKey}...`);
    
    const schemaResponse = await fetch(jiraUrl, {
      method: 'GET',
      headers: authHeaders
    });
    
    if (!schemaResponse.ok) {
      throw new Error(`Failed fetching transitions schema: ${schemaResponse.status}`);
    }

    const schemaData = await schemaResponse.json();
    const transitions = schemaData.transitions || [];

    const targetTransition = transitions.find(t => 
      t.name.toLowerCase().includes('in progress') || t.name.toLowerCase().includes('start progress')
    );

    if (!targetTransition) {
      console.log(`[Jira API] Mapping halted: No available 'In Progress' transition found for ${issueKey}.`);
      return;
    }

    console.log(`[Jira API] Target state mapped to transition ID ${targetTransition.id}. Executing...`);

    const transitionResponse = await fetch(jiraUrl, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        transition: { id: targetTransition.id }
      })
    });

    if (transitionResponse.ok) {
      console.log(`[Jira API] Success: Ticket ${issueKey} moved to In Progress.`);
    } else {
      console.log(`[Jira API] Server rejected state change transition: ${transitionResponse.status}`);
    }

  } catch (err) {
    console.error(`[Jira API Error] Loop failed for issue ${issueKey}:`, err.message);
  }
}

/**
 * Main Webhook Handler with Embedded Llama-3 Processing and Automation Loops
 */
app.post('/webhooks/jira', verifyJiraSignature, async (req, res) => {
  try {
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

    if (currentStatus.toLowerCase() !== 'to do' && currentStatus.toLowerCase() !== 'open') {
      console.log(`[Notice] Skipping automation for ${ticketKey}: Status is already advanced.`);
      console.log(`=========================================`);
      return;
    }

    console.log(`[AI Agent] Routing payload to Llama 3 Infrastructure...`);
    let triageResult;

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
      
      const rawText = aiData.response;
      const sanitizedText = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
      
      triageResult = JSON.parse(sanitizedText);

      console.log(`\n[Llama 3 Triage Parsed Object]:`);
      console.log(triageResult);

    } catch (networkError) {
      console.log(`[Notice] AI Host offline or parsing failed. Activating Local Llama 3 Emulator...`);
      
      triageResult = {
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
    }

    const finalLog = {
      ticketKey,
      summary,
      aiResponse: triageResult,
      timestamp: new Date().toISOString()
    };
    triageLogs.unshift(finalLog);

    // Store in database
    try {
      await pool.query(
        'INSERT INTO triage_logs (ticket_key, summary, category, risk_level, justification, ai_model) VALUES ($1, $2, $3, $4, $5, $6)',
        [ticketKey, summary, triageResult.category, triageResult.risk, triageResult.justification, 'llama3']
      );
      console.log(`[Database] Triage log stored for ${ticketKey}`);
    } catch (dbErr) {
      console.error('[Database] Failed to store triage log:', dbErr.message);
    }

    // SLA Tracking
    try {
      const slaResult = await pool.query(
        'INSERT INTO sla_tracking (ticket_key, first_seen_at) VALUES ($1, NOW()) ON CONFLICT (ticket_key) DO NOTHING',
        [ticketKey]
      );
      console.log(`[SLA] Tracking started for ${ticketKey}`);
    } catch (slaErr) {
      console.error('[SLA] Failed to track ticket:', slaErr.message);
    }

    await transitionIssueToInProgress(ticketKey);

    console.log(`=========================================`);

  } catch (error) {
    console.error('[System Error] Webhook parsing failed:', error.message);
  }
});

app.get('/api/triage-logs', async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  try {
    const result = await pool.query('SELECT * FROM triage_logs ORDER BY processed_at DESC LIMIT 100');
    const dbLogs = result.rows.map(row => ({
      ticketKey: row.ticket_key,
      summary: row.summary,
      aiResponse: {
        category: row.category,
        risk: row.risk_level,
        justification: row.justification
      },
      timestamp: row.processed_at
    }));
    res.json(dbLogs);
  } catch (err) {
    console.error('[Database] Failed to fetch triage logs:', err.message);
    res.json(triageLogs);
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage()
  });
});

// SLA status endpoint
app.get('/api/sla-status', async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  
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

app.listen(PORT, () => {
  console.log(`[Server] Core Orchestrator running on port ${PORT}`);
  console.log(`[Tunnel Target] Expose http://localhost:${PORT} to your network tunnel.`);
});
```

---

## FILE: package.json (Backend)

```json
{
  "name": "jira-ai-agent",
  "version": "1.0.0",
  "description": "AI-powered Jira ticket triage and automation system",
  "main": "index.js",
  "scripts": {
    "start": "node index.js",
    "dev": "NODE_ENV=development node index.js",
    "test": "echo \"Error: no test specified\" && exit 1"
  },
  "keywords": ["jira", "ai", "triage", "automation"],
  "author": "",
  "license": "ISC",
  "type": "module",
  "dependencies": {
    "dotenv": "^17.4.2",
    "express": "^5.2.1",
    "pg": "^8.13.0"
  }
}
```

---

## FILE: .env (Environment - NOT in git)

```
PORT=3000
NODE_ENV=development
JIRA_BASE_URL=https://ai-agent-dev.atlassian.net
JIRA_DATA_CENTER_PAT=ATATT3xFfGF0En4z9HXU4T-0dLH1Q85ySZBok49lgSBW2yOcRN-2q-4w7QGE3mt-OF2HKw9tB58qFa-Jx-FjCKcbj_UyO-_bhBoUBTp0SXAgxJTdlsNOxQD7F-huKEXhCY_i8mBVvS9Ba7Qb5xnR1UQgBUN0MG-rS2E4TwmbGozp6_17oqMlbzU=004CE355
JIRA_WEBHOOK_SECRET=1155afe83dc499126a5e2560d23b723968c1830891f5de418b0d07a6715d68a6
DATABASE_URL=postgresql://jira_agent_user:1234@192.168.1.114:5432/jira_agent
```

---

## FILE: .env.example (Template)

```
# Server Configuration
PORT=3000
NODE_ENV=development

# Jira Configuration
JIRA_BASE_URL=https://ai-agent-dev.atlassian.net
JIRA_DATA_CENTER_PAT=your_personal_access_token_here
JIRA_WEBHOOK_SECRET=your_webhook_secret_here

# AI Service (Llama 3 via Ollama)
AI_SERVICE_URL=http://127.0.0.1:11434

# PostgreSQL Database
DATABASE_URL=postgresql://user:password@localhost:5432/jira_agent

# SLA Configuration (in hours)
DEFAULT_SLA_HOURS=24
CRITICAL_SLA_HOURS=2
HIGH_RISK_SLA_HOURS=8
```

---

## FILE: .gitignore

```
# Dependency Directories
node_modules/
jspm_packages/

# Environment Configurations (CRITICAL SECURITY)
.env
.env.local
.env.development.local
.env.test.local
.env.production.local

# Debug and System Logs
npm-debug.log*
yarn-debug.log*
yarn-error.log*
logs/
*.log

# Operating System Garbage Files
.DS_Store
Thumbs.db
```

---

## FILE: jira-ai-dashboard/package.json

```json
{
  "name": "jira-ai-dashboard",
  "version": "0.0.0",
  "scripts": {
    "ng": "ng",
    "start": "ng serve",
    "build": "ng build",
    "watch": "ng build --watch --configuration development",
    "test": "ng test"
  },
  "private": true,
  "packageManager": "npm@11.16.0",
  "dependencies": {
    "@angular/common": "^22.0.0",
    "@angular/compiler": "^22.0.0",
    "@angular/core": "^22.0.0",
    "@angular/forms": "^22.0.0",
    "@angular/platform-browser": "^22.0.0",
    "@angular/router": "^22.0.0",
    "rxjs": "~7.8.0",
    "tslib": "^2.3.0"
  },
  "devDependencies": {
    "@angular/build": "^22.0.5",
    "@angular/cli": "^22.0.5",
    "@angular/compiler-cli": "^22.0.0",
    "jsdom": "^28.0.0",
    "prettier": "^3.8.1",
    "typescript": "~6.0.2",
    "vitest": "^4.0.8"
  }
}
```

---

## FILE: jira-ai-dashboard/src/index.html

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>JiraAiDashboard</title>
  <base href="/">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="icon" type="image/x-icon" href="favicon.ico">
</head>
<body>
  <app-root></app-root>
</body>
</html>
```

---

## FILE: jira-ai-dashboard/src/main.ts

```typescript
import 'zone.js'; 
import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app';

bootstrapApplication(AppComponent, appConfig)
  .catch((err) => console.error(err));
```

---

## FILE: jira-ai-dashboard/src/app/app.ts

```typescript
import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TriageService, TriageLog } from './triage';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule], 
  templateUrl: './app.html',
  styleUrls: ['./app.css']
})
export class AppComponent implements OnInit {
  private triageService = inject(TriageService);

  logs: TriageLog[] = [];

  ngOnInit(): void {
    this.fetchData();
  }

  fetchData(): void {
    this.triageService.getTriageLogs().subscribe({
      next: (data) => {
        this.logs = data;
        console.log('Successfully pulled triage logs:', data);
      },
      error: (err) => {
        console.error('Failed to reach backend:', err);
      }
    });
  }
}
```

---

## FILE: jira-ai-dashboard/src/app/app.html

```html
<div class="terminal-container">
  
  <!-- SOC Header -->
  <header class="soc-header">
    <div class="brand-block">
      <h1>Jira Triage Engine</h1>
      <div class="meta-data">
        
      </div>
    </div>
    <button class="btn-sync" (click)="fetchData()">[ EXECUTE SYNC ]</button>
  </header>

  <!-- Idle / Awaiting Payload -->
  <div *ngIf="logs.length === 0" class="empty-state">
    <span>> AWAITING INBOUND WEBHOOK PAYLOAD_</span>
  </div>

  <!-- Operational Data Grid -->
  <div *ngIf="logs.length > 0" class="log-grid">
    <div *ngFor="let log of logs; let i = index" 
         class="triage-card" 
         [style.animation-delay]="i * 0.05 + 's'">
      
      <!-- Metadata Row -->
      <div class="card-header">
        <span class="ticket-id">ID: {{ log.ticketKey }}</span>
        <span class="timestamp">SYS_TIME: {{ log.timestamp | date:'HH:mm:ss:SSS' }}</span>
      </div>

      <!-- Ticket Core -->
      <h3 class="summary-title">{{ log.summary }}</h3>
      
      <!-- Tactical Badges -->
      <div class="badge-row">
        <span class="badge" 
              [ngClass]="{
                'badge-sec': log.aiResponse.category === 'SECURITY_ALERT', 
                'badge-bug': log.aiResponse.category === 'BUG', 
                'badge-feat': log.aiResponse.category === 'FEATURE_REQUEST'
              }">
          TYPE // {{ log.aiResponse.category }}
        </span>
        <span class="badge"
              [ngClass]="{
                'risk-high': log.aiResponse.risk === 'HIGH', 
                'risk-med': log.aiResponse.risk === 'MEDIUM', 
                'risk-low': log.aiResponse.risk === 'LOW'
              }">
          RISK // {{ log.aiResponse.risk }}
        </span>
      </div>

      <!-- Raw AI Telemetry -->
      <div class="ai-output">
        <strong>LLM_JUSTIFICATION:</strong>{{ log.aiResponse.justification }}
      </div>

    </div>
  </div>

</div>
```

---

## FILE: jira-ai-dashboard/src/app/app.css

```css
@import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400..700&family=JetBrains+Mono:wght@400;700&display=swap');

:root {
  --bg-base: #050505;
  --bg-panel: #0a0a0a;
  --border-dim: #1f1f22;
  --border-bright: #3a3a40;
  
  --text-primary: #f4f4f5;
  --text-secondary: #8b8b93;
  
  --threat-critical: #ff1e56;
  --threat-warn: #ffc400;
  --threat-low: #00e676;
  --system-blue: #00f0ff;
}

:host {
  display: block;
  min-height: 100vh;
  background-color: var(--bg-base);
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='0.04'/%3E%3C/svg%3E");
  color: var(--text-primary);
  font-family: 'Bricolage Grotesque', sans-serif;
  padding: 32px;
  box-sizing: border-box;
}

.terminal-container {
  max-width: 1400px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 32px;
}

.soc-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  border-bottom: 2px solid var(--border-bright);
  padding-bottom: 16px;
}

.brand-block h1 {
  font-size: 32px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: -0.05em;
  margin: 0 0 8px 0;
  display: flex;
  align-items: center;
  gap: 12px;
}

.brand-block h1::before {
  content: '';
  display: block;
  width: 12px;
  height: 12px;
  background-color: var(--system-blue);
  box-shadow: 0 0 10px var(--system-blue);
  animation: pulse 2s infinite;
}

.meta-data {
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  color: var(--text-secondary);
  display: flex;
  gap: 24px;
}

.meta-data span strong {
  color: var(--system-blue);
}

.btn-sync {
  background: transparent;
  color: var(--system-blue);
  border: 1px solid var(--system-blue);
  font-family: 'JetBrains Mono', monospace;
  font-size: 13px;
  padding: 10px 24px;
  cursor: pointer;
  text-transform: uppercase;
  transition: all 0.15s ease-out;
  position: relative;
  overflow: hidden;
}

.btn-sync:hover {
  background: var(--system-blue);
  color: var(--bg-base);
  box-shadow: 0 0 15px rgba(0, 240, 255, 0.3);
}

.btn-sync:active {
  transform: translateY(2px);
}

.log-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(600px, 1fr));
  gap: 24px;
}

.triage-card {
  background: var(--bg-panel);
  border: 1px solid var(--border-dim);
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  position: relative;
  transition: border-color 0.2s ease;
  animation: slideUpFade 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
  opacity: 0;
}

.triage-card:hover {
  border-color: var(--border-bright);
}

.triage-card::before {
  content: '';
  position: absolute;
  top: 0;
  right: 0;
  border-width: 0 16px 16px 0;
  border-style: solid;
  border-color: var(--bg-base) var(--bg-base) var(--border-dim) var(--border-dim);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  border-bottom: 1px dashed var(--border-dim);
  padding-bottom: 12px;
}

.ticket-id {
  color: var(--text-primary);
  font-weight: 700;
  background: var(--border-dim);
  padding: 4px 8px;
  letter-spacing: 0.05em;
}

.summary-title {
  font-size: 20px;
  font-weight: 600;
  margin: 0;
  line-height: 1.4;
  color: var(--text-primary);
}

.badge-row {
  display: flex;
  gap: 12px;
  margin-top: 4px;
}

.badge {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  font-weight: 700;
  padding: 4px 10px;
  border: 1px solid;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.badge-sec { color: var(--threat-critical); border-color: var(--threat-critical); background: rgba(255, 30, 86, 0.05); }
.badge-bug { color: var(--threat-warn); border-color: var(--threat-warn); background: rgba(255, 196, 0, 0.05); }
.badge-feat { color: var(--system-blue); border-color: var(--system-blue); background: rgba(0, 240, 255, 0.05); }

.risk-high { background: var(--threat-critical); color: var(--bg-base); border-color: var(--threat-critical); }
.risk-med { background: var(--threat-warn); color: var(--bg-base); border-color: var(--threat-warn); }
.risk-low { background: var(--threat-low); color: var(--bg-base); border-color: var(--threat-low); }

.ai-output {
  background: rgba(255, 255, 255, 0.02);
  border-left: 2px solid var(--border-bright);
  padding: 16px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  color: var(--text-secondary);
  line-height: 1.6;
}

.ai-output strong {
  color: var(--text-primary);
  margin-right: 8px;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 100px 0;
  font-family: 'JetBrains Mono', monospace;
  color: var(--border-bright);
  border: 1px dashed var(--border-bright);
}

.empty-state span {
  font-size: 14px;
  animation: blink 1.5s infinite;
}

@keyframes pulse {
  0% { opacity: 1; box-shadow: 0 0 10px var(--system-blue); }
  50% { opacity: 0.4; box-shadow: 0 0 2px var(--system-blue); }
  100% { opacity: 1; box-shadow: 0 0 10px var(--system-blue); }
}

@keyframes slideUpFade {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}
```

---

## FILE: jira-ai-dashboard/src/app/app.config.ts

```typescript
import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideHttpClient() 
  ]
};
```

---

## FILE: jira-ai-dashboard/src/app/triage.ts

```typescript
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface TriageLog {
  ticketKey: string;
  summary: string;
  aiResponse: {
    category: 'BUG' | 'FEATURE_REQUEST' | 'SECURITY_ALERT';
    risk: 'LOW' | 'MEDIUM' | 'HIGH';
    justification: string;
  };
  timestamp: string;
}

@Injectable({
  providedIn: 'root'
})
export class TriageService {
  private http = inject(HttpClient);
  
  private apiUrl = 'http://localhost:3000/api/triage-logs';

  getTriageLogs(): Observable<TriageLog[]> {
    return this.http.get<TriageLog[]>(this.apiUrl);
  }
}
```

---

## FILE: jira-ai-dashboard/src/app/app.spec.ts

```typescript
import { TestBed } from '@angular/core/testing';
import { AppComponent } from './app';

describe('AppComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should have empty logs initially', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app.logs).toEqual([]);
  });
});
```

---

## FILE: jira-ai-dashboard/src/app/triage.spec.ts

```typescript
import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { TriageService } from './triage';

describe('TriageService', () => {
  let service: TriageService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule]
    });
    service = TestBed.inject(TriageService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
```

---

## DATABASE SCHEMA (Auto-created by backend)

```sql
CREATE TABLE IF NOT EXISTS triage_logs (
  id SERIAL PRIMARY KEY,
  ticket_key VARCHAR(50) NOT NULL,
  summary TEXT,
  category VARCHAR(50),
  risk_level VARCHAR(20),
  justification TEXT,
  ai_model VARCHAR(50),
  processed_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sla_tracking (
  id SERIAL PRIMARY KEY,
  ticket_key VARCHAR(50) UNIQUE NOT NULL,
  first_seen_at TIMESTAMP DEFAULT NOW(),
  transitioned_at TIMESTAMP,
  sla_hours INTEGER DEFAULT 24,
  is_breached BOOLEAN DEFAULT FALSE
);
```

---

## API ENDPOINTS

| Endpoint | Method | Description |
|----------|--------|-------------|
| /webhooks/jira | POST | Jira webhook receiver |
| /api/triage-logs | GET | Fetch triage logs |
| /api/sla-status | GET | Fetch SLA tracking data |
| /api/health | GET | Health check |

---

## SETUP COMMANDS

### Backend (Taha)
```bash
git clone -b feature/full-implementation https://github.com/MrGray17/jira-ai-agent.git
cd jira-ai-agent
npm install
notepad .env
node index.js
```

### Ollama (Taha)
```bash
ollama serve
```

### Serveo Tunnel (Taha)
```bash
ssh -R jira-ai-agent:80:127.0.0.1:3000 serveo.net
```

### Dashboard (Your PC)
```bash
cd jira-ai-dashboard
npm install
npm start
```
