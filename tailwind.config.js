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
        extend: {},
        container: {
            center: true,
            padding: '1rem',
        },
    },
    plugins: [require('@tailwindcss/typography')],
    darkMode: 'class',
}
