/** @type {import('tailwindcss').Config} */
const daisyui = require('daisyui').default;

/* Theme tokens: Google Stitch project Caddy Server Manager UI (projects/2950181496994489532).
 * DaisyUI 5 + Tailwind 3: pass options into the plugin; `daisyui: {}` in this file is not forwarded.
 * Colors and radii for `data-theme="caddystitch"` live in `src/styles.css` (themes: false). */
module.exports = {
  content: ['./src/**/*.{html,ts}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Space Grotesk"', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace']
      },
      colors: {
        stitch: {
          surface: '#f9f9f9',
          'surface-low': '#f3f3f3',
          'surface-container': '#eeeeee',
          'surface-lowest': '#ffffff',
          'surface-dim': '#dadada',
          'on-surface': '#1a1c1c',
          'on-surface-variant': '#474747',
          outline: '#777777',
          'outline-variant': '#c6c6c6',
          primary: '#000000',
          'on-primary': '#e2e2e2',
          'primary-container': '#3b3b3b',
          secondary: '#5f5e5e',
          'secondary-container': '#d6d4d3',
          'on-secondary-container': '#1b1c1c',
          'primary-fixed': '#5e5e5e',
          error: '#ba1a1a'
        }
      }
    }
  },
  plugins: [
    daisyui({
      themes: false,
      logs: false
    })
  ]
};
