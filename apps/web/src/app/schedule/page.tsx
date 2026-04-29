import { PublicShell } from '@/components/PublicShell';

export const metadata = { title: 'Schedule · West Port Radio' };

export default function SchedulePage() {
  return (
    <PublicShell>
      <div className="space-y-8">
        <h1 className="text-3xl font-bold text-ink tracking-tight">Schedule</h1>
        <p className="text-muted">
          Weekly programming schedule coming soon. Follow us on social media for show
          announcements.
        </p>
        <div className="grid gap-3">
          {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(
            (day) => (
              <div
                key={day}
                className="bg-paper-dark rounded-xl p-5 border border-stone-200"
              >
                <h2 className="text-base font-semibold text-ink mb-1">{day}</h2>
                <p className="text-sm text-muted">AutoDJ — continuous music</p>
              </div>
            ),
          )}
        </div>
      </div>
    </PublicShell>
  );
}
