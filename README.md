# Jira AI Agent

AI-powered Jira ticket triage and automation system for Maroc Telecom.

## Overview

This system automatically:
1. Receives Jira webhooks when tickets are created
2. Classifies tickets using AI (Llama 3)
3. Transitions tickets from "To Do" to "In Progress"
4. Tracks SLA compliance
5. Displays results on a cyberpunk-themed dashboard

## Architecture

```
┌─────────────────┐    Webhook    ┌──────────────────┐    ┌───────────────────┐
│  Jira Cloud     │─────────────▶│  Node.js Backend  │───▶│  Llama 3 (Ollama) │
│  (KAN board)    │              │  :3000             │    │  :11434            │
└─────────────────┘              └────────┬─────────┘    └───────────────────┘
                                          │
                                          ▼
                                 ┌──────────────────┐
                                 │  PostgreSQL       │
                                 │  (triage logs,    │
                                 │   SLA tracking)   │
                                 └──────────────────┘
```

## Setup Instructions

### 1. Backend Setup

```bash
# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your credentials

# Start the server
npm start
```

### 2. Dashboard Setup

```bash
cd jira-ai-dashboard

# Install dependencies
npm install

# Start the dashboard
npm start
```

### 3. PostgreSQL Setup (Optional)

If you want persistent storage:

```bash
# Create database
createdb jira_agent

# Run the server (tables are created automatically)
npm start
```

### 4. Expose via Serveo

```bash
# From the PC running the backend
ssh -R your-subdomain:80:127.0.0.1:3000 serveo.net
```

### 5. Configure Jira Webhook

1. Go to Jira → Settings → Webhooks
2. Add new webhook:
   - URL: `https://your-subdomain.serveo.net/webhooks/jira`
   - Events: Issue created

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/webhooks/jira` | POST | Jira webhook receiver |
| `/api/triage-logs` | GET | Fetch triage logs |
| `/api/sla-status` | GET | Fetch SLA tracking data |
| `/api/health` | GET | Health check |

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | 3000 |
| `NODE_ENV` | Environment (development/production) | development |
| `JIRA_BASE_URL` | Jira instance URL | - |
| `JIRA_DATA_CENTER_PAT` | Personal Access Token | - |
| `JIRA_WEBHOOK_SECRET` | Webhook secret for verification | - |
| `AI_SERVICE_URL` | Ollama API URL | http://127.0.0.1:11434 |
| `DATABASE_URL` | PostgreSQL connection string | - |

## Team Setup

### Your PC (Developer)
- Code development and testing
- Push to GitHub

### Friend's PC (Llama 3)
- Run the backend
- Run Ollama with Llama 3
- Expose via Serveo

### Person 3's PC (PostgreSQL)
- Run PostgreSQL
- Accept connections from backend

## Testing

1. Start the backend: `npm start`
2. Start the dashboard: `cd jira-ai-dashboard && npm start`
3. Create a test ticket in Jira
4. Watch the terminal for triage logs
5. Open the dashboard to see results

## License

ISC
