import type { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import fastifyCors from '@fastify/cors';
import { env } from '../lib/env.js';

function getConfiguredOrigins(): string[] {
  return env.CORS_ALLOWED_ORIGINS.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function isAllowedDevelopmentOrigin(origin: string): boolean {
  try {
    const { protocol, hostname } = new URL(origin);
    if (!['http:', 'https:'].includes(protocol)) return false;

    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname.endsWith('.local')) {
      return true;
    }

    if (hostname.startsWith('10.')) return true;
    if (hostname.startsWith('192.168.')) return true;

    const match = hostname.match(/^172\.(\d{1,2})\./);
    if (match) {
      const secondOctet = Number(match[1]);
      return secondOctet >= 16 && secondOctet <= 31;
    }

    return false;
  } catch {
    return false;
  }
}

const corsPlugin: FastifyPluginAsync = async (fastify) => {
  const configuredOrigins = getConfiguredOrigins();

  await fastify.register(fastifyCors, {
    origin: (origin, callback) => {
      if (!origin) {
        callback(null, true);
        return;
      }

      if (env.APP_ENV === 'development') {
        callback(null, isAllowedDevelopmentOrigin(origin));
        return;
      }

      const allowedOrigins = configuredOrigins.length
        ? configuredOrigins
        : [
            'https://wstprtradio.com',
            'https://admin.wstprtradio.com',
            'https://www.wstprtradio.com',
          ];

      callback(null, allowedOrigins.includes(origin));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  });
};

export default fp(corsPlugin, { name: 'cors' });
