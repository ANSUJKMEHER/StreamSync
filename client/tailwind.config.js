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
        "surface-tint": "var(--color-primary)",
        "on-background": "var(--color-on-background)",
        "on-tertiary-container": "#00311f",
        "primary-fixed": "#e9ddff",
        "surface-dim": "var(--color-background)",
        "on-primary-fixed-variant": "#5516be",
        "surface-container-high": "var(--color-surface-container-high)",
        "on-surface": "var(--color-on-surface)",
        "error": "#ffb4ab",
        "secondary-fixed": "#e1e0ff",
        "inverse-primary": "var(--color-primary-dark)",
        "inverse-on-surface": "var(--color-background)",
        "background": "var(--color-background)",
        "secondary-fixed-dim": "#c0c1ff",
        "surface-container-highest": "var(--color-surface-container-highest)",
        "inverse-surface": "var(--color-on-surface)",
        "surface": "var(--color-surface)",
        "on-error-container": "#ffdad6",
        "surface-bright": "var(--color-surface-container-high)",
        "primary": "var(--color-primary)",
        "surface-variant": "var(--color-surface-container-highest)",
        "on-primary-container": "var(--color-background)",
        "tertiary": "#4edea3",
        "tertiary-container": "#00a572",
        "on-secondary-fixed-variant": "#2f2ebe",
        "outline-variant": "var(--color-outline-variant)",
        "surface-container": "var(--color-surface-container)",
        "primary-container": "var(--color-primary-container)",
        "secondary-container": "#3131c0",
        "secondary": "var(--color-primary)",
        "error-container": "#93000a",
        "on-tertiary-fixed-variant": "#005236",
        "on-primary-fixed": "#23005c",
        "on-secondary-fixed": "#07006c",
        "tertiary-fixed-dim": "#4edea3",
        "surface-container-low": "var(--color-surface-container-low)",
        "outline": "var(--color-outline)",
        "surface-container-lowest": "var(--color-surface-container-lowest)",
        "on-surface-variant": "var(--color-on-surface-variant)",
        "primary-fixed-dim": "var(--color-primary)",
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
