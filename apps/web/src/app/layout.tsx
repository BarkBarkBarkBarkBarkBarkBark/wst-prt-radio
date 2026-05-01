import type { Metadata } from 'next';
import './globals.css';
import { AudioProvider } from '@/lib/AudioProvider';
import { PlayerBar } from '@/components/PlayerBar';

export const metadata: Metadata = {
  title: 'West Port Radio',
  description: 'Pirate Radio from Kansas City, Missouri',
  openGraph: {
    title: 'West Port Radio',
    description: 'Pirate Radio from Kansas City, Missouri',
    type: 'website',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      {/* pb-[72px] reserves space so content never hides behind the fixed PlayerBar */}
      <body className="antialiased pb-[72px]">
        <AudioProvider>
          {children}
          <PlayerBar />
        </AudioProvider>
      </body>
    </html>
  );
}
