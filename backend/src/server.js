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
  crossOriginResourcePolicy: { policy: "cross-origin" }
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
app.use('/uploads', express.static(path.join(__dirname, '../public/uploads')));

// const limiter = rateLimit({
//   windowMs: 15 * 60 * 1000, // 15 minutes
//   max: 1000, // Increased from 100 to 1000 requests per window
//   message: { error: 'Too many requests, please try again later.' },
//   standardHeaders: true,
//   legacyHeaders: false,
// });
// app.use('/api', limiter);

app.use(appRoutes);

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


