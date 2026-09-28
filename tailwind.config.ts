import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: "#1c1917",
          soft: "#44403c",
          mute: "#78716c",
        },
        canvas: "#f7f7f5",
        brand: {
          DEFAULT: "#8f1d22",
          dark: "#701719",
          tint: "#fdf3f3",
        },
        ok: { DEFAULT: "#166534", bg: "#f0fdf4", line: "#bbf7d0" },
        warn: { DEFAULT: "#92400e", bg: "#fffbeb", line: "#fde68a" },
        danger: { DEFAULT: "#991b1b", bg: "#fef2f2", line: "#fecaca" },
        info: { DEFAULT: "#1d4ed8", bg: "#eff6ff", line: "#bfdbfe" },
      },
      boxShadow: {
        card: "0 1px 2px 0 rgb(28 25 23 / 0.05)",
        pop: "0 8px 24px -8px rgb(28 25 23 / 0.18)",
      },
      keyframes: {
        fadein: { from: { opacity: "0", transform: "translateY(4px)" }, to: { opacity: "1", transform: "translateY(0)" } },
        slidein: { from: { opacity: "0", transform: "translateX(16px)" }, to: { opacity: "1", transform: "translateX(0)" } },
      },
      animation: {
        fadein: "fadein .18s ease-out both",
        slidein: "slidein .22s ease-out both",
      },
    },
  },
  plugins: [],
};
export default config;
