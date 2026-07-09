/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './attractions/**/*.html'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Playfair Display', 'serif'],
      },
      colors: {
        forest: '#1a3a2a',
        'forest-light': '#2d5a3d',
        sand: '#f5f0e8',
        'sand-dark': '#e8e0d4',
        gold: '#c9a96e',
        'gold-dark': '#b08d4f',
        stone: '#3a3a3a',
      },
    },
  },
  safelist: ['hidden'],
};
