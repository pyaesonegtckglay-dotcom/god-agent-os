/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './store/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        void:    '#05060d',
        surface: {
          1: '#0a0c16',
          2: '#0e1121',
          3: '#131729',
          4: '#191e32',
          5: '#1f263b',
        },
        purple: {
          DEFAULT: '#7c3aed',
          bright:  '#8b5cf6',
          light:   '#a78bfa',
          dim:     'rgba(124,58,237,0.15)',
        },
        blue:  { DEFAULT: '#3b82f6', bright: '#60a5fa' },
        cyan:  { DEFAULT: '#22d3ee', bright: '#67e8f9' },
        green: { DEFAULT: '#22c55e', bright: '#4ade80' },
        amber: { DEFAULT: '#f59e0b', bright: '#fbbf24' },
        pink:  { DEFAULT: '#ec4899', bright: '#f472b6' },
        neon:  { purple: '#bf00ff', blue: '#00d4ff', green: '#00ff88' },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      borderRadius: {
        '2xl': '16px',
        '3xl': '20px',
        '4xl': '24px',
      },
      backdropBlur: { xs: '2px', sm: '8px', md: '16px', lg: '24px', xl: '40px' },
      boxShadow: {
        'glow-purple': '0 0 20px rgba(124,58,237,0.3), 0 0 60px rgba(124,58,237,0.1)',
        'glow-blue':   '0 0 20px rgba(59,130,246,0.3)',
        'glow-cyan':   '0 0 20px rgba(34,211,238,0.3)',
        'glow-green':  '0 0 12px rgba(34,197,94,0.4)',
        'card':        '0 4px 24px rgba(0,0,0,0.3)',
        'card-hover':  '0 8px 40px rgba(0,0,0,0.4)',
      },
      animation: {
        'fade-in-up':  'fadeInUp 0.4s ease-out forwards',
        'fade-in':     'fadeIn 0.3s ease-out forwards',
        'slide-left':  'slideInLeft 0.3s ease-out forwards',
        'pulse-glow':  'pulseGlow 2s ease-in-out infinite',
        'spin-slow':   'spin 8s linear infinite',
        'orb-float':   'orbFloat 6s ease-in-out infinite',
        'shimmer':     'shimmer 3s linear infinite',
        'typing-dot':  'typingDot 1.4s ease-in-out infinite',
      },
      keyframes: {
        fadeInUp:    { from: { opacity: '0', transform: 'translateY(12px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        fadeIn:      { from: { opacity: '0' }, to: { opacity: '1' } },
        slideInLeft: { from: { opacity: '0', transform: 'translateX(-16px)' }, to: { opacity: '1', transform: 'translateX(0)' } },
        pulseGlow:   { '0%,100%': { opacity: '0.6' }, '50%': { opacity: '1' } },
        orbFloat:    { '0%,100%': { transform: 'translateY(0px) rotate(0deg)' }, '33%': { transform: 'translateY(-8px) rotate(5deg)' }, '66%': { transform: 'translateY(4px) rotate(-3deg)' } },
        shimmer:     { '0%': { backgroundPosition: '-200% center' }, '100%': { backgroundPosition: '200% center' } },
        typingDot:   { '0%,80%,100%': { transform: 'scale(0)', opacity: '0.3' }, '40%': { transform: 'scale(1)', opacity: '1' } },
      },
    },
  },
  plugins: [],
}
