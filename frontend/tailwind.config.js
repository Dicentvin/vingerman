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
          950: '#ffffff',
          900: '#f8f9fc',
          800: '#f0f2f8',
          700: '#e4e8f2',
          600: '#d6dced',
        },
        gold: {
          DEFAULT: '#1a56db',
          light: '#3b82f6',
          dark: '#1e40af',
          muted: 'rgba(26,86,219,0.10)',
        },
        violet: {
          soft: '#7c3aed',
          muted: 'rgba(124,58,237,0.10)',
        },
        teal: {
          soft: '#0891b2',
          muted: 'rgba(8,145,178,0.10)',
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
