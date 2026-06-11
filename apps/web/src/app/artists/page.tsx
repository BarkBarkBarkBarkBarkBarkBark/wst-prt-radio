import { PublicShell } from '@/components/PublicShell';
import { API_BASE } from '@/lib/api';

interface Artist {
  id: string;
  name: string;
  bio: string | null;
  image_url: string | null;
  links_json: string;
}

async function getArtists(): Promise<Artist[]> {
  try {
    const response = await fetch(`${API_BASE}/public/artists`, { cache: 'no-store' });
    if (!response.ok) return [];
    const data = await response.json() as { artists?: Artist[] };
    return data.artists ?? [];
  } catch {
    return [];
  }
}

export const metadata = { title: 'Artists · West Port Radio' };

export default async function ArtistsPage() {
  const artists = await getArtists();

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

        {/* Featured section */}
        <div className="border border-ink/12 bg-white/75 p-8 space-y-4">
          <h2 className="text-xl font-bold uppercase tracking-[0.12em] text-ink">Featured Artists</h2>
          {artists.length === 0 ? (
            <p className="text-sm text-muted">
              Artist profiles are coming soon. In the meantime, tune in to discover who&apos;s on rotation.
            </p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {artists.map((artist) => {
                const links = (() => {
                  try { return JSON.parse(artist.links_json) as { label: string; url: string }[]; } catch { return []; }
                })();

                return (
                  <article key={artist.id} className="border border-ink/10 bg-paper p-5 space-y-4">
                    {artist.image_url ? (
                      <div className="aspect-[4/3] overflow-hidden bg-stone-100">
                        <img src={artist.image_url} alt={artist.name} className="h-full w-full object-cover" />
                      </div>
                    ) : null}
                    <div className="space-y-2">
                      <h3 className="text-lg font-semibold text-ink">{artist.name}</h3>
                      {artist.bio ? <p className="text-sm leading-7 text-muted">{artist.bio}</p> : null}
                      {links.length > 0 ? (
                        <div className="flex flex-wrap gap-2 pt-2">
                          {links.map((link) => (
                            <a
                              key={`${artist.id}-${link.label}`}
                              href={link.url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs uppercase tracking-[0.25em] text-ink underline decoration-ink/20 underline-offset-4"
                            >
                              {link.label}
                            </a>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
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
