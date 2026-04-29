import { LiveHero } from '@/components/live/LiveHero';

export const metadata = { title: 'Live · wstprtradio' };

export default function LivePage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-12 space-y-8">
      <h1 className="text-3xl font-bold text-white">Live</h1>
      <LiveHero fullPage />
    </div>
  );
}
