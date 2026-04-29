import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';

async function requireSession(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  if (!request.session?.userId) {
    await reply.status(401).send({ error: 'Unauthorized', message: 'Authentication required' });
  }
}

const authPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.decorate('requireSession', requireSession);
};

export default fp(authPlugin, { name: 'auth' });
export { requireSession };
