'use strict';

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { apiLimiter } = require('./middlewares/rateLimiter');
const { errorHandler } = require('./middlewares/errorHandler');
const authRoutes = require('./routes/auth');
const peopleRoutes = require('./routes/people');
const verifyRoutes = require('./routes/verify');

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(apiLimiter);

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

app.use('/auth', authRoutes);
app.use('/people', peopleRoutes);
app.use('/verify', verifyRoutes);

app.use(errorHandler);

module.exports = app;
