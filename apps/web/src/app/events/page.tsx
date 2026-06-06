import { PublicShell } from '@/components/PublicShell';
import EventsPageClient from './EventsPageClient';

export const metadata = { title: 'Events · West Port Radio' };

export default function EventsPage() {
  return (
    <PublicShell>
      <EventsPageClient />
    </PublicShell>
  );
}
