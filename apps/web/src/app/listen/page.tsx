import { PublicShell } from '@/components/PublicShell';
import { NowPlayingCard } from '@/components/player/NowPlayingCard';
import { RecentTracks } from '@/components/player/RecentTracks';

export const metadata = { title: 'Listen · West Port Radio' };

export default function ListenPage() {
  return (
    <PublicShell>
      <div className="space-y-8">
        <h1 className="text-3xl font-bold text-ink tracking-tight">Listen</h1>
        <NowPlayingCard />
        <RecentTracks />
      </div>
    </PublicShell>
  );
}
