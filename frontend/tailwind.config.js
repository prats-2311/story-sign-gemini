/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // "Deep Neural Pro" Palette
        neural: {
          900: '#0F1117', // Charcoal (Main Bg)
          800: '#1A1D26', // Midnight Blue (Card/Panel Bg)
          700: '#2A2F3D', // Borders/Separators
        },
        cyber: {
          cyan: '#00F2FF', // "Correct Form" / Primary Accent (Neon)
          amber: '#FFB800', // "Correction Needed" / Warning
          red: '#FF2E2E',   // Critical Error
        }
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'], // Geometric & Clean
        mono: ['Fira Code', 'monospace'], // For the Thinking Log
      },
      backgroundImage: {
        'glass-gradient': 'linear-gradient(145deg, rgba(26, 29, 38, 0.6) 0%, rgba(15, 17, 23, 0.8) 100%)',
      },
      backdropBlur: {
        'xs': '2px', // Subtle glass
      },
      boxShadow: {
        'neon-cyan': '0 0 10px rgba(0, 242, 255, 0.5), 0 0 20px rgba(0, 242, 255, 0.3)',
      },
      ringColor: {
        'cyber-cyan': '#00F2FF', // Glowing Ring Utility
      },
      animation: {
        'shockwave': 'shockwave 1s ease-out infinite',
        'pulse-fast': 'pulse 1s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        shockwave: {
          '0%': { transform: 'scale(1)', opacity: '1', boxShadow: '0 0 0 0 rgba(0, 242, 255, 0.7)' },
          '70%': { transform: 'scale(1.5)', opacity: '0', boxShadow: '0 0 0 20px rgba(0, 242, 255, 0)' },
          '100%': { transform: 'scale(1.5)', opacity: '0' },
        }
      }
    },
  },
  plugins: [],
}
