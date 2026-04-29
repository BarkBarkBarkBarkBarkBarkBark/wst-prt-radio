'use client';

import Image from 'next/image';
import { useNowPlaying } from '@/lib/hooks/useNowPlaying';
import { LiveBadge } from './LiveBadge';
import { ListenerCount } from './ListenerCount';

export function NowPlayingCard() {
  const { data, loading } = useNowPlaying();

  if (loading) {
    return (
      <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6 animate-pulse">
        <div className="flex gap-4">
          <div className="w-20 h-20 bg-gray-800 rounded-xl flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-gray-800 rounded w-3/4" />
            <div className="h-3 bg-gray-800 rounded w-1/2" />
          </div>
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6">
      <div className="flex gap-4 items-start">
        {data.artUrl ? (
          <Image
            src={data.artUrl}
            alt={`${data.title} album art`}
            width={80}
            height={80}
            className="rounded-xl object-cover flex-shrink-0"
          />
        ) : (
          <div className="w-20 h-20 bg-gray-800 rounded-xl flex-shrink-0 flex items-center justify-center">
            <svg className="w-8 h-8 text-gray-600" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
            </svg>
          </div>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {data.isLive && <LiveBadge />}
          </div>
          <h2 className="text-lg font-semibold text-white truncate">{data.title}</h2>
          <p className="text-gray-400 truncate">{data.artist}</p>
          {data.album && <p className="text-gray-500 text-sm truncate">{data.album}</p>}
          <div className="mt-2">
            <ListenerCount count={data.listenersCount} />
          </div>
        </div>
      </div>
    </div>
  );
}
