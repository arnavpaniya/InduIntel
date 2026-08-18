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
        // Claymorphism color palette from DESIGN.md
        background: '#E9E6DF',
        clay: {
          DEFAULT: '#D8D3CA',
          secondary: '#C7C1B7',
          deep: '#B7B0A5',
        },
        text: {
          primary: '#292825',
          secondary: '#77736B',
        },
        accent: {
          muted: '#7B8068',
        },
        status: {
          verified: '#849783',
          warning: '#A99469',
          conflict: '#A8786D',
        },
      },
      borderRadius: {
        'clay-sm': '16px',
        'clay': '20px',
        'clay-lg': '24px',
        'clay-xl': '28px',
      },
      boxShadow: {
        'clay': '8px 8px 16px #b7b0a5, -8px -8px 16px #f9f6ed',
        'clay-inset': 'inset 4px 4px 8px #b7b0a5, inset -4px -4px 8px #f9f6ed',
        'clay-sm': '4px 4px 8px #b7b0a5, -4px -4px 8px #f9f6ed',
        'clay-lg': '12px 12px 24px #b7b0a5, -12px -12px 24px #f9f6ed',
      },
      fontFamily: {
        heading: ['Syne', 'Space Grotesk', 'sans-serif'],
        display: ['Space Grotesk', 'sans-serif'],
        sans: ['Plus Jakarta Sans', 'Space Grotesk', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      fontSize: {
        'kpi': ['48px', { lineHeight: '1', fontWeight: '600' }],
        'page-title': ['32px', { lineHeight: '1.2', fontWeight: '600' }],
        'section-title': ['20px', { lineHeight: '1.3', fontWeight: '600' }],
        'body': ['15px', { lineHeight: '1.6' }],
        'meta': ['12px', { lineHeight: '1.5' }],
      },
      animation: {
        'fade-in': 'fadeIn 300ms ease-out',
        'slide-up': 'slideUp 400ms ease-out',
        'pulse-soft': 'pulseSoft 2000ms ease-in-out infinite',
        'processing-step': 'processingStep 500ms ease-out forwards',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.6' },
        },
        processingStep: {
          '0%': { opacity: '0', transform: 'translateX(-10px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
}
export default config