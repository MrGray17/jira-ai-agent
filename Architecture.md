+-----------------------------------------------------------------------------------------+
|                                MAROC TELECOM SECURE INTRANET                            |
|                                                                                         |
|  [ JIRA DATA CENTER v9.12 ]                                                             |
|  |-- Triggers: Issue Created or Updated (Status: "To Do")                               |
|  |-- Security: Generates HMAC-SHA256 signature via JIRA_WEBHOOK_SECRET                  |
|  |                                                                                      |
|  +--- 1. ( HTTP POST payload + x-hub-signature header ) -----+                          |
|                                                              |                          |
|                                  +---------------------------v-----------------------+  |
|                                  |   NODE.JS EXPRESS ORCHESTRATOR (Port 3000)        |  |
|  <--- 2. ( HTTP 200 OK / 403 ) --+   [ SECURITY GATE ] verifyJiraSignature()         |  |
|                                  |   Validates raw buffer hash against local secret. |  |
|  +--- 8. ( GET Transitions ) ----+   Rejects bad actors instantly.                   |  |
|  |                               |                                                   |  |
|  |   <--- 9. ( JSON Schema ) ----+   [ PIPELINE FILTER ]                             |  |
|  |                               |   Is Status == 'To Do'? If False -> Drop.         |  |
|  |                               |   If True -> Proceed to Intelligence Engine.      |  |
|  |                               |                                                   |  |
|  |                               |   [ INTELLIGENCE ROUTER ]                         |  |
|  |                               |   +-- 3. ( HTTP POST Prompt ) --------------+     |  |
|  |                               |   |                                         v     |  |
|  |                               |   |       [ OLLAMA / LLAMA-3 NODE ]         |     |  |
|  |                               |   |       Evaluates Risk & Category         |     |  |
|  |                               |   |       Returns structured JSON           |     |  |
|  |                               |   |                                         |     |  |
|  |                               |   +<----- 4. ( JSON Response ) -------------+     |  |
|  |                               |   |                                               |  |
|  |                               |   * Failsafe: Local Emulator executes regex       |  |
|  |                               |     if Ollama host is offline or times out.       |  |
|  |                               |                                                   |  |
|  |                               |   [ PERSISTENT STORAGE LAYER ]                    |  |
|  |                               |   5. db.query('INSERT INTO triage_logs...')       |  |
|  |                               |   +-----------------------------------------+     |  |
|  |                               |   |                                         v     |  |
|  |                               |   |          [POSTGRESQL DB ]          |     |  |
|  |                               |   |          triage_logs table              |     |  |
|  |                               |   |                                         |     |  |
|  |                               |   +<----- 6. ( Write Confirmed ) -----------+     |  |
|  |                               |                                                   |  |
|  +--- 10. ( POST Transition ) ---+   [ AUTOMATION LOOP ]                             |  |
|  |    Authorization: Bearer PAT  |   7. transitionIssueToInProgress()                |  |
|  v    Payload: { "id": "21" }    |                                                   |  |
| [ Issue moved to In Progress ]   +---------------------------+-----------------------+  |
+--------------------------------------------------------------|--------------------------+
                                                               |
                                                               |
                                                               | 11. HTTP GET /api/triage-logs
                                                               |     (Triggered by Sync Button)
                                                               |     (Express queries PostgreSQL)
+--------------------------------------------------------------v--------------------------+
|   ANGULAR SOC DASHBOARD (Port 4200)                                                     |
|   |-- Component: TriageService (HTTP Client configuration)                              |
|   |-- State: Zone.js change detection intercepting the asynchronous network pipe        |
|   |-- UI DOM: High-contrast risk matrices, conditional styling via ngClass              |
|                                                                                         |
|   [ USER ACTION ] -> Clicks Execute Sync -> DB Polled -> Renders CSS Grid matrix.       |
+-----------------------------------------------------------------------------------------+