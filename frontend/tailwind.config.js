/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // ShopGenie brand palette — warm paper e-commerce look.
        paper: '#FBFAF6',
        paperDim: '#F3F1E9',
        ink: '#16231C',
        inkMuted: '#5B6A5F',
        sand: '#E7E1D3',
        sandDark: '#D8D0BC',
        forest: {
          50: '#EAF4EF',
          100: '#CFE7DA',
          400: '#2E8E63',
          500: '#0F6B4C',
          600: '#0C5A3F',
          700: '#094830',
        },
        ember: {
          50: '#FDF1E7',
          100: '#FBDFC4',
          400: '#E27A2E',
          500: '#D9661C',
          600: '#B85216',
        },
        // Legacy tokens kept only so nothing referencing them (e.g. Razorpay
        // brand blue) breaks; the app no longer uses the old dark theme.
        brand: {
          50: '#f0f5ff',
          100: '#e0ebff',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
        },
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        display: ['"Fraunces"', 'serif'],
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out forwards',
        'slide-up': 'slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'pulse-subtle': 'pulseSubtle 2s infinite ease-in-out',
        'spin-slow': 'spin 8s linear infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(15px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        pulseSubtle: {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '0.6', transform: 'scale(0.98)' },
        }
      }
    },
  },
  plugins: [],
}

