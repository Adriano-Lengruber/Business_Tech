import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: 'var(--al-bg)',
        surface: 'var(--al-surface)',
        'surface-muted': 'var(--al-surface-muted)',
        border: 'var(--al-border)',
        'text-primary': 'var(--al-text-primary)',
        'text-secondary': 'var(--al-text-secondary)',
        'text-muted': 'var(--al-text-muted)',
        accent: 'var(--al-accent)',
        'accent-hover': 'var(--al-accent-hover)',
        'accent-foreground': 'var(--al-accent-foreground)',
        copper: 'var(--al-copper)',
        success: 'var(--al-success)',
        warning: 'var(--al-warning)',
        danger: 'var(--al-danger)',
        info: 'var(--al-info)',
      },
      fontFamily: {
        display: ['var(--font-display)', 'var(--font-sans)', 'system-ui', 'sans-serif'],
        sans: ['var(--font-sans)', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
};

export default config;
