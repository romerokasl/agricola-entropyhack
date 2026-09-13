import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        agricola: {
          blue: {
            DEFAULT: "#003B71",
            hover: "#002C55",
            light: "#EBF3FA",
            dark: "#00264A",
            border: "#004B9B",
          },
          yellow: {
            DEFAULT: "#FDDA24",
            hover: "#F3C510",
            light: "#FEF9E7",
            dark: "#C69500",
          },
          dark: {
            DEFAULT: "#282828",
            muted: "#5F5D58",
            subtle: "#888888",
          },
          bg: {
            DEFAULT: "#F8F8F8",
            alt: "#F4F4F4",
            white: "#FFFFFF",
          },
          border: {
            DEFAULT: "#E2E6EA",
            light: "#EDEDED",
          },
          // Acentos de Grupo Cibest/Bancolombia, extraídos del sitio real.
          // Son el "verde acento" que aparece en las láminas del banco.
          brand: {
            green: "#00C389",
            "green-soft": "#E6F9F2",
            coral: "#FF7F41",
            sky: "#59CBE8",
          },
          status: {
            safe: "#28A745",
            "safe-bg": "#EAF7ED",
            warning: "#E0A800",
            "warning-bg": "#FFF9E6",
            alert: "#DC3545",
            "alert-bg": "#FDECEE",
          },
        },
      },
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "'Segoe UI'",
          "Roboto",
          "'Helvetica Neue'",
          "Arial",
          "sans-serif",
        ],
      },
      boxShadow: {
        subtle: "0 2px 8px rgba(0, 0, 0, 0.04)",
        card: "0 4px 16px rgba(0, 0, 0, 0.06)",
        hover: "0 8px 24px rgba(0, 59, 113, 0.08)",
      },
      borderRadius: {
        card: "12px",
        button: "8px",
      },
    },
  },
  plugins: [],
};
export default config;
