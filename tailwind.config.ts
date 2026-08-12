import type { Config } from "tailwindcss";

// Tokens da SPEC-MVP.md §5 — usar exatamente. Tema único, claro. Sem sombras.
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#F8F1E2",
        card: "#FFFFFF",
        ink: "#191510",
        "ink-soft": "#6E6553",
        "ink-faint": "#998D75",
        line: "#ECE2CC",
        sand: "#EBBF52",
        "sand-deep": "#D4A637",
        "sand-tint": "#F8ECD0",
        ok: "#2F7D4F",
        "ok-tint": "#E4F1E8",
        danger: "#C2452B",
        "danger-tint": "#F9E6E0",
      },
      borderRadius: {
        card: "16px",
        control: "12px",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
