import type { Config } from "tailwindcss";
import tailwindAnimate from "tailwindcss-animate";

export default {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}", "./index.html"],
  theme: {
    extend: {
      colors: {
        green: {
          DEFAULT: "#00ff88",
          dim: "#00cc6a",
          dark: "#003322",
        },
        amber: {
          DEFAULT: "#ffb830",
          dim: "#cc9326",
          dark: "#332200",
        },
        red: {
          DEFAULT: "#ff4466",
          dim: "#cc3652",
          dark: "#331118",
        },
        cyan: {
          DEFAULT: "#00ddcc",
          dim: "#00b3a3",
          dark: "#002b28",
        },
        bg: {
          DEFAULT: "#0a0c0e",
          2: "#0f1215",
          3: "#141820",
          4: "#1a1f2e",
        },
        fg: {
          DEFAULT: "#e2e8f0",
          dim: "#8899aa",
          muted: "#4a5568",
        },
        border: {
          DEFAULT: "#1f2937",
          2: "#2d3748",
        },
      },
      fontFamily: {
        display: ["Syne", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "Menlo", "monospace"],
      },
      fontSize: {
        "2xs": ["9px", { lineHeight: "12px" }],
        xs: ["11px", { lineHeight: "16px" }],
        sm: ["12px", { lineHeight: "18px" }],
        base: ["13px", { lineHeight: "20px" }],
        lg: ["15px", { lineHeight: "22px" }],
        xl: ["18px", { lineHeight: "24px" }],
        "2xl": ["20px", { lineHeight: "28px" }],
        "3xl": ["24px", { lineHeight: "32px" }],
      },
    },
  },
  plugins: [tailwindAnimate],
} satisfies Config;
