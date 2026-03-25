import type { Config } from 'tailwindcss'
import plugin from 'tailwindcss/plugin'

const config: Config = {
  content: [
    './src/**/*.{ts,tsx}',
    '../../packages/ui/src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          primary: 'var(--brand-primary)',
          secondary: 'var(--brand-secondary)',
          accent: 'var(--brand-accent)',
          background: 'var(--brand-background)',
          surface: 'var(--brand-surface)',
          'text-primary': 'var(--brand-text-primary)',
          'text-secondary': 'var(--brand-text-secondary)',
        },
      },
      borderRadius: {
        brand: 'var(--brand-radius)',
      },
      fontFamily: {
        brand: ['var(--brand-font)', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [
    plugin(({ addUtilities }) => {
      addUtilities({
        '.safe-area-pb': { 'padding-bottom': 'env(safe-area-inset-bottom)' },
        '.safe-area-pt': { 'padding-top': 'env(safe-area-inset-top)' },
        '.safe-area-pl': { 'padding-left': 'env(safe-area-inset-left)' },
        '.safe-area-pr': { 'padding-right': 'env(safe-area-inset-right)' },
      })
    }),
  ],
}

export default config
