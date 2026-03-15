'use strict';

const { createLogger, format, transports } = require('winston');

const logger = createLogger({
  level: process.env.NODE_ENV === 'test' ? 'silent' : 'info',
  format: format.combine(
    format.timestamp(),
    format.errors({ stack: true }),
    process.env.NODE_ENV === 'development'
      ? format.combine(format.colorize(), format.simple())
      : format.json()
  ),
  transports: [new transports.Console()],
});

module.exports = logger;
