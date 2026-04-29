import { LiveHero } from '@/components/live/LiveHero';
import { NowPlayingCard } from '@/components/player/NowPlayingCard';

export default function HomePage() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-12 space-y-12">
      <section className="text-center space-y-4">
        <h1 className="text-5xl font-extrabold text-white tracking-tight">wstprtradio</h1>
        <p className="text-xl text-gray-400 max-w-2xl mx-auto">
          Community radio, always on. Tune in for music, live sets, and good vibes.
        </p>
        <div className="flex justify-center gap-4 pt-2">
          <a
            href="/listen"
            className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-6 py-3 rounded-full transition-colors"
          >
            Listen Now
          </a>
          <a
            href="/schedule"
            className="border border-gray-600 hover:border-gray-400 text-gray-300 hover:text-white font-semibold px-6 py-3 rounded-full transition-colors"
          >
            Schedule
          </a>
        </div>
      </section>

      <LiveHero />
      <NowPlayingCard />
    </div>
  );
}
