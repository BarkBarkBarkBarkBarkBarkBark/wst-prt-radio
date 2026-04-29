import { PublicShell } from '@/components/PublicShell';
import { LiveHero } from '@/components/live/LiveHero';

export const metadata = { title: 'Live · West Port Radio' };

export default function LivePage() {
  return (
    <PublicShell>
      <div className="space-y-8">
        <h1 className="text-3xl font-bold text-ink tracking-tight">Live</h1>
        <LiveHero fullPage />
      </div>
    </PublicShell>
  );
}
