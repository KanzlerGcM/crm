/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      colors: {
        chevla: {
          50: '#FFF0F0',
          100: '#FFD6D6',
          200: '#FFB3B3',
          300: '#FF8080',
          400: '#FF4D4D',
          500: '#FF1744',
          600: '#D50000',
          700: '#B71C1C',
          800: '#8B0000',
          900: '#5C0000',
          950: '#3D0000',
        },
        war: {
          void: '#0D0F13',
          steel: '#14171D',
          panel: '#1A1D23',
          surface: '#22262E',
          border: '#2A2F38',
          muted: '#3A3F48',
        },
        aurora: {
          blue: '#0077FF',
          cyan: '#00E5FF',
          violet: '#8B5CF6',
          deep: '#0D0F13',
        },
        sidebar: {
          DEFAULT: '#0A0C10',
          light: '#10131A',
          lighter: '#161A24',
          border: '#1E2230',
        },
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
      boxShadow: {
        'glass': '0 8px 32px rgba(0, 0, 0, 0.4)',
        'glass-lg': '0 12px 48px rgba(0, 0, 0, 0.5)',
        'glow-red': '0 0 20px rgba(255, 23, 68, 0.15)',
        'glow-cyan': '0 0 20px rgba(0, 229, 255, 0.12)',
        'glow-violet': '0 0 20px rgba(139, 92, 246, 0.15)',
        'card': '0 4px 30px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255,255,255,0.03)',
        'card-hover': '0 8px 40px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255,255,255,0.05)',
        'input-focus': '0 0 0 3px rgba(255, 23, 68, 0.12)',
        'war': '0 0 40px rgba(255, 23, 68, 0.08)',
      },
    },
  },
  plugins: [],
};
