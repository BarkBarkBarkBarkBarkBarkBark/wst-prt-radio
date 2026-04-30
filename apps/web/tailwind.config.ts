import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    '../../packages/ui/src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Warm vinyl / paper aesthetic palette
        paper: '#F4EFE4',
        'paper-dark': '#EDE8D9',
        ink: '#151515',
        muted: '#777064',
        'accent-red': '#B73524',
        'record-black': '#080808',
        // Legacy brand tokens (admin UI)
        brand: {
          50: '#f0f4ff',
          100: '#e0e9ff',
          500: '#4f6ef7',
          600: '#3b5cf6',
          700: '#2d4ae8',
          900: '#1a2c99',
        },
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'bar-pulse': 'barPulse 0.8s ease-in-out infinite alternate',
        'live-pulse': 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        barPulse: {
          '0%': { transform: 'scaleY(0.25)' },
          '100%': { transform: 'scaleY(1)' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
