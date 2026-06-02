/** @type {import('tailwindcss').Config} */

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,vue}"],
  theme: {
    container: {
      center: true,
    },
    extend: {
      colors: {
        dark: {
          900: '#0a0e1a',
          800: '#0f1629',
          700: '#151d38',
          600: '#1a2444',
          500: '#222d50',
        },
        cyan: {
          glow: '#00e5ff',
        },
        amber: {
          alert: '#ff9100',
        },
        emerald: {
          ok: '#00e676',
        },
        rose: {
          danger: '#ff1744',
        },
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
        sans: ['Noto Sans SC', 'system-ui', 'sans-serif'],
        display: ['Orbitron', 'sans-serif'],
      },
      animation: {
        'pulse-glow': 'pulseGlow 2s ease-in-out infinite',
        'slide-in': 'slideIn 0.3s ease-out',
        'fade-in': 'fadeIn 0.5s ease-out',
      },
      keyframes: {
        pulseGlow: {
          '0%, 100%': { boxShadow: '0 0 5px rgba(0, 229, 255, 0.3)' },
          '50%': { boxShadow: '0 0 20px rgba(0, 229, 255, 0.6)' },
        },
        slideIn: {
          '0%': { transform: 'translateX(-10px)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
      },
    },
  },
  plugins: [],
};
