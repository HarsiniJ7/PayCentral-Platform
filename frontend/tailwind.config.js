/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0B1320",      // near-black navy, primary background for chrome
        panel: "#1C2B38",    // panel background (formerly "slate")
        steel: "#3C5266",    // muted borders / secondary text
        mist: "#A9B7C2",     // body text on dark
        paper: "#F6F7F5",    // light page background
        signal: "#1FAE8A",   // teal-green accent: "approved" / brand
        signal2: "#36D6AE",  // lighter teal for gradients
        violet: "#6C63FF",   // secondary brand accent
        amber: "#E2A23B",    // warnings / medium severity
        coral: "#D9534F",    // critical / declined
      },
      fontFamily: {
        display: ["'Space Grotesk'", "sans-serif"],
        body: ["'Inter'", "sans-serif"],
        mono: ["'IBM Plex Mono'", "monospace"],
      },
      backgroundImage: {
        "brand-gradient": "linear-gradient(135deg, #1FAE8A 0%, #36D6AE 50%, #6C63FF 100%)",
        "ink-gradient": "radial-gradient(120% 120% at 0% 0%, #16222F 0%, #0B1320 60%)",
        "card-sheen": "linear-gradient(135deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0) 60%)",
      },
      boxShadow: {
        soft: "0 1px 2px rgba(15,26,36,0.04), 0 8px 24px -8px rgba(15,26,36,0.08)",
        lifted: "0 4px 12px rgba(15,26,36,0.06), 0 16px 40px -12px rgba(15,26,36,0.16)",
        glow: "0 0 0 1px rgba(31,174,138,0.15), 0 8px 30px -8px rgba(31,174,138,0.35)",
      },
      borderRadius: {
        xl2: "1.25rem",
      },
      keyframes: {
        floatSlow: { "0%,100%": { transform: "translateY(0)" }, "50%": { transform: "translateY(-6px)" } },
        fadeUp: { "0%": { opacity: 0, transform: "translateY(6px)" }, "100%": { opacity: 1, transform: "translateY(0)" } },
        shimmer: { "0%": { backgroundPosition: "-200% 0" }, "100%": { backgroundPosition: "200% 0" } },
      },
      animation: {
        floatSlow: "floatSlow 6s ease-in-out infinite",
        fadeUp: "fadeUp 0.35s ease-out both",
        shimmer: "shimmer 2.5s linear infinite",
      },
    },
  },
  plugins: [],
};
