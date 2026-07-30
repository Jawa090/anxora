const express = require('express');
const router = express.Router();

// Health check endpoint
router.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Basic welcome endpoint
router.get('/', (req, res) => {
  res.json({ message: 'Welcome to Anxora API' });
});

module.exports = router;
