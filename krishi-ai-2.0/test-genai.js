
import fs from 'fs';
import { GoogleGenAI } from '@google/genai';

// Simple .env parser since dotenv isn't installed
function loadEnv() {
    try {
        const content = fs.readFileSync('.env', 'utf-8');
        const lines = content.split('\n');
        const env = {};
        for (const line of lines) {
            if (line.trim() && !line.startsWith('#')) {
                const [key, ...valueParts] = line.split('=');
                const value = valueParts.join('=').trim();
                if (key && value) {
                    env[key.trim()] = value;
                }
            }
        }
        return env;
    } catch (e) {
        console.error("Could not read .env file");
        return {};
    }
}

async function testApi() {
    const env = loadEnv();
    const apiKey = env.VITE_API_KEY;

    if (!apiKey || apiKey.includes('YOUR_GOOGLE_GENAI_API_KEY_HERE')) {
        console.error("❌ API Key not found or is still the placeholder.");
        console.error("Please update .env file with your actual Google Gemini API key.");
        process.exit(1);
    }

    console.log("Found API Key:", apiKey.slice(0, 5) + "...");
    console.log("Testing connection to Google GenAI...");

    try {
        const ai = new GoogleGenAI({ apiKey });

        // First, let's try to list models to see what's available and verify auth
        console.log("Listing available models...");
        // note: ListModels might be under 'models' or 'files' depending on SDK version, 
        // but for @google/genai it is usually ai.models.list()

        // Try to Generate Content using a safe default
        // We will wrap this in a try-catch for the specific model

        const candidates = ['gemini-1.5-flash', 'gemini-2.0-flash-exp', 'gemini-pro'];
        let success = false;

        for (const modelName of candidates) {
            try {
                console.log(`Attempting with model: ${modelName}...`);
                const response = await ai.models.generateContent({
                    model: modelName,
                    contents: [{ parts: [{ text: "Hello, are you functional?" }] }]
                });
                console.log(`✅ API Test Successful with ${modelName}!`);
                console.log("Response:", response.text ? response.text.slice(0, 100) + "..." : "No text");
                success = true;
                break;
            } catch (e) {
                console.log(`Failed with ${modelName}: ${e.message?.split('\n')[0]}`);
            }
        }

        if (!success) {
            console.error("❌ Could not generate content with any standard model.");
        }

    } catch (error) {
        console.error("❌ General API Error!");
        console.error("Error details:", error);
    }
}

testApi();
