/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        background: '#0F172A',
        card: '#1E293B',
        hover: '#334155',
        primary: {
          DEFAULT: '#3B82F6', // Electric Blue
          foreground: '#FFFFFF',
        },
        secondary: {
          DEFAULT: '#1E1B4B', // Deep Indigo
          foreground: '#FFFFFF',
        },
        accent: {
          DEFAULT: '#8B5CF6', // Neon Purple
          foreground: '#FFFFFF',
        },
        success: '#22C55E',
        error: '#EF4444',
        warning: '#F59E0B',
        muted: '#64748B',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
