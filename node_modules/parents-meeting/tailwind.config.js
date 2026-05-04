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
                "background-light": "#f6f8f8",
                "background-dark": "#11211e",
            },
            fontFamily: {
                "display": ["Manrope", "sans-serif"]
            },
            borderRadius: { "DEFAULT": "0.5rem", "lg": "1rem", "xl": "1.5rem", "full": "9999px" },
        },
    },
    plugins: [
        import('@tailwindcss/forms'),
        import('@tailwindcss/container-queries')
    ],
}
