import type { AlwaysOnState } from './station.js';

export interface LiveRoomIceCandidate {
  candidate: string;
  sdpMid: string | null;
  sdpMLineIndex: number | null;
  usernameFragment?: string | null;
}

export type SignalRole = 'listener' | 'broadcaster';

export interface SignalPeer {
  peerId: string;
  displayName?: string;
}

export type SignalClientMessage =
  | { type: 'join_as_listener'; peerId: string }
  | { type: 'join_as_broadcaster'; peerId: string; displayName?: string }
  | { type: 'sdp_offer'; peerId: string; targetPeerId: string; sdp: string }
  | { type: 'sdp_answer'; peerId: string; targetPeerId: string; sdp: string }
  | { type: 'ice_candidate'; peerId: string; targetPeerId: string; candidate: LiveRoomIceCandidate }
  | { type: 'leave'; peerId: string };

export type SignalServerMessage =
  | {
      type: 'station_status';
      stationState: 'closed' | 'open' | 'live' | 'blocked' | 'degraded';
      liveSessionId: string | null;
      listenerCount: number;
      broadcasterPresent: boolean;
      broadcasterPeerId: string | null;
      broadcasterDisplayName: string | null;
      updatedAt: string;
      alwaysOnState?: AlwaysOnState;
    }
  | { type: 'broadcaster_accepted'; liveSessionId: string }
  | { type: 'broadcaster_rejected'; reason: string }
  | { type: 'listener_accepted' }
  | { type: 'peer_offer'; fromPeerId: string; sdp: string }
  | { type: 'peer_answer'; fromPeerId: string; sdp: string }
  | { type: 'ice_candidate'; fromPeerId: string; candidate: LiveRoomIceCandidate }
  | { type: 'force_disconnect'; reason: string };
