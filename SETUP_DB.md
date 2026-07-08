# Setup Guide for Database Person (PostgreSQL)

This guide will help you set up PostgreSQL for the Jira AI Agent project.

## Your Role

You are responsible for:
1. Running PostgreSQL database
2. Creating the database and tables
3. Allowing connections from Taha's PC (backend server)

---

## Prerequisites

- PostgreSQL installed and running
- Network access between your PC and Taha's PC

---

## Step 1: Install PostgreSQL

### Windows
```bash
# Download from https://www.postgresql.org/download/windows/

# Or using winget
winget install PostgreSQL.PostgreSQL.16
```

### During Installation
- Set a password for the `postgres` user (remember this!)
- Default port: 5432
- Keep the default locale

---

## Step 2: Create Database

```bash
# Open PostgreSQL command line (psql)
# You can find it in Start Menu as "pgAdmin 4" or "SQL Shell (psql)"

# Connect to PostgreSQL
psql -U postgres

# Enter your password when prompted

# Create the database
CREATE DATABASE jira_agent;

# Verify it was created
\l

# Exit psql
\q
```

---

## Step 3: Create Database User (Optional but Recommended)

For security, create a dedicated user instead of using `postgres`:

```bash
# Connect to PostgreSQL
psql -U postgres

# Create a new user
CREATE USER jira_agent_user WITH PASSWORD 'secure_password_here';

# Grant privileges
GRANT ALL PRIVILEGES ON DATABASE jira_agent TO jira_agent_user;

# Exit
\q
```

---

## Step 4: Configure PostgreSQL for Remote Connections

### Find your IP address
```bash
# Windows
ipconfig

# Look for "IPv4 Address" - it will be something like 192.168.1.xxx
```

### Edit pg_hba.conf
This file allows remote connections. Location:
- Windows: `C:\Program Files\PostgreSQL\16\data\pg_hba.conf`

Add this line at the end:
```
# Allow connections from local network
host    all    all    192.168.1.0/24    md5
```

**Note:** Replace `192.168.1.0/24` with your actual network range. If you're on the same WiFi, this should work.

### Edit postgresql.conf
Location: `C:\Program Files\PostgreSQL\16\data\postgresql.conf`

Find and change:
```
# Before:
#listen_addresses = 'localhost'

# After:
listen_addresses = '*'
```

### Restart PostgreSQL
```bash
# Windows Services
# Open Services app (services.msc)
# Find "postgresql" service and restart it

# Or using command line (Run as Administrator)
net stop postgresql-x64-16
net start postgresql-x64-16
```

---

## Step 5: Test Remote Connection

### From your PC
```bash
psql -U jira_agent_user -d jira_agent -h localhost
```

### From Taha's PC (after he sets up)
```bash
psql -U jira_agent_user -d jira_agent -h YOUR_IP_ADDRESS
```

---

## Step 6: Provide Connection Details to Taha

Give Taha this information:

```
Host: YOUR_IP_ADDRESS (e.g., 192.168.1.xxx)
Port: 5432
Database: jira_agent
User: jira_agent_user
Password: secure_password_here
```

The connection string will be:
```
postgresql://jira_agent_user:secure_password_here@192.168.1.xxx:5432/jira_agent
```

---

## Step 7: Tables Will Be Created Automatically

When Taha starts the backend server, the tables will be created automatically:
- `triage_logs` - Stores AI classification results
- `sla_tracking` - Tracks ticket age and SLA status

You don't need to create them manually.

---

## Troubleshooting

### Problem: "Connection refused"
**Solution:** 
- Check if PostgreSQL is running
- Check if the port is correct (default: 5432)
- Check firewall settings

### Problem: "Password authentication failed"
**Solution:**
- Verify the username and password
- Check pg_hba.conf has the correct authentication method

### Problem: "Could not connect to server"
**Solution:**
- Make sure `listen_addresses = '*'` in postgresql.conf
- Check if firewall is blocking port 5432
- Verify both PCs are on the same network

### Problem: "Permission denied for database"
**Solution:**
- Grant privileges to the user:
```sql
GRANT ALL PRIVILEGES ON DATABASE jira_agent TO jira_agent_user;
```

---

## Firewall Configuration (If Needed)

If Taha can't connect, you may need to allow port 5432 through Windows Firewall:

```bash
# Run Command Prompt as Administrator

# Add firewall rule
netsh advfirewall firewall add rule name="PostgreSQL" dir=in action=allow protocol=TCP localport=5432
```

---

## What to Report to Mohamed

After setup, tell Mohamed:
1. [OK] PostgreSQL is running on port 5432
2. [OK] Database `jira_agent` is created
3. [OK] User `jira_agent_user` is created
4. [OK] Remote connections are enabled
5. [OK] Connection string: `postgresql://jira_agent_user:password@YOUR_IP:5432/jira_agent`
6. [FAIL] Any errors you encountered

---

## Quick Reference

| Item | Value |
|------|-------|
| Database | jira_agent |
| User | jira_agent_user |
| Port | 5432 |
| Config files | `C:\Program Files\PostgreSQL\16\data\` |

---

## Need Help?

Contact Mohamed if you have any issues. He will coordinate with Taha for testing the connection.
