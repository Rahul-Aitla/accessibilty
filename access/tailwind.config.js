/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: '#6366f1', // Indigo
        'primary-dark': '#4f46e5',
        secondary: '#ec4899', // Pink
        'secondary-dark': '#db2777',
        accent: '#8b5cf6', // Purple
        'accent-dark': '#7c3aed',
        success: '#10b981', // Emerald
        warning: '#f59e0b', // Amber
        danger: '#ef4444', // Red
        info: '#06b6d4', // Cyan
        background: {
          light: '#f8fafc',
          dark: '#0f172a',
        },
        gamify: {
          bronze: '#b45309',
          silver: '#94a3b8',
          gold: '#eab308',
          platinum: '#14b8a6',
        },
      },
      animation: {
        'bounce-slow': 'bounce 3s infinite',
        'pulse-slow': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'spin-slow': 'spin 3s linear infinite',
        'ping-slow': 'ping 3s cubic-bezier(0, 0, 0.2, 1) infinite',
      },
      boxShadow: {
        'glow': '0 0 15px 2px rgba(99, 102, 241, 0.4)',
        'glow-success': '0 0 15px 2px rgba(16, 185, 129, 0.4)',
        'glow-warning': '0 0 15px 2px rgba(245, 158, 11, 0.4)',
        'glow-danger': '0 0 15px 2px rgba(239, 68, 68, 0.4)',
      },
      borderRadius: {
        'xl': '1rem',
        '2xl': '1.5rem',
        '3xl': '2rem',
      },
    },
  },
  plugins: [],
};
