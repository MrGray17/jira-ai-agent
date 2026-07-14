import express from 'express';
import dotenv from 'dotenv';
import { pool, initializeDatabase, testConnection } from './src/db.js';
import { corsMiddleware } from './src/middleware/cors.js';
import webhookRoutes from './src/routes/webhooks.js';
import apiRoutes from './src/routes/api.js';
import { startSlaMonitor } from './src/services/sla.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json({
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(corsMiddleware);

// Routes
app.use(webhookRoutes);
app.use(apiRoutes);

// Start server
app.listen(PORT, () => {
  console.log(`[Server] Core Orchestrator running on port ${PORT}`);
  console.log(`[Tunnel Target] Expose http://localhost:${PORT} to your network tunnel.`);

  // Initialize database and start monitors
  testConnection();
  initializeDatabase();
  startSlaMonitor();
});
