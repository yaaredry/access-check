'use strict';

require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

const WEAK_SECRETS = ['dev-secret', 'change_this_to_a_long_random_secret_in_production', 'secret', 'password'];
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32 || WEAK_SECRETS.includes(process.env.JWT_SECRET)) {
  console.error('FATAL: JWT_SECRET is missing, too short (< 32 chars), or is a known weak default. Set a strong secret before starting.');
  process.exit(1);
}

const app = require('./app');
const logger = require('./config/logger');

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  logger.info(`Access-check backend running on port ${PORT} [${process.env.NODE_ENV || 'development'}]`);
});
