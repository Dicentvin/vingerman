/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        display: ['"DM Serif Display"', 'serif'],
        sans: ['"DM Sans"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      colors: {
        ink: {
          950: '#0e0e12',
          900: '#16161d',
          800: '#1e1e28',
          700: '#282835',
          600: '#363645',
        },
        gold: {
          DEFAULT: '#c8a96e',
          light: '#e0c898',
          dark: '#a08040',
          muted: 'rgba(200,169,110,0.12)',
        },
        violet: {
          soft: '#7c6fc4',
          muted: 'rgba(124,111,196,0.12)',
        },
        teal: {
          soft: '#4dbf9e',
          muted: 'rgba(77,191,158,0.12)',
        },
      },
      animation: {
        'pulse-ring': 'pulse-ring 1.2s ease-in-out infinite',
        'fade-in': 'fade-in 0.3s ease-out',
        'slide-up': 'slide-up 0.3s ease-out',
      },
      keyframes: {
        'pulse-ring': {
          '0%,100%': { boxShadow: '0 0 0 0 rgba(224,101,101,0.3)' },
          '50%': { boxShadow: '0 0 0 14px rgba(224,101,101,0)' },
        },
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'slide-up': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
}
