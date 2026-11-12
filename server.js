const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 8888;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request Logger
app.use((req, res, next) => {
  const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
  console.log(`[${now}] ${req.method} ${req.url}`);
  next();
});

// Serve Static Frontend Assets
app.use(express.static(path.join(__dirname, 'public')));

// API Routes
const apiRoutes = require('./routes/api');
app.use('/api', apiRoutes);

// Return JSON 404 for unknown /api/* routes (never return index.html for API calls)
app.use('/api/*', (req, res) => {
  res.status(404).json({ error: `API endpoint not found: ${req.originalUrl}` });
});

// Fallback to index.html for SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start Server
app.listen(PORT, '0.0.0.0', () => {
  console.log('====================================================');
  console.log(`🚀 TraceDeck is running!`);
  console.log(`📡 Access URL: http://0.0.0.0:${PORT}`);
  console.log(`⚡ Environment: Node.js ${process.version}`);
  console.log('====================================================');
});
