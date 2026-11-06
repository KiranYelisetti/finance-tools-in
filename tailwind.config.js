module.exports = {
    content: ["./src/**/*.{html,js,njk}"],
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
            // The ledger palette: paper, ink, bank green and stamp red. Everything else is a shade of these.
            colors: {
                paper: "#F4F0E6",
                sheet: "#FFFDF7",
                ink: "#1C1A16",
                muted: "#635C50",
                rule: "#DCD3C1",
                bank: { DEFAULT: "#1E5B47", dark: "#164536" },
                stamp: "#A3261B",
            },
            fontFamily: {
                serif: ['"Source Serif 4"', "Georgia", "Cambria", '"Times New Roman"', "serif"],
                sans: ["system-ui", "-apple-system", '"Segoe UI"', "Roboto", '"Noto Sans"', '"Helvetica Neue"', "Arial", "sans-serif"],
            },
        },
        container: {
            center: true,
            padding: '1rem',
        },
    },
    plugins: [require('@tailwindcss/typography')],
    darkMode: 'class',
}
