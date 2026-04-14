'use strict';

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { apiLimiter } = require('./middlewares/rateLimiter');
const { errorHandler } = require('./middlewares/errorHandler');
const authRoutes = require('./routes/auth');
const peopleRoutes = require('./routes/people');
const verifyRoutes = require('./routes/verify');
const accessRequestRoutes = require('./routes/accessRequests');
const usersRoutes = require('./routes/users');
const statsRoutes = require('./routes/stats');

const app = express();

// Trust the nginx reverse proxy so express-rate-limit uses the real client IP
// from X-Forwarded-For rather than the proxy's IP.
app.set('trust proxy', 1);

app.use(helmet());

const allowedOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map(o => o.trim())
  : ['http://localhost:3002', 'http://localhost:3003'];
app.use(cors({
  origin: (origin, cb) => {
    // Allow requests with no Origin header (same-host, curl, mobile apps on LAN)
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error(`Origin ${origin} not allowed by CORS`));
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json({ limit: '1mb' }));
app.use(apiLimiter);

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

app.use('/auth', authRoutes);
app.use('/people', peopleRoutes);
app.use('/verify', verifyRoutes);
app.use('/access-requests', accessRequestRoutes);
app.use('/users', usersRoutes);
app.use('/stats', statsRoutes);

app.use(errorHandler);

module.exports = app;
