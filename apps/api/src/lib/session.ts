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

declare module 'fastify' {
  interface Session {
    userId?: string;
    userEmail?: string;
    userRole?: string;
  }
}
