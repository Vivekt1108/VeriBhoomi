import type { Config } from "tailwindcss";

// VeriBhoomi design system — "cartographic / archival".
// Deliberately NOT the generic AI look (no purple/neon/glass). Think old land
// survey maps, official ledgers, ink on parchment.
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        parchment: {
          DEFAULT: "#F4EEE2", // warm paper base
          dark: "#E8DFCC",
          deep: "#DED2B8",
        },
        ink: {
          DEFAULT: "#1B2A41", // deep navy ink — primary text/UI
          soft: "#34435A",
          faint: "#6B7689",
        },
        terracotta: {
          DEFAULT: "#B5532A", // the single accent
          soft: "#C9764F",
        },
        forest: "#2F5D44", // alternate accent / "safe"
        gold: "#B8893B", // muted gold = verified
        seal: "#7A1F1F", // official red seal, used sparingly
      },
      fontFamily: {
        serif: ["var(--font-serif)", "Georgia", "serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
      backgroundImage: {
        // faint survey grid, like graph paper
        grid: "linear-gradient(rgba(27,42,65,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(27,42,65,0.05) 1px, transparent 1px)",
      },
      backgroundSize: {
        grid: "28px 28px",
      },
      boxShadow: {
        ledger: "0 1px 0 rgba(27,42,65,0.08), 0 8px 24px -12px rgba(27,42,65,0.25)",
        // raised "card" depth for the dashboard tiles
        raised: "0 1px 0 rgba(255,255,255,0.5) inset, 0 2px 4px rgba(27,42,65,0.06), 0 12px 32px -14px rgba(27,42,65,0.35)",
        // soft glow used on active/critical accents
        "glow-terracotta": "0 0 0 1px rgba(181,83,42,0.25), 0 8px 28px -8px rgba(181,83,42,0.45)",
        "glow-forest": "0 0 0 1px rgba(47,93,68,0.25), 0 8px 28px -8px rgba(47,93,68,0.4)",
      },
      keyframes: {
        "draw-in": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        // slow pulse for the live map pins
        ping: {
          "75%, 100%": { transform: "scale(2.2)", opacity: "0" },
        },
        // gentle float for hero/seal flourishes
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-6px)" },
        },
        // sweep used by the "scanning" / analysing states
        sweep: {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(100%)" },
        },
      },
      animation: {
        "draw-in": "draw-in 0.5s ease-out forwards",
        ping: "ping 2.4s cubic-bezier(0,0,0.2,1) infinite",
        float: "float 6s ease-in-out infinite",
        sweep: "sweep 1.6s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
