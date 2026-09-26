/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx}', './public/index.html'],
  darkMode: 'media',
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef2ff', 100: '#e0e7ff', 200: '#c7d2fe', 300: '#a5b4fc', 400: '#818cf8',
          500: '#6366f1', 600: '#4f46e5', 700: '#4338ca', 800: '#3730a3', 900: '#312e81', 950: '#1e1b4b',
        },
      },
      keyframes: {
        'slide-down': { from: { transform: 'translateY(-8px)', opacity: 0 }, to: { transform: 'none', opacity: 1 } },
        pop: { '0%': { transform: 'scale(.8)' }, '60%': { transform: 'scale(1.1)' }, '100%': { transform: 'scale(1)' } },
      },
      animation: {
        'slide-down': 'slide-down .2s ease-out',
        pop: 'pop .35s ease-out',
      },
    },
  },
  plugins: [],
};
