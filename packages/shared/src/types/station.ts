export type StationMode = 'autodj' | 'live_audio' | 'live_video' | 'degraded';

export interface NowPlaying {
  title: string;
  artist: string;
  album?: string;
  artUrl?: string;
  listenersCount: number;
  isLive: boolean;
  streamUrl: string;
}

export interface LiveSession {
  id: string;
  mode: 'live_audio' | 'live_video';
  title: string;
  status: 'pending' | 'active' | 'ended';
  startedAt: string | null;
}

export interface StationStatus {
  mode: StationMode;
  nowPlaying: NowPlaying | null;
  liveSession: LiveSession | null;
}

export type DestinationKind =
  | 'twitch'
  | 'instagram'
  | 'custom_rtmp'
  | 'custom_srt'
  | 'tiktok_experimental'
  | 'discord_notify';

export interface Destination {
  id: string;
  kind: DestinationKind;
  name: string;
  enabled: boolean;
  url: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}
