import React from 'react';

type Color = 'gray' | 'green' | 'red' | 'yellow' | 'blue' | 'indigo' | 'purple';

interface BadgeProps {
  color?: Color;
  children: React.ReactNode;
  className?: string;
}

const colorClasses: Record<Color, string> = {
  gray: 'bg-gray-100 text-gray-700',
  green: 'bg-green-100 text-green-700',
  red: 'bg-red-100 text-red-700',
  yellow: 'bg-yellow-100 text-yellow-800',
  blue: 'bg-blue-100 text-blue-700',
  indigo: 'bg-indigo-100 text-indigo-700',
  purple: 'bg-purple-100 text-purple-700',
};

export const Badge: React.FC<BadgeProps> = ({ color = 'gray', children, className = '' }) => {
  return (
    <span
      className={[
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        colorClasses[color],
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {children}
    </span>
  );
};
