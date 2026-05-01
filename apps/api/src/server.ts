import Fastify from 'fastify';
import fastifySwagger from '@fastify/swagger';
import fastifySwaggerUi from '@fastify/swagger-ui';
import fastifyWebsocket from '@fastify/websocket';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { env } from './lib/env.js';
import { loggerOptions } from './lib/logger.js';
import corsPlugin from './plugins/cors.js';
import rateLimitPlugin from './plugins/rateLimit.js';

import healthRoute from './routes/health.js';
import statusRoute from './routes/public/status.js';
import adminControlRoute from './routes/admin/control.js';
import signalRoute from './routes/signal.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

export async function buildServer() {
  const fastify = Fastify({
    logger: loggerOptions[env.APP_ENV] as Parameters<typeof Fastify>[0]['logger'],
    trustProxy: true,
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
  await fastify.register(fastifyWebsocket);

  await fastify.register(healthRoute);
  await fastify.register(statusRoute);
  await fastify.register(adminControlRoute);
  await fastify.register(signalRoute);

  return fastify;
}
