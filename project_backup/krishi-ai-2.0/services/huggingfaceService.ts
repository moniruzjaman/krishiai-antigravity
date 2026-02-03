
import { HFClassificationResult } from "../types";

/**
 * High-speed plant disease classification using Hugging Face Inference API.
 * Model: linkv/plant-disease-classification (or similar specialized agri-vision models)
 */
export const classifyPlantDiseaseHF = async (base64Data: string): Promise<HFClassificationResult[] | null> => {
  // Get HF token from Vite environment
  const HF_TOKEN = typeof import.meta !== 'undefined' && import.meta.env
    ? import.meta.env.VITE_HF_TOKEN
    : (typeof process !== 'undefined' ? (process.env.VITE_HF_TOKEN || process.env.HF_TOKEN) : '');

  // If no token is provided, we gracefully return null and rely solely on Gemini
  if (!HF_TOKEN) {
    console.warn("Hugging Face Token (HF_TOKEN) not found. Skipping HF classification.");
    return null;
  }

  try {
    // Convert base64 to binary for Inference API
    const byteCharacters = atob(base64Data);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);

    const response = await fetch(
      "https://api-inference.huggingface.co/models/linkv/plant-disease-classification",
      {
        headers: {
          Authorization: `Bearer ${HF_TOKEN}`,
          "Content-Type": "application/octet-stream"
        },
        method: "POST",
        body: byteArray,
      }
    );

    if (!response.ok) {
      throw new Error(`HF Inference API error: ${response.statusText}`);
    }

    const result = await response.json();

    // Sort and limit results to top 5
    if (Array.isArray(result)) {
      return result
        .sort((a, b) => b.score - a.score)
        .slice(0, 5);
    }

    return null;
  } catch (error) {
    console.error("Hugging Face Inference Error:", error);
    return null;
  }
};

/**
 * Query Qwen-VL-Plus/Max via Hugging Face Inference for high-speed multi-modal tasks.
 */
export const queryQwenVL = async (prompt: string, base64Data: string, lang: string = 'bn'): Promise<string | null> => {
  const HF_TOKEN = typeof import.meta !== 'undefined' && import.meta.env
    ? import.meta.env.VITE_HF_TOKEN
    : (typeof process !== 'undefined' ? (process.env.VITE_HF_TOKEN || process.env.HF_TOKEN) : '');

  if (!HF_TOKEN) return null;

  try {
    const response = await fetch(
      "https://api-inference.huggingface.co/models/Qwen/Qwen2.5-VL-7B-Instruct", // Update with correct model path if needed
      {
        headers: {
          Authorization: `Bearer ${HF_TOKEN}`,
          "Content-Type": "application/json"
        },
        method: "POST",
        body: JSON.stringify({
          inputs: {
            image: base64Data,
            text: `${prompt} (Answer strictly in ${lang === 'bn' ? 'Bangla' : 'English'})`
          }
        }),
      }
    );

    if (!response.ok) return null;
    const result = await response.json();
    return result[0]?.generated_text || result.generated_text || null;
  } catch (error) {
    console.error("Qwen-VL Error:", error);
    return null;
  }
};
