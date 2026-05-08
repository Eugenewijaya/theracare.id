/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}", "../shared/**/*.{js,jsx}", "../parent-portal/src/**/*.{js,jsx}", "../parent-web-dashboard/src/**/*.{js,jsx}", "../parent-reports-archive/src/**/*.{js,jsx}", "../parent-reschedule/src/**/*.{js,jsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        "primary": "#30abe8",
        "background-light": "#f6f7f8",
        "background-dark": "#111c21",
        "surface-light": "#ffffff",
        "surface-dark": "#1a2a32",
        "text-primary-light": "#0e171b",
        "text-primary-dark": "#f0f5f7",
        "text-secondary-light": "#4e7f97",
        "text-secondary-dark": "#a0bcca",
        "border-light": "#e7eff3",
        "border-dark": "#2a4250",
      },
      fontFamily: { "display": ["Lexend", "Manrope", "sans-serif"] },
      borderRadius: { "DEFAULT": "0.5rem", "lg": "1rem", "xl": "1.5rem", "full": "9999px" },
    },
  },
  plugins: [import('@tailwindcss/forms'), import('@tailwindcss/container-queries')],
}
