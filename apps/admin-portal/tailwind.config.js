/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'espro-orange': '#f66633',
        'espro-brown': '#4b2e2b',
        'espro-cream': '#f5e9da',
        'espro-dark': '#333333',
        'espro-teal': '#3a878c',
      },
    },
  },
  plugins: [],
}

