import type { FastifyPluginAsync } from 'fastify';

const logoutRoute: FastifyPluginAsync = async (fastify) => {
  fastify.post('/auth/logout', async (request, reply) => {
    await request.session.destroy();
    return reply.send({ ok: true });
  });
};

export default logoutRoute;
