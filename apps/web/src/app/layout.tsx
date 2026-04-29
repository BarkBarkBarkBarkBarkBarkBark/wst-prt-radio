import type { Metadata } from 'next';
import './globals.css';
import { PersistentPlayer } from '@/components/player/PersistentPlayer';

export const metadata: Metadata = {
  title: 'wstprtradio',
  description: 'Always-on community radio',
  openGraph: {
    title: 'wstprtradio',
    description: 'Always-on community radio',
    type: 'website',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-950 text-gray-100 font-sans antialiased">
        <nav className="border-b border-gray-800 bg-gray-900/80 backdrop-blur-sm sticky top-0 z-40">
          <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
            <a href="/" className="text-lg font-bold text-white tracking-tight">
              wstprtradio
            </a>
            <div className="flex items-center gap-6 text-sm text-gray-400">
              <a href="/listen" className="hover:text-white transition-colors">Listen</a>
              <a href="/schedule" className="hover:text-white transition-colors">Schedule</a>
              <a href="/live" className="hover:text-white transition-colors">Live</a>
              <a href="/about" className="hover:text-white transition-colors">About</a>
            </div>
          </div>
        </nav>

        <main className="pb-32">{children}</main>

        <PersistentPlayer />
      </body>
    </html>
  );
}
