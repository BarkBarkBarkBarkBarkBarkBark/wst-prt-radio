import Fastify from 'fastify';
import fastifyCookie from '@fastify/cookie';
import fastifySession from '@fastify/session';
import fastifySwagger from '@fastify/swagger';
import fastifySwaggerUi from '@fastify/swagger-ui';
import fastifyWebsocket from '@fastify/websocket';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { env } from './lib/env.js';
import { loggerOptions } from './lib/logger.js';
import { initializeAdmins } from './lib/admins.js';
import corsPlugin from './plugins/cors.js';
import rateLimitPlugin from './plugins/rateLimit.js';

import healthRoute from './routes/health.js';
import autoplayRoute from './routes/public/autoplay.js';
import statusRoute from './routes/public/status.js';
import adminControlRoute from './routes/admin/control.js';
import authRoute from './routes/auth/index.js';
import signalRoute from './routes/signal.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

export async function buildServer() {
  const fastify = Fastify({
    logger: loggerOptions[env.APP_ENV] as Parameters<typeof Fastify>[0]['logger'],
    trustProxy: true,
  });

  await initializeAdmins({
    info: (msg) => fastify.log.info(msg),
    warn: (msg) => fastify.log.warn(msg),
  });

  await fastify.register(fastifySwagger, {
    mode: 'static',
    specification: {
      path: join(__dirname, '..', 'openapi.yaml'),
      postProcessor: (specification) => specification,
      baseDir: join(__dirname, '..'),
    },
  });
  await fastify.register(fastifySwaggerUi, {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: true,
    },
    staticCSP: true,
  });

  await fastify.register(corsPlugin);
  await fastify.register(rateLimitPlugin);

  await fastify.register(fastifyCookie);
  await fastify.register(fastifySession, {
    secret: env.SESSION_SECRET,
    cookieName: 'wstprtradio.sid',
    cookie: {
      // vercel.app (web) and fly.dev (api) are different eTLD+1s, so
      // SameSite=Lax would make the browser silently drop the cookie on
      // every cross-origin fetch. SameSite=None requires Secure=true,
      // which is already enforced in production (HTTPS only on Fly).
      // In dev we stay on Lax (HTTP localhost, no Secure needed).
      httpOnly: true,
      secure: env.APP_ENV === 'production',
      sameSite: env.APP_ENV === 'production' ? 'none' : 'lax',
      maxAge: 1000 * 60 * 60 * 12,
    },
    saveUninitialized: false,
  });

  await fastify.register(fastifyWebsocket);

  await fastify.register(healthRoute);
  await fastify.register(authRoute);
  await fastify.register(autoplayRoute);
  await fastify.register(statusRoute);
  await fastify.register(adminControlRoute);
  await fastify.register(signalRoute);

  return fastify;
}
