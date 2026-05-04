/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        "primary": "#30abe8",
        "background-light": "#f6f7f8",
        "background-dark": "#111c21",
        "surface-light": "#ffffff",
        "surface-dark": "#18272f",
      },
      fontFamily: {
        "display": ["Lexend", "sans-serif"],
      },
    },
  },
  plugins: [],
}
