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

export const AdminPasswordPayloadSchema = z.object({
  password: z.string().min(1),
});
