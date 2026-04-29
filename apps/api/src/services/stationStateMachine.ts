import type { StationMode } from '@wstprtradio/shared';
import { isLiveDjConnected } from './azuracastService.js';
import { getLiveInputStatus } from './cloudflareStreamService.js';

let lastKnownState: StationMode = 'autodj';

export async function computeCurrentState(): Promise<StationMode> {
  try {
    const [azuraLive, cfStatus] = await Promise.all([
      Promise.resolve(isLiveDjConnected()),
      getLiveInputStatus(),
    ]);

    if (azuraLive && cfStatus === 'connected') {
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
