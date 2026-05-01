import { randomUUID } from 'node:crypto';
import type { AdminStatus, AuditLogEntry, SignalClientMessage, SignalServerMessage, StationState, StationStatus } from '@wstprtradio/shared';
import { getDb } from '../db/client.js';
import { writeAudit } from '../lib/audit.js';
import { getAlwaysOnState } from './autoplayService.js';

type SignalSocket = {
  send: (data: string) => void;
  close: () => void;
  readyState: number;
  OPEN: number;
};

type ConnectionRole = 'listener' | 'broadcaster' | 'guest';

const MAX_GUESTS = 4;

interface ConnectionState {
  id: string;
  socket: SignalSocket;
  peerId: string | null;
  role: ConnectionRole | null;
  displayName: string | null;
  sessionId: string | null;
  closed: boolean;
}

interface StreamStateRow {
  station_state: StationState;
  live_session_id: string | null;
  broadcaster_peer_id: string | null;
  broadcaster_display_name: string | null;
  updated_at: string;
}

const STATE_ROW_ID = 'primary';
const connections = new Map<string, ConnectionState>();
const peerIndex = new Map<string, string>();
let jamMode = false;

function db() {
  return getDb();
}

function nowIso(): string {
  return new Date().toISOString();
}

function readState(): StreamStateRow {
  const row = db()
    .prepare(
      `SELECT station_state, live_session_id, broadcaster_peer_id, broadcaster_display_name, updated_at
       FROM stream_state
       WHERE id = ?`,
    )
    .get(STATE_ROW_ID) as StreamStateRow | undefined;

  if (row) {
    return row;
  }

  const fallback: StreamStateRow = {
    station_state: 'open',
    live_session_id: null,
    broadcaster_peer_id: null,
    broadcaster_display_name: null,
    updated_at: nowIso(),
  };

  db()
    .prepare(
      `INSERT INTO stream_state (id, station_state, live_session_id, broadcaster_peer_id, broadcaster_display_name, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(
      STATE_ROW_ID,
      fallback.station_state,
      fallback.live_session_id,
      fallback.broadcaster_peer_id,
      fallback.broadcaster_display_name,
      fallback.updated_at,
    );

  return fallback;
}

function setState(update: {
  stationState: StationState;
  liveSessionId?: string | null;
  broadcasterPeerId?: string | null;
  broadcasterDisplayName?: string | null;
}): StreamStateRow {
  const next: StreamStateRow = {
    station_state: update.stationState,
    live_session_id: update.liveSessionId ?? null,
    broadcaster_peer_id: update.broadcasterPeerId ?? null,
    broadcaster_display_name: update.broadcasterDisplayName ?? null,
    updated_at: nowIso(),
  };

  db()
    .prepare(
      `UPDATE stream_state
       SET station_state = ?, live_session_id = ?, broadcaster_peer_id = ?, broadcaster_display_name = ?, updated_at = ?
       WHERE id = ?`,
    )
    .run(
      next.station_state,
      next.live_session_id,
      next.broadcaster_peer_id,
      next.broadcaster_display_name,
      next.updated_at,
      STATE_ROW_ID,
    );

  return next;
}

function getConnectionByPeerId(peerId: string | null): ConnectionState | null {
  if (!peerId) return null;
  const connectionId = peerIndex.get(peerId);
  return connectionId ? connections.get(connectionId) ?? null : null;
}

function countListeners(): number {
  return Array.from(connections.values()).filter((connection) => !connection.closed && connection.role === 'listener').length;
}

function countGuests(): number {
  return Array.from(connections.values()).filter((c) => !c.closed && c.role === 'guest').length;
}

function getGuestPeerIds(): string[] {
  return Array.from(connections.values())
    .filter((c) => !c.closed && c.role === 'guest' && c.peerId != null)
    .map((c) => c.peerId as string);
}

function endSession(sessionId: string | null, reason: string): void {
  if (!sessionId) return;
  db()
    .prepare(
      `UPDATE sessions
       SET state = 'ended', ended_at = ?, ended_reason = ?
       WHERE id = ? AND state = 'active'`,
    )
    .run(nowIso(), reason, sessionId);
}

function normalizeState(): StreamStateRow {
  const state = readState();
  if (state.broadcaster_peer_id && !getConnectionByPeerId(state.broadcaster_peer_id)) {
    // Stranded broadcaster_peer_id with no live socket. Close the session and
    // clear the slot regardless of station_state so the next admin/open or
    // join_as_broadcaster doesn't get rejected with "someone is already live".
    // Preserve the station_state itself: a `closed` station stays closed,
    // a `blocked` station stays blocked, a `live` station drops back to `open`.
    endSession(state.live_session_id, 'server_recovered_without_broadcaster');
    const nextState: StationState = state.station_state === 'live' ? 'open' : state.station_state;
    return setState({ stationState: nextState });
  }
  return state;
}

function toPublicStatus(state: StreamStateRow): StationStatus {
  const broadcaster = getConnectionByPeerId(state.broadcaster_peer_id);
  return {
    stationState: state.station_state,
    liveSessionId: state.live_session_id,
    listenerCount: countListeners(),
    broadcasterPresent: Boolean(broadcaster),
    broadcasterPeerId: broadcaster?.peerId ?? null,
    broadcasterDisplayName: broadcaster?.displayName ?? state.broadcaster_display_name ?? null,
    updatedAt: state.updated_at,
    jamMode,
    guestCount: countGuests(),
    guestPeerIds: getGuestPeerIds(),
    ...(broadcaster ? {} : { alwaysOnState: getAlwaysOnState() }),
  };
}

function sendMessage(socket: SignalSocket, message: SignalServerMessage): void {
  if (socket.readyState !== socket.OPEN) return;
  socket.send(JSON.stringify(message));
}

function broadcastStatus(): void {
  const status = getPublicStationStatus();
  const payload: SignalServerMessage = { type: 'station_status', ...status };
  for (const connection of connections.values()) {
    if (!connection.closed) {
      sendMessage(connection.socket, payload);
    }
  }
}

function replaceExistingPeerConnection(peerId: string, nextConnectionId: string): void {
  const existingId = peerIndex.get(peerId);
  if (existingId && existingId !== nextConnectionId) {
    disconnectConnection(existingId, 'replaced_by_new_socket', true);
  }
  peerIndex.set(peerId, nextConnectionId);
}

function detachPeerIndex(connection: ConnectionState): void {
  if (connection.peerId && peerIndex.get(connection.peerId) === connection.id) {
    peerIndex.delete(connection.peerId);
  }
}

function isPeerBlocked(peerId: string): boolean {
  const row = db().prepare(`SELECT peer_id FROM blocked_peers WHERE peer_id = ?`).get(peerId);
  return row !== undefined;
}

function countBlockedPeers(): number {
  const row = db().prepare(`SELECT COUNT(*) as count FROM blocked_peers`).get() as { count: number };
  return row.count;
}

function startBroadcasterSession(peerId: string, displayName: string | null): string {
  const sessionId = randomUUID();
  db()
    .prepare(
      `INSERT INTO sessions (id, peer_id, role, display_name, state, started_at, ended_at, ended_reason)
       VALUES (?, ?, 'broadcaster', ?, 'active', ?, NULL, NULL)`,
    )
    .run(sessionId, peerId, displayName, nowIso());
  return sessionId;
}

function recentAudit(): AuditLogEntry[] {
  const rows = db()
    .prepare(
      `SELECT id, actor, action, entity_type as entityType, entity_id as entityId, data_json as dataJson, created_at as createdAt
       FROM audit_log
       ORDER BY created_at DESC
       LIMIT 12`,
    )
    .all() as Array<{
      id: string;
      actor: string;
      action: string;
      entityType: string | null;
      entityId: string | null;
      dataJson: string | null;
      createdAt: string;
    }>;

  return rows.map((row) => ({
    id: row.id,
    actor: row.actor,
    action: row.action,
    entityType: row.entityType,
    entityId: row.entityId,
    data: row.dataJson ? JSON.parse(row.dataJson) : null,
    createdAt: row.createdAt,
  }));
}

function disconnectBroadcaster(connection: ConnectionState, reason: string, nextState: StationState): void {
  const state = readState();
  endSession(connection.sessionId ?? state.live_session_id, reason);
  setState({ stationState: nextState });
  writeAudit(db(), 'system', 'broadcaster_disconnected', 'session', connection.sessionId ?? state.live_session_id, {
    peerId: connection.peerId,
    reason,
  });

  // Reset jam mode and kick all guests when broadcaster leaves
  jamMode = false;
  for (const [id, conn] of connections) {
    if (!conn.closed && conn.role === 'guest') {
      conn.closed = true;
      connections.delete(id);
      if (conn.peerId) peerIndex.delete(conn.peerId);
      try { conn.socket.close(); } catch { /* ignore */ }
    }
  }
}

function disconnectConnection(connectionId: string, reason: string, closeSocket: boolean): void {
  const connection = connections.get(connectionId);
  if (!connection || connection.closed) return;

  connection.closed = true;
  connections.delete(connectionId);
  detachPeerIndex(connection);

  const state = readState();
  if (connection.role === 'broadcaster' && connection.peerId && state.broadcaster_peer_id === connection.peerId) {
    disconnectBroadcaster(
      connection,
      reason,
      state.station_state === 'blocked' ? 'blocked' : state.station_state === 'closed' ? 'closed' : 'open',
    );
  }

  if (closeSocket) {
    try {
      connection.socket.close();
    } catch {
      // Ignore socket shutdown errors.
    }
  }

  broadcastStatus();
}

function relaySignal(
  from: ConnectionState,
  message: Extract<SignalClientMessage, { type: 'sdp_offer' | 'sdp_answer' | 'ice_candidate' }>,
): void {
  if (!from.peerId || from.peerId !== message.peerId) {
    throw new Error('Peer mismatch');
  }

  const state = normalizeState();
  const target = getConnectionByPeerId(message.targetPeerId);
  if (!target || !state.broadcaster_peer_id) {
    throw new Error('Peer unavailable');
  }

  if (from.peerId !== state.broadcaster_peer_id && target.peerId !== state.broadcaster_peer_id) {
    throw new Error('Signals must involve the active broadcaster');
  }

  if (message.type === 'sdp_offer') {
    const fromRole: 'listener' | 'guest' = from.role === 'guest' ? 'guest' : 'listener';
    sendMessage(target.socket, { type: 'peer_offer', fromPeerId: from.peerId, sdp: message.sdp, fromRole });
    return;
  }

  if (message.type === 'sdp_answer') {
    sendMessage(target.socket, { type: 'peer_answer', fromPeerId: from.peerId, sdp: message.sdp });
    return;
  }

  sendMessage(target.socket, { type: 'ice_candidate', fromPeerId: from.peerId, candidate: message.candidate });
}

function acceptListener(connection: ConnectionState, peerId: string): void {
  replaceExistingPeerConnection(peerId, connection.id);
  connection.peerId = peerId;
  connection.role = 'listener';
  connection.displayName = null;
  connection.sessionId = null;
  sendMessage(connection.socket, { type: 'listener_accepted' });
  broadcastStatus();
}

function acceptGuest(connection: ConnectionState, peerId: string, displayName?: string): void {
  const state = normalizeState();

  if (state.station_state !== 'live' || !state.broadcaster_peer_id) {
    sendMessage(connection.socket, { type: 'guest_rejected', reason: 'no live host' });
    return;
  }
  if (!jamMode) {
    sendMessage(connection.socket, { type: 'guest_rejected', reason: 'guests are not enabled right now' });
    return;
  }
  if (isPeerBlocked(peerId)) {
    sendMessage(connection.socket, { type: 'guest_rejected', reason: 'this browser is blocked' });
    return;
  }
  if (countGuests() >= MAX_GUESTS) {
    sendMessage(connection.socket, { type: 'guest_rejected', reason: `guest slots are full (max ${MAX_GUESTS})` });
    return;
  }

  replaceExistingPeerConnection(peerId, connection.id);
  const safeName = displayName?.trim().slice(0, 80) || null;
  connection.peerId = peerId;
  connection.role = 'guest';
  connection.displayName = safeName;
  connection.sessionId = null;

  // Tell guest they're accepted and give them the host's peerId so they can offer
  sendMessage(connection.socket, { type: 'guest_accepted', hostPeerId: state.broadcaster_peer_id });
  broadcastStatus();
}

function acceptBroadcaster(connection: ConnectionState, peerId: string, displayName?: string): void {
  const state = normalizeState();

  if (isPeerBlocked(peerId)) {
    sendMessage(connection.socket, { type: 'broadcaster_rejected', reason: 'this browser is blocked' });
    return;
  }

  if (state.station_state === 'closed') {
    sendMessage(connection.socket, { type: 'broadcaster_rejected', reason: 'stream is closed' });
    return;
  }

  if (state.station_state === 'blocked') {
    sendMessage(connection.socket, { type: 'broadcaster_rejected', reason: 'stream is blocked' });
    return;
  }

  if (state.broadcaster_peer_id && state.broadcaster_peer_id !== peerId) {
    sendMessage(connection.socket, { type: 'broadcaster_rejected', reason: 'someone is already live' });
    return;
  }

  replaceExistingPeerConnection(peerId, connection.id);
  const safeName = displayName?.trim().slice(0, 80) || null;
  const sessionId = startBroadcasterSession(peerId, safeName);

  connection.peerId = peerId;
  connection.role = 'broadcaster';
  connection.displayName = safeName;
  connection.sessionId = sessionId;

  setState({
    stationState: 'live',
    liveSessionId: sessionId,
    broadcasterPeerId: peerId,
    broadcasterDisplayName: safeName,
  });

  writeAudit(db(), 'station', 'broadcaster_started', 'session', sessionId, {
    peerId,
    displayName: safeName,
  });

  sendMessage(connection.socket, { type: 'broadcaster_accepted', liveSessionId: sessionId });
  broadcastStatus();
}

function parseMessage(raw: unknown): SignalClientMessage | null {
  if (typeof raw !== 'string' && !(raw instanceof Buffer)) {
    return null;
  }

  try {
    const payload = JSON.parse(String(raw)) as SignalClientMessage;
    return payload && typeof payload === 'object' && 'type' in payload ? payload : null;
  } catch {
    return null;
  }
}

export function initializeStationService(): void {
  const state = readState();
  if (state.station_state === 'live') {
    endSession(state.live_session_id, 'server_restart');
    setState({ stationState: 'open' });
    return;
  }

  if (state.station_state === 'closed' && !state.broadcaster_peer_id) {
    setState({ stationState: 'open' });
  }
}

export function getPublicStationStatus(): StationStatus {
  return toPublicStatus(normalizeState());
}

export function getAdminStatus(): AdminStatus {
  const state = normalizeState();
  const broadcaster = getConnectionByPeerId(state.broadcaster_peer_id);
  const startedAt = state.live_session_id
    ? (db()
        .prepare(`SELECT started_at as startedAt FROM sessions WHERE id = ?`)
        .get(state.live_session_id) as { startedAt: string } | undefined)?.startedAt ?? state.updated_at
    : state.updated_at;

  const broadcasterStatus =
    broadcaster && state.live_session_id
      ? {
          peerId: broadcaster.peerId ?? state.broadcaster_peer_id ?? '',
          displayName: broadcaster.displayName,
          sessionId: state.live_session_id,
          startedAt,
        }
      : null;

  return {
    ...toPublicStatus(state),
    blockedPeerCount: countBlockedPeers(),
    broadcasterStatus,
    currentBroadcaster: broadcasterStatus,
    listenerPeerIds: Array.from(connections.values())
      .filter((c) => !c.closed && c.role === 'listener' && c.peerId != null)
      .map((c) => c.peerId as string),
    recentAudit: recentAudit(),
  };
}

export function openStation(actor: string): StationStatus {
  const state = readState();
  if (!state.broadcaster_peer_id) {
    setState({ stationState: 'open' });
  }
  writeAudit(db(), actor, 'station_opened', 'stream_state', STATE_ROW_ID, null);
  broadcastStatus();
  return getPublicStationStatus();
}

export function closeStation(actor: string): StationStatus {
  const broadcaster = getConnectionByPeerId(readState().broadcaster_peer_id);
  if (broadcaster) {
    sendMessage(broadcaster.socket, { type: 'force_disconnect', reason: 'stream closed by admin' });
    disconnectConnection(broadcaster.id, 'closed_by_admin', true);
  }
  setState({ stationState: 'closed' });
  writeAudit(db(), actor, 'station_closed', 'stream_state', STATE_ROW_ID, null);
  broadcastStatus();
  return getPublicStationStatus();
}

export function kickBroadcaster(actor: string): StationStatus {
  const broadcaster = getConnectionByPeerId(readState().broadcaster_peer_id);
  if (broadcaster) {
    sendMessage(broadcaster.socket, { type: 'force_disconnect', reason: 'broadcaster kicked by admin' });
    disconnectConnection(broadcaster.id, 'kicked_by_admin', true);
    writeAudit(db(), actor, 'broadcaster_kicked', 'session', broadcaster.sessionId, { peerId: broadcaster.peerId });
  }
  if (readState().station_state !== 'closed') {
    setState({ stationState: 'open' });
  }
  broadcastStatus();
  return getPublicStationStatus();
}

export function blockBroadcaster(actor: string): StationStatus {
  const broadcaster = getConnectionByPeerId(readState().broadcaster_peer_id);
  if (broadcaster?.peerId) {
    db()
      .prepare(
        `INSERT INTO blocked_peers (peer_id, reason, created_at)
         VALUES (?, ?, ?)
         ON CONFLICT(peer_id) DO UPDATE SET reason = excluded.reason, created_at = excluded.created_at`,
      )
      .run(broadcaster.peerId, 'blocked_by_admin', nowIso());
    sendMessage(broadcaster.socket, { type: 'force_disconnect', reason: 'this browser is blocked' });
    disconnectConnection(broadcaster.id, 'blocked_by_admin', true);
    setState({ stationState: 'blocked' });
    writeAudit(db(), actor, 'broadcaster_blocked', 'peer', broadcaster.peerId, { sessionId: broadcaster.sessionId });
  }
  broadcastStatus();
  return getPublicStationStatus();
}

export function clearBlockedPeers(actor: string): StationStatus {
  db().prepare(`DELETE FROM blocked_peers`).run();
  const state = readState();
  if (state.station_state === 'blocked' && !state.broadcaster_peer_id) {
    setState({ stationState: 'open' });
  }
  writeAudit(db(), actor, 'blocked_peers_cleared', 'blocked_peers', null, null);
  broadcastStatus();
  return getPublicStationStatus();
}

export function registerSignalConnection(socket: SignalSocket): string {
  const connectionId = randomUUID();
  connections.set(connectionId, {
    id: connectionId,
    socket,
    peerId: null,
    role: null,
    displayName: null,
    sessionId: null,
    closed: false,
  });

  sendMessage(socket, { type: 'station_status', ...getPublicStationStatus() });
  return connectionId;
}

export function handleSignalMessage(connectionId: string, rawMessage: unknown): void {
  const connection = connections.get(connectionId);
  if (!connection || connection.closed) return;

  const message = parseMessage(rawMessage);
  if (!message) return;

  if (message.type === 'join_as_listener') {
    acceptListener(connection, message.peerId);
    return;
  }

  if (message.type === 'join_as_broadcaster') {
    acceptBroadcaster(connection, message.peerId, message.displayName);
    return;
  }

  if (message.type === 'join_as_guest') {
    acceptGuest(connection, message.peerId, message.displayName);
    return;
  }

  if (message.type === 'set_jam_mode') {
    const state = readState();
    if (connection.peerId && connection.peerId === state.broadcaster_peer_id) {
      jamMode = message.enabled;
      // If turning jam mode off, kick all current guests
      if (!jamMode) {
        for (const [id, conn] of connections) {
          if (!conn.closed && conn.role === 'guest') {
            sendMessage(conn.socket, { type: 'force_disconnect', reason: 'guest mode disabled by host' });
            conn.closed = true;
            connections.delete(id);
            if (conn.peerId) peerIndex.delete(conn.peerId);
            try { conn.socket.close(); } catch { /* ignore */ }
          }
        }
      }
      broadcastStatus();
    }
    return;
  }

  if (message.type === 'leave') {
    disconnectConnection(connectionId, 'client_left', true);
    return;
  }

  // Never let a single bad signal payload tear down the whole socket loop:
  // a peer can disappear, a stale relay can race against a state change, etc.
  // Drop the offending message and let the client recover via state polling
  // instead of force-disconnecting and triggering a reconnect storm.
  try {
    relaySignal(connection, message);
  } catch {
    // Intentionally swallowed; relays are best-effort.
  }
}

export function handleSignalDisconnect(connectionId: string): void {
  disconnectConnection(connectionId, 'socket_closed', false);
}

/**
 * Broadcast the updated always-on state to all connected listeners.
 * Called after advanceAlwaysOnTrack() so every client switches tracks simultaneously.
 */
export function broadcastAlwaysOnAdvance(): void {
  broadcastStatus();
}
