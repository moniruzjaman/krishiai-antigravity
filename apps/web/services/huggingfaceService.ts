
import { HFClassificationResult } from "../types";

/**
 * Universal primary engine using Qwen/Qwen3-VL-8B-Instruct.
 */
export const queryQwenVL = async (
  prompt: string, 
  base64Image?: string, 
  lang: string = 'bn'
): Promise<string | null> => {
  const HF_TOKEN = (process.env.HF_TOKEN && process.env.HF_TOKEN !== "undefined" && process.env.HF_TOKEN !== "null") 
    ? process.env.HF_TOKEN 
    : "";
  
  try {
    const modelUrl = "https://api-inference.huggingface.co/models/Qwen/Qwen3-VL-8B-Instruct";
    
    // Explicitly enforcing structure for diagnostic queries
    const refinedPrompt = prompt.toLowerCase().includes('identify') || prompt.toLowerCase().includes('problem') 
      ? `As a BD Govt Scientific Officer, perform a detailed diagnostic audit. 
         Structure: 
         [শনাক্তকরণ ও লক্ষণসমূহ]: Detailed description.
         [সম্ভাব্য কারণ (Cause)]: Scientific reasoning.
         [সমন্বিত বালাই ব্যবস্থাপনা (IPM)]: Biological/Cultural steps.
         [রাসায়নিক প্রতিকার ও MoA নম্বর]: DAE recommended pesticide with Mode of Action group.
         ${prompt}`
      : prompt;

    const groundedPrompt = `As a Senior Scientific Officer of Bangladesh Agriculture (BARI/BRRI/BARC/DAE):
    ${refinedPrompt}
    
    Respond strictly in ${lang === 'bn' ? 'Bangla (বাংলা)' : 'English'}.
    Ensure accuracy and follow national agricultural guidelines. 
    Reference official DAM (Department of Agricultural Marketing) for price data if relevant.
    STRICTLY NO INTRODUCTIONS.`;

    const body: any = {
      inputs: base64Image ? {
        image: base64Image.includes('base64,') ? base64Image : `data:image/jpeg;base64,${base64Image}`,
        prompt: groundedPrompt
      } : groundedPrompt,
      parameters: { max_new_tokens: 1024, temperature: 0.2 }
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(modelUrl, {
      headers: { 
        "Authorization": `Bearer ${HF_TOKEN}`,
        "Content-Type": "application/json",
        "x-wait-for-model": "true"
      },
      method: "POST",
      body: JSON.stringify(body),
      signal: controller.signal
    });

    clearTimeout(timeoutId);
    if (!response.ok) return null;
    const result = await response.json();
    
    let text = "";
    if (Array.isArray(result)) {
      text = result[0]?.generated_text || result[0]?.text || "";
    } else {
      text = result?.generated_text || result?.text || "";
    }

    return text || null;
  } catch (error) {
    return null;
  }
};

/**
 * Specialized Agricultural Intelligence using HF Models.
 * References logic from CropNet datasets for pest surge and yield stress.
 */
export const queryCropNetInsight = async (weatherData: any, lang: string = 'bn'): Promise<string | null> => {
  const HF_TOKEN = (process.env.HF_TOKEN && process.env.HF_TOKEN !== "undefined" && process.env.HF_TOKEN !== "null") 
    ? process.env.HF_TOKEN 
    : "";

  try {
    const modelUrl = "https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.3";
    
    const prompt = `[INST] Act as an Agri-Data Scientist. Analyze this weather data for a farm in Bangladesh. 
    Reference patterns from CropNet datasets for pest and disease prediction.
    Data: Temp: ${weatherData.temp}C, Humidity: ${weatherData.humidity}%, Wind: ${weatherData.windSpeed}km/h, Rain: ${weatherData.rainProbability}%.
    Identify: 1. Specific Disease Risk 2. Pest Surge Likelihood 3. Spray Suitability.
    Language: Respond in ${lang === 'bn' ? 'Bangla (বাংলা)' : 'English'}.
    Format: Concise bullet points. NO INTRO. [/INST]`;

    const response = await fetch(modelUrl, {
      headers: { 
        "Authorization": `Bearer ${HF_TOKEN}`,
        "Content-Type": "application/json"
      },
      method: "POST",
      body: JSON.stringify({ inputs: prompt, parameters: { max_new_tokens: 250 } })
    });

    if (!response.ok) return null;
    const result = await response.json();
    
    let text = "";
    if (Array.isArray(result)) {
      text = result[0]?.generated_text || "";
    } else {
      text = result?.generated_text || "";
    }

    if (!text) return null;
    
    // Robust parsing for Mistral instruction format
    return text.includes('[/INST]') ? text.split('[/INST]').pop()?.trim() || text : text.trim();
  } catch (e) {
    return null;
  }
};

export const classifyPlantDiseaseHF = async (base64Data: string): Promise<HFClassificationResult[] | null> => {
  const HF_TOKEN = (process.env.HF_TOKEN && process.env.HF_TOKEN !== "undefined" && process.env.HF_TOKEN !== "null") 
    ? process.env.HF_TOKEN 
    : "";
  
  if (!base64Data) return null;
  try {
    const rawBase64 = base64Data.includes('base64,') ? base64Data.split(',')[1] : base64Data;
    const binaryString = atob(rawBase64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);

    const response = await fetch(
      "https://api-inference.huggingface.co/models/linkv/plant-disease-classification",
      {
        headers: { 
          "Authorization": `Bearer ${HF_TOKEN}`,
          "Content-Type": "application/octet-stream",
          "x-wait-for-model": "true"
        },
        method: "POST",
        body: bytes.buffer,
      }
    );

    if (!response.ok) return null;
    const result = await response.json();
    if (Array.isArray(result)) return result.sort((a: any, b: any) => b.score - a.score).slice(0, 5);
    return null;
  } catch (error: any) {
    return null;
  }
};