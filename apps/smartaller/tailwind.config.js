/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      screens: {
        lp: "900px",
      },
      colors: {
        brand: {
          50: "#eff6ff",
          100: "#dbeafe",
          400: "#60a5fa",
          500: "#3b82f6",
          600: "#2563eb",
        },
        landing: {
          bg: "rgb(var(--landing-bg) / <alpha-value>)",
          surface: "rgb(var(--landing-surface) / <alpha-value>)",
          "surface-2": "rgb(var(--landing-surface-2) / <alpha-value>)",
          inset: "rgb(var(--landing-inset) / <alpha-value>)",
          line: "rgb(var(--landing-line) / <alpha-value>)",
          border: "rgb(var(--landing-border) / <alpha-value>)",
          dashed: "rgb(var(--landing-dashed) / <alpha-value>)",
          text: "rgb(var(--landing-text) / <alpha-value>)",
          "text-2": "rgb(var(--landing-text-2) / <alpha-value>)",
          "text-3": "rgb(var(--landing-text-3) / <alpha-value>)",
          accent: "rgb(var(--landing-accent) / <alpha-value>)",
          "on-accent": "rgb(var(--landing-on-accent) / <alpha-value>)",
          "accent-hover": "rgb(var(--landing-accent-hover) / <alpha-value>)",
          "accent-soft": "rgb(var(--landing-accent-soft) / <alpha-value>)",
          "accent-soft-text": "rgb(var(--landing-accent-soft-text) / <alpha-value>)",
          "cta-bg": "rgb(var(--landing-cta-bg) / <alpha-value>)",
          "cta-border": "rgb(var(--landing-cta-border) / <alpha-value>)",
          "cta-text": "rgb(var(--landing-cta-text) / <alpha-value>)",
          signal: "rgb(var(--landing-signal) / <alpha-value>)",
          "status-bg": "rgb(var(--landing-status-bg) / <alpha-value>)",
          "status-text": "rgb(var(--landing-status-text) / <alpha-value>)",
          "pill-border": "rgb(var(--landing-pill-border) / <alpha-value>)",
          "demo-border": "rgb(var(--landing-demo-border) / <alpha-value>)",
          bubble: "rgb(var(--landing-bubble) / <alpha-value>)",
          plate: "rgb(var(--landing-plate) / <alpha-value>)",
          "wa-text": "rgb(var(--landing-wa-text) / <alpha-value>)",
          "step-line": "rgb(var(--landing-step-line) / <alpha-value>)",
          "ghost-hover": "rgb(var(--landing-ghost-hover) / <alpha-value>)",
        },
      },
      fontFamily: {
        jakarta: ["var(--font-jakarta)", "system-ui", "sans-serif"],
        "landing-display": [
          "var(--font-bricolage)",
          "Georgia",
          "serif",
        ],
        "landing-body": [
          "var(--font-figtree)",
          "Segoe UI",
          "system-ui",
          "sans-serif",
        ],
      },
      maxWidth: {
        landing: "1248px",
      },
      animation: {
        "fade-in": "fadeIn 0.5s ease-out forwards",
        "slide-up": "slideUp 0.5s ease-out forwards",
      },
      keyframes: {
        fadeIn: { from: { opacity: "0" }, to: { opacity: "1" } },
        slideUp: {
          from: { opacity: "0", transform: "translateY(12px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [],
};
