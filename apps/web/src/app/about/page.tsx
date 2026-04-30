import { PublicShell } from '@/components/PublicShell';

export const metadata = { title: 'About · West Port Radio' };

export default function AboutPage() {
  return (
    <PublicShell>
      <div className="space-y-8 max-w-2xl">
        <h1 className="text-3xl font-bold text-ink tracking-tight">About</h1>

        <div className="space-y-6 text-base text-muted leading-relaxed">
          <p>
            <strong className="text-ink">West Port Radio</strong> is a pirate radio station
            broadcasting 24/7 from Kansas City, Missouri. We play an eclectic mix of music across
            genres, with regular live DJ sets from local artists and special events.
          </p>
          <p>
            Our stream is powered by{' '}
            <a
              href="https://azuracast.com"
              className="text-accent-red hover:underline"
              target="_blank"
              rel="noreferrer"
            >
              AzuraCast
            </a>{' '}
            for AutoDJ and live audio, with live video streamed via Cloudflare Stream.
          </p>

          <h2 className="text-xl font-semibold text-ink">Get Involved</h2>
          <p>
            Interested in hosting a show? Reach out at{' '}
            <a href="mailto:hello@wstprtradio.com" className="text-accent-red hover:underline">
              hello@wstprtradio.com
            </a>
          </p>

          <h2 className="text-xl font-semibold text-ink">Technical</h2>
          <p>
            We broadcast at 128 kbps MP3. Stream URL:{' '}
            <code className="bg-paper-dark px-1.5 py-0.5 rounded text-sm text-ink">
              https://radio.wstprtradio.com/radio.mp3
            </code>
          </p>
        </div>
      </div>
    </PublicShell>
  );
}
