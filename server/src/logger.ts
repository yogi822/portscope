/**
 * Structured logging via pino (replaces console.log everywhere).
 * In development it pretty-prints; in production it emits JSON lines suitable
 * for log shippers.
 */
import { pino } from 'pino';
import { config } from './config.js';

export const logger = pino({
  level: config.logLevel,
  ...(config.nodeEnv === 'development'
    ? {
        transport: {
          target: 'pino-pretty',
          options: { colorize: true, translateTime: 'SYS:HH:MM:ss' },
        },
      }
    : {}),
});
