require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const path = require('path');
const rateLimit = require('express-rate-limit');

const appRoutes = require('./app');

const app = express();
app.set('trust proxy', 1);

const PORT = process.env.PORT || 4000;

app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  crossOriginEmbedderPolicy: false,
  frameguard: false,
  contentSecurityPolicy: false
}));
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:3001', 'https://elinasmart.com'], // Allow frontend ports + desktop app
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

morgan.token('user-email', (req) => req.user ? req.user.email : 'anonymous');
app.use(morgan('[:user-email] :method :url :status :response-time ms - :res[content-length]'));
app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', (req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  res.setHeader('Content-Security-Policy', "frame-ancestors 'self' http://localhost:3000 http://localhost:3001 http://localhost:8080 https://elinasmart.com *;");
  res.removeHeader('X-Frame-Options');
  next();
}, express.static(path.join(__dirname, '../public/uploads')));

app.use(appRoutes);

// Serve built frontend assets if frontend/dist exists
const fs = require('fs');
const frontendDistPath = path.join(__dirname, '../../frontend/dist');
if (fs.existsSync(frontendDistPath)) {
  app.use(express.static(frontendDistPath));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/uploads') || req.path.startsWith('/ws')) {
      return next();
    }
    res.sendFile(path.join(frontendDistPath, 'index.html'));
  });
}

const db = require('./config/database');
const realtimeService = require('./services/realtimeService');
const scheduledWorkflows = require('./services/scheduledWorkflows');
const imapIdleService = require('./services/imapIdleService');
const cronJobs = require('./cron');

async function bootstrap() {
  try {
    // Eagerly verify database connection on startup
    await db.query('SELECT 1');
    console.log('Database connected successfully.');

    const server = app.listen(PORT, () => {
      console.log(`Server running successfully on port ${PORT}`);
      console.log(`API Health Check: http://localhost:${PORT}/api/health`);
    });

    // Initialize WebSocket
    realtimeService.initialize(server);

    // Start scheduled workflows
    scheduledWorkflows.start();

    // Start real-time IMAP IDLE watchers for all active IMAP mailboxes
    imapIdleService.startAll();

    // Start cron jobs
    cronJobs.start();

  } catch (error) {
    console.error('Failed to connect to the database. Server shutting down...', error);
    process.exit(1);
  }
}

bootstrap();
