import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/renderer/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        atlas: {
          paper: 'var(--atlas-paper)',
          mist: 'var(--atlas-mist)',
          line: 'var(--atlas-line)',
          soft: 'var(--atlas-soft)',
          blue: 'var(--atlas-blue)',
          steel: 'var(--atlas-steel)',
          ink: 'var(--atlas-ink)',
          body: 'var(--atlas-body)',
        },
      },
      boxShadow: {
        atlas: '0 14px 34px rgba(24, 50, 75, 0.08)',
        card: '0 8px 22px rgba(24, 50, 75, 0.06)',
      },
      borderRadius: {
        atlas: '28px',
      },
      fontFamily: {
        serif: ['Georgia', 'Iowan Old Style', 'Times New Roman', 'serif'],
        sans: ['Inter', 'Segoe UI', 'Arial', 'sans-serif'],
      },
      backgroundImage: {
        'atlas-gradient': 'linear-gradient(180deg,var(--atlas-paper) 0%, var(--atlas-mist) 100%)',
        'atlas-panel': 'linear-gradient(180deg,var(--atlas-paper) 0%, var(--atlas-mist) 100%)',
      },
    },
  },
  plugins: [],
} satisfies Config;
