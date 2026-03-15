'use strict';

require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

const app = require('./app');
const logger = require('./config/logger');

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  logger.info(`Access-check backend running on port ${PORT} [${process.env.NODE_ENV || 'development'}]`);
});
