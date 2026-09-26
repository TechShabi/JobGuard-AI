const validator = require("validator");
const ScanHistory = require("../models/ScanHistory");
const crypto = require("crypto");
const { Op } = require("sequelize");
const { analyzeScam } = require("../services/geminiService");
const { extractWebsiteText } = require("../services/scraperService");
const { extractTextFromImage } = require("../services/ocrService");
const fs = require("fs");
const { consumeCareerSession } = require("../middleware/careerSession");
const { getStatus } = require("../services/careerSessionService");

// ── DESCRIPTION ──────────────────────────────────────────────
exports.verifyDescription = async (req, res) => {
  try {
    const { description } = req.body;

    if (!description || !description.trim()) {
      return res.status(400).json({
        success: false,
        message: "Description Required",
      });
    }

    const normalizedDescription = description
      .trim()
      .replace(/\s+/g, " ")
      .toLowerCase();

    const descriptionHash = crypto
      .createHash("sha256")
      .update(normalizedDescription)
      .digest("hex");

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const existingScan = await ScanHistory.findOne({
      where: {
        type: "description",
        content: descriptionHash,
        createdAt: { [Op.gte]: thirtyDaysAgo },
      },
      order: [["createdAt", "DESC"]],
    });

    if (existingScan) {
      return res.status(200).json({
        success: true,
        cached: true,
        message: "Result loaded from cache",
        data: JSON.parse(existingScan.ai_response),
      });
    }

    const parsed = await analyzeScam(description);

    // ✅ Sirf logged in user ka save karo
    if (!parsed.isFallback && req.user?.id) {
      try {
        await ScanHistory.create({
          user_id: req.user.id,
          type: "description",
          content: descriptionHash,
          scam_score: parsed.scam_score,
          verdict: parsed.verdict,
          ai_response: JSON.stringify(parsed),
        });
      } catch (dbErr) {
        console.error("DB Save Error:", dbErr.message);
      }
    } else {
      console.log("⚠️ Fallback result not saved to DB");
    }

    await consumeCareerSession(req);

    return res.status(200).json({
      success: true,
      cached: false,
      message: "Fresh analysis completed",
      data: parsed,
      careerSessions: req.careerUser ? getStatus(req.careerUser) : null,
    });

  } catch (error) {
    console.error("verifyDescription Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to analyze description",
    });
  }
};

// ── URL ──────────────────────────────────────────────────────
exports.verifyUrl = async (req, res) => {
  try {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({
        success: false,
        message: "URL Required",
      });
    }

    const normalizedUrl = url.trim().toLowerCase();

    if (!validator.isURL(normalizedUrl)) {
      return res.status(400).json({
        success: false,
        message: "Invalid URL format",
      });
    }

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const existingScan = await ScanHistory.findOne({
      where: {
        type: "url",
        content: normalizedUrl,
        createdAt: { [Op.gte]: thirtyDaysAgo },
      },
      order: [["createdAt", "DESC"]],
    });

    if (existingScan) {
      return res.status(200).json({
        success: true,
        cached: true,
        message: "Result loaded from cache",
        url: normalizedUrl,
        data: JSON.parse(existingScan.ai_response),
      });
    }

    let analysisText = "";

    try {
      analysisText = await extractWebsiteText(normalizedUrl);
    } catch (scrapeErr) {
      console.log("Scraping Failed:", scrapeErr.message);
      const urlObj = new URL(normalizedUrl);
      analysisText = `
        URL: ${normalizedUrl}
        Domain: ${urlObj.hostname}
        Path: ${urlObj.pathname}
        Protocol: ${urlObj.protocol}
      `;
    }

    const parsed = await analyzeScam(analysisText);

    // ✅ Sirf logged in user ka save karo
    if (!parsed.isFallback && req.user?.id) {
      try {
        await ScanHistory.create({
          user_id: req.user.id,
          type: "url",
          content: normalizedUrl,
          scam_score: parsed.scam_score,
          verdict: parsed.verdict,
          ai_response: JSON.stringify(parsed),
        });
      } catch (dbErr) {
        console.error("DB Save Error:", dbErr.message);
      }
    } else {
      console.log("⚠️ Fallback result not saved to DB");
    }

    await consumeCareerSession(req);

    return res.status(200).json({
      success: true,
      cached: false,
      message: "Fresh scan completed",
      url: normalizedUrl,
      data: parsed,
      careerSessions: req.careerUser ? getStatus(req.careerUser) : null,
    });

  } catch (error) {
    console.error("verifyUrl Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to analyze URL. Please try again.",
    });
  }
};

// ── IMAGE ────────────────────────────────────────────────────
exports.verifyImage = async (req, res) => {
  let imagePath;

  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Image Required",
      });
    }

    imagePath = req.file.path;

    const fileBuffer = fs.readFileSync(imagePath);
    const imageFileHash = crypto
      .createHash("sha256")
      .update(fileBuffer)
      .digest("hex");

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const cachedByFileHash = await ScanHistory.findOne({
      where: {
        type: "image",
        file_hash: imageFileHash,
        createdAt: { [Op.gte]: thirtyDaysAgo },
      },
      order: [["createdAt", "DESC"]],
    });

    if (cachedByFileHash) {
      return res.status(200).json({
        success: true,
        cached: true,
        cache_type: "file_hash",
        message: "Result loaded from cache",
        data: JSON.parse(cachedByFileHash.ai_response),
      });
    }

    const extractedText = await extractTextFromImage(imagePath);
    const normalizedText = (extractedText || "")
      .trim()
      .replace(/\s+/g, " ")
      .toLowerCase();

    const ocrHash = crypto
      .createHash("sha256")
      .update(normalizedText || "empty_image")
      .digest("hex");

    const cachedByOCR = await ScanHistory.findOne({
      where: {
        type: "image",
        content: ocrHash,
        createdAt: { [Op.gte]: thirtyDaysAgo },
      },
      order: [["createdAt", "DESC"]],
    });

    if (cachedByOCR) {
      return res.status(200).json({
        success: true,
        cached: true,
        cache_type: "ocr_hash",
        ocr_text: extractedText,
        message: "Result loaded from OCR cache",
        data: JSON.parse(cachedByOCR.ai_response),
      });
    }

    const parsed = await analyzeScam(
      extractedText || "Image uploaded but no text detected"
    );

    // ✅ Sirf logged in user ka save karo
    if (!parsed.isFallback && req.user?.id) {
      try {
        await ScanHistory.create({
          user_id: req.user.id,
          type: "image",
          content: ocrHash,
          file_hash: imageFileHash,
          scam_score: parsed.scam_score,
          verdict: parsed.verdict,
          ai_response: JSON.stringify(parsed),
        });
      } catch (dbErr) {
        console.error("DB Save Error:", dbErr.message);
      }
    } else {
      console.log("⚠️ Fallback result not saved to DB");
    }

    await consumeCareerSession(req);

    return res.status(200).json({
      success: true,
      cached: false,
      cache_type: null,
      ocr_text: extractedText,
      data: parsed,
      careerSessions: req.careerUser ? getStatus(req.careerUser) : null,
    });

  } catch (error) {
    console.error("verifyImage Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Image verification failed",
    });

  } finally {
    if (imagePath && fs.existsSync(imagePath)) {
      try {
        fs.unlinkSync(imagePath);
      } catch (err) {
        console.error("File Delete Error:", err);
      }
    }
  }
};