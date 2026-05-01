import type { FastifyPluginAsync } from 'fastify';
import { handleSignalDisconnect, handleSignalMessage, registerSignalConnection } from '../services/liveRoomService.js';

const signalRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get('/signal', { websocket: true }, (socket) => {
    const connectionId = registerSignalConnection(socket as never);

    socket.on('message', (message: unknown) => {
      handleSignalMessage(connectionId, message);
    });

    socket.on('close', () => {
      handleSignalDisconnect(connectionId);
    });
  });
};

export default signalRoute;