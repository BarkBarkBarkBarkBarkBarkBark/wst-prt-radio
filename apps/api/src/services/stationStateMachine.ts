import type { StationMode } from '@wstprtradio/shared';
import { isLiveDjConnected } from './azuracastService.js';
import { getLiveInputStatus } from './cloudflareStreamService.js';
import { getDb } from '../db/client.js';

let lastKnownState: StationMode = 'autodj';

function hasActiveLiveSession(): boolean {
  try {
    const db = getDb();
    const row = db
      .prepare(`SELECT id FROM live_sessions WHERE status IN ('pending', 'active') LIMIT 1`)
      .get();
    return row !== undefined;
  } catch {
    return false;
  }
}

export async function computeCurrentState(): Promise<StationMode> {
  try {
    const [azuraLive, cfStatus] = await Promise.all([
      Promise.resolve(isLiveDjConnected()),
      getLiveInputStatus(),
    ]);

    if (azuraLive && cfStatus === 'connected' && hasActiveLiveSession()) {
      lastKnownState = 'live_video';
    } else if (azuraLive) {
      lastKnownState = 'live_audio';
    } else {
      lastKnownState = 'autodj';
    }

    return lastKnownState;
  } catch {
    return 'degraded';
  }
}

export function getCurrentState(): StationMode {
  return lastKnownState;
}
