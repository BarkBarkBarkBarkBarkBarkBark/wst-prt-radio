import Link from 'next/link';

function RadioTowerIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4.9 16.1C1 12.2 1 5.8 4.9 1.9" />
      <path d="M7.8 4.7a6.14 6.14 0 0 0 0 8.5" />
      <circle cx="12" cy="9" r="2" />
      <line x1="12" y1="11" x2="12" y2="22" />
      <line x1="9" y1="22" x2="15" y2="22" />
      <path d="M16.2 4.7a6.14 6.14 0 0 1 0 8.5" />
      <path d="M19.1 1.9a9.96 9.96 0 0 1 0 14.2" />
    </svg>
  );
}

const NAV_ITEMS = [
  { label: 'Home', href: '/' },
  { label: 'Listen', href: '/listen' },
  { label: 'Stream', href: '/stream' },
  { label: 'Admin', href: '/admin' },
];

export function Header() {
  return (
    <header className="px-6 py-5 border-b border-stone-200">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center gap-y-3 gap-x-6 justify-between">
        {/* Brand */}
        <Link href="/" className="flex items-center gap-3 group">
          <RadioTowerIcon className="w-7 h-7 text-accent-red flex-shrink-0" />
          <div>
            <p className="text-lg font-bold tracking-[0.12em] text-ink uppercase leading-tight group-hover:text-accent-red transition-colors">
              WEST PORT RADIO
            </p>
            <p className="text-[11px] text-muted tracking-wider leading-none">
              Pirate Radio from Kansas City, Missouri
            </p>
          </div>
        </Link>

        {/* Frequency — hidden on very small screens */}
        <p className="hidden md:block text-xs text-muted tracking-[0.15em] uppercase">
          88.9&nbsp;FM&nbsp;·&nbsp;Kansas City, Missouri, USA
        </p>

        {/* Nav */}
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
