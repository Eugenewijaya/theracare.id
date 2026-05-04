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
                "primary": "#37ec13",
                "background-light": "#f6f8f6",
                "background-dark": "#132210",
                "surface-light": "#ffffff",
                "surface-dark": "#1a2f16",
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
