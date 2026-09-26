const fs = require("fs");
const path = require("path");

// Har supported format se plain text nikaalta hai — same contract for all:
// ek filePath andar, trimmed plain text bahar. Naye formats add karne ke
// liye sirf yahan ek naya "if (ext === ...)" block chahiye, controller ko
// kuch pata nahi chalta (analyze/optimize dono isi function ko call karte hain).
//
// npm installs needed for the new formats (already added to package.json):
//   npm install jszip word-extractor
// (pdf-parse, mammoth, cheerio already existed for PDF/DOCX/HTML.)
exports.extractResumeText = async (filePath) => {
  const ext = path.extname(filePath).toLowerCase();

  if (ext === ".pdf") {
    const pdfParse = require("pdf-parse");
    const buffer = fs.readFileSync(filePath);
    const data = await pdfParse(buffer);
    return (data.text || "").trim();
  }

  if (ext === ".docx") {
    const mammoth = require("mammoth");
    const result = await mammoth.extractRawText({ path: filePath });
    return (result.value || "").trim();
  }

  if (ext === ".doc") {
    // Legacy binary .doc — mammoth isse handle nahi karta, so a dedicated
    // extractor is used. Falls back to a clear message if the optional
    // dependency hasn't been installed yet, instead of crashing the server.
    try {
      const WordExtractor = require("word-extractor");
      const extractor = new WordExtractor();
      const doc = await extractor.extract(filePath);
      return (doc.getBody() || "").trim();
    } catch (err) {
      if (err.code === "MODULE_NOT_FOUND") {
        throw new Error(
          "Legacy .doc support needs the 'word-extractor' package (run: npm install word-extractor). Please upload .docx, .pdf, or .txt in the meantime."
        );
      }
      throw new Error("Could not read this .doc file. Please re-save it as .docx and try again.");
    }
  }

  if (ext === ".txt") {
    return fs.readFileSync(filePath, "utf-8").trim();
  }

  if (ext === ".rtf") {
    const raw = fs.readFileSync(filePath, "utf-8");
    return stripRtf(raw).trim();
  }

  if (ext === ".odt") {
    // ODT is a zip container; the readable text lives in content.xml.
    try {
      const JSZip = require("jszip");
      const buffer = fs.readFileSync(filePath);
      const zip = await JSZip.loadAsync(buffer);
      const contentXml = await zip.file("content.xml")?.async("string");
      if (!contentXml) throw new Error("content.xml not found in .odt archive");
      return stripXmlTags(contentXml).trim();
    } catch (err) {
      if (err.code === "MODULE_NOT_FOUND") {
        throw new Error(
          "ODT support needs the 'jszip' package (run: npm install jszip). Please upload .docx, .pdf, or .txt in the meantime."
        );
      }
      throw new Error("Could not read this .odt file. Please re-save it as .docx and try again.");
    }
  }

  if (ext === ".html" || ext === ".htm") {
    const cheerio = require("cheerio"); // already a project dependency
    const html = fs.readFileSync(filePath, "utf-8");
    const $ = cheerio.load(html);
    $("script, style").remove();
    return $("body").text().replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  }

  throw new Error("Unsupported resume file format");
};

// Minimal dependency-free RTF → plain text degrader: strips RTF control
// words/groups and unescapes the handful of characters resumes actually use.
// Good enough for AI review/optimization purposes (this is text extraction
// for analysis, not a full RTF renderer).
function stripRtf(rtf) {
  let text = rtf
    .replace(/\\par[d]?/g, "\n")
    .replace(/\\tab/g, "\t")
    .replace(/\\'([0-9a-fA-F]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/\{\\\*?\\[^{}]+\}/g, "")
    .replace(/\\[a-zA-Z]+-?\d* ?/g, "")
    .replace(/[{}]/g, "");
  return text;
}

function stripXmlTags(xml) {
  return xml
    .replace(/<text:p[^>]*>/g, "\n")
    .replace(/<text:tab\/>/g, "\t")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}
