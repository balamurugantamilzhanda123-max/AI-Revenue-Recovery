/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        revive: {
          bg: "#F8FAFC",
          surface: "#FFFFFF",
          card: "#FFFFFF",
          cardHover: "#F1F5F9",
          border: "#E2E8F0",
          borderLight: "#CBD5E1",
          mint: "#10B981",
          mintDark: "#059669",
          cyan: "#0284C7",
          indigo: "#4F46E5",
          indigoDark: "#4338CA",
          coral: "#E11D48",
          coralDark: "#BE123C",
          amber: "#D97706",
          emerald: "#059669",
          violet: "#7C3AED",
          text: {
            primary: "#0F172A",
            secondary: "#475569",
            muted: "#64748B",
          },
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "Inter", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "JetBrains Mono", "monospace"],
      },
      boxShadow: {
        "mint-glow": "0 4px 20px -2px rgba(16, 185, 129, 0.25)",
        "indigo-glow": "0 4px 20px -2px rgba(79, 70, 229, 0.25)",
        "coral-glow": "0 4px 20px -2px rgba(225, 29, 72, 0.25)",
        card: "0 1px 3px 0 rgba(0, 0, 0, 0.07), 0 1px 2px -1px rgba(0, 0, 0, 0.05)",
        "card-hover": "0 10px 25px -5px rgba(0, 0, 0, 0.08), 0 8px 10px -6px rgba(0, 0, 0, 0.04)",
      },
    },
  },
  plugins: [],
};
