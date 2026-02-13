
import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./styles/**/*.css"
  ],
  theme: {
    extend: {
      colors: {
        // Cyberpunk Core Colors
        background: "#0a0a0f",
        surface: "rgba(20, 20, 35, 0.8)",
        surfaceSoft: "#12121a",
        surfaceHover: "rgba(30, 30, 50, 0.9)",
        
        // Neon Accents
        cyber: {
          cyan: "#00f0ff",
          cyanDim: "#00a8b3",
          cyanGlow: "rgba(0, 240, 255, 0.5)",
          magenta: "#ff00ff",
          magentaDim: "#b300b3",
          magentaGlow: "rgba(255, 0, 255, 0.5)",
          yellow: "#ffe600",
          yellowDim: "#b3a200",
          yellowGlow: "rgba(255, 230, 0, 0.5)",
          red: "#ff0044",
          green: "#00ff66",
        },
        
        // Backgrounds
        bgDarkest: "#0a0a0f",
        bgDark: "#0d0d14",
        bgMedium: "#12121a",
        bgLight: "#1a1a25",
        bgLighter: "#252535",
        
        // Borders
        borderSubtle: "rgba(0, 240, 255, 0.2)",
        borderHover: "rgba(0, 240, 255, 0.4)",
        borderFocus: "rgba(0, 240, 255, 0.8)",
        
        // Text
        textPrimary: "#e0e0e0",
        textSecondary: "#a0a0a0",
        textMuted: "#606070",
        
        // Legacy compatibility
        accent: "#00f0ff",
        accentSoft: "#00a8b3",
        accentBlue: "#00f0ff",
      },
      boxShadow: {
        soft: "0 16px 40px rgba(0,0,0,0.45)",
        cyberSm: "0 0 5px rgba(0, 240, 255, 0.5)",
        cyberMd: "0 0 10px rgba(0, 240, 255, 0.5), 0 0 20px rgba(0, 240, 255, 0.5)",
        cyberLg: "0 0 10px rgba(0, 240, 255, 0.5), 0 0 30px rgba(0, 240, 255, 0.5), 0 0 50px rgba(0, 240, 255, 0.5)",
        cyberMagenta: "0 0 10px rgba(255, 0, 255, 0.5), 0 0 20px rgba(255, 0, 255, 0.5)",
        cyberYellow: "0 0 10px rgba(255, 230, 0, 0.5), 0 0 20px rgba(255, 230, 0, 0.5)",
        cyberInset: "inset 0 0 20px rgba(0, 240, 255, 0.05)",
      },
      borderRadius: {
        xl: "1rem",
        cyber: "0.25rem",
      },
      fontFamily: {
        mono: ["JetBrains Mono", "Fira Code", "Source Code Pro", "monospace"],
        display: ["Orbitron", "Rajdhani", "Share Tech Mono", "sans-serif"],
      },
      animation: {
        "pulse-glow": "pulse 2s infinite",
        "neon-flicker": "neonFlicker 3s infinite",
        "scan-line": "scanLine 4s linear infinite",
        "data-load": "dataLoad 1s ease-in-out infinite",
        shimmer: "shimmer 2s infinite",
      },
      keyframes: {
        neonFlicker: {
          "0%, 19%, 21%, 23%, 25%, 54%, 56%, 100%": {
            opacity: "1",
          },
          "20%, 24%, 55%": {
            opacity: "0.8",
          },
        },
        scanLine: {
          "0%": { transform: "translateY(-100%)" },
          "100%": { transform: "translateY(100vh)" },
        },
        dataLoad: {
          "0%, 100%": { height: "8px" },
          "50%": { height: "24px" },
        },
        shimmer: {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(100%)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
