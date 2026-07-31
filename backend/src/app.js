const express = require('express');
const router = express.Router();
const authRoutes = require('./routes/auth/auth');
const memberRoutes = require('./routes/auth/employeeRoutes');
const orgRoutes = require('./routes/auth/organizations');

// Health check endpoint
router.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Auth Routes
router.use('/api/auth', authRoutes);
router.use('/api/members', memberRoutes);
router.use('/api/organizations', orgRoutes);

// Basic welcome endpoint
router.get('/', (req, res) => {
  res.json({ message: 'Welcome to Anxora API' });
});

module.exports = router;
