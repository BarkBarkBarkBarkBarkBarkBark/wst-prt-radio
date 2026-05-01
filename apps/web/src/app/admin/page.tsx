import { PublicShell } from '@/components/PublicShell';
import { AdminConsole } from '@/components/AdminConsole';

export const metadata = { title: 'Admin · West Port Radio' };

export default function AdminPage() {
  return (
    <PublicShell>
      <AdminConsole />
    </PublicShell>
  );
}
