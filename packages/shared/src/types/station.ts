export type StationState = 'closed' | 'open' | 'live' | 'blocked' | 'degraded';

export interface AlwaysOnState {
  /** Index into the playlist tracks array */
  trackIndex: number;
  /** Unix ms when this track started playing on the server */
  startedAt: number;
}

export interface StationStatus {
  stationState: StationState;
  liveSessionId: string | null;
  listenerCount: number;
  broadcasterPresent: boolean;
  broadcasterPeerId: string | null;
  broadcasterDisplayName: string | null;
  updatedAt: string;
  /** Present when no live broadcaster; lets all clients seek to the same position */
  alwaysOnState?: AlwaysOnState;
}

export interface BroadcasterStatus {
  peerId: string;
  displayName: string | null;
  sessionId: string;
  startedAt: string;
}

export interface AuditLogEntry {
  id: string;
  actor: string;
  action: string;
  entityType: string | null;
  entityId: string | null;
  data: unknown;
  createdAt: string;
}

export interface AdminStatus extends StationStatus {
  broadcasterStatus: BroadcasterStatus | null;
  listenerPeerIds: string[];
  /** Detailed broadcaster info (alias for broadcasterStatus) */
  currentBroadcaster: BroadcasterStatus | null;
  /** Recent admin audit log entries */
  recentAudit: AuditLogEntry[];
  /** Number of currently blocked peers */
  blockedPeerCount: number;
}

export interface AlwaysOnTrack {
  id: string;
  title: string;
  filename: string;
  url: string;
  mimeType: string;
}

export interface AlwaysOnPlaylist {
  tracks: AlwaysOnTrack[];
}
