/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: '#30abe8',
        'background-light': '#f6f7f8',
        'background-dark': '#101922',
        'border-light': '#e5e7eb',
        'border-dark': '#1e293b',
      },
      fontFamily: {
        sans: ['Lexend', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
