import { z } from 'zod';

export const StationStateSchema = z.enum(['closed', 'open', 'live', 'blocked', 'degraded']);

export const StationStatusSchema = z.object({
  stationState: StationStateSchema,
  liveSessionId: z.string().nullable(),
  listenerCount: z.number().int().nonnegative(),
  broadcasterPresent: z.boolean(),
  broadcasterPeerId: z.string().nullable(),
  broadcasterDisplayName: z.string().nullable(),
  updatedAt: z.string(),
  jamMode: z.boolean().default(false),
  guestCount: z.number().int().nonnegative().default(0),
  guestPeerIds: z.array(z.string()).default([]),
});

export const BroadcasterStatusSchema = z.object({
  peerId: z.string(),
  displayName: z.string().nullable(),
  sessionId: z.string(),
  startedAt: z.string(),
});

export const AuditLogEntrySchema = z.object({
  id: z.string(),
  actor: z.string(),
  action: z.string(),
  entityType: z.string().nullable(),
  entityId: z.string().nullable(),
  data: z.unknown(),
  createdAt: z.string(),
});

export const AdminStatusSchema = StationStatusSchema.extend({
  blockedPeerCount: z.number().int().nonnegative(),
  currentBroadcaster: BroadcasterStatusSchema.nullable(),
  recentAudit: z.array(AuditLogEntrySchema),
});

export const AlwaysOnTrackSchema = z.object({
  id: z.string(),
  title: z.string(),
  filename: z.string(),
  url: z.string(),
  mimeType: z.string(),
});

export const AlwaysOnPlaylistSchema = z.object({
  tracks: z.array(AlwaysOnTrackSchema),
});

export const AdminPasswordPayloadSchema = z.object({
  password: z.string().min(1),
});
