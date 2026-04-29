type Color = 'gray' | 'green' | 'red' | 'yellow' | 'blue' | 'indigo' | 'purple';

interface BadgeProps {
  color?: Color;
  children: React.ReactNode;
  className?: string;
}

const colorClasses: Record<Color, string> = {
  gray: 'bg-gray-800 text-gray-400',
  green: 'bg-green-500/10 text-green-400',
  red: 'bg-red-500/10 text-red-400',
  yellow: 'bg-yellow-500/10 text-yellow-400',
  blue: 'bg-blue-500/10 text-blue-400',
  indigo: 'bg-indigo-500/10 text-indigo-400',
  purple: 'bg-purple-500/10 text-purple-400',
};

export function Badge({ color = 'gray', children, className = '' }: BadgeProps) {
  return (
    <span className={['inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium', colorClasses[color], className].join(' ')}>
      {children}
    </span>
  );
}
