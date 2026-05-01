import { buildServer } from './server.js';
import { env } from './lib/env.js';
import { getDb } from './db/client.js';
import { initializeStationService } from './services/liveRoomService.js';

async function main() {
  getDb();
  initializeStationService();

  const server = await buildServer();

  try {
    await server.listen({ port: env.PORT, host: '0.0.0.0' });
    console.log(`[server] Listening on port ${env.PORT}`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }

  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.on(signal, async () => {
      console.log(`[server] Received ${signal}, shutting down...`);
      await server.close();
      process.exit(0);
    });
  }
}

void main();
