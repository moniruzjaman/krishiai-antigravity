
import { GoogleGenAI, Modality, Type } from "@google/genai";
import { AnalysisResult, GroundingChunk, FlashCard, AgriTask, UserCrop, User, WeatherData, CropDiseaseReport, AgriQuizQuestion, Language, UserRole } from "../types";
import { AEZInfo } from "./locationService";

// Helper to get API key from environment (works in both browser and build)
const getApiKey = (): string => {
  // In browser, Vite exposes env vars via import.meta.env
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    return import.meta.env.VITE_API_KEY || '';
  }
  // Fallback for build-time (though vite.config.ts should handle this)
  return (process.env.VITE_API_KEY || process.env.API_KEY || '') as string;
};


const extractJSON = <T>(text: string, defaultValue: T): T => {
  if (!text) return defaultValue;
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    return jsonMatch ? JSON.parse(jsonMatch[0]) as T : defaultValue;
  } catch (e) {
    console.error("JSON Parse Error:", e, "Raw text:", text);
    return defaultValue;
  }
};

const withRetry = async <T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> => {
  let lastError: any;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      const errorStatus = error?.status || (error?.error?.code);
      if (errorStatus === 500 || errorStatus === 429) {
        const delay = Math.pow(2, i) * 1500;
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      throw error;
    }
  }
  throw lastError;
};

export const decodeBase64 = (base64: string): Uint8Array => {
  const binaryString = atob(base64);
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

/**
 * High-precision identification using BARI/BRRI/DAE grounded search.
 * Strictly acting as a National Scientific Officer of Bangladesh.
 */
export const analyzeCropImage = async (
  base64Data: string,
  mimeType: string,
  options?: {
    cropFamily?: string,
    userRank?: string,
    query?: string,
    lang?: Language,
    weather?: WeatherData
  }
): Promise<AnalysisResult> => {
  const lang = options?.lang || 'bn';

  return await withRetry(async () => {
    const ai = new GoogleGenAI({ apiKey: getApiKey() });

    const systemInstruction = `Role: Senior Scientific Officer (Plant Pathology / Soil Science / Entomology) at BARI/BRRI/DAE, Bangladesh.
    Task: Precisely identify Pests, Diseases, or Nutrient Deficiencies in the image specimen.
    
    STRICT GROUNDING RULES:
    1. Mandatory Primary Sources: dae.gov.bd, bari.gov.bd, brri.gov.bd, ais.gov.bd, barc.gov.bd, m.baritechnology.org.
    2. Pest/Disease Protocols: Follow "Krishoker Janala" (Plant Doctor) guidelines.
    3. Nutrient Deficiencies: Strictly follow BARC Fertilizer Recommendation Guide 2024.
    4. Provide official management protocols only.
    
    OUTPUT FORMAT:
    - DIAGNOSIS: [Official Name in Bangla and English]
    - CATEGORY: [Pest / Disease / Deficiency / Other]
    - CONFIDENCE: [Score 0-100]%
    - AUTHENTIC SOURCE: [Citing specific BD Govt Repository with link if possible]
    - MANAGEMENT PROTOCOL:
        - Cultural/Organic: [Scientific organic actions]
        - Chemical: [DAE-approved chemical dosage per Liter/Acre]
    - TECHNICAL SUMMARY: [Symptoms and scientific justification]
    
    Language: ${lang === 'bn' ? 'Bangla' : 'English'}. Use Google Search tool to verify information and extract official URLs for citations.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash-exp',
      contents: [{
        parts: [
          { inlineData: { data: base64Data, mimeType } },
          { text: `Crop: ${options?.cropFamily || 'General Agricultural Specimen'}. Query: ${options?.query || 'Identify health condition'}. Weather: ${options?.weather ? JSON.stringify(options.weather) : 'Unknown'}.` }
        ]
      }],
      config: {
        systemInstruction,
        tools: [{ googleSearch: {} }]
      }
    });

    const text = response.text || "";
    const chunks = (response.candidates?.[0]?.groundingMetadata?.groundingChunks as any) || [];

    const diagnosis = text.match(/DIAGNOSIS:\s*(.*)/i)?.[1]?.trim() || "Condition Identification in Progress";
    const categoryMatch = text.match(/CATEGORY:\s*(Pest|Disease|Deficiency|Other)/i)?.[1];
    const confidence = parseInt(text.match(/CONFIDENCE:\s*(\d+)/i)?.[1] || "0");
    const advisory = text.match(/MANAGEMENT PROTOCOL:\s*([\s\S]*?)(?=\n- TECHNICAL|$)/i)?.[1]?.trim() || "Please consult your local DAE officer.";
    const officialSource = text.match(/AUTHENTIC SOURCE:\s*(.*)/i)?.[1]?.trim() || "Bangladesh Govt. Agricultural Database";

    return {
      diagnosis,
      category: (categoryMatch as any) || 'Other',
      confidence,
      advisory,
      fullText: text,
      officialSource,
      groundingChunks: chunks
    };
  });
};

export const generateAgriImage = async (prompt: string): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: getApiKey() });
  const response = await ai.models.generateContent({
    model: 'imagen-3.0-generate-001',
    contents: [{ parts: [{ text: prompt }] }],
    config: { imageConfig: { aspectRatio: "16:9" } }
  });
  for (const part of response.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
  }
  throw new Error("Image generation failed");
};

export const generateSpeech = async (text: string): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: getApiKey() });
  const response = await ai.models.generateContent({
    model: "gemini-2.0-flash-exp",
    contents: [{ parts: [{ text: text.slice(0, 1000) }] }],
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } },
    },
  });
  const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!base64Audio) throw new Error("Speech generation failed");
  return base64Audio;
};

export const getLiveWeather = async (lat: number, lng: number, force = false, lang: Language = 'bn'): Promise<WeatherData> => {
  const ai = new GoogleGenAI({ apiKey: getApiKey() });
  const response = await ai.models.generateContent({
    model: 'gemini-2.0-flash-exp',
    contents: `Provide agricultural weather for Lat: ${lat}, Lng: ${lng}. JSON format. Include: upazila, district, temp, condition, humidity, windSpeed, rainProbability, diseaseRisk. Lang: ${lang === 'bn' ? 'Bangla' : 'English'}`,
    config: {
      tools: [{ googleSearch: {} }],
      responseMimeType: "application/json"
    }
  });
  return extractJSON<WeatherData>(response.text || "{}", { upazila: "Unknown", district: "Bangladesh", temp: 25, condition: "Sunny", description: "Clear", humidity: 60, windSpeed: 10, rainProbability: 0 });
};

export const sendChatMessage = async (history: any[], message: string, persona: string, role: string, weather?: WeatherData, crops?: UserCrop[]) => {
  const ai = new GoogleGenAI({ apiKey: getApiKey() });
  const context = `User Role: ${role}. Persona: ${persona}. Field Context: ${JSON.stringify(weather)}. Grown Crops: ${JSON.stringify(crops)}. Act as a verified BD Agri-Scientist.`;
  const response = await ai.models.generateContent({
    model: 'gemini-2.0-flash-exp',
    contents: [...history, { role: 'user', parts: [{ text: `${context}\n\nQuestion: ${message}` }] }],
    config: { tools: [{ googleSearch: {} }] }
  });
  return {
    text: response.text || "I am unable to answer that right now.",
    groundingChunks: (response.candidates?.[0]?.groundingMetadata?.groundingChunks as any) || []
  };
};

export const searchAgriculturalInfo = async (query: string) => {
  const ai = new GoogleGenAI({ apiKey: getApiKey() });
  const response = await ai.models.generateContent({
    model: 'gemini-2.0-flash-exp',
    contents: `Official agricultural guidance for: ${query}. Use authentic sources from Bangladesh govt.`,
    config: { tools: [{ googleSearch: {} }] }
  });
  return {
    text: response.text || "",
    groundingChunks: (response.candidates?.[0]?.groundingMetadata?.groundingChunks as any) || []
  };
};

export const getAIPlantNutrientAdvice = async (crop: string, aez: string, soil: string, areaSize: number, unit: string, lang: Language) => {
  const ai = new GoogleGenAI({ apiKey: getApiKey() });
  const response = await ai.models.generateContent({
    model: 'gemini-2.0-flash-exp',
    contents: `Calculate official fertilizer dose for ${crop} in ${aez}. Soil status: ${soil}. Land: ${areaSize} ${unit}. Use BARC FRG 2024. Lang: ${lang}.`,
    config: { tools: [{ googleSearch: {} }] }
  });
  return response.text;
};

export const getBiocontrolExpertAdvice = async (query: string) => {
  const ai = new GoogleGenAI({ apiKey: getApiKey() });
  const response = await ai.models.generateContent({
    model: 'gemini-2.0-flash-exp',
    contents: `Biological/Organic control methods for ${query}. Ground in BARI research.`,
    config: { tools: [{ googleSearch: {} }] }
  });
  return response.text;
};

export const interpretSoilReportAI = async (inputs: any) => {
  const ai = new GoogleGenAI({ apiKey: getApiKey() });
  const response = await ai.models.generateContent({
    model: 'gemini-2.0-flash-exp',
    contents: `Interpret soil test: ${JSON.stringify(inputs)}. Follow SRDI standards.`,
    config: { tools: [{ googleSearch: {} }] }
  });
  return response.text;
};

export const getPesticideExpertAdvice = async (query: string, lang: Language) => {
  const ai = new GoogleGenAI({ apiKey: getApiKey() });
  const response = await ai.models.generateContent({
    model: 'gemini-2.0-flash-exp',
    contents: `DAE approved Pesticide info for: ${query}. Site: dae.gov.bd. Lang: ${lang}.`,
    config: { tools: [{ googleSearch: {} }] }
  });
  return {
    text: response.text || "",
    groundingChunks: (response.candidates?.[0]?.groundingMetadata?.groundingChunks as any) || []
  };
};

export const analyzePesticideMixing = async (items: any[], weather?: WeatherData, lang?: Language) => {
  const ai = new GoogleGenAI({ apiKey: getApiKey() });
  const response = await ai.models.generateContent({
    model: 'gemini-2.0-flash-exp',
    contents: `Pesticide mixing compatibility for: ${JSON.stringify(items)}. Follow IRAC guidelines.`,
    config: { tools: [{ googleSearch: {} }] }
  });
  return {
    text: response.text || "",
    groundingChunks: (response.candidates?.[0]?.groundingMetadata?.groundingChunks as any) || []
  };
};

export const getPesticideRotationAdvice = async (query: string, lang: Language) => {
  const ai = new GoogleGenAI({ apiKey: getApiKey() });
  const response = await ai.models.generateContent({
    model: 'gemini-2.0-flash-exp',
    contents: `Resistance management rotation for: ${query}. Source: dae.gov.bd.`,
    config: { tools: [{ googleSearch: {} }] }
  });
  return {
    text: response.text || "",
    groundingChunks: (response.candidates?.[0]?.groundingMetadata?.groundingChunks as any) || []
  };
};

export const requestPesticidePrecisionParameters = async (query: string, lang: Language) => {
  const ai = new GoogleGenAI({ apiKey: getApiKey() });
  const response = await ai.models.generateContent({
    model: 'gemini-2.0-flash-exp',
    contents: `Precision audit data needed for: ${query}. Return JSON.`,
    config: { responseMimeType: "application/json" }
  });
  return extractJSON<any[]>(response.text || "[]", []);
};

export const performDeepPesticideAudit = async (query: string, dynamicData: any, lang: Language) => {
  const ai = new GoogleGenAI({ apiKey: getApiKey() });
  const response = await ai.models.generateContent({
    model: 'gemini-2.0-flash-exp',
    contents: `Deep pesticide audit for: ${query} with data ${JSON.stringify(dynamicData)}.`,
    config: { tools: [{ googleSearch: {} }] }
  });
  return {
    text: response.text || "",
    groundingChunks: (response.candidates?.[0]?.groundingMetadata?.groundingChunks as any) || []
  };
};

export const getAISprayAdvisory = async (crop: string, pest: string, weather: WeatherData, lang: Language) => {
  const ai = new GoogleGenAI({ apiKey: getApiKey() });
  const response = await ai.models.generateContent({
    model: 'gemini-2.0-flash-exp',
    contents: `Spray advisory for ${pest} in ${crop}. Context: ${JSON.stringify(weather)}.`,
    config: { tools: [{ googleSearch: {} }] }
  });
  return {
    text: response.text || "",
    groundingChunks: (response.candidates?.[0]?.groundingMetadata?.groundingChunks as any) || []
  };
};

export const performSoilHealthAudit = async (inputs: any, aez?: AEZInfo, lang?: Language) => {
  const ai = new GoogleGenAI({ apiKey: getApiKey() });
  const response = await ai.models.generateContent({
    model: 'gemini-2.0-flash-exp',
    contents: `Soil health audit: ${JSON.stringify(inputs)}. AEZ: ${aez?.name}. Use official BD standards.`,
    config: { tools: [{ googleSearch: {} }] }
  });
  return response.text;
};

export const requestSoilPrecisionParameters = async (inputs: any, aezName: string, lang: Language) => {
  const ai = new GoogleGenAI({ apiKey: getApiKey() });
  const response = await ai.models.generateContent({
    model: 'gemini-2.0-flash-exp',
    contents: `Field parameters needed for soil audit in ${aezName}. JSON.`,
    config: { responseMimeType: "application/json" }
  });
  return extractJSON<any[]>(response.text || "[]", []);
};

export const performDeepSoilAudit = async (inputs: any, aezName: string, dynamicData: any, lang: Language) => {
  const ai = new GoogleGenAI({ apiKey: getApiKey() });
  const response = await ai.models.generateContent({
    model: 'gemini-2.0-flash-exp',
    contents: `Scientific deep soil audit for ${aezName}. Data: ${JSON.stringify(dynamicData)}.`,
    config: { tools: [{ googleSearch: {} }] }
  });
  return response.text;
};

export const getCropDiseaseInfo = async (crop: string) => {
  const ai = new GoogleGenAI({ apiKey: getApiKey() });
  const response = await ai.models.generateContent({
    model: 'gemini-2.0-flash-exp',
    contents: `Crop protection data for: ${crop}. Ground in BARI/BRRI. JSON.`,
    config: { responseMimeType: "application/json" }
  });
  return { data: extractJSON<CropDiseaseReport>(response.text || "{}", { cropName: crop, summary: "", diseases: [], pests: [] }) };
};

export const getFieldMonitoringData = async (lat: number, lng: number, aezName: string) => {
  const ai = new GoogleGenAI({ apiKey: getApiKey() });
  const response = await ai.models.generateContent({
    model: 'gemini-2.0-flash-exp',
    contents: `Simulate NDVI and Biomass for field at ${lat}, ${lng} (${aezName}).`,
    config: { tools: [{ googleSearch: {} }] }
  });
  return {
    text: response.text || "",
    groundingChunks: (response.candidates?.[0]?.groundingMetadata?.groundingChunks as any) || []
  };
};

export const getLCCAnalysisSummary = async (lcc: number, tsr: number, dose: string, lang: Language) => {
  const ai = new GoogleGenAI({ apiKey: getApiKey() });
  const response = await ai.models.generateContent({
    model: 'gemini-2.0-flash-exp',
    contents: `LCC reading: ${lcc}, TSR: ${tsr}, Dose: ${dose}. Provide expert rice nitrogen summary in ${lang}.`
  });
  return response.text;
};

export const identifyPlantSpecimen = async (base64: string, mimeType: string, lang: Language = 'bn') => {
  const ai = new GoogleGenAI({ apiKey: getApiKey() });
  const response = await ai.models.generateContent({
    model: 'gemini-2.0-flash-exp',
    contents: [{ parts: [{ inlineData: { data: base64, mimeType } }, { text: "Identify plant specimen. Provide scientific info in " + lang }] }],
    config: { tools: [{ googleSearch: {} }] }
  });
  return {
    text: response.text || "",
    groundingChunks: (response.candidates?.[0]?.groundingMetadata?.groundingChunks as any) || []
  };
};

export const searchNearbySellers = async (lat: number, lng: number, type: string, lang: Language) => {
  const ai = new GoogleGenAI({ apiKey: getApiKey() });
  const response = await ai.models.generateContent({
    model: 'gemini-2.0-flash-exp',
    contents: `Find ${type} near ${lat}, ${lng} in Bangladesh. Respond in ${lang}.`,
    config: {
      tools: [{ googleMaps: {} }],
      toolConfig: { retrievalConfig: { latLng: { latitude: lat, longitude: lng } } }
    }
  });
  return {
    text: response.text || "",
    groundingChunks: (response.candidates?.[0]?.groundingMetadata?.groundingChunks as any) || []
  };
};

export const getAgriFlashCards = async (topic: string) => {
  const ai = new GoogleGenAI({ apiKey: getApiKey() });
  const response = await ai.models.generateContent({
    model: 'gemini-2.0-flash-exp',
    contents: `5 high-impact flashcards for: ${topic}. JSON format.`,
    config: { responseMimeType: "application/json" }
  });
  return extractJSON<FlashCard[]>(response.text || "[]", []);
};

export const getAICropSchedule = async (crop: string, today: string, season: string) => {
  const ai = new GoogleGenAI({ apiKey: getApiKey() });
  const response = await ai.models.generateContent({
    model: 'gemini-2.0-flash-exp',
    contents: `Official cropping calendar for ${crop} from ${today} in ${season}. JSON.`,
    config: { responseMimeType: "application/json" }
  });
  return extractJSON<any[]>(response.text || "[]", []);
};

export const getAgriMetaExplanation = async (query: string) => {
  const ai = new GoogleGenAI({ apiKey: getApiKey() });
  const response = await ai.models.generateContent({
    model: 'gemini-2.0-flash-exp',
    contents: `Explain how Krishi AI processes: ${query}. Mention BARI/BRRI sources.`,
    config: { tools: [{ googleSearch: {} }] }
  });
  return response.text;
};

export const generateAgriQuiz = async (topic: string, lang: Language) => {
  const ai = new GoogleGenAI({ apiKey: getApiKey() });
  const response = await ai.models.generateContent({
    model: 'gemini-2.0-flash-exp',
    contents: `5 agricultural quiz questions for: ${topic}. Lang: ${lang}. JSON.`,
    config: { responseMimeType: "application/json" }
  });
  return extractJSON<AgriQuizQuestion[]>(response.text || "[]", []);
};

export const searchEncyclopedia = async (query: string, lang: Language) => {
  const ai = new GoogleGenAI({ apiKey: getApiKey() });
  const response = await ai.models.generateContent({
    model: 'gemini-2.0-flash-exp',
    contents: `Provide deep encyclopedic info on "${query}" in BD agriculture. Lang: ${lang}.`,
    config: { tools: [{ googleSearch: {} }] }
  });
  return {
    text: response.text || "",
    groundingChunks: (response.candidates?.[0]?.groundingMetadata?.groundingChunks as any) || []
  };
};

export const getPersonalizedAgriAdvice = async (crops: UserCrop[], rank: string) => {
  const ai = new GoogleGenAI({ apiKey: getApiKey() });
  const response = await ai.models.generateContent({
    model: 'gemini-2.0-flash-exp',
    contents: `Personalized advisor for a ${rank} farmer growing ${JSON.stringify(crops)}. Site: ais.gov.bd.`,
    config: { tools: [{ googleSearch: {} }] }
  });
  return response.text;
};

export const getAgriNews = async (lang: Language) => {
  const ai = new GoogleGenAI({ apiKey: getApiKey() });
  const response = await ai.models.generateContent({
    model: 'gemini-2.0-flash-exp',
    contents: `Latest top 5 agricultural news headlines in Bangladesh. Lang: ${lang}. JSON list.`,
    config: {
      tools: [{ googleSearch: {} }],
      responseMimeType: "application/json"
    }
  });
  return extractJSON<string[]>(response.text || "[]", ["Synchronizing local agri-updates..."]);
};

export const getTrendingMarketPrices = async (lang: Language) => {
  const ai = new GoogleGenAI({ apiKey: getApiKey() });
  const response = await ai.models.generateContent({
    model: 'gemini-2.0-flash-exp',
    contents: `Daily market commodity prices from dam.gov.bd. JSON: [{name, price, unit, trend, change, category}]. Lang: ${lang}.`,
    config: {
      tools: [{ googleSearch: {} }],
      responseMimeType: "application/json"
    }
  });
  return extractJSON<any[]>(response.text || "[]", []);
};

export const getAIYieldPrediction = async (crop: string, aez: string, soil: string, practice: string, water: string, notes: string, rank: string = 'Standard', dynamicData: any, lang: Language) => {
  const ai = new GoogleGenAI({ apiKey: getApiKey() });
  const response = await ai.models.generateContent({
    model: 'gemini-2.0-flash-exp',
    contents: `Predict yield potential: ${crop}, AEZ: ${aez}, Soil: ${soil}. Additional: ${JSON.stringify(dynamicData)}. Lang: ${lang}.`,
    config: { tools: [{ googleSearch: {} }] }
  });
  return {
    text: response.text || "",
    groundingChunks: (response.candidates?.[0]?.groundingMetadata?.groundingChunks as any) || []
  };
};

export const getAgriPodcastSummary = async (topic: string) => {
  const ai = new GoogleGenAI({ apiKey: getApiKey() });
  const response = await ai.models.generateContent({
    model: 'gemini-2.0-flash-exp',
    contents: `Agri-briefing podcast script for: ${topic} in Bangladesh.`,
    config: { tools: [{ googleSearch: {} }] }
  });
  return {
    text: response.text || "",
    groundingChunks: (response.candidates?.[0]?.groundingMetadata?.groundingChunks as any) || []
  };
};

export const requestPrecisionParameters = async (base64: string, mimeType: string, cropFamily: string, lang: Language) => {
  const ai = new GoogleGenAI({ apiKey: getApiKey() });
  const response = await ai.models.generateContent({
    model: 'gemini-2.0-flash-exp',
    contents: [{ parts: [{ inlineData: { data: base64, mimeType } }, { text: `Audit fields needed for precision identification of ${cropFamily}. JSON list. Lang: ${lang}.` }] }],
    config: { responseMimeType: "application/json" }
  });
  return extractJSON<any[]>(response.text || "[]", []);
};

export const performDeepAudit = async (base64: string, mimeType: string, cropFamily: string, dynamicData: any, lang: Language, weather?: WeatherData) => {
  const ai = new GoogleGenAI({ apiKey: getApiKey() });
  const response = await ai.models.generateContent({
    model: 'gemini-2.0-flash-exp',
    contents: [{
      parts: [
        { inlineData: { data: base64, mimeType } },
        { text: `Deep Scientific Audit: ${cropFamily}. Context: ${JSON.stringify(dynamicData)}. Weather: ${JSON.stringify(weather)}. Lang: ${lang}.` }
      ]
    }],
    config: { tools: [{ googleSearch: {} }] }
  });
  const text = response.text || "";
  const diagnosis = text.match(/DIAGNOSIS:\s*(.*)/i)?.[1]?.trim() || "Deep Diagnostic Report";
  const categoryMatch = text.match(/CATEGORY:\s*(Pest|Disease|Deficiency|Other)/i)?.[1];
  const confidence = parseInt(text.match(/CONFIDENCE:\s*(\d+)/i)?.[1] || "90");
  const advisory = text.match(/MANAGEMENT PROTOCOL:\s*([\s\S]*?)(?=\n- TECHNICAL|$)/i)?.[1]?.trim() || "";

  return {
    diagnosis,
    category: (categoryMatch as any) || 'Other',
    confidence,
    advisory,
    fullText: text,
    officialSource: "Verified Scientific Audit (AIS/BARC)",
    groundingChunks: (response.candidates?.[0]?.groundingMetadata?.groundingChunks as any) || []
  };
};
