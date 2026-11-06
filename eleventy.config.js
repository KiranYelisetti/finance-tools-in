module.exports = function (eleventyConfig) {
    // Pass through static assets
    eleventyConfig.addPassthroughCopy("src/favicon.svg");
    eleventyConfig.addPassthroughCopy("src/robots.txt");
    eleventyConfig.addPassthroughCopy("src/ads.txt");
    eleventyConfig.addPassthroughCopy("src/CNAME");
    eleventyConfig.addPassthroughCopy("src/og-image.png");
    eleventyConfig.addPassthroughCopy("src/js");
    eleventyConfig.addPassthroughCopy("src/fonts");
    // IndexNow key file: proves to Bing that our deploy step may submit URLs for this site
    eleventyConfig.addPassthroughCopy("src/38e120ba4a50d48ae164b86f9aaebed2.txt");

    const asDate = (d) => (d instanceof Date ? d : new Date(d));

    // ISO yyyy-mm-dd for front-matter dates (YAML parses "2026-10-13" into a Date object)
    eleventyConfig.addFilter("isoDate", (d) => asDate(d).toISOString().slice(0, 10));

    // "4 Nov 2026" for dates people read
    eleventyConfig.addFilter("humanDate", (d) =>
        asDate(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" }));

    // The date a page last changed: its `updated` front matter, else the git date Eleventy gives it
    eleventyConfig.addFilter("lastChanged", (all, url) => {
        const p = (all || []).find((x) => x.url === url);
        if (!p) return null;
        return p.data.updated || p.date;
    });

    // Watch targets
    eleventyConfig.addWatchTarget("./src/css/");

    return {
        dir: {
            input: "src",
            output: "_site",
            includes: "_includes"
        },
        templateFormats: ["html", "njk", "md"],
        htmlTemplateEngine: "njk",
        markdownTemplateEngine: "njk"
    };
};
