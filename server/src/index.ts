import express from 'express';
import cors from 'cors';
import http from 'http';
import dotenv from 'dotenv';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { initWebSocket } from './websocket/socketHandler';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Create HTTP server (needed for WebSocket upgrade)
const server = http.createServer(app);

// Middleware
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));

// Initialize WebSocket server
const roomManager = initWebSocket(server);

// Health check (now includes WebSocket stats)
app.get('/api/health', (_req, res) => {
  res.json({
    success: true,
    data: {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '0.2.0',
      uptime: process.uptime(),
      websocket: roomManager.getStats(),
    },
  });
});

import authRoutes from './routes/auth';
import oauthRoutes from './routes/oauth';
import roomRoutes from './routes/rooms';
import fileRoutes from './routes/files';
import executeRoutes from './routes/execute';
import githubRoutes from './routes/github';
import invitesRoutes from './routes/invites';
import aiRouter from './routes/ai';

// Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/oauth', oauthRoutes);
app.use('/api/v1/files', fileRoutes);
app.use('/api/v1/ai', aiRouter);
app.use('/api/v1/rooms', roomRoutes);
app.use('/api/v1/execute', executeRoutes);
app.use('/api/v1/github', githubRoutes);
app.use('/api/v1/invites', invitesRoutes);

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);



// Start server (use `server.listen` instead of `app.listen` for WebSocket support)
server.listen(PORT, () => {
  console.log(`
  ╔══════════════════════════════════════════════╗
  ║   🚀 StreamSync Server v0.2.0               ║
  ║   HTTP:  http://localhost:${PORT}               ║
  ║   WS:    ws://localhost:${PORT}/ws               ║
  ║   Health: http://localhost:${PORT}/api/health     ║
  ╚══════════════════════════════════════════════╝
  `);
});

export default app;
