import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: "#14213D",
        "on-primary": "#F4EDE0",
        "on-primary-white": "#FFFFFF",
        "primary-muted": "#525E7D",
        "primary-soft": "#EDF0FF",
        accent: "#FF6B5B",
        "accent-text": "#D0493C",
        "on-accent": "#14213D",
        "accent-container": "#FFEDEA",
        "on-accent-container": "#8C1712",
        surface: "#F4EDE0",
        "on-surface": "#14213D",
        "surface-card": "#FFFFFF",
        "surface-tint": "#F7F0E3",
        "surface-subtle": "#E9E2D5",
        "on-surface-variant": "#4A463D",
        outline: "#14213D",
        live: "#16A34A",
        "live-container": "#C5FFC8",
        "on-live-container": "#003914",
      },
      borderRadius: {
        sm: "8px",
        DEFAULT: "12px",
        md: "12px",
        lg: "16px",
        xl: "24px",
        full: "9999px",
      },
      spacing: {
        "gutter-xs": "4px",
        "gutter-sm": "8px",
        "gutter-md": "12px",
        "gutter-lg": "16px",
        "gutter-xl": "24px",
        "page-margin": "16px",
        "dock-clearance": "220px",
      },
      fontFamily: {
        display: ['"Plus Jakarta Sans"', "sans-serif"],
        headline: ['"Plus Jakarta Sans"', "sans-serif"],
        title: ['"Plus Jakarta Sans"', "sans-serif"],
        body: ['"Inter"', "sans-serif"],
        label: ['"Inter"', "sans-serif"],
      },
      fontSize: {
        "display-lg": ["36px", { lineHeight: "42px", letterSpacing: "-0.5px", fontWeight: "700" }],
        "display-lg-mobile": ["30px", { lineHeight: "36px", letterSpacing: "-0.5px", fontWeight: "700" }],
        "headline-md": ["22px", { lineHeight: "28px", letterSpacing: "-0.25px", fontWeight: "700" }],
        "title-lg": ["18px", { lineHeight: "24px", letterSpacing: "-0.15px", fontWeight: "700" }],
        "title-md": ["16px", { lineHeight: "22px", fontWeight: "600" }],
        "body-md": ["14px", { lineHeight: "20px", fontWeight: "400" }],
        "body-sm": ["13px", { lineHeight: "18px", fontWeight: "500" }],
        "label-lg": ["13px", { lineHeight: "18px", letterSpacing: "0.1px", fontWeight: "600" }],
        "label-sm": ["11px", { lineHeight: "14px", letterSpacing: "0.4px", fontWeight: "700" }],
      },
      transitionDuration: {
        "state-change": "120ms",
        "dock-pulse": "1400ms",
      },
      transitionDelay: {
        "state-change": "0ms",
        "dock-pulse": "0ms",
      },
      transitionTimingFunction: {
        "state-change": "ease-out",
        "dock-pulse": "ease-in-out",
      },
    },
  },
  plugins: [],
};

export default config;
