/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{vue,js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'deep-space': '#0A1628',
        'midnight': '#0F2137',
        'slate-dark': '#1E293B',
        'slate-mid': '#334155',
        'slate-light': '#64748B',
        'alert-orange': '#FF6B35',
        'success-green': '#00C853',
        'info-blue': '#2196F3',
        'neon-purple': 'var(--accent-color, #7C4DFF)',
        'cyber-teal': '#00E5FF',
        'danger-red': '#FF5252',
        'warning-amber': '#FFD740',
      },
      fontFamily: {
        'display': ['Space Grotesk', 'sans-serif'],
        'mono': ['JetBrains Mono', 'monospace'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
        'float': 'float 6s ease-in-out infinite',
        'scan': 'scan 2s linear infinite',
      },
      keyframes: {
        glow: {
          '0%': { boxShadow: '0 0 5px rgba(var(--accent-color-rgb, 124, 77, 255), 0.5)' },
          '100%': { boxShadow: '0 0 20px rgba(var(--accent-color-rgb, 124, 77, 255), 0.8), 0 0 30px rgba(var(--accent-color-rgb, 124, 77, 255), 0.4)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        scan: {
          '0%': { backgroundPosition: '0% 0%' },
          '100%': { backgroundPosition: '0% 100%' },
        },
      },
    },
  },
  plugins: [],
}
