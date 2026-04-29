import { Header } from './Header';
import { Footer } from './Footer';
import { BadDogStamp } from './BadDogStamp';

interface PublicShellProps {
  children: React.ReactNode;
}

/**
 * Shared chrome for all public-facing pages.
 * Provides the warm paper background, Header, Footer, and stamp.
 * Admin pages use their own dark layout and do not use this component.
 */
export function PublicShell({ children }: PublicShellProps) {
  return (
    <div className="min-h-screen bg-paper text-ink flex flex-col">
      <Header />
      <main className="flex-1 px-4 py-10 max-w-5xl mx-auto w-full">{children}</main>
      <Footer />
      <BadDogStamp />
    </div>
  );
}
