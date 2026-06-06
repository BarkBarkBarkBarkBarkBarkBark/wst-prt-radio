'use client';

import { useEffect, useState } from 'react';
import { API_BASE } from '@/lib/api';

interface Event {
  id: string;
  title: string;
  description: string | null;
  event_date: string;
  venue: string | null;
  ticket_url: string | null;
  image_url: string | null;
}

export default function EventsPageClient() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_BASE}/public/events`)
      .then((r) => r.ok ? r.json() : { events: [] })
      .then((d: { events?: Event[] }) => { setEvents(d.events ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <p className="text-[0.6rem] uppercase tracking-[0.45em] text-muted font-mono">West Port Radio</p>
        <h1 className="text-4xl font-bold uppercase tracking-[0.15em] text-ink">Events</h1>
        <p className="text-sm text-muted">Live sessions, local shows, and happenings from the station.</p>
      </div>

      {loading ? (
        <p className="text-sm text-muted">Loading events…</p>
      ) : events.length === 0 ? (
        <div className="border border-ink/10 p-8 text-center">
          <p className="text-sm text-muted">No upcoming events right now. Check back soon.</p>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {events.map((ev) => (
            <div key={ev.id} className="border border-ink/12 bg-white/75 p-6 space-y-3 flex flex-col">
              {ev.image_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={ev.image_url} alt={ev.title} className="w-full h-40 object-cover" />
              )}
              <p className="text-[0.6rem] uppercase tracking-[0.35em] text-muted font-mono">
                {new Date(ev.event_date).toLocaleDateString('en-US', {
                  weekday: 'short', month: 'long', day: 'numeric', year: 'numeric',
                })}
              </p>
              <h2 className="font-bold text-ink text-lg leading-tight">{ev.title}</h2>
              {ev.venue && <p className="text-xs text-muted">{ev.venue}</p>}
              {ev.description && <p className="text-sm text-muted leading-6">{ev.description}</p>}
              {ev.ticket_url && (
                <a
                  href={ev.ticket_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-auto inline-block border border-ink px-5 py-2 text-xs font-bold uppercase tracking-[0.25em] text-ink hover:border-accent-red hover:text-accent-red transition-colors"
                >
                  Get Tickets →
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
