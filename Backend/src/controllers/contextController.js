const Context = require("../models/Context");
const { extractJobInfo } = require("../services/geminiService");
const { extractWebsiteText } = require("../services/scraperService");
const { extractTextFromImage } = require("../services/ocrService");
const fs = require("fs");

// GET /api/context — current active context (null if none)
exports.getActiveContext = async (req, res) => {
  try {
    const context = await Context.findOne({
      where: { user_id: req.user.id, is_active: true },
      order: [["createdAt", "DESC"]],
    });
    return res.json({ success: true, context: context || null });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/context
// Rule: Active Context sirf 1. Auto-replace kabhi nahi — caller (frontend)
// pehle user se confirmation le chuka hota hai jab ye call fire hoti hai.
exports.createOrReplaceContext = async (req, res) => {
  try {
    const {
      source_module,
      company,
      role,
      experience,
      description,
      source_label,
    } = req.body;

    if (!role || !source_module) {
      return res.status(400).json({
        success: false,
        message: "role and source_module are required",
      });
    }

    // purane active context ko deactivate karo (history mein reh jayega, delete nahi)
    await Context.update(
      { is_active: false },
      { where: { user_id: req.user.id, is_active: true } }
    );

    const context = await Context.create({
      user_id: req.user.id,
      source_module,
      company: company || "Unknown Company",
      role,
      experience: experience || "Not Specified",
      description: description || null,
      source_label: source_label || null,
      is_active: true,
    });

    return res.status(201).json({ success: true, context });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// DELETE /api/context — active context clear karo (manual, user action)
exports.clearContext = async (req, res) => {
  try {
    await Context.update(
      { is_active: false },
      { where: { user_id: req.user.id, is_active: true } }
    );
    return res.json({ success: true, message: "Context cleared" });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ── Auto-detect helpers (Resume Review / Builder / Interview Step 1) ──
// Same scrape/OCR + single Gemini extraction call. Does NOT run scam scoring.
// Guests allowed via optionalAuth on the routes.

function normalizeUrl(raw) {
  const s = String(raw || "").trim();
  if (!s) return "";
  if (/^https?:\/\//i.test(s)) return s;
  return `https://${s}`;
}

// POST /api/context/extract-url  { url }
exports.extractFromUrl = async (req, res) => {
  try {
    const url = normalizeUrl(req.body?.url);
    if (!url) {
      return res.status(400).json({ success: false, message: "URL is required." });
    }

    let pageText = "";
    try {
      pageText = await extractWebsiteText(url);
    } catch (scrapeErr) {
      console.error("extractFromUrl scrape:", scrapeErr.message);
      pageText = url;
    }

    const content = [url, pageText].filter(Boolean).join("\n\n").slice(0, 4000);
    const data = await extractJobInfo(content);

    return res.json({ success: true, data });
  } catch (error) {
    console.error("extractFromUrl error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to extract job info from URL",
    });
  }
};

// POST /api/context/extract-description  { description }
exports.extractFromDescription = async (req, res) => {
  try {
    const description = String(req.body?.description || "").trim();
    if (!description) {
      return res.status(400).json({
        success: false,
        message: "Description is required.",
      });
    }

    const data = await extractJobInfo(description);
    return res.json({ success: true, data });
  } catch (error) {
    console.error("extractFromDescription error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to extract job info from description",
    });
  }
};

// POST /api/context/extract-image  multipart image
exports.extractFromImage = async (req, res) => {
  const imagePath = req.file?.path;
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Image file is required.",
      });
    }

    let ocrText = "";
    try {
      ocrText = await extractTextFromImage(imagePath);
    } catch (ocrErr) {
      console.error("extractFromImage OCR:", ocrErr.message);
    }

    const data = await extractJobInfo(ocrText || "");
    return res.json({
      success: true,
      data,
      ocr_text: ocrText || "",
    });
  } catch (error) {
    console.error("extractFromImage error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to extract job info from image",
    });
  } finally {
    if (imagePath && fs.existsSync(imagePath)) {
      try {
        fs.unlinkSync(imagePath);
      } catch (_) {
        /* ignore cleanup errors */
      }
    }
  }
};
