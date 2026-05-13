/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f0f4ff',
          100: '#e0e9ff',
          400: '#6b8cff',
          500: '#4f6ef7',
          600: '#3d5bd9',
          700: '#2d46b8',
          900: '#1a2a7a',
        },
        dark: {
          50: '#1a1b26',
          100: '#16171f',
          200: '#13141c',
          300: '#0f1017',
          400: '#0c0d12',
          500: '#08090d',
        },
        terminal: {
          green: '#4ade80',
          blue: '#60a5fa',
          yellow: '#facc15',
          red: '#f87171',
          purple: '#c084fc',
          cyan: '#22d3ee',
        },
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'Cascadia Code', 'monospace'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'pulse-dot': 'pulseDot 1.5s ease-in-out infinite',
        'typing': 'typing 0.6s steps(3) infinite',
        'gradient': 'gradient 3s ease infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
      },
      keyframes: {
        fadeIn: { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        slideUp: { '0%': { transform: 'translateY(10px)', opacity: '0' }, '100%': { transform: 'translateY(0)', opacity: '1' } },
        pulseDot: { '0%, 100%': { opacity: '1' }, '50%': { opacity: '0.3' } },
        typing: { '0%': { content: '.' }, '33%': { content: '..' }, '66%': { content: '...' } },
        gradient: { '0%, 100%': { backgroundPosition: '0% 50%' }, '50%': { backgroundPosition: '100% 50%' } },
        glow: { '0%': { boxShadow: '0 0 5px #4f6ef7' }, '100%': { boxShadow: '0 0 20px #4f6ef7, 0 0 40px #4f6ef7' } },
      },
    },
  },
  plugins: [],
}
