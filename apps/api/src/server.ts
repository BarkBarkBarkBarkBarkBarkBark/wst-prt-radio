import Fastify from 'fastify';
import fastifyCookie from '@fastify/cookie';
import fastifySession from '@fastify/session';
import { env } from './lib/env.js';
import { loggerOptions } from './lib/logger.js';
import { sessionOptions } from './lib/session.js';
import corsPlugin from './plugins/cors.js';
import rateLimitPlugin from './plugins/rateLimit.js';
import authPlugin from './plugins/auth.js';

// Routes
import healthRoute from './routes/health.js';
import statusRoute from './routes/public/status.js';
import nowPlayingRoute from './routes/public/nowPlaying.js';
import liveSessionRoute from './routes/public/liveSession.js';
import loginRoute from './routes/auth/login.js';
import logoutRoute from './routes/auth/logout.js';
import meRoute from './routes/admin/me.js';
import dashboardRoute from './routes/admin/dashboard.js';
import stationRoute from './routes/admin/station.js';
import liveRoute from './routes/admin/live.js';
import destinationsRoute from './routes/admin/destinations.js';
import settingsRoute from './routes/admin/settings.js';
import auditRoute from './routes/admin/audit.js';
import cloudflareStreamWebhook from './routes/webhooks/cloudflareStream.js';
import azuracastWebhook from './routes/webhooks/azuracast.js';

export async function buildServer() {
  const fastify = Fastify({
    logger: loggerOptions[env.APP_ENV] as Parameters<typeof Fastify>[0]['logger'],
    trustProxy: true,
  });

  await fastify.register(corsPlugin);
  await fastify.register(rateLimitPlugin);
  await fastify.register(fastifyCookie);
  await fastify.register(fastifySession, sessionOptions);
  await fastify.register(authPlugin);

  // Public routes
  await fastify.register(healthRoute);
  await fastify.register(statusRoute);
  await fastify.register(nowPlayingRoute);
  await fastify.register(liveSessionRoute);

  // Auth routes
  await fastify.register(loginRoute);
  await fastify.register(logoutRoute);

  // Admin routes
  await fastify.register(meRoute);
  await fastify.register(dashboardRoute);
  await fastify.register(stationRoute);
  await fastify.register(liveRoute);
  await fastify.register(destinationsRoute);
  await fastify.register(settingsRoute);
  await fastify.register(auditRoute);

  // Webhook routes
  await fastify.register(cloudflareStreamWebhook);
  await fastify.register(azuracastWebhook);

  return fastify;
}
