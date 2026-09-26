const { GoogleGenerativeAI } = require("@google/generative-ai");
require("dotenv").config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// ✅ Auto model selector
async function getModel() {
  const modelNames = [
    "gemini-2.5-flash",
    // "gemini-2.0-flash-lite", 
    // "gemini-1.5-pro",
    // "gemini-1.5-flash",
    // "gemini-pro",
  ];

  for (const name of modelNames) {
    try {
      const model = genAI.getGenerativeModel({ model: name });
      // Test karo
      await model.generateContent("test");
      console.log(`✅ Gemini Model: ${name}`);
      return model;
    } catch (err) {
      console.log(`❌ ${name} failed`);
      continue;
    }
  }

  throw new Error("No Gemini model available");
}

module.exports = { genAI, getModel };