import { PublicShell } from '@/components/PublicShell';
import { ListenClient } from '@/components/ListenClient';

export const metadata = { title: 'Listen · West Port Radio' };

export default function ListenPage() {
  return (
    <PublicShell>
      <ListenClient />
    </PublicShell>
  );
}
