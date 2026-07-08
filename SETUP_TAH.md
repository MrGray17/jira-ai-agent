# Setup Guide for Taha (Llama 3 + Backend Server)

This guide will help you set up the Jira AI Agent backend on your PC.

## Your Role

You are responsible for:
1. Running Ollama with Llama 3
2. Running the Node.js backend server
3. Exposing the server via Serveo tunnel

## Prerequisites

- Node.js (v18 or higher)
- Ollama installed and running
- Llama 3 model downloaded
- SSH access to your PC

---

## Step 1: Install Ollama and Llama 3

### Install Ollama
```bash
# Windows
# Download from https://ollama.com/download

# Or using winget
winget install Ollama.Ollama
```

### Download Llama 3
```bash
ollama pull llama3
```

### Verify Installation
```bash
# Check if Ollama is running
ollama list

# Test Llama 3
ollama run llama3 "Hello, respond with just 'OK'"
```

---

## Step 2: Clone the Repository

```bash
# Clone the repo
git clone https://github.com/MrGray17/jira-ai-agent.git

# Go to the project folder
cd jira-ai-agent

# Switch to the implementation branch
git checkout feature/full-implementation
```

---

## Step 3: Install Dependencies

```bash
npm install
```

---

## Step 4: Configure Environment

```bash
# Copy the example config
cp .env.example .env
```

Edit the `.env` file with the following values:

```env
# Server Configuration
PORT=3000
NODE_ENV=development

# Jira Configuration (Ask Mohamed for these values)
JIRA_BASE_URL=https://ai-agent-dev.atlassian.net
JIRA_DATA_CENTER_PAT=your_token_here
JIRA_WEBHOOK_SECRET=your_secret_here

# AI Service (Your PC)
AI_SERVICE_URL=http://127.0.0.1:11434

# PostgreSQL (Connection to DB person's PC)
DATABASE_URL=postgresql://user:password@localhost:5432/jira_agent
```

### Important Notes:
- `JIRA_DATA_CENTER_PAT` - Ask Mohamed for this token
- `JIRA_WEBHOOK_SECRET` - Ask Mohamed for this secret
- `DATABASE_URL` - You'll get this from the DB person later

---

## Step 5: Start Ollama

```bash
# Make sure Ollama is running on port 11434
ollama serve

# In another terminal, verify it's working
curl http://127.0.0.1:11434/api/tags
```

---

## Step 6: Start the Backend Server

```bash
# Start the server
npm start
```

You should see:
```
[Server] Core Orchestrator running on port 3000
[Tunnel Target] Expose http://localhost:3000 to your network tunnel.
[Database] Connected to PostgreSQL successfully.
```

**Note:** If you see `[Database] Connection failed`, that's OK - the server will run in memory-only mode. The database connection will be added later.

---

## Step 7: Expose via Serveo

```bash
# In a new terminal, run:
ssh -R jira-ai-agent:80:127.0.0.1:3000 serveo.net
```

You'll get a URL like:
```
https://jira-ai-agent.serveo.net
```

**Save this URL!** You'll need to give it to Mohamed for the Jira webhook configuration.

---

## Step 8: Test the Setup

### Test the Backend
```bash
# In a new terminal
curl http://localhost:3000/api/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "uptime": 123.456,
  "memory": { ... }
}
```

### Test Llama 3 Connection
```bash
curl http://localhost:3000/api/health
```

If Llama 3 is working, the server logs should show:
```
[AI Agent] Routing payload to Llama 3 Infrastructure...
[Llama 3 Triage Parsed Object]: { category: '...', risk: '...', justification: '...' }
```

---

## Troubleshooting

### Problem: "ECONNREFUSED 127.0.0.1:11434"
**Solution:** Ollama is not running. Start it with `ollama serve`.

### Problem: "Database Connection failed"
**Solution:** This is OK for now. The server will work without database. You'll connect to the database later.

### Problem: "Jira API Error"
**Solution:** Check that `JIRA_DATA_CENTER_PAT` and `JIRA_BASE_URL` are correct in `.env`.

### Problem: Serveo not working
**Solution:** Try a different subdomain:
```bash
ssh -R my-jira-agent:80:127.0.0.1:3000 serveo.net
```

---

## What to Report to Mohamed

After setup, tell Mohamed:
1. ✅ Ollama is running on port 11434
2. ✅ Backend server is running on port 3000
3. ✅ Serveo URL is: `https://your-subdomain.serveo.net`
4. ❌ Any errors you encountered

---

## Quick Reference

| Service | Port | Command |
|---------|------|---------|
| Ollama | 11434 | `ollama serve` |
| Backend | 3000 | `npm start` |
| Serveo | 80 | `ssh -R jira-ai-agent:80:127.0.0.1:3000 serveo.net` |

---

## Need Help?

Contact Mohamed if you have any issues. He will provide:
- Jira credentials
- Database connection details
- Webhook configuration
