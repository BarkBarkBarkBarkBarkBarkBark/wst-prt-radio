import { z } from 'zod';

export const DestinationKindSchema = z.enum([
  'twitch',
  'instagram',
  'custom_rtmp',
  'custom_srt',
  'tiktok_experimental',
  'discord_notify',
]);

export const DestinationSchema = z.object({
  id: z.string(),
  kind: DestinationKindSchema,
  name: z.string().min(1).max(100),
  enabled: z.boolean(),
  url: z.string(),
  sortOrder: z.number().int(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const CreateDestinationSchema = z.object({
  kind: DestinationKindSchema,
  name: z.string().min(1).max(100),
  enabled: z.boolean().default(true),
  url: z.string(),
  streamKey: z.string().optional(),
  srtPassphrase: z.string().optional(),
  sortOrder: z.number().int().default(0),
});

export const UpdateDestinationSchema = CreateDestinationSchema.partial();
