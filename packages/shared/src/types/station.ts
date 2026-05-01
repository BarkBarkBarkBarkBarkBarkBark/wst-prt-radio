export type StationState = 'closed' | 'open' | 'live' | 'blocked' | 'degraded';

export interface StationStatus {
  stationState: StationState;
  liveSessionId: string | null;
  listenerCount: number;
  broadcasterPresent: boolean;
  broadcasterPeerId: string | null;
  broadcasterDisplayName: string | null;
  updatedAt: string;
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
  blockedPeerCount: number;
  currentBroadcaster: BroadcasterStatus | null;
  recentAudit: AuditLogEntry[];
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

export interface AdminPasswordPayload {
  password: string;
}
