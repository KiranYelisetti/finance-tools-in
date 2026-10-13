module.exports = function (eleventyConfig) {
    // Pass through static assets
    eleventyConfig.addPassthroughCopy("src/favicon.svg");
    eleventyConfig.addPassthroughCopy("src/robots.txt");
    eleventyConfig.addPassthroughCopy("src/ads.txt");
    eleventyConfig.addPassthroughCopy("src/CNAME");
    eleventyConfig.addPassthroughCopy("src/og-image.png");
    eleventyConfig.addPassthroughCopy("src/js");

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
