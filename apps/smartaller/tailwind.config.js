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
          bg: "#0B0F14",
          surface: "#121922",
          "surface-2": "#18222D",
          inset: "#0F151C",
          line: "#1C2631",
          border: "#2A3645",
          dashed: "#2F3D4D",
          text: "#EEF2F5",
          "text-2": "#A3B0BD",
          "text-3": "#7F8C99",
          accent: "#2BC7A0",
          "on-accent": "#03261C",
          "accent-hover": "#3DD6AF",
          "accent-soft": "#16332A",
          "accent-soft-text": "#5FD9B4",
          "cta-bg": "#102A23",
          "cta-border": "#1D4A3D",
          "cta-text": "#B6CDC5",
          signal: "#F2994A",
          "status-bg": "#3A2A16",
          "status-text": "#F6B97A",
          "pill-border": "#243140",
          "demo-border": "#1F2A36",
          "bubble": "#1B2733",
          "plate": "#E9EDF0",
          "wa-text": "#D5DDE4",
          "step-line": "#243140",
          "ghost-hover": "#3A4858",
        },
      },
      fontFamily: {
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
