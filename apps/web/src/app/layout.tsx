import type { Metadata } from 'next';
import './globals.css';

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
      <body className="antialiased">{children}</body>
    </html>
  );
}
