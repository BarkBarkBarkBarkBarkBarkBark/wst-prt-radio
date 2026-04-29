import type { FastifyBaseLogger } from 'fastify';

export const loggerOptions = {
  development: {
    transport: {
      target: 'pino-pretty',
      options: { colorize: true, translateTime: 'HH:MM:ss', ignore: 'pid,hostname' },
    },
    level: 'debug',
  },
  production: {
    level: 'info',
  },
  test: {
    level: 'silent',
  },
} as const;

export type AppLogger = FastifyBaseLogger;
