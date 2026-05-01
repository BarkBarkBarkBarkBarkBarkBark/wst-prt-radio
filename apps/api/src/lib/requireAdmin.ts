import type { FastifyReply, FastifyRequest } from 'fastify';

declare module 'fastify' {
  interface Session {
    admin?: { username: string };
  }
}

/**
 * preHandler that 401s any request without an admin session.
 * Apply to every route under /admin/*.
 */
export async function requireAdmin(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const admin = request.session?.admin;
  if (!admin) {
    return reply.status(401).send({ error: 'Unauthorized' });
  }
  request.adminUsername = admin.username;
}

declare module 'fastify' {
  interface FastifyRequest {
    adminUsername?: string;
  }
}
