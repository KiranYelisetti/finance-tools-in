// One list of every tool. key picks the group colour in the design system (.is-amounts and so on).
// One list of every tool, used by the header menu, the home page index and the footer.
// Descriptions say what the tool does in plain words. No hype, no figures that can go stale.
module.exports = [
    {
        group: "Amounts and words", key: "amounts",
        tools: [
            { name: "Number to Words", url: "/number-to-words/", desc: "15,00,000 to Fifteen Lakh Rupees Only, and 1.5 crore back to digits. Cheque wording included." },
            { name: "Lakh Crore in Numbers", url: "/lakh-crore-in-numbers/", desc: "Budget-size figures such as 9.8 lakh crore in digits, crore and trillion." },
            { name: "Cash Counter", url: "/cash-counter/", desc: "Count notes and coins by denomination and get the total in figures and words." },
        ],
    },
    {
        group: "Loans", key: "loans",
        tools: [
            { name: "Home Loan EMI", url: "/home-loan-calculator/", desc: "Monthly EMI, total interest and what a yearly prepayment saves." },
            { name: "Car Loan", url: "/car-loan-calculator/", desc: "On-road price, EMI and the full cost of a new or used car." },
            { name: "EMI Prepayment", url: "/emi-prepayment-calculator/", desc: "Part payments on any loan: lower EMI or shorter tenure, and the interest saved." },
        ],
    },
    {
        group: "Tax and salary", key: "tax",
        tools: [
            { name: "Income Tax", url: "/income-tax-calculator/", desc: "Old regime against new regime for FY 2025-26 and FY 2026-27." },
            { name: "Salary, CTC to In-hand", url: "/salary-calculator/", desc: "Monthly take-home pay after PF, professional tax and income tax." },
            { name: "GST", url: "/gst-calculator/", desc: "Add or remove GST and see the CGST, SGST or IGST split." },
        ],
    },
    {
        group: "Savings and plans", key: "savings",
        tools: [
            { name: "SIP", url: "/sip-calculator/", desc: "What a monthly SIP could grow to at the return you assume." },
            { name: "PPF", url: "/ppf-calculator/", desc: "Yearly PPF deposits, interest and the maturity value at the notified rate." },
            { name: "Sukanya Samriddhi", url: "/ssy-calculator/", desc: "SSY deposits for a daughter and the maturity value at the notified rate." },
            { name: "Study Abroad", url: "/study-abroad-calculator/", desc: "Tuition, living costs and the education loan, in rupees." },
            { name: "Wedding Cost", url: "/wedding-cost-calculator/", desc: "An Indian wedding budget, line by line." },
        ],
    },
    {
        group: "Everyday", key: "everyday",
        tools: [
            { name: "Age Calculator", url: "/age-calculator/", desc: "Exact age in years, months and days on any date." },
            { name: "Image Resizer", url: "/image-resizer/", desc: "Resize a photo or signature to an exact size in KB for online forms." },
            { name: "Word Counter", url: "/word-counter/", desc: "Words, characters, reading time and the limits for posts, texts and titles." },
        ],
    },
];
