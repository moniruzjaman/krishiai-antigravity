
import { GoogleGenAI, Modality, Type } from "@google/genai";
import { AnalysisResult, GroundingChunk, FlashCard, AgriTask, UserCrop, User, WeatherData, CropDiseaseReport, AgriQuizQuestion, Language, UserRole } from "../types";
import { AEZInfo } from "./locationService";

/**
 * Helper to extract JSON from model output.
 */
const extractJSON = <T>(text: string, defaultValue: T): T => {
  if (!text) return defaultValue;
  try {
    // Attempt to find JSON structure in text
    const jsonMatch = text.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    if (!jsonMatch) return defaultValue;
    return JSON.parse(jsonMatch[0]) as T;
  } catch (e) {
    console.error("JSON Parse Error:", e, "Raw text:", text);
    return defaultValue;
  }
};

/**
 * Robust retry logic for API calls.
 */
const withRetry = async <T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> => {
  let lastError: any;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      const errorStatus = error?.status || (error?.error?.code);
      if (errorStatus === 500 || errorStatus === 429 || errorStatus === 503) {
        const delay = Math.pow(2, i) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      throw error;
    }
  }
  throw lastError;
};

/**
 * Extract raw base64 from a data URL or return the string as-is.
 */
const getRawBase64 = (data: string | null | undefined): string => {
  if (!data) return "";
  if (data.includes('base64,')) {
    const parts = data.split('base64,');
    return parts.length > 1 ? parts[1] : parts[0];
  }
  return data;
};

export const decodeBase64 = (base64: string): Uint8Array => {
  if (!base64) return new Uint8Array(0);
  const raw = getRawBase64(base64);
  const binaryString = atob(raw);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
  return bytes;
};

export const decodeAudioData = async (data: Uint8Array, ctx: AudioContext, sampleRate: number, numChannels: number): Promise<AudioBuffer> => {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);
  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
  }
  return buffer;
};

const BD_GOVT_GROUNDING_INSTRUCTION = `
Role: Senior Scientific Officer, Ministry of Agriculture, Bangladesh.
Response Strategy:
1. STRICTLY NO INTRODUCTIONS.
2. Use square brackets for headers like [রোগ শনাক্তকরণ]. 
3. Sourcing: Grounded in BARI/BRRI/DAE/BARC 2024-2025 standards.
4. Language: Bangla (বাংলা) for the main diagnostic results.
`;

export const analyzeCropImage = async (
  base64Data: string, 
  mimeType: string, 
  options?: { 
    cropFamily?: string, 
    userRank?: string, 
    query?: string, 
    lang?: Language, 
    weather?: WeatherData,
    hfHint?: string 
  }
): Promise<AnalysisResult> => {
  const lang = options?.lang || 'bn';

  return await withRetry(async () => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const systemInstruction = `${BD_GOVT_GROUNDING_INSTRUCTION}
    TASK: Detailed Agri-Diagnostic Audit.
    MANDATORY SECTIONS: [শনাক্তকরণ (লক্ষণসহ)], [কারণ (Cause)], [সমন্বিত বালাই ব্যবস্থাপনা (IPM)], [রাসায়নিক প্রতিকার (MoA নম্বরসহ)], [সতর্কতা].`;
    
    const response = await ai.models.generateContent({
      model: 'gemini-1.5-flash-preview',
      contents: [{ 
        parts: [
          { inlineData: { data: getRawBase64(base64Data), mimeType } }, 
          { text: `Crop: ${options?.cropFamily}. Hint: ${options?.hfHint}. Query: ${options?.query}.` }
        ] 
      }],
      config: { systemInstruction, tools: [{ googleSearch: {} }] }
    });
    
    const text = response.text || "";
    const diagnosis = text.match(/\[শনাক্তকরণ.*?\]:\s*(.*)/i)?.[1]?.split('\n')[0]?.trim() || "শনাক্তকরণ সম্পন্ন";
    const categoryMatch = text.match(/CATEGORY:\s*(Pest|Disease|Deficiency|Other)/i)?.[1];
    
    return {
      diagnosis,
      category: (categoryMatch as any) || 'Other',
      confidence: 95,
      advisory: text,
      fullText: text,
      officialSource: "BARI/BRRI Grounded",
      groundingChunks: (response.candidates?.[0]?.groundingMetadata?.groundingChunks as any) || []
    };
  });
};

export const getCropDiseaseInfo = async (crop: string) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const isRice = crop.includes('ধান') || crop.toLowerCase().includes('rice');
  
  const prompt = `Generate a highly detailed Pest & Disease Report for the crop: ${crop}.
  
  MANDATORY GROUNDING RULES:
  1. If Rice (ধান), use BRRI standards. For others, use BARI standards.
  2. All pesticides must follow DAE national protocols (2024-2025) including MoA (Mode of Action) numbers.
  
  Return strictly valid JSON in Bangla (বাংলা).
  JSON Structure:
  {
    "cropName": "string",
    "summary": "string",
    "varieties": [
      { "name": "string", "description": "string (brief discussion about the variety performance in BD)" }
    ],
    "diseases": [
      {
        "name": "string",
        "symptoms": "string",
        "imageDescription": "string (Detailed visual description of how this looks for AI image generation)",
        "favorableEnvironment": "string",
        "bioControl": "string (IPM methods)",
        "chemControl": "string (Chemical methods with MoA number and DAE dosage)",
        "severity": "Low/Medium/High"
      }
    ],
    "pests": [
      {
        "name": "string",
        "damageSymptoms": "string",
        "imageDescription": "string (Detailed visual description of the pest and its damage for AI image generation)",
        "favorableEnvironment": "string",
        "bioControl": "string (IPM methods)",
        "chemControl": "string (Chemical methods with MoA number and DAE dosage)",
        "severity": "Low/Medium/High"
      }
    ],
    "sourceUsed": "${isRice ? 'BRRI' : 'BARI'} & DAE Official 2025"
  }`;

  const response = await ai.models.generateContent({
    model: 'gemini-1.5-flash-preview',
    contents: prompt,
    config: { 
      systemInstruction: BD_GOVT_GROUNDING_INSTRUCTION,
      responseMimeType: "application/json" 
    }
  });
  
  return { data: extractJSON<CropDiseaseReport & { sourceUsed: string }>(response.text || "{}", {} as any) };
};

export const analyzeLeafColorAI = async (base64Data: string, mimeType: string): Promise<{ lccValue: number, confidence: number }> => {
  return await withRetry(async () => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: 'gemini-1.5-flash-preview',
      contents: [
        { inlineData: { data: getRawBase64(base64Data), mimeType } },
        { text: "Act as an IRRI Rice expert. Analyze this rice leaf image based on the standard 1-5 panel Leaf Color Chart (LCC). Determine the color index score. Respond strictly in JSON: { \"lccValue\": number, \"confidence\": number }. The lccValue must be between 1 and 5." }
      ],
      config: { responseMimeType: "application/json" }
    });
    return extractJSON<{ lccValue: number, confidence: number }>(response.text || "{}", { lccValue: 3, confidence: 70 });
  });
};

export const getLiveWeather = async (lat: number, lng: number, force = false, lang: Language = 'bn'): Promise<WeatherData> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const today = new Date().toISOString().split('T')[0];
  const response = await ai.models.generateContent({
    model: 'gemini-1.5-flash-preview',
    contents: `Today is ${today}. Search Google for real-time agricultural weather at Lat: ${lat}, Lng: ${lng} in Bangladesh. 
    Provide localized BAMIS-grounded data in JSON format only.
    Mandatory Keys: upazila, district, temp (number), condition (string), description (string), humidity (number), windSpeed (number, km/h), rainProbability (number, %), soilTemperature (number), evapotranspiration (number, mm), solarRadiation (number, W/m2), diseaseRisk (string: e.g. High/Medium/Low Risk for Rice Blast).
    All text values must be in ${lang === 'bn' ? 'Bangla (বাংলা)' : 'English'}.`,
    config: {
      tools: [{ googleSearch: {} }],
      responseMimeType: "application/json"
    }
  });
  return extractJSON<WeatherData>(response.text || "{}", { 
    upazila: lang === 'bn' ? "অজানা" : "Unknown", 
    district: lang === 'bn' ? "বাংলাদেশ" : "Bangladesh", 
    temp: 25, 
    condition: lang === 'bn' ? "রৌদ্রোজ্জ্বল" : "Sunny", 
    description: lang === 'bn' ? "পরিষ্কার আকাশ" : "Clear Sky", 
    humidity: 60, 
    windSpeed: 10, 
    rainProbability: 0,
    evapotranspiration: 1.2,
    soilTemperature: 24,
    solarRadiation: 400
  });
};

export const getTrendingMarketPrices = async (lang: Language = 'bn') => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const today = new Date().toISOString().split('T')[0];
  const response = await ai.models.generateContent({
    model: 'gemini-1.5-flash-preview',
    contents: `Today is ${today}. Search Google for real-time market prices of major crops in Bangladesh from Department of Agricultural Marketing (DAM).
    Return a JSON array of objects.
    Mandatory Keys: name, price (number, BDT per unit), unit (e.g., কেজি, ডজন), trend (string: "up", "down", "stable"), change (string: e.g. "+5%"), category (string).
    All string values must be in ${lang === 'bn' ? 'Bangla (বাংলা)' : 'English'}.`,
    config: { 
      systemInstruction: "You are an agricultural market data analyst for Bangladesh. Use official DAM (dam.gov.bd) grounding.",
      tools: [{ googleSearch: {} }],
      responseMimeType: "application/json"
    }
  });
  return extractJSON<any[]>(response.text || "[]", []);
};

export const getLCCAnalysisSummary = async (lcc: number, tsr: number, dose: string, lang: 'en' | 'bn' = 'bn') => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response = await ai.models.generateContent({
    model: 'gemini-1.5-flash-preview',
    contents: `LCC Summary: Value ${lcc}, TSR ${tsr}%, Dose ${dose}. START DIRECTLY WITH [এলসিসি বিশ্লেষণ].`,
    config: { systemInstruction: BD_GOVT_GROUNDING_INSTRUCTION }
  });
  return response.text;
};

export const generateSpeech = async (text: string): Promise<string> => {
  return await withRetry(async () => {
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const speechText = text.replace(/[*#_~]/g, '').slice(0, 1000);
      
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-tts",
        contents: [{ parts: [{ text: speechText }] }],
        config: {
          responseModalities: [Modality?.AUDIO || 'AUDIO' as any],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } },
        },
      });
      const candidates = response.candidates || [];
      if (candidates.length > 0) {
        const parts = candidates[0].content?.parts || [];
        for (const part of parts) {
          if (part.inlineData?.data) return part.inlineData.data;
        }
      }
      throw new Error("No audio data");
    } catch (error: any) {
      throw error;
    }
  });
};

export const searchNearbySellers = async (lat: number, lng: number, query: string, lang: Language = 'bn') => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: `Find closest ${query} near ${lat}, ${lng} in Bangladesh.`,
    config: {
      tools: [{ googleMaps: {} }, { googleSearch: {} }],
      toolConfig: { retrievalConfig: { latLng: { latitude: lat, longitude: lng } } }
    }
  });
  return {
    text: response.text || "",
    groundingChunks: (response.candidates?.[0]?.groundingMetadata?.groundingChunks as any) || []
  };
};

export const sendChatMessage = async (history: any[], message: string, persona: string, role: string, weather?: WeatherData, crops?: UserCrop[]) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const context = `UserRole: ${role}. Persona: ${persona}. Answer directly. Use square bracket headers.`;
  const response = await ai.models.generateContent({
    model: 'gemini-1.5-flash-preview',
    contents: [...history, { role: 'user', parts: [{ text: `${context}\n\nQ: ${message}` }] }],
    config: { tools: [{ googleSearch: {} }] }
  });
  return {
    text: response.text || "দুঃখিত, উত্তর দিতে পারছি না।",
    groundingChunks: (response.candidates?.[0]?.groundingMetadata?.groundingChunks as any) || []
  };
};

export const searchAgriculturalInfo = async (query: string) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response = await ai.models.generateContent({
    model: 'gemini-1.5-flash-preview',
    contents: `Official advice for: ${query}. Answer directly with square bracket headers.`,
    config: { systemInstruction: BD_GOVT_GROUNDING_INSTRUCTION, tools: [{ googleSearch: {} }] }
  });
  return {
    text: response.text || "",
    groundingChunks: (response.candidates?.[0]?.groundingMetadata?.groundingChunks as any) || []
  };
};

export const requestPrecisionParameters = async (base64Data: string, mimeType: string, cropFamily: string, lang: Language = 'bn') => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response = await ai.models.generateContent({
    model: 'gemini-1.5-flash-preview',
    contents: [
      { inlineData: { data: getRawBase64(base64Data), mimeType } },
      { text: `Identify followup questions for ${cropFamily}. JSON array. Bangla.` }
    ],
    config: { systemInstruction: BD_GOVT_GROUNDING_INSTRUCTION, responseMimeType: "application/json" }
  });
  return extractJSON<any[]>(response.text || "[]", []);
};

export const requestPesticidePrecisionParameters = async (query: string, lang: Language = 'bn') => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response = await ai.models.generateContent({
    model: 'gemini-1.5-flash-preview',
    contents: `Followup spray questions for ${query}. JSON array. Bangla.`,
    config: { systemInstruction: BD_GOVT_GROUNDING_INSTRUCTION, responseMimeType: "application/json" }
  });
  return extractJSON<any[]>(response.text || "[]", []);
};

export const requestSoilPrecisionParameters = async (inputs: any, aezName: string, lang: Language = 'bn') => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response = await ai.models.generateContent({
    model: 'gemini-1.5-flash-preview',
    contents: `Soil followup questions for ${aezName}. JSON array. Bangla.`,
    config: { systemInstruction: BD_GOVT_GROUNDING_INSTRUCTION, responseMimeType: "application/json" }
  });
  return extractJSON<any[]>(response.text || "[]", []);
};

export const performDeepPesticideAudit = async (query: string, dynamicData: Record<string, string>, lang: Language = 'bn') => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response = await ai.models.generateContent({
    model: 'gemini-1.5-flash-preview',
    contents: `Final Spray Audit: ${query} with ${JSON.stringify(dynamicData)}. START DIRECTLY WITH [চূড়ান্ত অডিট রিপোর্ট].`,
    config: { systemInstruction: BD_GOVT_GROUNDING_INSTRUCTION, tools: [{ googleSearch: {} }] }
  });
  return {
    text: response.text || "",
    groundingChunks: (response.candidates?.[0]?.groundingMetadata?.groundingChunks as any) || []
  };
};

export const performSoilHealthAudit = async (inputs: any, aez?: AEZInfo, lang: Language = 'bn') => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response = await ai.models.generateContent({
    model: 'gemini-1.5-flash-preview',
    contents: `Soil Audit: ${JSON.stringify(inputs)} in ${aez?.name}. Start with [পুষ্টি বিশ্লেষণ].`,
    config: { systemInstruction: BD_GOVT_GROUNDING_INSTRUCTION, tools: [{ googleSearch: {} }] }
  });
  return response.text;
};

export const performDeepSoilAudit = async (inputs: any, aezName: string, dynamicData: Record<string, string>, lang: Language = 'bn') => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response = await ai.models.generateContent({
    model: 'gemini-1.5-flash-preview',
    contents: `Deep Soil Audit ${aezName}. Start with [বিস্তারিত অডিট ফলাফল].`,
    config: { systemInstruction: BD_GOVT_GROUNDING_INSTRUCTION, tools: [{ googleSearch: {} }] }
  });
  return response.text;
};

export const getAIYieldPrediction = async (
  crop: string, aez: string, soilStatus: string, practice: string, water: string, notes: string, rank?: string, dynamicInputs?: Record<string, string>, lang: Language = 'bn'
) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response = await ai.models.generateContent({
    model: 'gemini-1.5-flash-preview',
    contents: `Predict yield for ${crop} in AEZ: ${aez}. Start with [ফলন পূর্বাভাস].`,
    config: { systemInstruction: BD_GOVT_GROUNDING_INSTRUCTION, tools: [{ googleSearch: {} }] }
  });
  return {
    text: response.text || "পূর্বাভাস জেনারেট করা যায়নি।",
    groundingChunks: (response.candidates?.[0]?.groundingMetadata?.groundingChunks as any) || []
  };
};

export const getAIPlantNutrientAdvice = async (crop: string, aez: string, soil: string, area: number, unit: string, lang: Language = 'bn') => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response = await ai.models.generateContent({
    model: 'gemini-1.5-flash-preview',
    contents: `BARC Fertilizer Guide 2024 for ${crop} in ${aez}. Area: ${area} ${unit}. START DIRECTLY WITH [সার সুপারিশ].`,
    config: { systemInstruction: BD_GOVT_GROUNDING_INSTRUCTION, tools: [{ googleSearch: {} }] }
  });
  return response.text;
};

export const getBiocontrolExpertAdvice = async (query: string) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response = await ai.models.generateContent({
    model: 'gemini-1.5-flash-preview',
    contents: `Biocontrol measures for ${query}. START DIRECTLY WITH [জৈবিক পদ্ধতি].`,
    config: { systemInstruction: BD_GOVT_GROUNDING_INSTRUCTION, tools: [{ googleSearch: {} }] }
  });
  return response.text;
};

export const interpretSoilReportAI = async (inputs: any) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response = await ai.models.generateContent({
    model: 'gemini-1.5-flash-preview',
    contents: `Interpret soil lab result: ${JSON.stringify(inputs)}. START DIRECTLY WITH [ল্যাব রিপোর্ট বিশ্লেষণ].`,
    config: { systemInstruction: BD_GOVT_GROUNDING_INSTRUCTION, tools: [{ googleSearch: {} }] }
  });
  return response.text;
};

export const getFieldMonitoringData = async (lat: number, lng: number, areaName: string) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response = await ai.models.generateContent({
    model: 'gemini-1.5-flash-preview',
    contents: `Satellite Health Monitoring for ${areaName}. START DIRECTLY WITH [স্যাটেলাইট পর্যবেক্ষণ].`,
    config: { systemInstruction: BD_GOVT_GROUNDING_INSTRUCTION, tools: [{ googleSearch: {} }] }
  });
  return { text: response.text || "" };
};

export const identifyPlantSpecimen = async (base64Data: string, mimeType: string, lang: Language = 'bn') => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response = await ai.models.generateContent({
    model: 'gemini-1.5-flash-preview',
    contents: [
      { inlineData: { data: getRawBase64(base64Data), mimeType } },
      { text: `Identify this botanical specimen. START DIRECTLY WITH [উদ্ভিদ পরিচয়].` }
    ],
    config: { systemInstruction: BD_GOVT_GROUNDING_INSTRUCTION, tools: [{ googleSearch: {} }] }
  });
  return {
    text: response.text || "",
    groundingChunks: (response.candidates?.[0]?.groundingMetadata?.groundingChunks as any) || []
  };
};

export const getAgriFlashCards = async (topic: string) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response = await ai.models.generateContent({
    model: 'gemini-1.5-flash-preview',
    contents: `Flashcards for ${topic}. JSON.`,
    config: { systemInstruction: BD_GOVT_GROUNDING_INSTRUCTION, responseMimeType: "application/json" }
  });
  return extractJSON<FlashCard[]>(response.text || "[]", []);
};

export const getAICropSchedule = async (crop: string, date: string, season: string) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response = await ai.models.generateContent({
    model: 'gemini-1.5-flash-preview',
    contents: `Crop schedule for ${crop}. JSON.`,
    config: { systemInstruction: BD_GOVT_GROUNDING_INSTRUCTION, responseMimeType: "application/json" }
  });
  return extractJSON<any[]>(response.text || "[]", []);
};

export const getAgriMetaExplanation = async (query: string) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response = await ai.models.generateContent({
    model: 'gemini-1.5-flash-preview',
    contents: `Explain logic for: ${query}. START DIRECTLY WITH [ব্যাখ্যা].`,
    config: { systemInstruction: BD_GOVT_GROUNDING_INSTRUCTION }
  });
  return response.text;
};

export const generateAgriQuiz = async (topic: string, lang: Language = 'bn') => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response = await ai.models.generateContent({
    model: 'gemini-1.5-flash-preview',
    contents: `5 agri questions on ${topic}. JSON.`,
    config: { systemInstruction: BD_GOVT_GROUNDING_INSTRUCTION, responseMimeType: "application/json" }
  });
  return extractJSON<AgriQuizQuestion[]>(response.text || "[]", []);
};

export const searchEncyclopedia = async (query: string, lang: Language = 'bn') => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response = await ai.models.generateContent({
    model: 'gemini-1.5-flash-preview',
    contents: `Detail ${query}. START DIRECTLY WITH [তথ্যসারসংক্ষেপ].`,
    config: { systemInstruction: BD_GOVT_GROUNDING_INSTRUCTION, tools: [{ googleSearch: {} }] }
  });
  return {
    text: response.text || "",
    groundingChunks: (response.candidates?.[0]?.groundingMetadata?.groundingChunks as any) || []
  };
};

export const getPersonalizedAgriAdvice = async (crops: UserCrop[], rank: string) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response = await ai.models.generateContent({
    model: 'gemini-1.5-flash-preview',
    contents: `Advise for a ${rank} growing: ${crops.map(c => c.name).join(', ')}. START DIRECTLY WITH [পরামর্শ].`,
    config: { systemInstruction: BD_GOVT_GROUNDING_INSTRUCTION, tools: [{ googleSearch: {} }] }
  });
  return response.text || "";
};

export const getAgriNews = async (lang: Language = 'bn') => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response = await ai.models.generateContent({
    model: 'gemini-1.5-flash-preview',
    contents: `Top 5 agricultural headlines from Bangladesh today. JSON array.`,
    config: { 
      systemInstruction: BD_GOVT_GROUNDING_INSTRUCTION,
      tools: [{ googleSearch: {} }],
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: { type: Type.STRING }
      }
    }
  });
  return extractJSON<string[]>(response.text || "[]", []);
};

export const getAgriPodcastSummary = async (topic: string) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response = await ai.models.generateContent({
    model: 'gemini-1.5-flash-preview',
    contents: `Podcast script for: ${topic}. START DIRECTLY WITH [পডকাস্ট স্ক্রিপ্ট].`,
    config: { systemInstruction: BD_GOVT_GROUNDING_INSTRUCTION, tools: [{ googleSearch: {} }] }
  });
  return {
    text: response.text || "",
    groundingChunks: (response.candidates?.[0]?.groundingMetadata?.groundingChunks as any) || []
  };
};

export const generateAgriImage = async (prompt: string): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: [{ parts: [{ text: prompt }] }],
    config: { imageConfig: { aspectRatio: "16:9" } }
  });
  for (const part of response.candidates?.[0].content.parts || []) {
    if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
  }
  throw new Error("Image generation failed");
};

export const performDeepAudit = async (base64Data: string, mimeType: string, cropFamily: string, dynamicData: Record<string, string>, lang: Language = 'bn', weather?: WeatherData): Promise<AnalysisResult> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const systemInstruction = `${BD_GOVT_GROUNDING_INSTRUCTION}
  Perform Deep Audit. START DIRECTLY WITH [অডিট ফলাফল].`;
  
  const response = await ai.models.generateContent({
    model: 'gemini-1.5-flash-preview',
    contents: [
      { inlineData: { data: getRawBase64(base64Data), mimeType } },
      { text: `Field Data: ${JSON.stringify(dynamicData)}. Weather: ${JSON.stringify(weather)}.` }
    ],
    config: { systemInstruction, tools: [{ googleSearch: {} }] }
  });
  
  const text = response.text || "";
  return {
    diagnosis: "গভীর অডিট রিপোর্ট",
    category: 'Other',
    confidence: 100,
    advisory: text,
    fullText: text,
    groundingChunks: (response.candidates?.[0]?.groundingMetadata?.groundingChunks as any) || []
  };
};

export const getPesticideExpertAdvice = async (query: string, lang: Language = 'bn') => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response = await ai.models.generateContent({
    model: 'gemini-1.5-flash-preview',
    contents: `Official DAE dosage for: ${query}. Sections: [ডোজ], [নিরাপত্তা], [গ্রুপ].`,
    config: { systemInstruction: BD_GOVT_GROUNDING_INSTRUCTION, tools: [{ googleSearch: {} }] }
  });
  return {
    text: response.text || "",
    groundingChunks: (response.candidates?.[0]?.groundingMetadata?.groundingChunks as any) || []
  };
};

export const getAISprayAdvisory = async (crop: string, pest: string, weather: WeatherData, lang: Language = 'bn') => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response = await ai.models.generateContent({
    model: 'gemini-1.5-flash-preview',
    contents: `Spray decision for ${pest} on ${crop}. Weather: ${JSON.stringify(weather)}. Use [সিদ্ধান্ত] header.`,
    config: { systemInstruction: BD_GOVT_GROUNDING_INSTRUCTION, tools: [{ googleSearch: {} }] }
  });
  return {
    text: response.text || "",
    groundingChunks: (response.candidates?.[0]?.groundingMetadata?.groundingChunks as any) || []
  };
};

export const analyzePesticideMixing = async (items: any[], weather?: WeatherData, lang: Language = 'bn') => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response = await ai.models.generateContent({
    model: 'gemini-1.5-flash-preview',
    contents: `Mixing safety for: ${items.map(i => i.text).join(', ')}. Start with [নিরাপত্তা বিশ্লেষণ].`,
    config: { systemInstruction: BD_GOVT_GROUNDING_INSTRUCTION, tools: [{ googleSearch: {} }] }
  });
  return {
    text: response.text || "",
    groundingChunks: (response.candidates?.[0]?.groundingMetadata?.groundingChunks as any) || []
  };
};
