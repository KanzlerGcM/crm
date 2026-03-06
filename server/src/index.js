import 'dotenv/config';
import { createServer } from 'http';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { initDatabase, saveOnShutdown } from './database.js';
import { initWebSocket, getOnlineUsers } from './socket.js';
import authRoutes from './routes/auth.js';
import clientRoutes from './routes/clients.js';
import contractRoutes from './routes/contracts.js';
import cnpjRoutes from './routes/cnpj.js';
import mapsRoutes from './routes/maps.js';
import emailRoutes from './routes/email.js';
import taskRoutes from './routes/tasks.js';
import paymentRoutes from './routes/payments.js';
import analyticsRoutes from './routes/analytics.js';
import pagespeedRoutes from './routes/pagespeed.js';
import emailTemplateRoutes from './routes/email-templates.js';
import whatsappRoutes from './routes/whatsapp.js';
import attachmentRoutes from './routes/attachments.js';
import invoiceRoutes from './routes/invoices.js';

const app = express();
const PORT = process.env.PORT || 3001;

// Security headers
const isProduction = process.env.NODE_ENV === 'production';
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: isProduction ? {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      imgSrc: ["'self'", 'data:', 'blob:'],
      connectSrc: ["'self'", 'ws:', 'wss:'],
    }
  } : false,
}));

// CORS — include production origin from env
const allowedOrigins = [
  'http://localhost:5173', 'http://localhost:5174', 'http://localhost:3000',
  ...(process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',').map(s => s.trim()) : []),
].filter(Boolean);

// Export for WebSocket to reuse
export { allowedOrigins };

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
}));

// Rate limiting — protect auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 15,
  message: { error: 'Muitas tentativas de login. Tente novamente em 15 minutos.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const generalLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(generalLimiter);

// Body parsing
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));

// Request logging
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (req.path !== '/api/health') {
      console.log(`${req.method} ${req.path} ${res.statusCode} (${duration}ms)`);
    }
  });
  next();
});

// Initialize database (async for sql.js)
await initDatabase();

// Routes
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/contracts', contractRoutes);
app.use('/api/cnpj', cnpjRoutes);
app.use('/api/maps', mapsRoutes);
app.use('/api/email-templates', emailTemplateRoutes);
app.use('/api/email', emailRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/pagespeed', pagespeedRoutes);
app.use('/api/whatsapp', whatsappRoutes);
app.use('/api/attachments', attachmentRoutes);
app.use('/api/invoices', invoiceRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    service: 'Prospector Chevla',
    version: '2.0.0',
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    onlineUsers: getOnlineUsers().length,
  });
});

// 404 for unknown API routes
app.use('/api/*', (req, res) => {
  res.status(404).json({ error: `Rota não encontrada: ${req.method} ${req.originalUrl}` });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Erro não tratado:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Erro interno do servidor',
  });
});

const httpServer = createServer(app);
initWebSocket(httpServer);

const server = httpServer.listen(PORT, () => {
  console.log(`\n🚀 Prospector Chevla Server v2.0.0`);
  console.log(`📋 API: http://localhost:${PORT}/api`);
  console.log(`🔌 WebSocket: ws://localhost:${PORT}`);
  console.log(`✅ Servidor pronto\n`);
});

// Graceful shutdown
const shutdown = (signal) => {
  console.log(`\n⚡ ${signal} recebido. Encerrando...`);
  saveOnShutdown();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 5000);
};
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('uncaughtException', (err) => console.error('Exceção não capturada:', err));
process.on('unhandledRejection', (err) => console.error('Promessa rejeitada:', err));
