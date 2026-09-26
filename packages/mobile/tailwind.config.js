/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx}', './public/index.html'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // violet-tinted neutrals (the whole UI is dark, like the landing page)
        slate: {
          50: '#f4f1fb', 100: '#e9e5f3', 200: '#d4cfe2', 300: '#b3adc6', 400: '#8b84a3',
          500: '#6f6988', 600: '#4f4a66', 700: '#2e2a3d', 800: '#1b1826', 900: '#110e19', 950: '#07050d',
        },
        brand: {
          50: '#f5f3ff', 100: '#ede9fe', 200: '#ddd6fe', 300: '#c4b5fd', 400: '#a78bfa',
          500: '#8b5cf6', 600: '#7c3aed', 700: '#6d28d9', 800: '#5b21b6', 900: '#4c1d95', 950: '#2e1065',
        },
      },
      fontFamily: {
        sans: ['"Archivo Variable"', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        display: ['"Archivo Variable"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"Archivo Variable"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
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
