import type { FastifyPluginAsync } from 'fastify';
import { requireSession } from '../../plugins/auth.js';
import { getDb } from '../../db/client.js';

interface UserRow {
  id: string;
  email: string;
  role: string;
  created_at: string;
}

const meRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get('/admin/me', { preHandler: requireSession }, async (request, reply) => {
    const db = getDb();
    const user = db
      .prepare('SELECT id, email, role, created_at FROM users WHERE id = ?')
      .get(request.session.userId) as UserRow | undefined;

    if (!user) {
      await request.session.destroy();
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    return reply.send({ id: user.id, email: user.email, role: user.role, createdAt: user.created_at });
  });
};

export default meRoute;
