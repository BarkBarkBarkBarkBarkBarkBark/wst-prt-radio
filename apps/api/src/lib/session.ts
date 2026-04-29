import type { FastifySessionOptions } from '@fastify/session';
import { env } from './env.js';

export const sessionOptions: FastifySessionOptions = {
  secret: env.SESSION_SECRET,
  cookie: {
    secure: env.APP_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    path: '/',
  },
  saveUninitialized: false,
};

// @fastify/session v11 uses SessionData for module augmentation
declare module '@fastify/session' {
  interface SessionData {
    userId?: string;
    userEmail?: string;
    userRole?: string;
  }
}
