import { PublicShell } from '@/components/PublicShell';

export const metadata = { title: 'Artists · West Port Radio' };

export default function ArtistsPage() {
  return (
    <PublicShell>
      <div className="space-y-10">
        <div className="space-y-2">
          <p className="text-[0.6rem] uppercase tracking-[0.45em] text-muted font-mono">West Port Radio</p>
          <h1 className="text-4xl font-bold uppercase tracking-[0.15em] text-ink">Artists</h1>
          <p className="text-sm text-muted max-w-2xl">
            West Port Radio is built on the music of Kansas City and beyond. We feature independent artists,
            local bands, and friends of the station. Want your music on the air? Reach out.
          </p>
        </div>

        {/* Featured section — placeholder until artist management is added to admin */}
        <div className="border border-ink/12 bg-white/75 p-8 space-y-4">
          <h2 className="text-xl font-bold uppercase tracking-[0.12em] text-ink">Featured Artists</h2>
          <p className="text-sm text-muted">
            Artist profiles are coming soon. In the meantime, tune in to discover who&apos;s on rotation.
          </p>
        </div>

        {/* Submit section */}
        <div className="border border-ink/12 bg-white/75 p-8 space-y-4">
          <h2 className="text-xl font-bold uppercase tracking-[0.12em] text-ink">Submit Your Music</h2>
          <p className="text-sm text-muted leading-7 max-w-2xl">
            We&apos;re always looking for new music. If you&apos;re a local artist or a touring act coming through Kansas City,
            we want to hear from you. Send us your demos, EPs, or just say hello.
          </p>
          <div className="grid sm:grid-cols-2 gap-4 pt-2">
            {[
              { label: 'Format', value: 'MP3, WAV, FLAC' },
              { label: 'Genre', value: 'Any — we\'re freeform' },
              { label: 'Response time', value: '1–2 weeks' },
              { label: 'Airplay', value: 'Always free' },
            ].map(({ label, value }) => (
              <div key={label} className="border border-ink/10 p-4">
                <p className="text-[0.6rem] uppercase tracking-[0.35em] text-muted font-mono">{label}</p>
                <p className="mt-1 text-sm font-semibold text-ink">{value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </PublicShell>
  );
}
