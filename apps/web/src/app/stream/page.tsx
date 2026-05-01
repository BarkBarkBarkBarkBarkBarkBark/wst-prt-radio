import { PublicShell } from '@/components/PublicShell';
import { StreamClient } from '@/components/StreamClient';

export const metadata = { title: 'Stream · West Port Radio' };

export default function StreamPage() {
  return (
    <PublicShell>
      <StreamClient />
    </PublicShell>
  );
}
