import Link from 'next/link';

const NAV_ITEMS = [
  { label: 'Home', href: '/' },
  { label: 'Events', href: '/events' },
  { label: 'Artists', href: '/artists' },
];

export function Header() {
  return (
    <header className="px-6 py-5 border-b border-stone-200">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center gap-y-3 gap-x-6 justify-between">
        <Link href="/" className="group">
          <p className="text-lg font-bold tracking-[0.16em] text-ink uppercase leading-tight group-hover:text-accent-red transition-colors">
            WEST PORT RADIO
          </p>
        </Link>

        <p className="hidden md:block text-xs text-muted tracking-[0.18em] uppercase">
          Kansas City, Missouri
        </p>

        <nav className="flex items-center gap-1" aria-label="Site navigation">
          {NAV_ITEMS.map(({ label, href }) => (
            <Link
              key={label}
              href={href}
              className="px-3 py-1.5 text-[11px] tracking-widest uppercase text-ink hover:text-accent-red border border-transparent hover:border-accent-red/40 transition-colors"
            >
              {label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
