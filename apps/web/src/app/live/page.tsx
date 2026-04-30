import { PublicShell } from '@/components/PublicShell';
import { OpenMicStudio } from '@/components/live/OpenMicStudio';

export const metadata = { title: 'Live · West Port Radio' };

export default function LivePage() {
  return (
    <PublicShell>
      <OpenMicStudio />
    </PublicShell>
  );
}
