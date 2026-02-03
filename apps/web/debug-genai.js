import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
dotenv.config();

const apiKey = process.env.VITE_API_KEY;
console.log("Key length:", apiKey ? apiKey.length : 0);

try {
    const client = new GoogleGenAI({ apiKey: apiKey });
    console.log("Client created.");
    console.log("Client keys:", Object.keys(client));
    if (client.models) {
        console.log("client.models keys:", Object.keys(client.models));
    }
} catch (e) {
    console.error("Error creating client:", e);
}
