import type { FastifyPluginAsync } from 'fastify';
import {
  blockBroadcaster,
  clearBlockedPeers,
  closeStation,
  getAdminStatus,
  kickBroadcaster,
  openStation,
} from '../../services/liveRoomService.js';
import { requireAdmin } from '../../lib/requireAdmin.js';

const adminControlRoute: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', requireAdmin);

  // Stricter limit than the global 200/min — admin actions should be deliberate.
  const adminLimit = { rateLimit: { max: 60, timeWindow: '1 minute' } };

  fastify.get('/admin/status', { config: adminLimit }, async (_request, reply) => {
    return reply.send(getAdminStatus());
  });

  fastify.post('/admin/open', { config: adminLimit }, async (request, reply) => {
    return reply.send({ ok: true, status: openStation(request.adminUsername ?? 'admin') });
  });

  fastify.post('/admin/close', { config: adminLimit }, async (request, reply) => {
    return reply.send({ ok: true, status: closeStation(request.adminUsername ?? 'admin') });
  });

  fastify.post('/admin/kick', { config: adminLimit }, async (request, reply) => {
    return reply.send({ ok: true, status: kickBroadcaster(request.adminUsername ?? 'admin') });
  });

  fastify.post('/admin/block', { config: adminLimit }, async (request, reply) => {
    return reply.send({ ok: true, status: blockBroadcaster(request.adminUsername ?? 'admin') });
  });

  fastify.post('/admin/clear-blocks', { config: adminLimit }, async (request, reply) => {
    return reply.send({ ok: true, status: clearBlockedPeers(request.adminUsername ?? 'admin') });
  });
};

export default adminControlRoute;
