require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const connectDB = require('./config/database');

const app = express();
const PORT = process.env.PORT || 5000;

// Connect to MongoDB
connectDB();

// Middleware
app.use(cors());
app.use(express.json());

// Serve the frontend folder as static files
// This means visiting http://localhost:5000 will load frontend/index.html
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// API Routes
const authRoutes = require('./routes/auth');
const aiRoutes = require('./routes/ai');
const adminRoutes = require('./routes/admin');

app.get('/api/ping', (req, res) => res.json({ msg: 'pong', version: 'v2', time: Date.now() }));

app.use('/api/auth', authRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/admin', adminRoutes);

// Fallback: for any non-API route, serve index.html (SPA support)
app.get('/{*splat}', (req, res) => {
    if (!req.path.startsWith('/api')) {
        res.sendFile(path.join(__dirname, '..', 'frontend', 'index.html'));
    }
});

// Global error handler
app.use((err, req, res, next) => {
    console.error('[UNHANDLED ERROR] Full Error:', err);
    res.status(500).json({
        msg: 'Internal server error',
        details: err.message || String(err),
        fullError: JSON.stringify(err, Object.getOwnPropertyNames(err))
    });
});

app.listen(PORT, () => {
    console.log(`✅ [UPDATED v2] Server running on http://localhost:${PORT}`);
    console.log(`📁 Serving frontend from: ${path.join(__dirname, '..', 'frontend')}`);
});
