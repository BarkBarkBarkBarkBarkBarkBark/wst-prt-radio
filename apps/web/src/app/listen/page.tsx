import { NowPlayingCard } from '@/components/player/NowPlayingCard';
import { RecentTracks } from '@/components/player/RecentTracks';

export const metadata = { title: 'Listen · wstprtradio' };

export default function ListenPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-12 space-y-8">
      <h1 className="text-3xl font-bold text-white">Listen</h1>
      <NowPlayingCard />
      <RecentTracks />
    </div>
  );
}
