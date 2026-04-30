export type LiveRoomAccessMode = 'open' | 'passphrase';
export type LiveRoomBroadcastMode = 'open_mic' | 'official';

export type LiveRoomParticipantRole = 'listener' | 'speaker' | 'host';

export interface LiveRoomParticipant {
  id: string;
  displayName: string;
  role: LiveRoomParticipantRole;
  joinedAt: string;
  isActiveBroadcaster: boolean;
}

export interface LiveRoomSnapshot {
  id: string;
  title: string;
  accessMode: LiveRoomAccessMode;
  broadcastMode: LiveRoomBroadcastMode;
  passphraseRequired: boolean;
  hostParticipantId: string | null;
  activeBroadcasterId: string | null;
  participants: LiveRoomParticipant[];
  updatedAt: string;
}

export interface LiveRoomJoinResponse {
  participantId: string;
  participantToken: string;
  room: LiveRoomSnapshot;
}

export interface LiveRoomIceCandidate {
  candidate: string;
  sdpMid: string | null;
  sdpMLineIndex: number | null;
  usernameFragment?: string | null;
}

export interface LiveRoomSignalEnvelope {
  type: 'offer' | 'answer' | 'ice-candidate';
  fromParticipantId: string;
  toParticipantId: string;
  sdp?: string;
  candidate?: LiveRoomIceCandidate;
}

export type LiveRoomServerEvent =
  | {
      type: 'room.snapshot';
      room: LiveRoomSnapshot;
    }
  | {
      type: 'room.signal';
      signal: LiveRoomSignalEnvelope;
    }
  | {
      type: 'room.notice';
      message: string;
    };