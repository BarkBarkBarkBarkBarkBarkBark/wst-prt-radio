import type { FastifyPluginAsync } from 'fastify';
import {
  blockBroadcaster,
  clearBlockedPeers,
  closeStation,
  getAdminStatus,
  kickBroadcaster,
  openStation,
} from '../../services/liveRoomService.js';

const adminControlRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get('/admin/status', async (_request, reply) => {
    return reply.send(getAdminStatus());
  });

  fastify.post('/admin/open', async (_request, reply) => {
    return reply.send({ ok: true, status: openStation('admin') });
  });

  fastify.post('/admin/close', async (_request, reply) => {
    return reply.send({ ok: true, status: closeStation('admin') });
  });

  fastify.post('/admin/kick', async (_request, reply) => {
    return reply.send({ ok: true, status: kickBroadcaster('admin') });
  });

  fastify.post('/admin/block', async (_request, reply) => {
    return reply.send({ ok: true, status: blockBroadcaster('admin') });
  });

  fastify.post('/admin/clear-blocks', async (_request, reply) => {
    return reply.send({ ok: true, status: clearBlockedPeers('admin') });
  });
};

export default adminControlRoute;