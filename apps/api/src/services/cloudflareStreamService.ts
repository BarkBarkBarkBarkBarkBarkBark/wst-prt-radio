import { env } from '../lib/env.js';

type LiveInputStatus = 'connected' | 'disconnected' | 'unknown';

interface CfLiveInputResponse {
  result: {
    status?: {
      current?: {
        state: string;
      };
    };
  };
  success: boolean;
}

interface CfOutputResponse {
  result: {
    uid: string;
    url: string;
    streamKey: string;
    enabled: boolean;
  };
  success: boolean;
}

interface CfOutputsListResponse {
  result: Array<{ uid: string; url: string; streamKey: string; enabled: boolean }>;
  success: boolean;
}

function cfHeaders(): HeadersInit {
  return {
    Authorization: `Bearer ${env.CLOUDFLARE_STREAM_API_TOKEN}`,
    'Content-Type': 'application/json',
  };
}

function cfBaseUrl(): string {
  return `https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/stream/live_inputs`;
}

export async function getLiveInputStatus(): Promise<LiveInputStatus> {
  if (!env.CLOUDFLARE_ACCOUNT_ID || !env.CLOUDFLARE_STREAM_API_TOKEN || !env.CLOUDFLARE_LIVE_INPUT_ID) {
    return 'unknown';
  }

  try {
    const url = `${cfBaseUrl()}/${env.CLOUDFLARE_LIVE_INPUT_ID}`;
    const response = await fetch(url, {
      headers: cfHeaders(),
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      return 'unknown';
    }

    const data = (await response.json()) as CfLiveInputResponse;
    if (!data.success) return 'unknown';

    const state = data.result?.status?.current?.state;
    if (state === 'connected') return 'connected';
    if (state === 'disconnected') return 'disconnected';
    return 'unknown';
  } catch {
    return 'unknown';
  }
}

export async function listOutputs(): Promise<CfOutputsListResponse['result']> {
  if (!env.CLOUDFLARE_ACCOUNT_ID || !env.CLOUDFLARE_STREAM_API_TOKEN || !env.CLOUDFLARE_LIVE_INPUT_ID) {
    return [];
  }

  try {
    const url = `${cfBaseUrl()}/${env.CLOUDFLARE_LIVE_INPUT_ID}/outputs`;
    const response = await fetch(url, { headers: cfHeaders(), signal: AbortSignal.timeout(8000) });
    if (!response.ok) return [];
    const data = (await response.json()) as CfOutputsListResponse;
    return data.success ? data.result : [];
  } catch {
    return [];
  }
}

export async function createOutput(rtmpUrl: string, streamKey: string): Promise<string | null> {
  try {
    const url = `${cfBaseUrl()}/${env.CLOUDFLARE_LIVE_INPUT_ID}/outputs`;
    const response = await fetch(url, {
      method: 'POST',
      headers: cfHeaders(),
      body: JSON.stringify({ url: rtmpUrl, streamKey }),
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return null;
    const data = (await response.json()) as CfOutputResponse;
    return data.success ? data.result.uid : null;
  } catch {
    return null;
  }
}

export async function deleteOutput(outputUid: string): Promise<boolean> {
  try {
    const url = `${cfBaseUrl()}/${env.CLOUDFLARE_LIVE_INPUT_ID}/outputs/${outputUid}`;
    const response = await fetch(url, {
      method: 'DELETE',
      headers: cfHeaders(),
      signal: AbortSignal.timeout(8000),
    });
    return response.ok;
  } catch {
    return false;
  }
}
