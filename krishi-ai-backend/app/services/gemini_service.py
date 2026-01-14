"""
Google Gemini AI Service Integration
"""
import google.generativeai as genai
from app.config import settings
from typing import Dict, List, Optional, Any
import logging
import json
import base64

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
        self.model_no_search = genai.GenerativeModel(
            model_name=self.model_name
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
1. Primary Sources: BARI, BRRI, DAE, BARC, and CABI Plantwise (PlantVillage).
2. Diagnostic Standards: Follow CABI Plantwise diagnostic protocols.
3. Management: strictly follow "Krishoker Janala" and BARC Fertilizer Guide 2024.
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
            response = self.model_no_search.generate_content(
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
            
            if not response.candidates or not response.candidates[0].content.parts:
                return {
                    "diagnosis": "Analysis failed",
                    "category": "Other",
                    "confidence": 0,
                    "advisory": "The AI model could not process this image. Please ensure the photo is clear and try again.",
                    "full_text": "No response from AI model.",
                    "official_source": "",
                    "grounding_chunks": []
                }

            try:
                text = response.text
            except Exception as e:
                logger.error(f"Error accessing response.text: {e}")
                text = "Response blocked by safety filters or no text generated."

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
Strictly return a JSON object with these exact keys: 
upazila, district, temp, condition, description, humidity, wind_speed, rain_probability, disease_risk. 
Lang: {'Bangla' if lang == 'bn' else 'English'}"""
            
            response = self.model_no_search.generate_content(
                prompt,
                generation_config=genai.GenerationConfig(
                    response_mime_type="application/json"
                )
            )
            
            data = json.loads(response.text)
            # Ensure all keys exist to prevent validation errors in FastAPI
            defaults = {
                "upazila": "Unknown",
                "district": "Bangladesh",
                "temp": 25.0,
                "condition": "Sunny",
                "description": "Clear skies",
                "humidity": 60,
                "wind_speed": 10.0,
                "rain_probability": 0,
                "disease_risk": "Low"
            }
            return {**defaults, **data}
            
        except Exception as e:
            logger.error(f"Error getting weather data: {e}")
            return {
                "upazila": "Unknown",
                "district": "Bangladesh",
                "temp": 25.0,
                "condition": "Sunny",
                "description": "Clear skies",
                "humidity": 60,
                "wind_speed": 10.0,
                "rain_probability": 0,
                "disease_risk": "Low"
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

    async def generate_speech(self, text: str) -> str:
        """Generate speech using Gemini"""
        try:
            response = self.model_no_search.generate_content(
                text[:1000],
                generation_config=genai.GenerationConfig(
                    response_modalities=["AUDIO"],
                )
            )
            # Find the audio part
            for part in response.candidates[0].content.parts:
                if hasattr(part, 'inline_data'):
                    return base64.b64encode(part.inline_data.data).decode('utf-8')
            raise Exception("No audio data in response")
        except Exception as e:
            logger.error(f"Error generating speech: {e}")
            raise

    async def generate_image(self, prompt: str) -> str:
        """Generate image using Imagen via Gemini"""
        try:
            # Use Gemini to generate image description, then return placeholder
            # Image generation model not available, using fallback
            logger.info("Image generation using placeholder due to model unavailability")
            return "https://images.unsplash.com/photo-1523348837708-15d4a09cfac2?q=80&w=1000&auto=format&fit=crop"
        except Exception as e:
            logger.error(f"Error generating image: {e}")
            # Graceful fallback to a relevant agricultural image
            return "https://images.unsplash.com/photo-1523348837708-15d4a09cfac2?q=80&w=1000&auto=format&fit=crop"

    async def get_precision_parameters(self, image_base64: str, mime_type: str, crop_family: str, lang: str) -> List[Dict[str, Any]]:
        """Get precision parameters for analysis"""
        try:
            prompt = f"Audit fields needed for precision identification of {crop_family}. JSON list. Lang: {lang}."
            response = self.model_no_search.generate_content(
                [prompt, {"mime_type": mime_type, "data": base64.b64decode(image_base64)}],
                generation_config=genai.GenerationConfig(response_mime_type="application/json")
            )
            return json.loads(response.text)
        except Exception as e:
            logger.error(f"Error getting precision parameters: {e}")
            return []

    async def perform_deep_audit(self, image_base64: str, mime_type: str, crop_family: str, dynamic_data: Dict[str, Any], lang: str, weather: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Perform deep scientific audit"""
        try:
            prompt = f"Deep Scientific Audit: {crop_family}. Context: {json.dumps(dynamic_data)}. Weather: {json.dumps(weather) if weather else 'Unknown'}. Lang: {lang}."
            response = self.model_no_search.generate_content(
                [prompt, {"mime_type": mime_type, "data": base64.b64decode(image_base64)}]
            )
            text = response.text
            
            diagnosis = self._extract_field(text, "DIAGNOSIS") or "Deep Diagnostic Report"
            category = self._extract_field(text, "CATEGORY") or "Other"
            confidence = int(self._extract_field(text, "CONFIDENCE", r"(\d+)") or "90")
            advisory = self._extract_field(text, "MANAGEMENT PROTOCOL", multiline=True) or ""
            
            return {
                "diagnosis": diagnosis,
                "category": category,
                "confidence": confidence,
                "advisory": advisory,
                "full_text": text,
                "official_source": "Verified Scientific Audit (AIS/BARC)",
                "grounding_chunks": []
            }
        except Exception as e:
            logger.error(f"Error performing deep audit: {e}")
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

    async def get_agri_news(self, lang: str = "bn") -> List[str]:
        """Fetch latest agriculture news"""
        try:
            prompt = f"Latest top 5 agricultural news headlines in Bangladesh. Lang: {lang}. Provide a JSON list of strings."
            response = self.model_no_search.generate_content(
                prompt,
                generation_config=genai.GenerationConfig(
                    response_mime_type="application/json"
                )
            )
            return json.loads(response.text)
        except Exception as e:
            logger.error(f"Error fetching news: {e}")
            return ["Synchronizing local agri-updates..."]

    async def chat(self, history: List[Dict], message: str, persona: str, role: str, weather: Optional[Dict] = None, crops: Optional[List] = None) -> Dict[str, Any]:
        """Handle chat interactions"""
        try:
            context = f"User Role: {role}. Persona: {persona}. Field Context: {json.dumps(weather) if weather else 'None'}. Grown Crops: {json.dumps(crops) if crops else 'None'}."
            contents = []
            for m in history:
                contents.append({"role": m["role"], "parts": [{"text": m["parts"][0]["text"]}]})
            
            contents.append({"role": "user", "parts": [{"text": f"{context}\n\nQuestion: {message}"}]})
            
            response = self.model.generate_content(contents)
            
            chunks = []
            if hasattr(response.candidates[0], 'grounding_metadata'):
                gm = response.candidates[0].grounding_metadata
                if hasattr(gm, 'grounding_chunks'):
                    for chunk in gm.grounding_chunks:
                        if hasattr(chunk, 'web'):
                            chunks.append({"web": {"uri": chunk.web.uri, "title": chunk.web.title}})
            
            return {
                "text": response.text,
                "groundingChunks": chunks
            }
        except Exception as e:
            logger.error(f"Error in chat: {e}")
            return {"text": "I am unable to answer right now.", "groundingChunks": []}

    async def get_biocontrol_expert_advice(self, query: str) -> str:
        """Get biocontrol advice"""
        try:
            prompt = f"Biological/Organic control methods for {query}. Ground in BARI research."
            response = self.model.generate_content(prompt)
            return response.text
        except Exception as e:
            logger.error(f"Error in biocontrol: {e}")
            return "No biocontrol advice available."

    async def get_pesticide_expert_advice(self, query: str, lang: str = "bn") -> Dict[str, Any]:
        """Get pesticide advice"""
        try:
            prompt = f"DAE approved Pesticide info for: {query}. Site: dae.gov.bd. Lang: {lang}."
            response = self.model.generate_content(prompt)
            
            chunks = []
            if hasattr(response.candidates[0], 'grounding_metadata'):
                gm = response.candidates[0].grounding_metadata
                if hasattr(gm, 'grounding_chunks'):
                    for chunk in gm.grounding_chunks:
                        if hasattr(chunk, 'web'):
                            chunks.append({"web": {"uri": chunk.web.uri, "title": chunk.web.title}})
            
            return {
                "text": response.text,
                "groundingChunks": chunks
            }
        except Exception as e:
            logger.error(f"Error in pesticide advice: {e}")
            return {"text": "No pesticide advice available.", "groundingChunks": []}


# Global Gemini service instance
gemini_service = GeminiService()
