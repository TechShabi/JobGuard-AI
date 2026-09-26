const Tesseract = require("tesseract.js");

exports.extractTextFromImage = async (imagePath) => {
  try {
    const result = await Tesseract.recognize(imagePath, "eng", {
      logger: () => {},
    });
    return result.data.text || "No text extracted from image";
  } catch (error) {
    console.error("OCR Error:", error.message);
    return "Could not extract text from image";
  }
};