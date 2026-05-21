/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}", "../shared/**/*.{js,jsx}", "../therapist-dashboard/src/**/*.{js,jsx}", "../therapist-schedule/src/**/*.{js,jsx}", "../therapist-availability-calendar/src/**/*.{js,jsx}", "../therapist-report/src/**/*.{js,jsx}", "../therapist-web-report/src/**/*.{js,jsx}", "../therapist-performance/src/**/*.{js,jsx}", "../parents-meeting/src/**/*.{js,jsx}", "../child-progress/src/**/*.{js,jsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        "primary": "#137fec",
        "background-light": "#f6f7f8",
        "background-dark": "#101922",
        "surface-light": "#ffffff",
        "surface-dark": "#1a2a32",
        "text-primary-light": "#0e171b",
        "text-primary-dark": "#f0f5f7",
        "text-secondary-light": "#4e7f97",
        "text-secondary-dark": "#a0bcca",
        "border-light": "#e7eff3",
        "border-dark": "#2a4250",
        "primary-content": "#0e1b19",
        "secondary": "#e7f3f1",
        "secondary-content": "#4e978b",
      },
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'ui-sans-serif', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        display: ['Plus Jakarta Sans', 'ui-sans-serif', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
      },
      borderRadius: { "DEFAULT": "0.5rem", "lg": "1rem", "xl": "1.5rem", "full": "9999px" },
    },
  },
  plugins: [import('@tailwindcss/forms'), import('@tailwindcss/container-queries')],
}
