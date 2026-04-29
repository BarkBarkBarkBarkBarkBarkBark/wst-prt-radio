import type { FastifyPluginAsync } from 'fastify';
import { verify } from 'argon2';
import { LoginSchema } from '@wstprtradio/shared';
import { getDb } from '../../db/client.js';

interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  role: string;
}

const loginRoute: FastifyPluginAsync = async (fastify) => {
  fastify.post(
    '/auth/login',
    {
      config: { rateLimit: { max: 10, timeWindow: '15 minutes' } },
    },
    async (request, reply) => {
      const parsed = LoginSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Bad Request', message: 'Invalid credentials format' });
      }

      const { email, password } = parsed.data;
      const db = getDb();

      const user = db
        .prepare('SELECT id, email, password_hash, role FROM users WHERE email = ?')
        .get(email) as UserRow | undefined;

      if (!user) {
        // Constant-time response to prevent user enumeration
        await new Promise((r) => setTimeout(r, 200));
        return reply.status(401).send({ error: 'Unauthorized', message: 'Invalid email or password' });
      }

      const valid = await verify(user.password_hash, password);
      if (!valid) {
        return reply.status(401).send({ error: 'Unauthorized', message: 'Invalid email or password' });
      }

      request.session.userId = user.id;
      request.session.userEmail = user.email;
      request.session.userRole = user.role;
      await request.session.save();

      return reply.send({ ok: true, user: { id: user.id, email: user.email, role: user.role } });
    },
  );
};

export default loginRoute;
