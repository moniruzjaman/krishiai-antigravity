"""
Google Gemini AI Service Integration
"""
import google.generativeai as genai
from app.config import settings
from typing import Dict, List, Optional, Any
import logging
import json

logger = logging.getLogger(__name__)

# Configure Gemini
genai.configure(api_key=settings.GEMINI_API_KEY)


class GeminiService:
    """Service for Google Gemini AI operations"""
    
    def __init__(self):
        self.model_name = "gemini-2.0-flash-exp"
        self.model = genai.GenerativeModel(
            model_name=self.model_name,
            tools=[{"google_search_retrieval": {}}]
        )
    
    async def analyze_crop_image(
        self,
        image_data: bytes,
        crop_family: Optional[str] = None,
        query: Optional[str] = None,
        lang: str = "bn"
    ) -> Dict[str, Any]:
        """
        Analyze crop image for pests, diseases, or deficiencies
        """
        try:
            system_instruction = f"""Role: Senior Scientific Officer (Plant Pathology / Soil Science / Entomology) at BARI/BRRI/DAE, Bangladesh.
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

Language: {'Bangla' if lang == 'bn' else 'English'}. Use Google Search tool to verify information and extract official URLs for citations."""

            # Create prompt
            prompt = f"Crop: {crop_family or 'General Agricultural Specimen'}. Query: {query or 'Identify health condition'}."
            
            # Generate content with image
            response = self.model.generate_content(
                [prompt, {"mime_type": "image/jpeg", "data": image_data}],
                generation_config=genai.GenerationConfig(
                    temperature=0.4,
                    top_p=0.95,
                    top_k=40,
                    max_output_tokens=2048,
                ),
                safety_settings=[
                    {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_NONE"},
                    {"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_NONE"},
                    {"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_NONE"},
                    {"category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_NONE"},
                ]
            )
            
            text = response.text
            chunks = []
            if hasattr(response.candidates[0], 'grounding_metadata'):
                # Extract grounding chunks if available
                gm = response.candidates[0].grounding_metadata
                if hasattr(gm, 'grounding_chunks'):
                    for chunk in gm.grounding_chunks:
                        if hasattr(chunk, 'web'):
                            chunks.append({
                                "web": {
                                    "uri": chunk.web.uri,
                                    "title": chunk.web.title
                                }
                            })

            # Parse response
            diagnosis = self._extract_field(text, "DIAGNOSIS") or "Condition Identification in Progress"
            category = self._extract_field(text, "CATEGORY") or "Other"
            confidence = int(self._extract_field(text, "CONFIDENCE", r"(\d+)") or "0")
            advisory = self._extract_field(text, "MANAGEMENT PROTOCOL", multiline=True) or "Please consult your local DAE officer."
            official_source = self._extract_field(text, "AUTHENTIC SOURCE") or "Bangladesh Govt. Agricultural Database"
            
            return {
                "diagnosis": diagnosis,
                "category": category,
                "confidence": confidence,
                "advisory": advisory,
                "full_text": text,
                "official_source": official_source,
                "grounding_chunks": chunks
            }
            
        except Exception as e:
            logger.error(f"Error analyzing crop image: {e}")
            raise
    
    async def get_fertilizer_advice(
        self,
        crop: str,
        aez: str,
        soil: str,
        area_size: float,
        unit: str,
        lang: str = "bn"
    ) -> str:
        """Get AI-powered fertilizer recommendations"""
        try:
            prompt = f"""Calculate official fertilizer dose for {crop} in {aez}. 
Soil status: {soil}. 
Land: {area_size} {unit}. 
Use BARC FRG 2024 standards.
Language: {lang}.
Provide specific dosages for Urea, TSP, MOP, and other fertilizers."""
            
            response = self.model.generate_content(prompt)
            return response.text
            
        except Exception as e:
            logger.error(f"Error getting fertilizer advice: {e}")
            raise
    
    async def interpret_soil_report(self, soil_data: Dict[str, Any]) -> str:
        """Interpret soil test results"""
        try:
            prompt = f"""Interpret soil test results: {json.dumps(soil_data)}. 
Follow SRDI (Soil Resource Development Institute) standards.
Provide recommendations for soil improvement."""
            
            response = self.model.generate_content(prompt)
            return response.text
            
        except Exception as e:
            logger.error(f"Error interpreting soil report: {e}")
            raise
    
    async def get_weather_data(self, lat: float, lng: float, lang: str = "bn") -> Dict[str, Any]:
        """Get agricultural weather data"""
        try:
            prompt = f"""Provide agricultural weather for Lat: {lat}, Lng: {lng}. 
JSON format. Include: upazila, district, temp, condition, humidity, windSpeed, rainProbability, diseaseRisk. 
Lang: {'Bangla' if lang == 'bn' else 'English'}"""
            
            response = self.model.generate_content(
                prompt,
                generation_config=genai.GenerationConfig(
                    response_mime_type="application/json"
                )
            )
            
            return json.loads(response.text)
            
        except Exception as e:
            logger.error(f"Error getting weather data: {e}")
            # Return default data
            return {
                "upazila": "Unknown",
                "district": "Bangladesh",
                "temp": 25,
                "condition": "Sunny",
                "description": "Clear",
                "humidity": 60,
                "windSpeed": 10,
                "rainProbability": 0
            }
    
    async def search_agricultural_info(self, query: str) -> Dict[str, Any]:
        """Search for agricultural information"""
        try:
            prompt = f"Official agricultural guidance for: {query}. Use authentic sources from Bangladesh govt."
            
            response = self.model.generate_content(prompt)
            
            return {
                "text": response.text,
                "grounding_chunks": []
            }
            
        except Exception as e:
            logger.error(f"Error searching agricultural info: {e}")
            raise
    
    def _extract_field(self, text: str, field_name: str, pattern: Optional[str] = None, multiline: bool = False) -> Optional[str]:
        """Extract field from formatted text"""
        import re
        
        if multiline:
            match = re.search(rf"{field_name}:\s*([\s\S]*?)(?=\n- [A-Z]|$)", text, re.IGNORECASE)
        elif pattern:
            match = re.search(rf"{field_name}:\s*{pattern}", text, re.IGNORECASE)
        else:
            match = re.search(rf"{field_name}:\s*(.*)", text, re.IGNORECASE)
        
        return match.group(1).strip() if match else None


# Global Gemini service instance
gemini_service = GeminiService()
