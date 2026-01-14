import { AnalysisResult, Language } from "../types";

export const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000/api/v1";

export const analyzeCropImageLocal = async (
    base64Data: string,
    mimeType: string,
    options?: {
        cropFamily?: string,
        query?: string,
        lang?: Language,
        weather?: any
    }
): Promise<AnalysisResult> => {
    try {
        const response = await fetch(`${BACKEND_URL}/analyze/local/crop`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                image_base64: base64Data,
                mime_type: mimeType,
                crop_family: options?.cropFamily,
                query: options?.query,
                lang: options?.lang,
                weather: options?.weather
            }),
        });

        if (!response.ok) {
            throw new Error(`Backend error: ${response.statusText}`);
        }

        return await response.json();
    } catch (error) {
        console.error("Local analysis error:", error);
        throw error;
    }
};

export const analyzeCropImageGemini = async (
    base64Data: string,
    mimeType: string,
    options?: {
        cropFamily?: string,
        query?: string,
        lang?: Language,
        weather?: any
    }
): Promise<AnalysisResult> => {
    try {
        const response = await fetch(`${BACKEND_URL}/analyze/crop`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                image_base64: base64Data,
                mime_type: mimeType,
                crop_family: options?.cropFamily,
                query: options?.query,
                lang: options?.lang,
                weather: options?.weather
            }),
        });

        if (!response.ok) {
            throw new Error(`Backend error: ${response.statusText}`);
        }

        return await response.json();
    } catch (error) {
        console.error("Gemini analysis error:", error);
        throw error;
    }
};

export const generateSpeech = async (text: string): Promise<string> => {
    const response = await fetch(`${BACKEND_URL}/ai/speech`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text })
    });
    if (!response.ok) throw new Error("Speech generation failed");
    const data = await response.json();
    return data.audio_base64;
};

export const generateImage = async (prompt: string): Promise<string> => {
    const response = await fetch(`${BACKEND_URL}/ai/image`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt })
    });
    if (!response.ok) throw new Error("Image generation failed");
    const data = await response.json();
    return data.image_url;
};

export const requestPrecisionParameters = async (image_base64: string, mime_type: string, crop_family: string, lang: Language) => {
    const response = await fetch(`${BACKEND_URL}/analyze/precision/parameters`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image_base64, mime_type, crop_family, lang })
    });
    if (!response.ok) throw new Error("Failed to get precision parameters");
    return await response.json();
};

export const performDeepAudit = async (image_base64: string, mime_type: string, crop_family: string, dynamic_data: any, lang: Language, weather?: any) => {
    const response = await fetch(`${BACKEND_URL}/analyze/deep`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image_base64, mime_type, crop_family, dynamic_data, lang, weather })
    });
    if (!response.ok) throw new Error("Deep audit failed");
    return await response.json();
};

export const searchInfo = async (query: string) => {
    const response = await fetch(`${BACKEND_URL}/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query })
    });
    if (!response.ok) throw new Error("Search failed");
    return await response.json();
};

