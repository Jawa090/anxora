require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const path = require('path');
const db = require('./config/database');
const rateLimit = require('express-rate-limit');

const appRoutes = require('./app');

const app = express();
app.set('trust proxy', 1);

const PORT = process.env.PORT || 4000;

app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));
app.use(cors({
  origin: ['http://localhost:3000',], // Allow frontend ports + desktop app
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

app.use(appRoutes);



async function bootstrap() {
  try {
    // Eagerly verify database connection on startup
    await db.query('SELECT 1');
    console.log('Database connected successfully.');

    const server = app.listen(PORT, () => {
      console.log(`Server running successfully on port ${PORT}`);
      console.log(`API Health Check: http://localhost:${PORT}/api/health`);
    });


  } catch (error) {
    console.error('Failed to connect to the database. Server shutting down...', error);
    process.exit(1);
  }
}

bootstrap();


