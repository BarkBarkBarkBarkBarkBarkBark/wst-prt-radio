import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import {
  blockBroadcaster,
  clearBlockedPeers,
  closeStation,
  getAdminStatus,
  kickBroadcaster,
  openStation,
  verifyAdminPassword,
} from '../../services/liveRoomService.js';

function getAdminPassword(request: FastifyRequest): string {
  const header = request.headers['x-admin-password'];
  if (Array.isArray(header)) {
    return header[0] ?? '';
  }
  return header ?? '';
}

async function requireAdmin(request: FastifyRequest, reply: FastifyReply): Promise<boolean> {
  if (!verifyAdminPassword(getAdminPassword(request))) {
    await reply.status(401).send({ error: 'Unauthorized', message: 'Invalid admin password' });
    return false;
  }
  return true;
}

const adminControlRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get('/admin/status', async (request, reply) => {
    if (!(await requireAdmin(request, reply))) return;
    return reply.send(getAdminStatus());
  });

  fastify.post('/admin/open', async (request, reply) => {
    if (!(await requireAdmin(request, reply))) return;
    return reply.send({ ok: true, status: openStation('admin') });
  });

  fastify.post('/admin/close', async (request, reply) => {
    if (!(await requireAdmin(request, reply))) return;
    return reply.send({ ok: true, status: closeStation('admin') });
  });

  fastify.post('/admin/kick', async (request, reply) => {
    if (!(await requireAdmin(request, reply))) return;
    return reply.send({ ok: true, status: kickBroadcaster('admin') });
  });

  fastify.post('/admin/block', async (request, reply) => {
    if (!(await requireAdmin(request, reply))) return;
    return reply.send({ ok: true, status: blockBroadcaster('admin') });
  });

  fastify.post('/admin/clear-blocks', async (request, reply) => {
    if (!(await requireAdmin(request, reply))) return;
    return reply.send({ ok: true, status: clearBlockedPeers('admin') });
  });
};

export default adminControlRoute;