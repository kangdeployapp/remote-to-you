/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: '#0B0F17',
        surface: '#131B2B',
        'surface-elevated': '#1B253B',
        'surface-card': '#162033',
        primary: {
          DEFAULT: '#2563EB',
          hover: '#1D4ED8',
          accent: '#38BDF8',
        },
        success: '#10B981',
        warning: '#F59E0B',
        danger: '#EF4444',
        border: '#24324D',
      },
      fontFamily: {
        sans: ['Segoe UI', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['Cascadia Code', 'Consolas', 'Courier New', 'monospace'],
      },
    },
  },
  plugins: [],
}
