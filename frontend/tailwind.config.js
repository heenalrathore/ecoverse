/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        eco: {
          // Light theme: backgrounds, surfaces, accents
          paper:    '#f4fbff',   // page bg lightest
          sky:      '#dff4ff',   // light blue
          mint:     '#d8f4e3',   // light green
          leaf:     '#9be3bd',   // medium accent
          green:    '#3fc290',   // brand green (darker so it pops on light)
          neon:     '#54e495',   // bright accent
          forest:   '#0e7c4f',   // deep accent for text/icons
          cyan:     '#3aaef8',   // accent blue
          ocean:    '#0a78b8',   // deeper blue
          ink:      '#0a2a1f',   // primary text on light
          ink2:     '#3a5a4f',   // secondary text
          sun:      '#ffd86b',
          warn:     '#ff8a5c',
          brown:    '#a36f3c',
          // Legacy keys kept so existing classes still resolve until migrated
          deep:     '#f4fbff',
          night:    '#dff4ff',
          mid:      '#9be3bd',
          ocean2:   '#0a78b8',
          toxic:    '#7ee7b3',
          smoke:    '#6e7a82',
        },
        mod: {
          pollution: '#5fb52a',   // darker so it reads on white surfaces
          forest:    '#0e7c4f',
          ocean:     '#0a78b8',
          energy:    '#c98a0e',
          rhythm:    '#7741d6',
          monster:   '#c93838',
        },
      },
      fontFamily: {
        display: ['"Sora"', 'system-ui', 'sans-serif'],
        body:    ['"Inter"', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        // Glows toned down for a light theme — they still read but no longer "burn"
        glow:         '0 12px 36px rgba(63,194,144,.30), 0 0 20px rgba(84,228,149,.25)',
        'glow-cyan':  '0 12px 36px rgba(58,174,248,.30), 0 0 20px rgba(58,174,248,.20)',
        'glow-red':   '0 12px 36px rgba(255,109,109,.30), 0 0 20px rgba(255,109,109,.20)',
        'glow-yellow':'0 12px 36px rgba(255,196,77,.35), 0 0 20px rgba(255,196,77,.25)',
        'glow-purple':'0 12px 36px rgba(154,107,255,.30), 0 0 20px rgba(154,107,255,.20)',
        'glow-toxic': '0 12px 36px rgba(126,231,179,.32), 0 0 20px rgba(126,231,179,.22)',
        card:         '0 8px 28px rgba(10,42,31,0.10)',
      },
      backgroundImage: {
        'radial-fade': 'radial-gradient(circle at center, rgba(63,194,144,.18), transparent 70%)',
        'hero': 'radial-gradient(ellipse at top, rgba(58,174,248,.22), transparent 60%), radial-gradient(ellipse at bottom right, rgba(63,194,144,.22), transparent 60%)',
      },
      animation: {
        'float-slow': 'float 8s ease-in-out infinite',
        'spin-slow':  'spin 30s linear infinite',
        'pulse-glow': 'pulseGlow 2.4s ease-in-out infinite',
        'shimmer':    'shimmer 3s linear infinite',
      },
      keyframes: {
        float: {
          '0%,100%': { transform: 'translateY(0)' },
          '50%':     { transform: 'translateY(-12px)' },
        },
        pulseGlow: {
          '0%,100%': { filter: 'drop-shadow(0 0 18px rgba(122,245,152,.5))' },
          '50%':     { filter: 'drop-shadow(0 0 36px rgba(122,245,152,.9))' },
        },
        shimmer: {
          '0%':   { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
    },
  },
  plugins: [],
}
