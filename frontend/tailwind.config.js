/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      animation: {
        bounce: 'bounce 1s infinite',
      },
      colors: {
        sniffle: {
          beige: '#F5E6D8',
          brown: '#8D6E63',
          orange: '#FF9800',
          dark: '#1A1A1A',
          light: '#FFFAF5',
        },
        // Legacy support for existing trendpup classes
        trendpup: {
          beige: '#F5E6D8',
          brown: '#8D6E63',
          orange: '#FF9800',
          dark: '#1A1A1A',
          light: '#FFFAF5',
        },
      },
    },
  },
  plugins: [],
} 