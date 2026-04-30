import { randomUUID } from 'node:crypto';
import type {
  LiveRoomAccessMode,
  LiveRoomBroadcastMode,
  LiveRoomIceCandidate,
  LiveRoomJoinResponse,
  LiveRoomServerEvent,
  LiveRoomSignalEnvelope,
  LiveRoomSnapshot,
} from '@wstprtradio/shared';
import { env } from '../lib/env.js';

interface ParticipantInternal {
  id: string;
  token: string;
  displayName: string;
  joinedAt: string;
}

interface RoomStateInternal {
  id: string;
  title: string;
  accessMode: LiveRoomAccessMode;
  broadcastMode: LiveRoomBroadcastMode;
  passphrase: string;
  hostSecret: string;
  hostParticipantId: string | null;
  activeBroadcasterId: string | null;
  participants: Map<string, ParticipantInternal>;
  updatedAt: string;
}

type EventSink = (event: LiveRoomServerEvent) => void;

const room: RoomStateInternal = {
  id: 'west-port-live-room',
  title: env.LIVE_ROOM_DEFAULT_TITLE,
  accessMode: env.LIVE_ROOM_DEFAULT_ACCESS,
  broadcastMode: env.LIVE_ROOM_DEFAULT_MODE,
  passphrase: env.LIVE_ROOM_SHARED_PASSPHRASE,
  hostSecret: env.LIVE_ROOM_HOST_SECRET,
  hostParticipantId: null,
  activeBroadcasterId: null,
  participants: new Map(),
  updatedAt: new Date().toISOString(),
};

const subscribers = new Map<string, Set<EventSink>>();

function touchRoom(): void {
  room.updatedAt = new Date().toISOString();
}

function verifyParticipant(participantId: string, participantToken: string): ParticipantInternal {
  const participant = room.participants.get(participantId);
  if (!participant || participant.token !== participantToken) {
    throw new Error('Unauthorized participant');
  }
  return participant;
}

function participantRole(participantId: string): 'listener' | 'speaker' | 'host' {
  if (room.hostParticipantId === participantId) return 'host';
  if (room.activeBroadcasterId === participantId) return 'speaker';
  return 'listener';
}

export function getLiveRoomSnapshot(): LiveRoomSnapshot {
  return {
    id: room.id,
    title: room.title,
    accessMode: room.accessMode,
    broadcastMode: room.broadcastMode,
    passphraseRequired: room.accessMode === 'passphrase',
    hostParticipantId: room.hostParticipantId,
    activeBroadcasterId: room.activeBroadcasterId,
    participants: Array.from(room.participants.values())
      .map((participant) => ({
        id: participant.id,
        displayName: participant.displayName,
        role: participantRole(participant.id),
        joinedAt: participant.joinedAt,
        isActiveBroadcaster: room.activeBroadcasterId === participant.id,
      }))
      .sort((a, b) => a.joinedAt.localeCompare(b.joinedAt)),
    updatedAt: room.updatedAt,
  };
}

function broadcast(event: LiveRoomServerEvent): void {
  for (const sinks of subscribers.values()) {
    for (const sink of sinks) {
      sink(event);
    }
  }
}

function sendToParticipant(participantId: string, event: LiveRoomServerEvent): void {
  const sinks = subscribers.get(participantId);
  if (!sinks) return;
  for (const sink of sinks) {
    sink(event);
  }
}

function broadcastSnapshot(): void {
  broadcast({ type: 'room.snapshot', room: getLiveRoomSnapshot() });
}

export function joinLiveRoom(displayName: string, passphrase?: string): LiveRoomJoinResponse {
  const trimmedName = displayName.trim();
  if (!trimmedName) {
    throw new Error('Display name is required');
  }

  if (room.accessMode === 'passphrase' && room.passphrase && passphrase !== room.passphrase) {
    throw new Error('Invalid passphrase');
  }

  const participantId = randomUUID();
  const participantToken = randomUUID();
  const participant: ParticipantInternal = {
    id: participantId,
    token: participantToken,
    displayName: trimmedName.slice(0, 40),
    joinedAt: new Date().toISOString(),
  };

  room.participants.set(participantId, participant);
  touchRoom();
  broadcastSnapshot();

  return {
    participantId,
    participantToken,
    room: getLiveRoomSnapshot(),
  };
}

export function leaveLiveRoom(participantId: string, participantToken: string): void {
  verifyParticipant(participantId, participantToken);

  room.participants.delete(participantId);
  subscribers.delete(participantId);

  if (room.activeBroadcasterId === participantId) {
    room.activeBroadcasterId = null;
    broadcast({ type: 'room.notice', message: 'The current broadcaster disconnected.' });
  }

  if (room.hostParticipantId === participantId) {
    room.hostParticipantId = null;
    broadcast({ type: 'room.notice', message: 'The host left the room.' });
  }

  touchRoom();
  broadcastSnapshot();
}

export function subscribeToLiveRoomEvents(
  participantId: string,
  participantToken: string,
  sink: EventSink,
): () => void {
  verifyParticipant(participantId, participantToken);

  const sinks = subscribers.get(participantId) ?? new Set<EventSink>();
  sinks.add(sink);
  subscribers.set(participantId, sinks);

  sink({ type: 'room.snapshot', room: getLiveRoomSnapshot() });

  return () => {
    const activeSinks = subscribers.get(participantId);
    if (!activeSinks) return;
    activeSinks.delete(sink);
    if (activeSinks.size === 0) {
      subscribers.delete(participantId);
    }
  };
}

export function claimLiveRoomHost(
  participantId: string,
  participantToken: string,
  hostSecret?: string,
): LiveRoomSnapshot {
  verifyParticipant(participantId, participantToken);

  if (room.hostParticipantId && room.hostParticipantId !== participantId) {
    throw new Error('A host is already active');
  }

  if (room.hostSecret && room.hostSecret !== hostSecret) {
    throw new Error('Invalid host secret');
  }

  room.hostParticipantId = participantId;
  touchRoom();
  broadcastSnapshot();
  return getLiveRoomSnapshot();
}

export function configureLiveRoom(
  participantId: string,
  participantToken: string,
  config: {
    title?: string;
    accessMode?: LiveRoomAccessMode;
    broadcastMode?: LiveRoomBroadcastMode;
    passphrase?: string;
  },
): LiveRoomSnapshot {
  verifyParticipant(participantId, participantToken);
  if (room.hostParticipantId !== participantId) {
    throw new Error('Only the host can update room settings');
  }

  if (config.title !== undefined) {
    room.title = config.title.trim().slice(0, 80) || room.title;
  }
  if (config.accessMode !== undefined) {
    room.accessMode = config.accessMode;
  }
  if (config.broadcastMode !== undefined) {
    room.broadcastMode = config.broadcastMode;
  }
  if (config.passphrase !== undefined) {
    room.passphrase = config.passphrase;
  }

  touchRoom();
  broadcastSnapshot();
  return getLiveRoomSnapshot();
}

export function startLiveBroadcast(participantId: string, participantToken: string): LiveRoomSnapshot {
  verifyParticipant(participantId, participantToken);

  if (room.broadcastMode === 'official' && room.hostParticipantId !== participantId) {
    throw new Error('Room is in official mode; only the host can broadcast');
  }

  if (room.activeBroadcasterId && room.activeBroadcasterId !== participantId) {
    throw new Error('Another broadcaster is already live');
  }

  room.activeBroadcasterId = participantId;
  touchRoom();
  broadcast({ type: 'room.notice', message: 'A broadcaster is now live.' });
  broadcastSnapshot();
  return getLiveRoomSnapshot();
}

export function stopLiveBroadcast(participantId: string, participantToken: string): LiveRoomSnapshot {
  verifyParticipant(participantId, participantToken);

  if (room.activeBroadcasterId !== participantId && room.hostParticipantId !== participantId) {
    throw new Error('Only the active broadcaster or host can stop the broadcast');
  }

  room.activeBroadcasterId = null;
  touchRoom();
  broadcast({ type: 'room.notice', message: 'The live broadcast has ended.' });
  broadcastSnapshot();
  return getLiveRoomSnapshot();
}

export function relayLiveRoomSignal(
  participantId: string,
  participantToken: string,
  signal: {
    toParticipantId: string;
    type: LiveRoomSignalEnvelope['type'];
    sdp?: string;
    candidate?: LiveRoomIceCandidate;
  },
): void {
  verifyParticipant(participantId, participantToken);

  if (!room.participants.has(signal.toParticipantId)) {
    throw new Error('Signal target not found');
  }

  const broadcasterId = room.activeBroadcasterId;
  if (
    broadcasterId &&
    participantId !== broadcasterId &&
    signal.toParticipantId !== broadcasterId
  ) {
    throw new Error('Signals must be sent to or from the active broadcaster');
  }

  sendToParticipant(signal.toParticipantId, {
    type: 'room.signal',
    signal: {
      type: signal.type,
      fromParticipantId: participantId,
      toParticipantId: signal.toParticipantId,
      ...(signal.sdp ? { sdp: signal.sdp } : {}),
      ...(signal.candidate ? { candidate: signal.candidate } : {}),
    },
  });
}
