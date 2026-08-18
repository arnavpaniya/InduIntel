import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Dark Industrial Command-Center Color Palette (v2)
        background: '#0B0D10',
        surface: {
          DEFAULT: '#12151A',
          raised: '#171B21',
          hover: '#1C2027',
        },
        border: {
          DEFAULT: '#262B33',
          divider: '#1D2127',
        },
        text: {
          primary: '#E7E9EC',
          secondary: '#8B929C',
          muted: '#4E545D',
        },
        accent: {
          DEFAULT: '#F0A93E', // Signal Amber
          amber: '#F0A93E',
        },
        status: {
          verified: '#4CAF7D', // Signal Green
          inferred: '#5B9BD5', // Signal Blue
          conflict: '#E05B4E', // Signal Red
          unknown: '#6B7280',  // Neutral Gray
          warning: '#F0A93E',
        },
        // Legacy clay mapping aliases pointing to Command-Center palette
        clay: {
          DEFAULT: '#12151A',
          secondary: '#171B21',
          deep: '#262B33',
        },
      },
      borderRadius: {
        'sm': '4px',
        'DEFAULT': '6px',
        'md': '6px',
        'lg': '8px',
        'clay-sm': '4px',
        'clay': '6px',
        'clay-lg': '8px',
        'clay-xl': '8px',
      },
      boxShadow: {
        'none': 'none',
        'clay': 'none',
        'clay-inset': 'none',
        'clay-sm': 'none',
        'clay-lg': 'none',
      },
      fontFamily: {
        sans: ['Inter', 'IBM Plex Sans', 'system-ui', 'sans-serif'],
        heading: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'IBM Plex Mono', 'monospace'],
      },
      fontSize: {
        'kpi': ['36px', { lineHeight: '1.1', fontWeight: '500' }],
        'page-title': ['26px', { lineHeight: '1.2', fontWeight: '500' }],
        'section-title': ['16px', { lineHeight: '1.3', fontWeight: '500' }],
        'body': ['14px', { lineHeight: '1.5' }],
        'meta': ['11px', { lineHeight: '1.4' }],
      },
      animation: {
        'fade-in': 'fadeIn 150ms ease-out',
        'slide-up': 'slideUp 200ms ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
}
export default config