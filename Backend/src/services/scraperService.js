const axios = require("axios");
const cheerio = require("cheerio");

exports.extractWebsiteText = async (url) => {
  try {
    const res = await axios.get(url, {
      timeout: 15000,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
        "Accept-Encoding": "gzip, deflate, br",
        "Connection": "keep-alive",
        "Upgrade-Insecure-Requests": "1",
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "none",
        "Cache-Control": "max-age=0",
      },
      maxRedirects: 5,
    });

    const $ = cheerio.load(res.data);

    // Remove unwanted elements
    $(
      "script, style, nav, footer, header, iframe, noscript, svg, img"
    ).remove();

    // Try to get main content
    let text = "";

    // LinkedIn specific
    if (url.includes("linkedin.com")) {
      text = $(".description__text").text() ||
             $(".job-description").text() ||
             $("main").text() ||
             $("body").text();
    } else {
      text = $("main").text() ||
             $("article").text() ||
             $(".job-description").text() ||
             $(".content").text() ||
             $("body").text();
    }

    // Clean text
    text = text
      .replace(/\s+/g, " ")
      .replace(/\n+/g, " ")
      .trim()
      .slice(0, 4000);

    if (!text || text.length < 50) {
      // Agar text nahi mila to URL hi analyze karo
      return `
        URL: ${url}
        Domain: ${new URL(url).hostname}
        Path: ${new URL(url).pathname}
        Note: Could not extract page content. Analyzing URL structure only.
      `;
    }

    return text;

  } catch (error) {
    console.error("Scraper Error:", error.message);

    // URL structure se hi analyze karo
    try {
      const urlObj = new URL(url);
      return `
        URL: ${url}
        Domain: ${urlObj.hostname}
        Path: ${urlObj.pathname}
        Protocol: ${urlObj.protocol}
        Note: Page content could not be fetched. Analyzing URL structure only.
      `;
    } catch {
      return `URL provided for analysis: ${url}`;
    }
  }
};