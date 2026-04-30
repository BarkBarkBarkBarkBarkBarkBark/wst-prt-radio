import type { FastifyPluginAsync, FastifyReply } from 'fastify';
import { z } from 'zod';
import {
  claimLiveRoomHost,
  configureLiveRoom,
  getLiveRoomSnapshot,
  joinLiveRoom,
  leaveLiveRoom,
  relayLiveRoomSignal,
  startLiveBroadcast,
  stopLiveBroadcast,
  subscribeToLiveRoomEvents,
} from '../../services/liveRoomService.js';

const JoinSchema = z.object({
  displayName: z.string().min(1).max(40),
  passphrase: z.string().optional(),
});

const ParticipantAuthSchema = z.object({
  participantId: z.string().min(1),
  participantToken: z.string().min(1),
});

const ClaimHostSchema = ParticipantAuthSchema.extend({
  hostSecret: z.string().optional(),
});

const ConfigureRoomSchema = ParticipantAuthSchema.extend({
  title: z.string().min(1).max(80).optional(),
  accessMode: z.enum(['open', 'passphrase']).optional(),
  broadcastMode: z.enum(['open_mic', 'official']).optional(),
  passphrase: z.string().max(80).optional(),
});

const SignalSchema = ParticipantAuthSchema.extend({
  toParticipantId: z.string().min(1),
  type: z.enum(['offer', 'answer', 'ice-candidate']),
  sdp: z.string().optional(),
  candidate: z
    .object({
      candidate: z.string(),
      sdpMid: z.string().nullable(),
      sdpMLineIndex: z.number().int().nullable(),
      usernameFragment: z.string().nullable().optional(),
    })
    .optional(),
});

function sendValidationError(reply: FastifyReply, issues: unknown) {
  return reply.status(400).send({ error: 'Bad Request', issues });
}

const liveRoomRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get('/public/live-room', async (_request, reply) => {
    return reply.send(getLiveRoomSnapshot());
  });

  fastify.post('/public/live-room/join', async (request, reply) => {
    const parsed = JoinSchema.safeParse(request.body);
    if (!parsed.success) return sendValidationError(reply, parsed.error.issues);

    try {
      return reply.send(joinLiveRoom(parsed.data.displayName, parsed.data.passphrase));
    } catch (error) {
      return reply.status(403).send({ error: 'Forbidden', message: (error as Error).message });
    }
  });

  fastify.post('/public/live-room/leave', async (request, reply) => {
    const parsed = ParticipantAuthSchema.safeParse(request.body);
    if (!parsed.success) return sendValidationError(reply, parsed.error.issues);

    try {
      leaveLiveRoom(parsed.data.participantId, parsed.data.participantToken);
      return reply.send({ ok: true });
    } catch (error) {
      return reply.status(401).send({ error: 'Unauthorized', message: (error as Error).message });
    }
  });

  fastify.post('/public/live-room/claim-host', async (request, reply) => {
    const parsed = ClaimHostSchema.safeParse(request.body);
    if (!parsed.success) return sendValidationError(reply, parsed.error.issues);

    try {
      return reply.send(claimLiveRoomHost(parsed.data.participantId, parsed.data.participantToken, parsed.data.hostSecret));
    } catch (error) {
      return reply.status(409).send({ error: 'Conflict', message: (error as Error).message });
    }
  });

  fastify.post('/public/live-room/configure', async (request, reply) => {
    const parsed = ConfigureRoomSchema.safeParse(request.body);
    if (!parsed.success) return sendValidationError(reply, parsed.error.issues);

    try {
      const config = {
        ...(parsed.data.title !== undefined ? { title: parsed.data.title } : {}),
        ...(parsed.data.accessMode !== undefined ? { accessMode: parsed.data.accessMode } : {}),
        ...(parsed.data.broadcastMode !== undefined ? { broadcastMode: parsed.data.broadcastMode } : {}),
        ...(parsed.data.passphrase !== undefined ? { passphrase: parsed.data.passphrase } : {}),
      };

      return reply.send(
        configureLiveRoom(parsed.data.participantId, parsed.data.participantToken, config),
      );
    } catch (error) {
      return reply.status(409).send({ error: 'Conflict', message: (error as Error).message });
    }
  });

  fastify.post('/public/live-room/broadcast/start', async (request, reply) => {
    const parsed = ParticipantAuthSchema.safeParse(request.body);
    if (!parsed.success) return sendValidationError(reply, parsed.error.issues);

    try {
      return reply.send(startLiveBroadcast(parsed.data.participantId, parsed.data.participantToken));
    } catch (error) {
      return reply.status(409).send({ error: 'Conflict', message: (error as Error).message });
    }
  });

  fastify.post('/public/live-room/broadcast/stop', async (request, reply) => {
    const parsed = ParticipantAuthSchema.safeParse(request.body);
    if (!parsed.success) return sendValidationError(reply, parsed.error.issues);

    try {
      return reply.send(stopLiveBroadcast(parsed.data.participantId, parsed.data.participantToken));
    } catch (error) {
      return reply.status(409).send({ error: 'Conflict', message: (error as Error).message });
    }
  });

  fastify.post('/public/live-room/signal', async (request, reply) => {
    const parsed = SignalSchema.safeParse(request.body);
    if (!parsed.success) return sendValidationError(reply, parsed.error.issues);

    try {
      const signal = {
        toParticipantId: parsed.data.toParticipantId,
        type: parsed.data.type,
        ...(parsed.data.sdp !== undefined ? { sdp: parsed.data.sdp } : {}),
        ...(parsed.data.candidate !== undefined
          ? {
              candidate: {
                candidate: parsed.data.candidate.candidate,
                sdpMid: parsed.data.candidate.sdpMid,
                sdpMLineIndex: parsed.data.candidate.sdpMLineIndex,
                ...(parsed.data.candidate.usernameFragment !== undefined
                  ? { usernameFragment: parsed.data.candidate.usernameFragment }
                  : {}),
              },
            }
          : {}),
      };
      relayLiveRoomSignal(parsed.data.participantId, parsed.data.participantToken, signal);
      return reply.send({ ok: true });
    } catch (error) {
      return reply.status(409).send({ error: 'Conflict', message: (error as Error).message });
    }
  });

  fastify.get('/public/live-room/events', async (request, reply) => {
    const query = z
      .object({
        participantId: z.string().min(1),
        participantToken: z.string().min(1),
      })
      .safeParse(request.query);
    if (!query.success) return sendValidationError(reply, query.error.issues);

    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    const send = (event: unknown) => {
      reply.raw.write(`data: ${JSON.stringify(event)}\n\n`);
    };

    let unsubscribe: (() => void) | undefined;
    let heartbeat: NodeJS.Timeout | undefined;

    try {
      unsubscribe = subscribeToLiveRoomEvents(query.data.participantId, query.data.participantToken, send);
      heartbeat = setInterval(() => {
        reply.raw.write(': keepalive\n\n');
      }, 15_000);
    } catch (error) {
      if (heartbeat) clearInterval(heartbeat);
      reply.raw.end(`data: ${JSON.stringify({ error: 'Unauthorized', message: (error as Error).message })}\n\n`);
      return;
    }

    request.raw.on('close', () => {
      if (heartbeat) clearInterval(heartbeat);
      unsubscribe?.();
      reply.raw.end();
    });
  });
};

export default liveRoomRoute;
