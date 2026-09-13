import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
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
  			viz: {
  				ord1: 'var(--viz-ord-1)',
  				ord2: 'var(--viz-ord-2)',
  				ord3: 'var(--viz-ord-3)',
  				ord4: 'var(--viz-ord-4)',
  				solo: 'var(--viz-solo)',
  				ok: 'var(--viz-ok)',
  				espera: 'var(--viz-espera)',
  				info: 'var(--viz-info)',
  				neutro: 'var(--viz-neutro)',
  				alerta: 'var(--viz-alerta)',
  				track: 'var(--viz-track)'
  			},
  			agricola: {
  				blue: {
  					DEFAULT: '#003B71',
  					hover: '#002C55',
  					light: '#EBF3FA',
  					dark: '#00264A',
  					border: '#004B9B'
  				},
  				yellow: {
  					DEFAULT: '#FDDA24',
  					hover: '#F3C510',
  					light: '#FEF9E7',
  					dark: '#C69500'
  				},
  				dark: {
  					DEFAULT: '#282828',
  					muted: '#5F5D58',
  					subtle: '#888888'
  				},
  				bg: {
  					DEFAULT: '#F8F8F8',
  					alt: '#F4F4F4',
  					white: '#FFFFFF'
  				},
  				border: {
  					DEFAULT: '#E2E6EA',
  					light: '#EDEDED'
  				},
  				brand: {
  					green: '#00C389',
  					'green-soft': '#E6F9F2',
  					coral: '#FF7F41',
  					sky: '#59CBE8'
  				},
  				status: {
  					safe: '#28A745',
  					'safe-bg': '#EAF7ED',
  					warning: '#E0A800',
  					'warning-bg': '#FFF9E6',
  					alert: '#DC3545',
  					'alert-bg': '#FDECEE'
  				}
  			}
  		},
  		fontFamily: {
  			sans: [
  				'-apple-system',
  				'BlinkMacSystemFont',
  				'Segoe UI',
  				'Roboto',
  				'Helvetica Neue',
  				'Arial',
  				'sans-serif'
  			]
  		},
  		boxShadow: {
  			subtle: '0 2px 8px rgba(0, 0, 0, 0.04)',
  			card: '0 4px 16px rgba(0, 0, 0, 0.06)',
  			hover: '0 8px 24px rgba(0, 59, 113, 0.08)'
  		},
  		borderRadius: {
  			card: '12px',
  			button: '8px',
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)'
  		},
  		keyframes: {
  			'accordion-down': {
  				from: {
  					height: '0'
  				},
  				to: {
  					height: 'var(--radix-accordion-content-height)'
  				}
  			},
  			'accordion-up': {
  				from: {
  					height: 'var(--radix-accordion-content-height)'
  				},
  				to: {
  					height: '0'
  				}
  			}
  		},
  		animation: {
  			'accordion-down': 'accordion-down 0.2s ease-out',
  			'accordion-up': 'accordion-up 0.2s ease-out'
  		}
  	}
  },
  plugins: [require("tailwindcss-animate")],
};
export default config;
