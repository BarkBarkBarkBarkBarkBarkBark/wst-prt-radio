import type { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import fastifyCors from '@fastify/cors';
import { env } from '../lib/env.js';

const corsPlugin: FastifyPluginAsync = async (fastify) => {
  const allowedOrigins =
    env.APP_ENV === 'development'
      ? ['http://localhost:3000', 'http://localhost:3001']
      : ['https://wstprtradio.com', 'https://admin.wstprtradio.com', 'https://www.wstprtradio.com'];

  await fastify.register(fastifyCors, {
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  });
};

export default fp(corsPlugin, { name: 'cors' });
