interface CardProps {
  children: React.ReactNode;
  className?: string;
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

const paddingClasses = { none: '', sm: 'p-4', md: 'p-6', lg: 'p-8' };

export function Card({ children, className = '', padding = 'md' }: CardProps) {
  return (
    <div className={['bg-gray-900 rounded-xl border border-gray-800', paddingClasses[padding], className].filter(Boolean).join(' ')}>
      {children}
    </div>
  );
}
