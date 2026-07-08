# Taha's Setup Guide

Follow these steps in order. Do not skip any step.

---

## Step 1: Install Node.js

1. Go to https://nodejs.org
2. Download the LTS version (green button)
3. Run the installer
4. Click "Next" through everything (use default settings)

**Check it worked:**
Open Command Prompt and type:
```
node --version
```
You should see a version number like `v20.11.0`. If you see an error, restart your computer.

---

## Step 2: Install Ollama

1. Go to https://ollama.com/download
2. Download for Windows
3. Run the installer
4. Click "Install"

**Check it worked:**
Open Command Prompt and type:
```
ollama --version
```
You should see a version number.

---

## Step 3: Download Llama 3

Open Command Prompt and type:
```
ollama pull llama3
```

Wait for it to finish (this takes a few minutes). You will see a progress bar.

**Check it worked:**
```
ollama list
```
You should see `llama3` in the list.

---

## Step 4: Get the Code

1. Open Command Prompt
2. Type these commands one by one:

```
git clone https://github.com/MrGray17/jira-ai-agent.git
cd jira-ai-agent
git checkout feature/full-implementation
```

---

## Step 5: Install Project Dependencies

Make sure you are in the `jira-ai-agent` folder, then type:

```
npm install
```

Wait for it to finish. You will see a lot of text scroll by. This is normal.

---

## Step 6: Configure the Environment

Type this command:
```
copy .env.example .env
```

Then open the `.env` file in Notepad:
```
notepad .env
```

Make sure it looks exactly like this:

```
PORT=3000
NODE_ENV=development
JIRA_BASE_URL=https://ai-agent-dev.atlassian.net
JIRA_DATA_CENTER_PAT=ATATT3xFfGF0En4z9HXU4T-0dLH1Q85ySZBok49lgSBW2yOcRN-2q-4w7QGE3mt-OF2HKw9tB58qFa-Jx-FjCKcbj_UyO-_bhBoUBTp0SXAgxJTdlsNOxQD7F-huKEXhCY_i8mBVvS9Ba7Qb5xnR1UQgBUN0MG-rS2E4TwmbGozp6_17oqMlbzU=004CE355
JIRA_WEBHOOK_SECRET=1155afe83dc499126a5e2560d23b723968c1830891f5de418b0d07a6715d68a6
```

Save the file (Ctrl+S) and close Notepad.

---

## Step 7: Start Ollama

Open a NEW Command Prompt window and type:
```
ollama serve
```

Leave this window open. Do not close it.

---

## Step 8: Start the Backend

Open ANOTHER NEW Command Prompt window. Type:
```
cd jira-ai-agent
npm start
```

You should see:
```
[Server] Core Orchestrator running on port 3000
```

Leave this window open. Do not close it.

---

## Step 9: Expose via Serveo

Open ANOTHER NEW Command Prompt window. Type:
```
ssh -R jira-ai-agent:80:127.0.0.1:3000 serveo.net
```

You will see something like:
```
https://jira-ai-agent.serveo.net
```

**Write down this URL. You need to give it to Mohamed.**

---

## Step 10: Test It

1. Open your browser
2. Go to: https://ai-agent-dev.atlassian.net
3. Create a new ticket (any title is fine)
4. Go back to your Command Prompt windows
5. You should see text appear in the window running `npm start`

---

## What to Tell Mohamed

Send him a message with:
```
1. [OK] Ollama is running
2. [OK] Backend is running
3. [FAIL] If you see any errors

My Serveo URL is: https://jira-ai-agent.serveo.net
```

---

## If Something Goes Wrong

**Problem: "node is not recognized"**
Solution: Close all Command Prompt windows and open a new one. If still not working, restart your computer.

**Problem: "ollama is not recognized"**
Solution: Close all Command Prompt windows and open a new one. If still not working, restart your computer.

**Problem: "npm start" shows an error**
Solution: Make sure you are in the right folder. Type:
```
cd jira-ai-agent
npm start
```

**Problem: "Port 3000 already in use"**
Solution: Something else is using port 3000. Close all other programs and try again.

**Problem: No tickets appear when you create one**
Solution: Check that the Serveo URL is correct in Jira webhook settings.

---

## What You Need (Summary)

| Step | What You Install | Where to Get It |
|------|------------------|-----------------|
| 1 | Node.js | https://nodejs.org |
| 2 | Ollama | https://ollama.com/download |
| 3 | Llama 3 | `ollama pull llama3` |
| 4 | The code | `git clone` from GitHub |

---

## Commands Cheat Sheet

| What You Want to Do | Command |
|---------------------|---------|
| Start Ollama | `ollama serve` |
| Start Backend | `cd jira-ai-agent` then `npm start` |
| Expose via Serveo | `ssh -R jira-ai-agent:80:127.0.0.1:3000 serveo.net` |
| Check if Ollama is running | `curl http://127.0.0.1:11434/api/tags` |
| Check if Backend is running | `curl http://localhost:3000/api/health` |

---

## Need Help?

Contact Mohamed. He will help you.
