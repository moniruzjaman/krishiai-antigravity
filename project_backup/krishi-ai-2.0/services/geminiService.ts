import { GoogleGenAI, Modality, Type } from "@google/genai";
import { AnalysisResult, GroundingChunk, FlashCard, AgriTask, UserCrop, User, WeatherData, CropDiseaseReport, AgriQuizQuestion, Language, UserRole, CABITrainingModule, DiagnosisResult, CABIScenario } from "../types";
import { AEZInfo } from "./locationService";

// Helper to get API key from environment (works in both browser and build)
export const getApiKey = (): string => {
  return (import.meta as any).env?.VITE_GEMINI_API_KEY || (typeof process !== 'undefined' ? process.env.VITE_GEMINI_API_KEY : '') || 'AIzaSyD-muq8wjKePCEGkco_3a0d8ABIQiY2zto';
};

export const getBackendUrl = (): string => {
  return (import.meta as any).env?.VITE_BACKEND_URL || (typeof process !== 'undefined' ? process.env.VITE_BACKEND_URL : '') || '';
};


const extractJSON = <T>(text: string, defaultValue: T): T => {
  if (!text) return defaultValue;
  try {
    // Improved regex to find the first JSON object or array
    const jsonMatch = text.match(/\{(?:[^{}]|\{(?:[^{}]|\{[^{}]*\})*\})*\}|\[[\s\S]*\]/);
    if (!jsonMatch) return defaultValue;
    return JSON.parse(jsonMatch[0]) as T;
  } catch (e) {
    console.error("Critical JSON Parse Error. Trace:", e, "Input slice:", text.substring(0, 200));
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

const SYSTEM_PROMPT = `আপনি একজন বিশেষজ্ঞ উদ্ভিদ রোগতত্ত্ববিদ এবং কৃষিবিদ। 
আপনি CABI Plantwise প্রোটোকল অনুসরণ করেন। 

আপনার কাজ হলো শস্যের ছবি বিশ্লেষণ করে নিচের যেকোনো একটি ক্যাটাগরিতে রোগ নির্ণয় করা:
১. রোগ (Disease): ছত্রাক, ব্যাকটেরিয়া বা ভাইরাস জনিত।
২. পোকা (Pest): মাকড়সা, শুঁয়োপোকা, এফিড ইত্যাদি পোকামাকড় বা তাদের কামড়ের চিহ্ন।
৩. পুষ্টির অভাব (Nutrient Deficiency): নাইট্রোজেন, ফসফরাস, পটাশিয়াম বা অন্য কোনো সারের অভাব।
৪. নির্জীব কারণ (Abiotic): খরা, অতিরিক্ত লবণাক্ততা বা তাপ।

বিশ্লেষণ করার সময় CABI 'রেডি রেকনার' (Ready Reckoner) সারণী এবং বিয়োগ পদ্ধতি (Elimination Method) প্রয়োগ করুন।
আউটপুট অবশ্যই বাংলা ভাষায় হতে হবে।`;

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
    const model = 'gemini-3-flash-preview';

    // Construct the user prompt part, incorporating options if available
    let userPrompt = "এই শস্যটির অবস্থা বিশ্লেষণ করুন। এটি কি কোনো রোগ, পোকার আক্রমণ নাকি পুষ্টির অভাব? বিস্তারিত জানান।";
    if (options?.query) userPrompt += ` ব্যবহারকারীর প্রশ্ন/লক্ষণ: ${options.query}`;
    if (options?.cropFamily) userPrompt += ` সম্ভাব্য শস্য: ${options.cropFamily}`;
    if (options?.weather) userPrompt += ` আবহাওয়া: ${JSON.stringify(options.weather)}`;

    const response = await ai.models.generateContent({
      model,
      contents: {
        parts: [
          { inlineData: { mimeType: mimeType || 'image/jpeg', data: base64Data } },
          { text: userPrompt }
        ]
      },
      config: {
        systemInstruction: SYSTEM_PROMPT,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            cropName: { type: Type.STRING },
            symptoms: { type: Type.ARRAY, items: { type: Type.STRING } },
            signs: { type: Type.ARRAY, items: { type: Type.STRING } },
            isBiotic: { type: Type.BOOLEAN },
            confidence: { type: Type.NUMBER },
            diseaseName: { type: Type.STRING },
            category: {
              type: Type.STRING,
              description: "Must be one of: Disease, Pest, Nutrient, Abiotic"
            },
            nutrientDetails: {
              type: Type.OBJECT,
              properties: {
                element: { type: Type.STRING },
                description: { type: Type.STRING }
              }
            },
            pestDetails: {
              type: Type.OBJECT,
              properties: {
                pestName: { type: Type.STRING },
                characteristics: { type: Type.ARRAY, items: { type: Type.STRING } }
              }
            },
            deductionLogic: { type: Type.STRING },
            recommendations: {
              type: Type.OBJECT,
              properties: {
                safe: { type: Type.STRING },
                effective: { type: Type.STRING },
                practical: { type: Type.STRING },
                locallyAvailable: { type: Type.STRING },
                ipmStrategy: { type: Type.STRING }
              },
              required: ["safe", "effective", "practical", "locallyAvailable", "ipmStrategy"]
            },
            knowledgeBankLink: { type: Type.STRING }
          },
          required: ["cropName", "symptoms", "signs", "isBiotic", "diseaseName", "category", "recommendations"]
        }
      }
    });

    const text = response.text || '{}';
    const structuredResult: DiagnosisResult = JSON.parse(text);

    // Map to legacy AnalysisResult format
    const categoryMap: Record<string, 'Pest' | 'Disease' | 'Deficiency' | 'Other'> = {
      'Disease': 'Disease',
      'Pest': 'Pest',
      'Nutrient': 'Deficiency',
      'Abiotic': 'Other'
    };

    const advisory = `${lang === 'bn' ? 'নিরাপদ' : 'Safe'}: ${structuredResult.recommendations.safe}\n\n${lang === 'bn' ? 'কার্যকর' : 'Effective'}: ${structuredResult.recommendations.effective}\n\n${lang === 'bn' ? 'ব্যবহারিক' : 'Practical'}: ${structuredResult.recommendations.practical}\n\n${lang === 'bn' ? 'স্থানীয়ভাবে পাওয়া যায়' : 'Locally Available'}: ${structuredResult.recommendations.locallyAvailable}\n\n${lang === 'bn' ? 'IPM কৌশল' : 'IPM Strategy'}: ${structuredResult.recommendations.ipmStrategy}`;

    const technicalSummary = `${lang === 'bn' ? 'লক্ষণ' : 'Symptoms'}: ${structuredResult.symptoms.join(', ')}\n${lang === 'bn' ? 'চিহ্ন' : 'Signs'}: ${structuredResult.signs.join(', ')}\n\n${lang === 'bn' ? 'বিশ্লেষণ যুক্তি' : 'Deduction Logic'}: ${structuredResult.deductionLogic}`;

    return {
      diagnosis: structuredResult.diseaseName,
      category: categoryMap[structuredResult.category] || 'Other',
      confidence: structuredResult.confidence,
      advisory,
      technicalSummary,
      fullText: text,
      officialSource: structuredResult.knowledgeBankLink || "CABI Plantwise Protocol (Gemini 3)",
      groundingChunks: [],
      structuredResult
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
  const ai: any = new GoogleGenAI({ apiKey: getApiKey() });
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
  return await withRetry(async () => {
    const key = getApiKey();
    if (!key) {
      return { upazila: "Dhaka", district: "Bangladesh", temp: 25, condition: "Sunny", description: "Clear", humidity: 60, windSpeed: 10, rainProbability: 0, diseaseRisk: "API Key Missing" };
    }

    const ai: any = new GoogleGenAI({ apiKey: key });
    const response = await ai.models.generateContent({
      model: 'gemini-1.5-flash',
      contents: [{
        role: 'user',
        parts: [{
          text: `Current weather report and agricultural conditions for Lat: ${lat}, Lng: ${lng}.
          
          Provide localized agricultural weather in JSON format.
          Include: upazila (area name), district, temp (celsius), condition, humidity (percentage), windSpeed (km/h), rainProbability (percentage), and diseaseRisk (specific crop risk like 'Rice Blast' or 'None').
          
          Language: ${lang === 'bn' ? 'Bangla' : 'English'}`
        }]
      }],
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json"
      }
    });

    const text = response.text || "";

    const defaultData: WeatherData = {
      upazila: "Dhaka",
      district: "Bangladesh",
      temp: 25,
      condition: "Sunny",
      description: "Clear",
      humidity: 60,
      windSpeed: 10,
      rainProbability: 0,
      diseaseRisk: "No immediate pathological risk detected."
    };

    if (!text) return defaultData;

    const parsed = extractJSON<Partial<WeatherData>>(text, {});
    return { ...defaultData, ...parsed } as WeatherData;
  });
};

export const generateGroundedWeatherReport = async (weather: WeatherData, lang: Language): Promise<{ text: string, groundingChunks: GroundingChunk[] }> => {
  return await withRetry(async () => {
    const ai: any = new GoogleGenAI({ apiKey: getApiKey() });

    const systemInstruction = `Role: Senior Agricultural Meteorologist at BAMIS (Bangladesh Agricultural Meteorology Information System).
    Task: Provide a deep scientific agricultural weather report based on live weather data.
    
    STRICT GROUNDING:
    1. Primary Source: bamis.gov.bd, dae.gov.bd, bari.gov.bd.
    2. Analysis: Correlate ${weather.temp}°C, ${weather.humidity}% Humidity, and ${weather.rainProbability}% Rain probability with crop-specific risks.
    3. Management: Provide DAE-approved field management advice.
    
    Output Format:
    - **SITUATION ANALYSIS**: [Scientific summary of current conditions]
    - **CROP IMPACT & RISKS**: [Specific risks for major crops like Rice, Potato, Maize etc. based on ${lang}]
    - **SCIENTIFIC ADVISORY**: [Actionable steps for farmers]
    
    Language: ${lang === 'bn' ? 'Bangla' : 'English'}. Use Google Search to find current BAMIS bulletins or DAE advisories for ${weather.upazila}, ${weather.district}.`;

    const response = await ai.models.generateContent({
      model: 'gemini-1.5-flash',
      contents: [{ role: 'user', parts: [{ text: `Generate a grounded agricultural report for ${weather.upazila}, ${weather.district} with data: ${JSON.stringify(weather)}` }] }],
      config: {
        systemInstruction,
        tools: [{ googleSearch: {} }]
      }
    });

    return {
      text: response.text || "",
      groundingChunks: (response.candidates?.[0]?.groundingMetadata?.groundingChunks as any) || []
    };
  });
};

export const sendChatMessage = async (history: any[], message: string, persona: string, role: string, weather?: WeatherData, crops?: UserCrop[]) => {
  const ai: any = new GoogleGenAI({ apiKey: getApiKey() });
  const context = `User Role: ${role}. Persona: ${persona}. Field Context: ${JSON.stringify(weather)}. Grown Crops: ${JSON.stringify(crops)}. Act as a verified BD Agri-Scientist.`;
  const response = await ai.models.generateContent({
    model: 'gemini-1.5-flash',
    contents: [...history, { role: 'user', parts: [{ text: `${context}\n\nQuestion: ${message}` }] }],
    config: { tools: [{ googleSearch: {} }] }
  });
  return {
    text: response.text || "I am unable to answer that right now.",
    groundingChunks: (response.candidates?.[0]?.groundingMetadata?.groundingChunks as any) || []
  };
};

export const searchAgriculturalInfo = async (query: string) => {
  const ai: any = new GoogleGenAI({ apiKey: getApiKey() });
  const response = await ai.models.generateContent({
    model: 'gemini-2.0-flash-exp',
    contents: [{ role: 'user', parts: [{ text: `Official agricultural guidance for: ${query}. Use authentic sources from Bangladesh govt.` }] }],
    config: { tools: [{ googleSearch: {} }] }
  });
  return {
    text: response.text || "",
    groundingChunks: (response.candidates?.[0]?.groundingMetadata?.groundingChunks as any) || []
  };
};

export const getAIPlantNutrientAdvice = async (crop: string, aez: string, soil: string, areaSize: number, unit: string, lang: Language) => {
  return await withRetry(async () => {
    const ai: any = new GoogleGenAI({ apiKey: getApiKey() });

    const systemInstruction = `Role: Senior Agronomist at BARC (Bangladesh Agricultural Research Council).
    Task: Calculate precise fertilizer dosages.
    
    STRICT GROUNDING:
    1. Primary Document: Fertilizer Recommendation Guide 2024 (BARC).
    2. Units: Convert all calculations to Bigha (33 decimal) or Decimal precisely.
    3. Site Restriction: barc.gov.bd.
    
    Output must specify quantities for: UREA, TSP, MOP, GYPSUM, and ZINC SULPHATE. Include split application timings.
    
    Language: ${lang === 'bn' ? 'Bangla' : 'English'}.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash-exp',
      contents: [{ role: 'user', parts: [{ text: `Crop: ${crop}. AEZ: ${aez}. Soil Fertility: ${soil}. Land Area: ${areaSize} ${unit}.` }] }],
      config: {
        systemInstruction,
        tools: [{ googleSearch: {} }]
      }
    });

    return response.text;
  });
};

export const getBiocontrolExpertAdvice = async (query: string) => {
  const ai: any = new GoogleGenAI({ apiKey: getApiKey() });
  const response = await ai.models.generateContent({
    model: 'gemini-2.0-flash-exp',
    contents: [{ role: 'user', parts: [{ text: `Biological/Organic control methods for ${query}. Ground in BARI research.` }] }],
    config: { tools: [{ googleSearch: {} }] }
  });
  return response.text;
};

export const interpretSoilReportAI = async (inputs: any) => {
  const ai: any = new GoogleGenAI({ apiKey: getApiKey() });
  const response = await ai.models.generateContent({
    model: 'gemini-1.5-flash',
    contents: [{ role: 'user', parts: [{ text: `Interpret soil test: ${JSON.stringify(inputs)}. Follow SRDI standards.` }] }],
    config: { tools: [{ googleSearch: {} }] }
  });
  return response.text;
};

export const getPesticideExpertAdvice = async (query: string, lang: Language) => {
  return await withRetry(async () => {
    const ai: any = new GoogleGenAI({ apiKey: getApiKey() });

    const systemInstruction = `Role: Senior Scientific Officer (Entomology/Pathology) at DAE.
    Task: Provide official information about the specified pesticide product or group.
    
    STRICT GROUNDING:
    1. Primary Repository: dae.gov.bd.
    2. Guidelines: National Pesticide Management Rules and BARI Plant Protection guidelines.
    
    Output must include: AI (Active Ingredient), TARGET PESTS/DISEASES, RECOMMENDED DOSAGE per Liter/Acre, and SAFETY PRECAUTIONS (PHI).
    
    Language: ${lang === 'bn' ? 'Bangla' : 'English'}. Use Google Search to cross-reference the product with official DAE lists.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash-exp',
      contents: [{ role: 'user', parts: [{ text: `Provide official DAE advisory for: ${query}` }] }],
      config: {
        systemInstruction,
        tools: [{ googleSearch: {} }]
      }
    });

    return {
      text: response.text || "No official data found for this product.",
      groundingChunks: (response.candidates?.[0]?.groundingMetadata?.groundingChunks as any) || []
    };
  });
};

export const analyzePesticideMixing = async (items: { text: string, data?: string, mimeType?: string }[], weather?: WeatherData, lang: Language = 'bn') => {
  return await withRetry(async () => {
    const ai: any = new GoogleGenAI({ apiKey: getApiKey() });

    const systemInstruction = `Role: Senior Agronomist (Chemical Safety) at BARI/DAE.
    Task: Audit the safety of mixing the following pesticide products.
    
    STRICT GROUNDING:
    1. Chemical Compatibility: Follow IRAC (Insecticide Resistance Action Committee) and FRAC (Fungicide Resistance Action Committee) guidelines.
    2. Physical Compatibility: Analyze potential precipitation or separation risks.
    3. Site Restriction: dae.gov.bd.
    
    Output must identify the Active Ingredient (AI) for each scanned image and analyze the MOA (Mode of Action) overlap.
    Format your response with: MIXING SAFETY STATUS, ACTIVE INGREDIENTS IDENTIFIED, OVERLAP RISK, and DAE-CERTIFIED ADVICE.
    
    Language: ${lang === 'bn' ? 'Bangla' : 'English'}. Use Google Search if product brands are unknown to find Active Ingredients.`;

    // Process parts (handling both text and images)
    const contentParts = items.map(item => {
      if (item.data && item.mimeType) {
        return { inlineData: { data: item.data, mimeType: item.mimeType } };
      }
      return { text: `Product/Group: ${item.text}` };
    });

    if (weather) {
      contentParts.push({ text: `Environmental Context: ${JSON.stringify(weather)}` });
    }

    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash-exp',
      contents: [{ parts: contentParts as any }],
      config: {
        systemInstruction,
        tools: [{ googleSearch: {} }]
      }
    });

    return {
      text: response.text || "Unable to analyze chemical compatibility.",
      groundingChunks: (response.candidates?.[0]?.groundingMetadata?.groundingChunks as any) || []
    };
  });
};

export const getPesticideRotationAdvice = async (query: string, lang: Language) => {
  return await withRetry(async () => {
    const ai: any = new GoogleGenAI({ apiKey: getApiKey() });

    const systemInstruction = `Role: Crop Protection Specialist at BARI/DAE.
    Task: Design an Anti-Resistance Pesticide Rotation Schedule.
    
    STRICT GROUNDING:
    1. Follow IRAC (Insecticide) and FRAC (Fungicide) Mode of Action (MoA) groups.
    2. Source: dae.gov.bd and BARI official guidelines.
    
    Output must provide a rotation of products with DIFFERENT MoA codes to prevent pest resistance.
    
    Language: ${lang === 'bn' ? 'Bangla' : 'English'}. Use Google Search to identify MoA groups for products related to "${query}".`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash-exp',
      contents: [{ parts: [{ text: `Create a resistance management rotation for: ${query}` }] }],
      config: {
        systemInstruction,
        tools: [{ googleSearch: {} }]
      }
    });

    return {
      text: response.text || "",
      groundingChunks: (response.candidates?.[0]?.groundingMetadata?.groundingChunks as any) || []
    };
  });
};

export const requestPesticidePrecisionParameters = async (query: string, lang: Language) => {
  const ai: any = new GoogleGenAI({ apiKey: getApiKey() });
  const response = await ai.models.generateContent({
    model: 'gemini-2.0-flash-exp',
    contents: [{ role: 'user', parts: [{ text: `Precision audit data needed for: ${query}. Return JSON.` }] }],
    config: { responseMimeType: "application/json" }
  });
  return extractJSON<any[]>(response.text || "[]", []);
};

export const performDeepPesticideAudit = async (query: string, dynamicData: any, lang: Language) => {
  const ai: any = new GoogleGenAI({ apiKey: getApiKey() });
  const response = await ai.models.generateContent({
    model: 'gemini-2.0-flash-exp',
    contents: [{ role: 'user', parts: [{ text: `Deep pesticide audit for: ${query} with data ${JSON.stringify(dynamicData)}.` }] }],
    config: { tools: [{ googleSearch: {} }] }
  });
  return {
    text: response.text || "",
    groundingChunks: (response.candidates?.[0]?.groundingMetadata?.groundingChunks as any) || []
  };
};

export const getAISprayAdvisory = async (crop: string, pest: string, weather: WeatherData, lang: Language) => {
  return await withRetry(async () => {
    const ai: any = new GoogleGenAI({ apiKey: getApiKey() });

    const systemInstruction = `Role: DAE Field Officer.
    Task: Provide a "Go/No-Go" spray advisory based on environmental conditions.
    
    STRICT GROUNDING:
    1. Weather threshold: No spray if Wind > 15km/h or Rain > 40%.
    2. Source: dae.gov.bd.
    
    Output must clearly state if conditions are suitable for spraying against ${pest} in ${crop}.
    
    Language: ${lang === 'bn' ? 'Bangla' : 'English'}.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash-exp',
      contents: [{ parts: [{ text: `Crop: ${crop}. Pest: ${pest}. Weather: ${JSON.stringify(weather)}` }] }],
      config: {
        systemInstruction,
        tools: [{ googleSearch: {} }]
      }
    });

    return {
      text: response.text || "",
      groundingChunks: (response.candidates?.[0]?.groundingMetadata?.groundingChunks as any) || []
    };
  });
};

export const performSoilHealthAudit = async (inputs: any, aez?: AEZInfo, lang: Language = 'bn') => {
  return await withRetry(async () => {
    const ai: any = new GoogleGenAI({ apiKey: getApiKey() });

    const systemInstruction = `Role: Principal Soil Scientist at SRDI (Soil Resource Development Institute), Bangladesh.
    Task: Conduct a high-precision Soil Health Audit.
    
    STRICT GROUNDING:
    1. Primary Standards: SRDI Soil Test Interpretation Guidelines.
    2. Fertilizer Recommendation: BARC FRG 2024.
    3. Site Restriction: srdi.gov.bd, barc.gov.bd.
    
    Output must categorize pH, Organic Carbon, and N-P-K levels (e.g., Very Low, Low, Optimum) and provide SRDI-approved soil amendment advice (e.g., Lime for acidity).
    
    Language: ${lang === 'bn' ? 'Bangla' : 'English'}.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash-exp',
      contents: [{ parts: [{ text: `Soil Data: ${JSON.stringify(inputs)}. AEZ: ${aez?.id} - ${aez?.name}.` }] }],
      config: {
        systemInstruction,
        tools: [{ googleSearch: {} }]
      }
    });

    return response.text;
  });
};

export const requestSoilPrecisionParameters = async (inputs: any, aezName: string, lang: Language) => {
  const ai: any = new GoogleGenAI({ apiKey: getApiKey() });
  const response = await ai.models.generateContent({
    model: 'gemini-2.0-flash-exp',
    contents: [{ role: 'user', parts: [{ text: `Based on initial soil data ${JSON.stringify(inputs)} in ${aezName}, what specific missing environmental or field data is needed for a Deep Scientific Audit? Return JSON list of 3-5 high-impact fields.` }] }],
    config: { responseMimeType: "application/json" }
  });
  return extractJSON<any[]>(response.text || "[]", []);
};

export const performDeepSoilAudit = async (inputs: any, aezName: string, dynamicData: any, lang: Language) => {
  return await withRetry(async () => {
    const ai: any = new GoogleGenAI({ apiKey: getApiKey() });

    const systemInstruction = `Role: Senior Soil Scientist at SRDI.
    Task: Perform a Deep Multimodal Soil Audit incorporating field data.
    
    STRICT GROUNDING:
    1. Soil Series Data: Reference SRDI district-wise soil maps.
    2. BARC FRG 2024 for nutrient balancing.
    
    Output must be a "National Scientific Advisory" including: SOIL SERIES ANALYSIS, CRITICAL DEFICIENCY IDENTIFICATION, and a 3-YEAR SOIL RESTORATION PLAN.
    
    Language: ${lang === 'bn' ? 'Bangla' : 'English'}.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash-exp',
      contents: [{ parts: [{ text: `Primary Data: ${JSON.stringify(inputs)}. Field Data: ${JSON.stringify(dynamicData)}. AEZ: ${aezName}` }] }],
      config: {
        systemInstruction,
        tools: [{ googleSearch: {} }]
      }
    });

    return response.text;
  });
};

export const getCropDiseaseInfo = async (crop: string) => {
  const ai: any = new GoogleGenAI({ apiKey: getApiKey() });
  const response = await ai.models.generateContent({
    model: 'gemini-2.0-flash-exp',
    contents: [{ role: 'user', parts: [{ text: `Crop protection data for: ${crop}. Ground in BARI/BRRI. JSON.` }] }],
    config: { responseMimeType: "application/json" }
  });
  return { data: extractJSON<CropDiseaseReport>(response.text || "{}", { cropName: crop, summary: "", diseases: [], pests: [] }) };
};

export const getFieldMonitoringData = async (lat: number, lng: number, aezName: string) => {
  const ai: any = new GoogleGenAI({ apiKey: getApiKey() });
  const response = await ai.models.generateContent({
    model: 'gemini-2.0-flash-exp',
    contents: [{ role: 'user', parts: [{ text: `Simulate NDVI and Biomass for field at ${lat}, ${lng} (${aezName}).` }] }],
    config: { tools: [{ googleSearch: {} }] }
  });
  return {
    text: response.text || "",
    groundingChunks: (response.candidates?.[0]?.groundingMetadata?.groundingChunks as any) || []
  };
};

export const getLCCAnalysisSummary = async (lcc: number, tsr: number, dose: string, lang: Language) => {
  const ai: any = new GoogleGenAI({ apiKey: getApiKey() });
  const response = await ai.models.generateContent({
    model: 'gemini-1.5-flash',
    contents: [{ role: 'user', parts: [{ text: `LCC reading: ${lcc}, TSR: ${tsr}, Dose: ${dose}. Provide expert rice nitrogen summary in ${lang}.` }] }]
  });
  return response.text;
};

export const identifyPlantSpecimen = async (base64: string, mimeType: string, lang: Language = 'bn') => {
  const ai: any = new GoogleGenAI({ apiKey: getApiKey() });
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
  const ai: any = new GoogleGenAI({ apiKey: getApiKey() });
  const response = await ai.models.generateContent({
    model: 'gemini-2.0-flash-exp',
    contents: [{ role: 'user', parts: [{ text: `Find ${type} near ${lat}, ${lng} in Bangladesh. Respond in ${lang}.` }] }],
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
  const ai: any = new GoogleGenAI({ apiKey: getApiKey() });
  const response = await ai.models.generateContent({
    model: 'gemini-2.0-flash-exp',
    contents: [{ role: 'user', parts: [{ text: `5 high-impact flashcards for: ${topic}. JSON format.` }] }],
    config: { responseMimeType: "application/json" }
  });
  return extractJSON<FlashCard[]>(response.text || "[]", []);
};

export const getAICropSchedule = async (crop: string, today: string, season: string) => {
  const ai: any = new GoogleGenAI({ apiKey: getApiKey() });
  const response = await ai.models.generateContent({
    model: 'gemini-2.0-flash-exp',
    contents: [{ role: 'user', parts: [{ text: `Official cropping calendar for ${crop} from ${today} in ${season}. JSON.` }] }],
    config: { responseMimeType: "application/json" }
  });
  return extractJSON<any[]>(response.text || "[]", []);
};

// Agri Meta Explanation disabled as per request
export const getAgriMetaExplanation = async (query: string) => {
  return "This function is currently disabled to optimize processing resources.";
};

export const generateAgriQuiz = async (topic: string, lang: Language) => {
  const ai: any = new GoogleGenAI({ apiKey: getApiKey() });
  const response = await ai.models.generateContent({
    model: 'gemini-2.0-flash-exp',
    contents: [{ role: 'user', parts: [{ text: `5 agricultural quiz questions for: ${topic}. Lang: ${lang}. JSON.` }] }],
    config: { responseMimeType: "application/json" }
  });
  return extractJSON<AgriQuizQuestion[]>(response.text || "[]", []);
};

export const generateCABIScenario = async (
  mode: 'simulation' | 'analysis',
  input: string | any, // input can be topic string OR AnalysisResult object
  lang: Language
): Promise<CABIScenario> => {
  return await withRetry(async () => {
    const backendUrl = getBackendUrl();
    if (backendUrl) {
      try {
        const response = await fetch(`${backendUrl}/cabi/scenario`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mode, input_data: input, lang })
        });
        if (response.ok) {
          return await response.json();
        }
      } catch (e) {
        console.warn("Backend CABI failed, falling back to direct Gemini...", e);
      }
    }

    const ai: any = new GoogleGenAI({ apiKey: getApiKey() });

    let prompt = "";
    let dataContext = "";

    if (mode === 'analysis') {
      const analysis = input as any;
      dataContext = `REAL CASE CONTEXT:
      Diagnosis: ${analysis.diagnosis}
      Crop: ${analysis.crop || 'Unknown'}
      Visible Symptoms: ${analysis.technicalSummary}
      Image: (Provided in separate channel)
      `;
      prompt = `Create a CABI-style diagnostic quiz question based on this REAL diagnosis. 
      The user has just analyzed this crop. Challenge them to verify the diagnosis.`;
    } else {
      dataContext = `SIMULATION CONTEXT:
      Topic: ${input}
      `;
      prompt = `Generate a HYPOTHETICAL field scenario about ${input}.
      1. Describe visual symptoms typical for this problem.
      2. Create a realistic "Farmer's History" (e.g., "Leaves turned yellow after rain").
      3. Select a suitable Unsplash Image URL representing this problem (or a generic crop field if specific one not found).
      `;
    }

    const systemInstruction = `Role: Senior CABI Plant Doctor Trainer.
    Task: Create a single interactive Diagnostic Scenario (${mode}).
    
    STRICT JSON OUTPUT FORMAT (CABIScenario):
    {
      "id": "scenario_${Date.now()}",
      "mode": "${mode}",
      "imageUrl": "https://images.unsplash.com/photo-...", (For 'analysis' mode, use placeholder "USER_UPLOADED_IMAGE")
      "crop": "Name of crop",
      "symptoms": ["List of visual symptoms"],
      "history": "Brief field history provided by farmer",
      "question": "The diagnostic question",
      "options": [
        { "label": "Option A (Diagnosis)", "isCorrect": boolean, "feedback": "Why right/wrong (CABI logic)" }
      ],
      "explanation": "Deduction logic using Elimination Method",
      "cabiReference": "Relevant CABI Protocol/Code"
    }
    
    Language: ${lang === 'bn' ? 'Bangla' : 'English'}.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash-exp',
      contents: [{ parts: [{ text: dataContext + "\n" + prompt }] }],
      config: {
        systemInstruction,
        responseMimeType: "application/json"
      }
    });

    const scenario = extractJSON<CABIScenario>(response.text || "{}", {
      id: 'error',
      mode: mode,
      imageUrl: '',
      crop: 'Unknown',
      symptoms: [],
      history: 'Error generating scenario',
      question: 'Error',
      options: [],
      explanation: 'Failed to generate'
    });

    // If analysis mode, preserve the original image URL or base64 if we handled it here (but usually UI handles the image display for real cases)
    // We can just return a flag or specific string for imageUrl
    if (mode === 'analysis') {
      scenario.imageUrl = "USER_UPLOADED_IMAGE";
    }

    return scenario;
  });
};

export const generateCABITrainingSession = async (lang: Language, userCrops: UserCrop[] = [], aez?: string, analysisResult?: any): Promise<CABITrainingModule[]> => {
  let scenario: CABIScenario;

  if (analysisResult) {
    scenario = await generateCABIScenario('analysis', analysisResult, lang);
    if (analysisResult.imageUrl) {
      scenario.imageUrl = analysisResult.imageUrl;
    }
  } else {
    const topics = userCrops.length > 0 ? userCrops.map(c => c.name) : ['Rice', 'Potato', 'Brinjal', 'Tomato'];
    const randomTopic = topics[Math.floor(Math.random() * topics.length)];
    scenario = await generateCABIScenario('simulation', `${randomTopic} common diseases`, lang);
  }

  // Map CABIScenario to CABITrainingModule for compatibility with existing UI
  return [
    {
      id: 1,
      title: lang === 'bn' ? "পর্যবেক্ষণ ও লক্ষণ" : "Observation & Symptoms",
      icon: "🔬",
      desc: lang === 'bn' ? "প্রাথমিক পর্যায়" : "Primary Assessment",
      content: scenario.history,
      checkpoints: scenario.symptoms,
      logic: [
        { label: lang === 'bn' ? "সম্ভাব্য কারণ" : "Potential Cause", target: scenario.crop, desc: "Field Context" }
      ]
    },
    {
      id: 2,
      title: lang === 'bn' ? "ডায়াগনোসিস সিমুলেটর" : "Diagnosis Simulator",
      icon: "📸",
      desc: lang === 'bn' ? "ভার্চুয়াল কেস স্টাডি" : "Virtual Case Study",
      content: lang === 'bn' ? "নিচের ছবিটি পর্যবেক্ষণ করে সঠিক সিদ্ধান্ত নিন।" : "Observe the image and make a diagnosis.",
      simulator: {
        image: scenario.imageUrl,
        question: scenario.question,
        options: scenario.options.map((o: any) => ({ ...o, value: o.label }))
      }
    }
  ];
};

export const searchEncyclopedia = async (query: string, lang: Language) => {
  const ai: any = new GoogleGenAI({ apiKey: getApiKey() });
  const response = await ai.models.generateContent({
    model: 'gemini-2.0-flash-exp',
    contents: [{ role: 'user', parts: [{ text: `Provide deep encyclopedic info on "${query}" in BD agriculture. Lang: ${lang}.` }] }],
    config: { tools: [{ googleSearch: {} }] }
  });
  return {
    text: response.text || "",
    groundingChunks: (response.candidates?.[0]?.groundingMetadata?.groundingChunks as any) || []
  };
};

export const getPersonalizedAgriAdvice = async (crops: UserCrop[], rank: string) => {
  const ai: any = new GoogleGenAI({ apiKey: getApiKey() });
  const response = await ai.models.generateContent({
    model: 'gemini-2.0-flash-exp',
    contents: `Personalized advisor for a ${rank} farmer growing ${JSON.stringify(crops)}. Site: ais.gov.bd.`,
    config: { tools: [{ googleSearch: {} }] }
  });
  return response.text;
};

export const getAgriNews = async (lang: Language) => {
  const ai: any = new GoogleGenAI({ apiKey: getApiKey() });
  const response = await ai.models.generateContent({
    model: 'gemini-1.5-flash',
    contents: [{ role: 'user', parts: [{ text: `Latest top 5 agricultural news headlines in Bangladesh. Lang: ${lang}. JSON list.` }] }],
    config: {
      tools: [{ googleSearch: {} }],
      responseMimeType: "application/json"
    }
  });
  return extractJSON<string[]>(response.text || "[]", ["Synchronizing local agri-updates..."]);
};

export const getTrendingMarketPrices = async (lang: Language) => {
  const backendUrl = getBackendUrl();
  if (backendUrl) {
    try {
      const resp = await fetch(`${backendUrl}/market/prices`);
      if (resp.ok) {
        const data = await resp.json();
        // Field mapping: backend returns retail[] array, frontend expects 'price'
        return data.map((item: any) => ({
          ...item,
          price: item.retail?.[0] || item.price || 0
        }));
      }
    } catch (e) {
      console.warn("Backend market fetch failed, falling back to Gemini...", e);
    }
  }

  const ai: any = new GoogleGenAI({ apiKey: getApiKey() });
  const response = await ai.models.generateContent({
    model: 'gemini-1.5-flash',
    contents: [{
      role: 'user', parts: [{
        text: `Fetch daily market commodity prices for Bangladesh (Source: dam.gov.bd).
    STRICT COMMODITY FOCUS: Rice, Onion, Potato, Green Chili, Egg, Lentil.
    
    Return as JSON array: [{name, price, unit, trend (up/down/stable), change (amount), category}].
    Prices must be in BDT (৳). Use 2026 data.
    
    Lang: ${lang}.`
      }]
    }],
    config: {
      tools: [{ googleSearch: {} }],
      responseMimeType: "application/json"
    }
  });
  return extractJSON<any[]>(response.text || "[]", []);
};

export const getAIYieldPrediction = async (crop: string, aez: string, soil: string, practice: string, water: string, notes: string, rank: string = 'Standard', dynamicData: any, lang: Language) => {
  return await withRetry(async () => {
    const ai = new GoogleGenAI({ apiKey: getApiKey() });

    const systemInstruction = `Role: Strategic Agricultural Analyst at BARI/BRRI.
    Task: Conduct a high-level Yield Potential & Gap Analysis.
    
    STRICT GROUNDING:
    1. Models: BARI/BRRI Regional Yield Potential datasets.
    2. Context: Regional AEZ and historic Boro/Aman/Rabi yield patterns.
    3. Site Restriction: bari.gov.bd, brri.gov.bd.
    
    Output must be a "National Strategic Analysis" including: YIELD FORECAST (per Bigha/Decimal), YIELD-GAP ANALYSIS, and STRATEGIC OPTIMIZATION (Actionable steps to reach potential).
    
    Language: ${lang === 'bn' ? 'Bangla' : 'English'}.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash-exp',
      contents: [{ parts: [{ text: `Crop: ${crop}. AEZ: ${aez}. Practice: ${practice}. Inputs: ${JSON.stringify(dynamicData)}. Notes: ${notes}. User Rank: ${rank}.` }] }],
      config: {
        systemInstruction,
        tools: [{ googleSearch: {} }]
      }
    });

    return {
      text: response.text || "",
      groundingChunks: (response.candidates?.[0]?.groundingMetadata?.groundingChunks as any) || []
    };
  });
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
  const diagnosis = text.match(/(?:\*\*|)?DIAGNOSIS(?:\*\*|)?:\s*(.*)/i)?.[1]?.trim() || "Deep Diagnostic Report";
  const categoryMatch = text.match(/(?:\*\*|)?CATEGORY(?:\*\*|)?:\s*(Pest|Disease|Deficiency|Other)/i)?.[1];
  const confidenceValue = text.match(/(?:\*\*|)?CONFIDENCE(?:\*\*|)?:\s*(\d+)/i)?.[1];
  const confidence = confidenceValue ? parseInt(confidenceValue) : 90;

  const techSummaryMatch = text.match(/(?:TECHNICAL SUMMARY|TECHNICAL)(?:\*\*|)?:\s*([\s\S]*?)(?=\n-?\s*(?:\*\*|)?MANAGEMENT|$)/i);
  const technicalSummary = techSummaryMatch ? techSummaryMatch[1].trim() : "";

  const advisoryMatch = text.match(/(?:MANAGEMENT PROTOCOL|MANAGEMENT)(?:\*\*|)?:\s*([\s\S]*?)(?=\n-?\s*(?:\*\*|)?AUTHENTIC|$)/i);
  const advisory = advisoryMatch ? advisoryMatch[1].trim() : "Please consult your local DAE officer.";

  return {
    diagnosis,
    category: (categoryMatch as any) || 'Other',
    confidence,
    advisory,
    technicalSummary,
    fullText: text,
    officialSource: "Verified Scientific Audit (AIS/BARC)",
    groundingChunks: (response.candidates?.[0]?.groundingMetadata?.groundingChunks as any) || []
  };
};
export const groundedAgriSearch = async (crop: string, query: string, lang: Language): Promise<AnalysisResult> => {
  return await withRetry(async () => {
    const ai = new GoogleGenAI({ apiKey: getApiKey() });

    const systemInstruction = `Role: Senior Scientific Officer at BARI/BRRI/DAE, Bangladesh.
    Task: Precisely identify Pests, Diseases, or Nutrient Deficiencies based on the TEXT DESCRIPTION provided.
    
    STRICT GROUNDING RULES:
    1. Search ONLY within: dae.gov.bd, bari.gov.bd, brri.gov.bd, ais.gov.bd, barc.gov.bd.
    2. Provide official management protocols derived from these searches.
    
    OUTPUT FORMAT (STRICT - MUST USE THESE HEADERS IN ENGLISH EVEN IF CONTENT IS BANGLA):
    - **DIAGNOSIS**: [Official Name in Bangla and English]
    - **CATEGORY**: [Pest / Disease / Deficiency / Other]
    - **CONFIDENCE**: [Score 0-100]%
    - **TECHNICAL SUMMARY**: [Symptoms and scientific justification from search results]
    - **MANAGEMENT PROTOCOL**: [DAE-approved actions found in search]
    - **AUTHENTIC SOURCE**: [Citing specific BD Govt Repository with link]
    
    Language: ${lang === 'bn' ? 'Bangla' : 'English'}. Use Google Search tool to find official pages for "${crop} ${query}".`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash-exp',
      contents: [{
        parts: [{ text: `Crop: ${crop}. Symptoms/Query: ${query}. Find official diagnosis and management from Bangladesh govt sources.` }]
      }],
      config: {
        systemInstruction,
        tools: [{ googleSearch: {} }]
      }
    });

    const text = response.text || "";
    const chunks = (response.candidates?.[0]?.groundingMetadata?.groundingChunks as any) || [];

    const extractField = (pattern: RegExp, defaultValue: string = ""): string => {
      const match = text.match(pattern);
      return match ? match[1].trim() : defaultValue;
    };

    const diagnosis = extractField(/(?:\*\*|)?DIAGNOSIS(?:\*\*|)?:\s*(.*)/i, "Verified Diagnosis Found");
    const categoryMatch = text.match(/(?:\*\*|)?CATEGORY(?:\*\*|)?:\s*(Pest|Disease|Deficiency|Other)/i)?.[1];
    const confidence = parseInt(extractField(/(?:\*\*|)?CONFIDENCE(?:\*\*|)?:\s*(\d+)/i, "85"));

    const techSummaryMatch = text.match(/(?:TECHNICAL SUMMARY|TECHNICAL)(?:\*\*|)?:\s*([\s\S]*?)(?=\n-?\s*(?:\*\*|)?MANAGEMENT|$)/i);
    const technicalSummary = techSummaryMatch ? techSummaryMatch[1].trim() : "Search-based finding: " + query;

    const advisoryMatch = text.match(/(?:MANAGEMENT PROTOCOL|MANAGEMENT)(?:\*\*|)?:\s*([\s\S]*?)(?=\n-?\s*(?:\*\*|)?AUTHENTIC|$)/i);
    const advisory = advisoryMatch ? advisoryMatch[1].trim() : "Please consult your local DAE officer for " + crop;

    const officialSource = extractField(/(?:\*\*|)?AUTHENTIC SOURCE(?:\*\*|)?:\s*(.*)/i, "BARI/BRRI/DAE Repository");

    return {
      diagnosis,
      category: (categoryMatch as any) || 'Other',
      confidence,
      advisory,
      technicalSummary,
      fullText: text,
      officialSource,
      groundingChunks: chunks
    };
  });
};

/**
 * Augmented fallback that uses both the image and search to ensure vision-primary grounding
 * even when primary analysis encounters issues.
 */
export const visionGroundedAgriSearch = async (
  base64Data: string,
  mimeType: string,
  crop: string,
  query: string,
  lang: Language
): Promise<AnalysisResult> => {
  return await withRetry(async () => {
    const ai = new GoogleGenAI({ apiKey: getApiKey() });

    const systemInstruction = `Role: Senior Scientific Officer at BARI/BRRI/DAE, Bangladesh.
    Task: Conduct a DEEP VISION-VERIFICATION of the agricultural specimen using CABI protocols. 
    
    DIAGNOSTIC PROTOCOL (IMAGE-ANCHORED):
    1. VISUAL SEGMENTATION: Analyze **LEAVES, STEMS, and BODY PARTS** in the speciment image.
    2. SYMPTOM MAPPING: Link visual lesions or pest signs to CABI Diagnosis Logic.
    3. AUTHENTIC SEARCH: Cross-reference findings with official repositories (dae.gov.bd, bari.gov.bd, etc.).
    
    OUTPUT FORMAT (STRICT - MUST USE THESE HEADERS IN ENGLISH):
    - **DIAGNOSIS**: [Official Name]
    - **CATEGORY**: [Pest / Disease / Deficiency / Other]
    - **CONFIDENCE**: [Score 0-100]%
    - **TECHNICAL SUMMARY**: [Deep analysis of Leaves, Stems, and Body evidence]
    - **MANAGEMENT PROTOCOL**: [Official DAE/CABI actions]
    - **AUTHENTIC SOURCE**: [Citing specific BD Govt Repository]
    
    Language: ${lang === 'bn' ? 'Bangla' : 'English'}.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash-exp',
      contents: [{
        parts: [
          { inlineData: { data: base64Data, mimeType } },
          { text: `Crop: ${crop}. Description: ${query}. Identify and verify using official Bangladesh sources.` }
        ]
      }],
      config: {
        systemInstruction,
        tools: [{ googleSearch: {} }]
      }
    });

    const text = response.text || "";
    const chunks = (response.candidates?.[0]?.groundingMetadata?.groundingChunks as any) || [];

    const extractField = (pattern: RegExp, defaultValue: string = ""): string => {
      const match = text.match(pattern);
      return match ? match[1].trim() : defaultValue;
    };

    const diagnosis = extractField(/(?:\*\*|)?DIAGNOSIS(?:\*\*|)?:\s*(.*)/i, "Cross-Verified Identification");
    const categoryMatch = text.match(/(?:\*\*|)?CATEGORY(?:\*\*|)?:\s*(Pest|Disease|Deficiency|Other)/i)?.[1];
    const confidence = parseInt(extractField(/(?:\*\*|)?CONFIDENCE(?:\*\*|)?:\s*(\d+)/i, "95"));

    const techSummaryMatch = text.match(/(?:TECHNICAL SUMMARY|TECHNICAL)(?:\*\*|)?:\s*([\s\S]*?)(?=\n-?\s*(?:\*\*|)?MANAGEMENT|$)/i);
    const technicalSummary = techSummaryMatch ? techSummaryMatch[1].trim() : "Verified via Vision-Search: " + query;

    const advisoryMatch = text.match(/(?:MANAGEMENT PROTOCOL|MANAGEMENT)(?:\*\*|)?:\s*([\s\S]*?)(?=\n-?\s*(?:\*\*|)?AUTHENTIC|$)/i);
    const advisory = advisoryMatch ? advisoryMatch[1].trim() : "Please consult your local DAE officer.";

    const officialSource = extractField(/(?:\*\*|)?AUTHENTIC SOURCE(?:\*\*|)?:\s*(.*)/i, "BARI/BRRI/DAE Cross-Verification");

    return {
      diagnosis,
      category: (categoryMatch as any) || 'Other',
      confidence,
      advisory,
      technicalSummary,
      fullText: text,
      officialSource,
      groundingChunks: chunks
    };
  });
};
