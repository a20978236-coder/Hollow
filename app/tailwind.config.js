/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: { 950: '#05070b', 900: '#0a0e15', 800: '#111722', 700: '#1a2230', 600: '#263042', 500: '#3a4659' },
        neon: { DEFAULT: '#22d3ee', 400: '#22d3ee', 500: '#06b6d4', blue: '#3b82f6' },
      },
      fontFamily: { sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'], mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'] },
      boxShadow: { glow: '0 0 24px -6px rgba(34,211,238,.55)' },
    },
  },
  plugins: [],
}
