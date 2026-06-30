import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Geist"', "system-ui", "sans-serif"],
        mono: ['"Geist Mono"', "ui-monospace", "monospace"],
      },
      colors: {
        surface: {
          DEFAULT: "#161920",
          sidebar: "#111419",
          panel: "#1d2028",
          border: "rgba(255,255,255,0.08)",
          hover: "#252931",
        },
        q: {
          green: "#3ddc97",
          "green-dim": "rgba(61,220,151,0.12)",
          red: "#ff5d5d",
          amber: "#f5b544",
          blue: "#5b9dff",
          purple: "#8b5cf6",
          teal: "#2dd4bf",
          pink: "#ff5fa2",
          text: "#e8ecf1",
          sub: "#b9c0c9",
          muted: "#8a93a0",
          dim: "#5b636e",
        },
      },
    },
  },
  plugins: [],
};

export default config;
