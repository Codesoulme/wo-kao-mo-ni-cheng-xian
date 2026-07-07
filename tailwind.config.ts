import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";

const config: Config = {
    darkMode: "class",
    content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
  	extend: {
  		colors: {
  			background: 'hsl(var(--background))',
  			foreground: 'hsl(var(--foreground))',
  			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))'
  			},
  			popover: {
  				DEFAULT: 'hsl(var(--popover))',
  				foreground: 'hsl(var(--popover-foreground))'
  			},
  			primary: {
  				DEFAULT: 'hsl(var(--primary))',
  				foreground: 'hsl(var(--primary-foreground))'
  			},
  			secondary: {
  				DEFAULT: 'hsl(var(--secondary))',
  				foreground: 'hsl(var(--secondary-foreground))'
  			},
  			muted: {
  				DEFAULT: 'hsl(var(--muted))',
  				foreground: 'hsl(var(--muted-foreground))'
  			},
  			accent: {
  				DEFAULT: 'hsl(var(--accent))',
  				foreground: 'hsl(var(--accent-foreground))'
  			},
  			destructive: {
  				DEFAULT: 'hsl(var(--destructive))',
  				foreground: 'hsl(var(--destructive-foreground))'
  			},
  			border: 'hsl(var(--border))',
  			input: 'hsl(var(--input))',
  			ring: 'hsl(var(--ring))',
  			chart: {
  				'1': 'hsl(var(--chart-1))',
  				'2': 'hsl(var(--chart-2))',
  				'3': 'hsl(var(--chart-3))',
  				'4': 'hsl(var(--chart-4))',
  				'5': 'hsl(var(--chart-5))'
  			}
  		},
  		borderRadius: {
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)'
  		},
  		keyframes: {
  			'fx-delta-fly': {
  				'0%':   { opacity: '0', transform: 'translateY(8px) scale(0.85)' },
  				'15%':  { opacity: '1', transform: 'translateY(0) scale(1.1)' },
  				'30%':  { opacity: '1', transform: 'translateY(-4px) scale(1)' },
  				'100%': { opacity: '0', transform: 'translateY(-32px) scale(0.95)' },
  			},
  			'fx-breakthrough': {
  				'0%':   { opacity: '0', transform: 'scale(0.7)' },
  				'15%':  { opacity: '1', transform: 'scale(1.05)' },
  				'30%':  { opacity: '1', transform: 'scale(1)' },
  				'85%':  { opacity: '1', transform: 'scale(1)' },
  				'100%': { opacity: '0', transform: 'scale(1.15)' },
  			},
  			'fx-breakthrough-spiral': {
  				'0%':   { transform: 'rotate(0deg) scale(0.6)', opacity: '0' },
  				'30%':  { transform: 'rotate(180deg) scale(1)', opacity: '0.7' },
  				'100%': { transform: 'rotate(720deg) scale(1.3)', opacity: '0' },
  			},
  			'fx-drop': {
  				'0%':   { opacity: '0', transform: 'scale(0.4)' },
  				'20%':  { opacity: '1', transform: 'scale(1.1)' },
  				'40%':  { opacity: '1', transform: 'scale(1)' },
  				'100%': { opacity: '0', transform: 'scale(1.4)' },
  			},
  			'fx-achievement': {
  				'0%':   { opacity: '0', transform: 'translateX(40px)' },
  				'10%':  { opacity: '1', transform: 'translateX(0)' },
  				'85%':  { opacity: '1', transform: 'translateX(0)' },
  				'100%': { opacity: '0', transform: 'translateX(20px)' },
  			},
  			'fx-screen-shake': {
  				'0%,100%': { transform: 'translate(0,0)' },
  				'20%': { transform: 'translate(-4px, 2px)' },
  				'40%': { transform: 'translate(4px, -2px)' },
  				'60%': { transform: 'translate(-3px, -3px)' },
  				'80%': { transform: 'translate(3px, 3px)' },
  			},
  			'fx-tap-ripple': {
  				'0%':   { opacity: '0.5', transform: 'scale(0)' },
  				'100%': { opacity: '0', transform: 'scale(2.5)' },
  			},
  		},
  		animation: {
  			'fx-delta-fly': 'fx-delta-fly 1.4s ease-out forwards',
  			'fx-breakthrough': 'fx-breakthrough 2.6s ease-out forwards',
  			'fx-breakthrough-spiral': 'fx-breakthrough-spiral 2.6s ease-out forwards',
  			'fx-drop': 'fx-drop 2.2s ease-out forwards',
  			'fx-achievement': 'fx-achievement 4.2s ease-out forwards',
  			'fx-screen-shake': 'fx-screen-shake 0.3s ease-in-out',
  			'fx-tap-ripple': 'fx-tap-ripple 0.55s ease-out forwards',
  		},
  	}
  },
  plugins: [tailwindcssAnimate],
};
export default config;
