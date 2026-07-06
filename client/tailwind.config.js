export default {
  darkMode: "class",
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        "on-tertiary": "#003824",
        "on-secondary": "#1000a9",
        "on-secondary-container": "#b0b2ff",
        "surface-tint": "#d0bcff",
        "on-background": "#e1e1ef",
        "on-tertiary-container": "#00311f",
        "primary-fixed": "#e9ddff",
        "surface-dim": "#11131c",
        "on-primary-fixed-variant": "#5516be",
        "surface-container-high": "#282933",
        "on-surface": "#e1e1ef",
        "error": "#ffb4ab",
        "secondary-fixed": "#e1e0ff",
        "inverse-primary": "#6d3bd7",
        "inverse-on-surface": "#2e303a",
        "background": "#11131c",
        "secondary-fixed-dim": "#c0c1ff",
        "surface-container-highest": "#32343e",
        "inverse-surface": "#e1e1ef",
        "surface": "#11131c",
        "on-error-container": "#ffdad6",
        "surface-bright": "#373943",
        "primary": "#d0bcff",
        "surface-variant": "#32343e",
        "on-primary-container": "#340080",
        "tertiary": "#4edea3",
        "tertiary-container": "#00a572",
        "on-secondary-fixed-variant": "#2f2ebe",
        "outline-variant": "#494454",
        "surface-container": "#1d1f29",
        "primary-container": "#a078ff",
        "secondary-container": "#3131c0",
        "secondary": "#c0c1ff",
        "error-container": "#93000a",
        "on-tertiary-fixed-variant": "#005236",
        "on-primary-fixed": "#23005c",
        "on-secondary-fixed": "#07006c",
        "tertiary-fixed-dim": "#4edea3",
        "surface-container-low": "#191b24",
        "outline": "#958ea0",
        "surface-container-lowest": "#0c0e17",
        "on-surface-variant": "#cbc3d7",
        "primary-fixed-dim": "#d0bcff",
        "on-error": "#690005",
        "tertiary-fixed": "#6ffbbe",
        "on-tertiary-fixed": "#002113",
        "on-primary": "#3c0091"
      },
      borderRadius: {
        DEFAULT: "0.25rem",
        lg: "0.5rem",
        xl: "0.75rem",
        full: "9999px"
      },
      spacing: {
        "panel-padding": "12px",
        "canvas-margin": "32px",
        "container-gap": "8px",
        "unit": "4px",
        "gutter": "16px"
      },
      fontFamily: {
        "code-md": ["JetBrains Mono", "monospace"],
        "headline-lg": ["Geist", "sans-serif"],
        "headline-md": ["Geist", "sans-serif"],
        "label-md": ["JetBrains Mono", "monospace"],
        "body-md": ["Geist", "sans-serif"],
        "body-lg": ["Geist", "sans-serif"]
      },
      fontSize: {
        "code-md": ["13px", { lineHeight: "20px", fontWeight: "400" }],
        "headline-lg": ["32px", { lineHeight: "40px", letterSpacing: "-0.02em", fontWeight: "600" }],
        "headline-md": ["24px", { lineHeight: "32px", letterSpacing: "-0.01em", fontWeight: "600" }],
        "label-md": ["12px", { lineHeight: "16px", letterSpacing: "0.05em", fontWeight: "500" }],
        "body-md": ["14px", { lineHeight: "20px", fontWeight: "400" }],
        "body-lg": ["16px", { lineHeight: "24px", fontWeight: "400" }]
      }
    }
  },
  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/container-queries')
  ]
}
