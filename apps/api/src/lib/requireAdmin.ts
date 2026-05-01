import type { FastifyReply, FastifyRequest } from 'fastify';

declare module 'fastify' {
  interface Session {
    admin?: { username: string };
  }
}

/**
 * Auth is currently disabled — all admin routes are open.
 * Re-enable by restoring the session check below.
 */
export async function requireAdmin(request: FastifyRequest, _reply: FastifyReply): Promise<void> {
  request.adminUsername = request.session?.admin?.username ?? 'admin';
}

declare module 'fastify' {
  interface FastifyRequest {
    adminUsername?: string;
  }
}
