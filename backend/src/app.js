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

const app = express();

// Trust the nginx reverse proxy so express-rate-limit uses the real client IP
// from X-Forwarded-For rather than the proxy's IP.
app.set('trust proxy', 1);

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(apiLimiter);

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

app.use('/auth', authRoutes);
app.use('/people', peopleRoutes);
app.use('/verify', verifyRoutes);
app.use('/access-requests', accessRequestRoutes);

app.use(errorHandler);

module.exports = app;
