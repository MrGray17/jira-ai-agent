# Database Setup Guide

Follow these steps in order. Do not skip any step.

---

## Step 1: Install PostgreSQL

1. Go to https://www.postgresql.org/download/windows/
2. Download the installer (click the big blue button)
3. Run the installer
4. When it asks for a password, type a password you will remember. **Write it down.**
5. Click "Next" through everything else (use default settings)
6. Finish the installation

---

## Step 2: Open PostgreSQL Command Line

1. Open the Start Menu
2. Type `psql`
3. Click on "SQL Shell (psql)"
4. It will ask for several things. Just press Enter for all of them EXCEPT the password
5. When it asks for password, type the password you set in Step 1

You should see something like:
```
postgres=#
```

---

## Step 3: Create the Database

Type this command and press Enter:
```sql
CREATE DATABASE jira_agent;
```

You should see:
```
CREATE DATABASE
```

---

## Step 4: Create a User

Type this command and press Enter:
```sql
CREATE USER jira_agent_user WITH PASSWORD 'MySecurePass123';
```

You should see:
```
CREATE ROLE
```

---

## Step 5: Give the User Permission

Type this command and press Enter:
```sql
GRANT ALL PRIVILEGES ON DATABASE jira_agent TO jira_agent_user;
```

You should see:
```
GRANT PRIVILEGES
```

---

## Step 6: Exit PostgreSQL

Type this command and press Enter:
```
\q
```

---

## Step 7: Find Your IP Address

1. Open Command Prompt (type `cmd` in Start Menu)
2. Type:
```
ipconfig
```
3. Look for "IPv4 Address" - it looks like `192.168.1.xxx`
4. **Write down this number.** You need to give it to Mohamed.

---

## Step 8: Allow Remote Connections

1. Open File Explorer
2. Go to: `C:\Program Files\PostgreSQL\16\data\`
3. Find the file `pg_hba.conf`
4. Right-click it, open with Notepad
5. Scroll to the very bottom
6. Add this line at the end:
```
host    all    all    192.168.1.0/24    md5
```
7. Save the file (Ctrl+S)

---

## Step 9: Enable Network Access

1. In the same folder, find `postgresql.conf`
2. Right-click it, open with Notepad
3. Press Ctrl+F and search for `listen_addresses`
4. You will see something like:
```
#listen_addresses = 'localhost'
```
5. Change it to:
```
listen_addresses = '*'
```
6. Remove the `#` at the beginning
7. Save the file (Ctrl+S)

---

## Step 10: Restart PostgreSQL

1. Press `Win + R`, type `services.msc`, press Enter
2. Find `postgresql` in the list
3. Right-click it and select "Restart"

---

## Step 11: Test the Connection

1. Open Command Prompt
2. Type:
```
psql -U jira_agent_user -d jira_agent -h localhost
```
3. When it asks for password, type: `MySecurePass123`
4. You should see:
```
jira_agent=#
```
5. Type `\q` to exit

---

## What to Tell Mohamed

Send him a message with this information:
```
My IP address is: 192.168.1.xxx
My database connection string is:
postgresql://jira_agent_user:MySecurePass123@192.168.1.xxx:5432/jira_agent
```

Replace `192.168.1.xxx` with your actual IP address from Step 7.

---

## If Something Goes Wrong

**Problem: "psql" is not recognized**
Solution: Close the Command Prompt and open a new one. If still not working, restart your computer.

**Problem: "password authentication failed"**
Solution: Make sure you typed the correct password. Passwords in PostgreSQL are case-sensitive.

**Problem: "connection refused"**
Solution: Make sure PostgreSQL is running. Open Services (services.msc) and check that postgresql says "Running".

**Problem: "permission denied"**
Solution: Make sure you ran the GRANT command in Step 5.

---

## What You Need (Summary)

| Step | What You Do |
|------|-------------|
| 1 | Install PostgreSQL |
| 2 | Create database `jira_agent` |
| 3 | Create user `jira_agent_user` |
| 4 | Give user permission |
| 5 | Allow remote connections |
| 6 | Find your IP address |
| 7 | Give connection string to Mohamed |

---

## Commands Cheat Sheet

| What You Want to Do | Command |
|---------------------|---------|
| Open PostgreSQL | Type `psql` in Start Menu |
| Create database | `CREATE DATABASE jira_agent;` |
| Create user | `CREATE USER jira_agent_user WITH PASSWORD 'MySecurePass123';` |
| Give permission | `GRANT ALL PRIVILEGES ON DATABASE jira_agent TO jira_agent_user;` |
| Exit PostgreSQL | `\q` |
| Find IP address | `ipconfig` in Command Prompt |
| Test connection | `psql -U jira_agent_user -d jira_agent -h localhost` |

---

## Need Help?

Contact Mohamed. He will help you.
