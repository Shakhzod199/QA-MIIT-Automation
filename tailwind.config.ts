import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: "#0b0b10",
          panel: "#13131a",
          border: "#23232e",
          hover: "#1a1a23",
        },
      },
    },
  },
  plugins: [],
};

export default config;
