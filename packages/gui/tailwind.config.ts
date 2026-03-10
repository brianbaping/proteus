import type { Config } from "tailwindcss";
import tailwindAnimate from "tailwindcss-animate";

function cssVar(name: string): string {
  return `rgb(var(--${name}) / <alpha-value>)`;
}

export default {
  content: ["./src/**/*.{ts,tsx}", "./index.html"],
  theme: {
    extend: {
      colors: {
        green: {
          DEFAULT: cssVar("green"),
          dim: cssVar("green-dim"),
          dark: cssVar("green-dark"),
        },
        amber: {
          DEFAULT: cssVar("amber"),
          dim: cssVar("amber-dim"),
          dark: cssVar("amber-dark"),
        },
        red: {
          DEFAULT: cssVar("red"),
          dim: cssVar("red-dim"),
          dark: cssVar("red-dark"),
        },
        cyan: {
          DEFAULT: cssVar("cyan"),
          dim: cssVar("cyan-dim"),
          dark: cssVar("cyan-dark"),
        },
        bg: {
          DEFAULT: cssVar("bg"),
          2: cssVar("bg-2"),
          3: cssVar("bg-3"),
          4: cssVar("bg-4"),
        },
        fg: {
          DEFAULT: cssVar("fg"),
          dim: cssVar("fg-dim"),
          muted: cssVar("fg-muted"),
        },
        border: {
          DEFAULT: cssVar("border"),
          2: cssVar("border-2"),
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
