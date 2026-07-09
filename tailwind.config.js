/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './attractions/**/*.html'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Playfair Display', 'serif'],
      },
      opacity: {
        18: '0.18',
        22: '0.22',
        72: '0.72',
        78: '0.78',
        92: '0.92',
      },
      colors: {
        forest: '#1a3a2a',
        'forest-light': '#2d5a3d',
        sand: '#f5f0e8',
        'sand-dark': '#e8e0d4',
        gold: '#c9a96e',
        'gold-dark': '#b08d4f',
        stone: {
          DEFAULT: '#3a3a3a',
          50: '#fafaf9',
          100: '#f5f5f4',
          200: '#e7e5e4',
          500: '#78716c',
          700: '#44403c',
        },
      },
    },
  },
  safelist: ['hidden'],
};
