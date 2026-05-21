/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    darkMode: "class",
    theme: {
        extend: {
            colors: {
                "primary": "#30e8c9",
                "primary-content": "#0e1b19",
                "secondary": "#e7f3f1",
                "secondary-content": "#4e978b",
                "background-light": "#f6f8f8",
                "background-dark": "#11211e",
                "border-light": "#d0e7e3",
            },
            fontFamily: {
              sans: ['Plus Jakarta Sans', 'ui-sans-serif', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
              display: ['Plus Jakarta Sans', 'ui-sans-serif', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
            },
            borderRadius: { "DEFAULT": "0.5rem", "lg": "1rem", "xl": "1.5rem", "full": "9999px" },
        },
    },
    plugins: [
        import('@tailwindcss/forms'),
        import('@tailwindcss/container-queries')
    ],
}
