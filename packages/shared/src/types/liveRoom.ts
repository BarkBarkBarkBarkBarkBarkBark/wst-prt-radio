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
  | { type: 'join_as_guest'; peerId: string; displayName?: string }
  | { type: 'set_jam_mode'; peerId: string; enabled: boolean }
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
      jamMode: boolean;
      guestCount: number;
      guestPeerIds: string[];
    }
  | { type: 'broadcaster_accepted'; liveSessionId: string }
  | { type: 'broadcaster_rejected'; reason: string }
  | { type: 'listener_accepted' }
  | { type: 'guest_accepted'; hostPeerId: string }
  | { type: 'guest_rejected'; reason: string }
  | { type: 'peer_offer'; fromPeerId: string; sdp: string; fromRole: 'listener' | 'guest' }
  | { type: 'peer_answer'; fromPeerId: string; sdp: string }
  | { type: 'ice_candidate'; fromPeerId: string; candidate: LiveRoomIceCandidate }
  | { type: 'force_disconnect'; reason: string };
