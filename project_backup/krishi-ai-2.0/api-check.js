
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
dotenv.config();

async function test() {
    console.log("Testing Gemini API Key...");
    const apiKey = process.env.VITE_API_KEY;
    if (!apiKey) {
        console.error("VITE_API_KEY is missing in .env");
        process.exit(1);
    }

    try {
        const genAI = new GoogleGenAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });
        const result = await model.generateContent("Test connection. Respond with 'OK'");
        console.log("RESPONSE:", result.response.text());
        console.log("✅ API status: FUNCTIONAL");
    } catch (err) {
        console.error("❌ API status: FAILED");
        console.error("Error details:", err.message);
    }
}

test();
