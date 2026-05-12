/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        bg: '#050816',
        card: '#0f172a',
        'card-alt': '#111827',
        'border-subtle': 'rgba(255,255,255,0.08)',
        primary: '#00D1FF',
        success: '#00E676',
        warning: '#FFB020',
        danger: '#FF5252',
        accent: '#7C4DFF',
        'text-muted': '#64748b',
        'text-secondary': '#94a3b8',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      borderRadius: {
        card: '18px',
        chip: '40px',
      },
      boxShadow: {
        glass: '0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.06)',
        glow: '0 0 20px rgba(0,209,255,0.3)',
        'glow-success': '0 0 20px rgba(0,230,118,0.35)',
        'glow-danger': '0 0 20px rgba(255,82,82,0.35)',
        'glow-warning': '0 0 20px rgba(255,176,32,0.3)',
        'glow-accent': '0 0 20px rgba(124,77,255,0.35)',
      },
      animation: {
        'pulse-slow': 'pulse 3s ease-in-out infinite',
        'glow-pulse': 'glow-pulse 2s ease-in-out infinite',
        'spin-slow': 'spin 8s linear infinite',
        'fade-in': 'fade-in 0.4s ease-out',
        'slide-up': 'slide-up 0.4s ease-out',
      },
      keyframes: {
        'glow-pulse': {
          '0%, 100%': { opacity: '0.6', transform: 'scale(1)' },
          '50%': { opacity: '1', transform: 'scale(1.05)' },
        },
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'slide-up': {
          from: { opacity: '0', transform: 'translateY(12px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
      backdropBlur: {
        xs: '4px',
      },
    },
  },
  plugins: [],
};
