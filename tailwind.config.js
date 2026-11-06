// QuickTools India Tailwind config. The design system is in src/css/ds (docs/DESIGN-SYSTEM.md).
//
// Two jobs:
// 1. Expose the design tokens as utilities (bg-surface, text-muted, border-line and so on).
// 2. Re-point Tailwind's stock palettes at the Desi Pop scales. Pages that still use stock classes
//    (bg-indigo-600, text-gray-500, from-blue-50) pick up the new palette without a markup change,
//    and no stock blue or purple can leak in. Each page moves to the components during the rollout.

const chai = { 50: "#FFFBF3", 100: "#FBF3E4", 200: "#F0E4CC", 300: "#DDCDB0", 400: "#B5A486", 500: "#7A6B53", 600: "#6B5D48", 700: "#4D4234", 800: "#2E2720", 900: "#1D1914", 950: "#13100D" };
const haldi = { 50: "#FFF9E0", 100: "#FFF0B3", 200: "#FFE380", 300: "#FFD54D", 400: "#FFC629", 500: "#F5AF00", 600: "#CC8A00", 700: "#9E6800", 800: "#6E4800", 900: "#4A3000", 950: "#2E1E00" };
const rani = { 50: "#FFF0F6", 100: "#FFD9E9", 200: "#FFB3D2", 300: "#FF85B8", 400: "#FF5C9E", 500: "#F0337F", 600: "#C81D63", 700: "#9C134C", 800: "#700C36", 900: "#4A0723", 950: "#2E0415" };
const mor = { 50: "#E8FAF9", 100: "#C2F0EE", 200: "#8EE3E0", 300: "#52CFCB", 400: "#20B3B0", 500: "#0E9594", 600: "#0A7779", 700: "#0B5D60", 800: "#0B4446", 900: "#082E30", 950: "#041C1D" };
const mehendi = { 50: "#F1FAE6", 100: "#DDF2C2", 200: "#C0E694", 300: "#9BD45E", 400: "#79BE35", 500: "#5C9E1F", 600: "#477D17", 700: "#375F14", 800: "#274312", 900: "#1A2D0C", 950: "#0F1B07" };
const neel = { 50: "#EEF1FF", 100: "#D9DFFF", 200: "#B6C1FF", 300: "#8D9DFF", 400: "#6577F6", 500: "#4656E0", 600: "#3441BC", 700: "#283294", 800: "#1E256B", 900: "#141947", 950: "#0B0E2B" };
const sindoor = { 50: "#FFF1EE", 100: "#FFDCD4", 200: "#FFB6A6", 300: "#FF8A72", 400: "#F9603F", 500: "#E2401F", 600: "#BB2F14", 700: "#912411", 800: "#661A0E", 900: "#431109", 950: "#290A05" };

const fontStack = ['"Bricolage Grotesque Variable"', '"Bricolage Grotesque"', "ui-sans-serif", "system-ui", "-apple-system", '"Segoe UI"', "Roboto", '"Noto Sans"', '"Nirmala UI"', "Arial", "sans-serif"];

module.exports = {
    content: ["./src/**/*.{html,js,njk,md}"],
    safelist: [
        { pattern: /from-(emerald|teal|cyan|amber)-(50|100|200|300|400|500|600|700|800|900)/ },
        { pattern: /to-(emerald|teal|cyan|amber)-(50|100|200|300|400|500|600|700|800|900)/ },
        { pattern: /bg-(emerald|teal|cyan|amber)-(50|100|200|300|400|500|600|700|800|900)/ },
        { pattern: /text-(emerald|teal|cyan|amber)-(50|100|200|300|400|500|600|700|800|900)/ },
        { pattern: /border-(emerald|teal|cyan|amber)-(50|100|200|300|400|500|600|700|800|900)/ },
        { pattern: /ring-(emerald|teal|cyan|amber)-(50|100|200|300|400|500|600|700|800|900)/ },
        { pattern: /hover:bg-(emerald|teal|cyan|amber)-(50|100|200|300|400|500|600|700|800|900)/ },
        { pattern: /hover:text-(emerald|teal|cyan|amber)-(50|100|200|300|400|500|600|700|800|900)/ },
        { pattern: /focus:ring-(emerald|teal|cyan|amber)-(50|100|200|300|400|500|600|700|800|900)/ },
        { pattern: /dark:bg-(emerald|teal|cyan|amber)-(50|100|200|300|400|500|600|700|800|900)/ },
        { pattern: /dark:text-(emerald|teal|cyan|amber)-(50|100|200|300|400|500|600|700|800|900)/ },
        { pattern: /dark:border-(emerald|teal|cyan|amber)-(50|100|200|300|400|500|600|700|800|900)/ },
    ],
    theme: {
        extend: {
            colors: {
                // Design system roles (theme aware through CSS variables)
                canvas: "var(--qt-canvas)",
                surface: "var(--qt-surface)",
                sunken: "var(--qt-sunken)",
                ink: { DEFAULT: "var(--qt-ink)", 2: "var(--qt-ink-2)" },
                muted: "var(--qt-muted)",
                line: { DEFAULT: "var(--qt-line)", soft: "var(--qt-line-soft)" },
                primary: "var(--qt-primary)",
                accent: "var(--qt-accent)",
                link: "var(--qt-link)",
                danger: "var(--qt-danger)",
                success: "var(--qt-success)",
                // Desi Pop scales
                chai, haldi, rani, mor, mehendi, neel, sindoor,
                // Stock palettes re-pointed (see the note at the top)
                slate: chai, gray: chai, zinc: chai, neutral: chai, stone: chai,
                red: sindoor, rose: sindoor,
                orange: haldi, amber: haldi, yellow: haldi,
                lime: mehendi, green: mehendi, emerald: mehendi,
                teal: mor, cyan: mor, sky: mor, blue: mor, indigo: mor,
                violet: neel, purple: neel,
                fuchsia: rani, pink: rani,
            },
            fontFamily: {
                sans: fontStack,
                serif: fontStack,
                display: fontStack,
            },
            boxShadow: {
                // Hard offset shadows for big surfaces, quiet ones for small controls
                sm: "0 1px 0 0 rgba(22, 18, 14, .14)",
                DEFAULT: "0 1px 0 0 rgba(22, 18, 14, .16)",
                md: "2px 2px 0 0 var(--qt-shadow)",
                lg: "4px 4px 0 0 var(--qt-shadow)",
                xl: "6px 6px 0 0 var(--qt-shadow)",
                "2xl": "8px 8px 0 0 var(--qt-shadow)",
            },
            borderRadius: {
                card: "var(--qt-r-lg)",
                field: "var(--qt-r-md)",
            },
        },
        container: {
            center: true,
            padding: "1rem",
        },
    },
    plugins: [require("@tailwindcss/typography")],
    darkMode: "class",
};
