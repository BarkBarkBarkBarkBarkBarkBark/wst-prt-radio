/**
 * Unit tests for the single-broadcaster state machine.
 *
 * Run: `pnpm --filter @wstprtradio/api test`
 *
 * Why node:test instead of vitest: zero new deps, runs in the same Node 20
 * runtime that ships with Fly's Docker image, no jsdom pretense — these tests
 * exercise pure business logic against an in-memory SQLite DB.
 */

process.env.SQLITE_DB_PATH = ':memory:';
process.env.APP_ENV = 'test';
process.env.ADMIN_USERS = process.env.ADMIN_USERS || 'marco:barkbark';
process.env.SESSION_SECRET = process.env.SESSION_SECRET || 'a'.repeat(64);

import { strict as assert } from 'node:assert';
import { beforeEach, describe, it } from 'node:test';
import type { SignalServerMessage } from '@wstprtradio/shared';

import { getDb } from '../db/client.js';
import {
  blockBroadcaster,
  clearBlockedPeers,
  closeStation,
  getAdminStatus,
  getPublicStationStatus,
  handleSignalDisconnect,
  handleSignalMessage,
  initializeStationService,
  kickBroadcaster,
  openStation,
  registerSignalConnection,
} from './liveRoomService.js';

interface FakeSocket {
  send: (data: string) => void;
  close: () => void;
  readyState: number;
  OPEN: number;
  sent: SignalServerMessage[];
}

function makeSocket(): FakeSocket {
  const sent: SignalServerMessage[] = [];
  return {
    OPEN: 1,
    readyState: 1,
    send: (data: string) => {
      sent.push(JSON.parse(data) as SignalServerMessage);
    },
    close: () => {},
    sent,
  };
}

function resetDb(): void {
  const db = getDb();
  db.exec('DELETE FROM audit_log; DELETE FROM blocked_peers; DELETE FROM sessions; DELETE FROM stream_state;');
  db.prepare(
    `INSERT INTO stream_state (id, station_state, live_session_id, broadcaster_peer_id, broadcaster_display_name, updated_at)
     VALUES ('primary', 'open', NULL, NULL, NULL, ?)`,
  ).run(new Date().toISOString());
}

describe('liveRoomService', () => {
  beforeEach(() => {
    resetDb();
  });

  it('starts open with nobody live', () => {
    const status = getPublicStationStatus();
    assert.equal(status.stationState, 'open');
    assert.equal(status.broadcasterPresent, false);
    assert.equal(status.listenerCount, 0);
  });

  it('admits a broadcaster and rejects a second one', () => {
    const a = makeSocket();
    const b = makeSocket();
    const aId = registerSignalConnection(a as never);
    const bId = registerSignalConnection(b as never);

    handleSignalMessage(aId, JSON.stringify({ type: 'join_as_broadcaster', peerId: 'peer-a', displayName: 'Marco' }));
    handleSignalMessage(bId, JSON.stringify({ type: 'join_as_broadcaster', peerId: 'peer-b' }));

    const status = getPublicStationStatus();
    assert.equal(status.stationState, 'live');
    assert.equal(status.broadcasterPeerId, 'peer-a');
    assert.equal(status.broadcasterDisplayName, 'Marco');

    const aAccepted = a.sent.some((m) => m.type === 'broadcaster_accepted');
    const bRejected = b.sent.some(
      (m) => m.type === 'broadcaster_rejected' && m.reason === 'someone is already live',
    );
    assert.ok(aAccepted, 'first broadcaster should be accepted');
    assert.ok(bRejected, 'second broadcaster should be rejected');
  });

  it('kick disconnects the broadcaster and reopens the station', () => {
    const sock = makeSocket();
    const id = registerSignalConnection(sock as never);
    handleSignalMessage(id, JSON.stringify({ type: 'join_as_broadcaster', peerId: 'peer-a' }));
    assert.equal(getPublicStationStatus().stationState, 'live');

    const after = kickBroadcaster('marco');
    assert.equal(after.stationState, 'open');
    assert.equal(after.broadcasterPresent, false);
    assert.ok(sock.sent.some((m) => m.type === 'force_disconnect'));

    const audit = getAdminStatus().recentAudit.map((a) => a.action);
    assert.ok(audit.includes('broadcaster_kicked'));
  });

  it('block + clear-blocks round-trips', () => {
    const sock = makeSocket();
    const id = registerSignalConnection(sock as never);
    handleSignalMessage(id, JSON.stringify({ type: 'join_as_broadcaster', peerId: 'peer-x' }));
    assert.equal(getPublicStationStatus().stationState, 'live');

    blockBroadcaster('marco');
    assert.equal(getPublicStationStatus().stationState, 'blocked');
    assert.equal(getAdminStatus().blockedPeerCount, 1);

    // The same peer should now be rejected if they try to come back.
    const rejoin = makeSocket();
    const rejoinId = registerSignalConnection(rejoin as never);
    handleSignalMessage(rejoinId, JSON.stringify({ type: 'join_as_broadcaster', peerId: 'peer-x' }));
    assert.ok(rejoin.sent.some((m) => m.type === 'broadcaster_rejected' && m.reason === 'this browser is blocked'));

    clearBlockedPeers('marco');
    assert.equal(getAdminStatus().blockedPeerCount, 0);
    assert.equal(getPublicStationStatus().stationState, 'open');
  });

  it('close + open round-trips', () => {
    closeStation('marco');
    assert.equal(getPublicStationStatus().stationState, 'closed');
    openStation('marco');
    assert.equal(getPublicStationStatus().stationState, 'open');
  });

  it('initializeStationService recovers from a stale live session', () => {
    // Simulate a previous run that crashed mid-broadcast.
    const db = getDb();
    db.prepare(
      `UPDATE stream_state
       SET station_state = 'live', live_session_id = 'sess-1', broadcaster_peer_id = 'ghost', broadcaster_display_name = 'Old DJ', updated_at = ?
       WHERE id = 'primary'`,
    ).run(new Date().toISOString());
    db.prepare(
      `INSERT INTO sessions (id, peer_id, role, display_name, state, started_at)
       VALUES ('sess-1', 'ghost', 'broadcaster', 'Old DJ', 'active', ?)`,
    ).run(new Date().toISOString());

    initializeStationService();

    const status = getPublicStationStatus();
    assert.equal(status.stationState, 'open');
    assert.equal(status.broadcasterPresent, false);

    const session = db
      .prepare(`SELECT state, ended_reason FROM sessions WHERE id = 'sess-1'`)
      .get() as { state: string; ended_reason: string | null };
    assert.equal(session.state, 'ended');
    assert.equal(session.ended_reason, 'server_restart');
  });

  it('normalizeState clears a stranded broadcaster_peer_id even if state is closed', () => {
    // Stale broadcaster id paired with a `closed` station — used to pin the
    // station shut. Phase 2 widened normalizeState to clear this.
    const db = getDb();
    db.prepare(
      `UPDATE stream_state
       SET station_state = 'closed', live_session_id = 'sess-2', broadcaster_peer_id = 'ghost', broadcaster_display_name = 'Ghost', updated_at = ?
       WHERE id = 'primary'`,
    ).run(new Date().toISOString());

    // Reading status invokes normalizeState() — should clear the stranded peer
    // but preserve `closed`.
    const status = getPublicStationStatus();
    assert.equal(status.stationState, 'closed');
    assert.equal(status.broadcasterPeerId, null);
    assert.equal(status.broadcasterPresent, false);

    // Now open should succeed without a "someone is already live" pseudo-block.
    openStation('marco');
    assert.equal(getPublicStationStatus().stationState, 'open');
  });

  it('disconnecting the broadcaster socket re-opens the station', () => {
    const sock = makeSocket();
    const id = registerSignalConnection(sock as never);
    handleSignalMessage(id, JSON.stringify({ type: 'join_as_broadcaster', peerId: 'peer-1' }));
    assert.equal(getPublicStationStatus().stationState, 'live');

    handleSignalDisconnect(id);
    const after = getPublicStationStatus();
    assert.equal(after.stationState, 'open');
    assert.equal(after.broadcasterPresent, false);
  });

  it('listener count tracks join_as_listener', () => {
    const a = makeSocket();
    const b = makeSocket();
    const aId = registerSignalConnection(a as never);
    const bId = registerSignalConnection(b as never);
    handleSignalMessage(aId, JSON.stringify({ type: 'join_as_listener', peerId: 'l-1' }));
    handleSignalMessage(bId, JSON.stringify({ type: 'join_as_listener', peerId: 'l-2' }));
    assert.equal(getPublicStationStatus().listenerCount, 2);

    handleSignalDisconnect(aId);
    assert.equal(getPublicStationStatus().listenerCount, 1);
  });
});
