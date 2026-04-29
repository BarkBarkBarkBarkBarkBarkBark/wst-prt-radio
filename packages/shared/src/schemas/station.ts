import { z } from 'zod';

export const StationModeSchema = z.enum(['autodj', 'live_audio', 'live_video', 'degraded']);

export const NowPlayingSchema = z.object({
  title: z.string(),
  artist: z.string(),
  album: z.string().optional(),
  artUrl: z.string().url().optional(),
  listenersCount: z.number().int().nonnegative(),
  isLive: z.boolean(),
  streamUrl: z.string().url(),
});

export const LiveSessionSchema = z.object({
  id: z.string(),
  mode: z.enum(['live_audio', 'live_video']),
  title: z.string(),
  status: z.enum(['pending', 'active', 'ended']),
  startedAt: z.string().nullable(),
});

export const StationStatusSchema = z.object({
  mode: StationModeSchema,
  nowPlaying: NowPlayingSchema.nullable(),
  liveSession: LiveSessionSchema.nullable(),
});
