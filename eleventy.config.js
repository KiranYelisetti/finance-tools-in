module.exports = function (eleventyConfig) {
    // Pass through static assets
    eleventyConfig.addPassthroughCopy("src/favicon.svg");
    eleventyConfig.addPassthroughCopy("src/robots.txt");
    eleventyConfig.addPassthroughCopy("src/ads.txt");
    eleventyConfig.addPassthroughCopy("src/CNAME");
    eleventyConfig.addPassthroughCopy("src/og-image.png");
    eleventyConfig.addPassthroughCopy("src/js");
    // IndexNow key file: proves to Bing that our deploy step may submit URLs for this site
    eleventyConfig.addPassthroughCopy("src/38e120ba4a50d48ae164b86f9aaebed2.txt");

    // ISO yyyy-mm-dd for front-matter dates (YAML parses "2026-10-13" into a Date object)
    eleventyConfig.addFilter("isoDate", (d) => (d instanceof Date ? d : new Date(d)).toISOString().slice(0, 10));

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
