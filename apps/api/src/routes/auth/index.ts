import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { verifyAdmin } from '../../lib/admins.js';

const LoginBody = z.object({
  username: z.string().min(1).max(80),
  password: z.string().min(1).max(200),
});

const authRoute: FastifyPluginAsync = async (fastify) => {
  fastify.post(
    '/auth/login',
    {
      // Tighter rate limit so brute-force attempts on the login form don't
      // blow through the global 200 req/min budget.
      config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
    },
    async (request, reply) => {
      const parsed = LoginBody.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Invalid login payload' });
      }
      const { username, password } = parsed.data;
      const ok = await verifyAdmin(username, password);
      if (!ok) {
        return reply.status(401).send({ error: 'Invalid username or password' });
      }
      request.session.admin = { username };
      return reply.send({ ok: true, username });
    },
  );

  fastify.post('/auth/logout', async (request, reply) => {
    if (request.session.admin) {
      await new Promise<void>((resolve, reject) => {
        request.session.destroy((err) => (err ? reject(err) : resolve()));
      });
    }
    return reply.send({ ok: true });
  });

  fastify.get('/auth/me', async (request, reply) => {
    const admin = request.session.admin;
    if (!admin) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }
    return reply.send({ username: admin.username });
  });
};

export default authRoute;
