import { buildServer } from './server.js';
import { env } from './lib/env.js';
import { closeDb, getDb } from './db/client.js';
import { initializeStationService } from './services/liveRoomService.js';
import { startCleanupSchedule, stopCleanupSchedule } from './services/cleanupService.js';

async function main() {
  getDb();
  initializeStationService();

  const server = await buildServer();

  startCleanupSchedule({ info: (msg) => server.log.info(msg) });

  try {
    await server.listen({ port: env.PORT, host: '0.0.0.0' });
    server.log.info(`[server] Listening on port ${env.PORT}`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }

  let shuttingDown = false;
  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.on(signal, () => {
      if (shuttingDown) return;
      shuttingDown = true;
      server.log.info(`[server] Received ${signal}, shutting down...`);
      stopCleanupSchedule();
      server
        .close()
        .catch((err) => server.log.error({ err }, 'server close failed'))
        .finally(() => {
          try {
            closeDb();
          } catch (err) {
            server.log.error({ err }, 'closeDb failed');
          }
          process.exit(0);
        });
    });
  }
}

void main();
