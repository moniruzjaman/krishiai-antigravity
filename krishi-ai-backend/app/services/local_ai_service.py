"""
Refined Local AI Service Implementation
Uses HF Image Classification Pipeline + LLM Reasoning (OpenAI/Gemini)
"""
import torch
from transformers import pipeline
from PIL import Image
import io
import logging
from typing import Dict, List, Optional, Any
import json
import os
from app.config import settings

logger = logging.getLogger(__name__)

class LocalAIService:
    """Service for local AI operations using modular HF + LLM stack"""
    
    _instance = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(LocalAIService, cls).__new__(cls)
            cls._instance._initialized = False
        return cls._instance

    def __init__(self):
        if self._initialized:
            return
            
        self.device = 0 if torch.cuda.is_available() else -1
        self.vision_model_id = "google/vit-base-patch16-224"
        
        # Initialize lazily
        self._classifier = None
        self._openai_client = None
        
        self.knowledge_base = self._load_local_knowledge()
        self._initialized = True
        logger.info(f"LocalAIService (Modular) initialized using device: {'GPU' if self.device == 0 else 'CPU'}")

    @property
    def classifier(self):
        """Lazy load HF image classifier"""
        if self._classifier is None:
            try:
                logger.info(f"Loading HF image classifier: {self.vision_model_id}...")
                self._classifier = pipeline(
                    "image-classification", 
                    model=self.vision_model_id,
                    device=self.device
                )
                logger.info("HF image classifier loaded.")
            except Exception as e:
                logger.error(f"Failed to load HF classifier: {e}")
                raise
        return self._classifier

    def _get_llm_reasoning(self, visual_labels: List[Dict[str, Any]], query: Optional[str] = None, lang: str = "bn", weather: Optional[Dict[str, Any]] = None) -> str:
        """Get grounded reasoning from an LLM (OpenAI or Gemini fallback)"""
        labels_str = ", ".join([f"{l['label']} ({round(l['score']*100)}%)" for l in visual_labels])
        weather_str = json.dumps(weather) if weather else "Not available"
        
        prompt = f"""Role: Senior Scientific Officer (Pathology/Entomology/CABI Plantwise Expert).
Task: Analyze these visual classification results for a crop specimen:
Visual Labels: {labels_str}
User Query: {query or "Identify health condition"}
Weather Context: {weather_str}

STRICT GROUNDING RULES:
1. Primary Sources: BARI, BRRI, DAE, BARC, and CABI Plantwise (PlantVillage).
2. Diagnostic Standards: Follow CABI Plantwise diagnostic protocols.
3. Provide management protocols in Agricultural standards of Bangladesh.

OUTPUT FORMAT:
- DIAGNOSIS: [Name]
- CATEGORY: [Pest/Disease/Deficiency]
- MANAGEMENT: [Step-by-step advisory]

Language Requirement: You MUST respond entirely in {'Bangla' if lang == 'bn' else 'English'}.
"""

        # Try OpenAI if API key exists
        if settings.OPENAI_API_KEY and "YOUR_OPENAI_API_KEY" not in settings.OPENAI_API_KEY:
            try:
                from openai import OpenAI
                if self._openai_client is None:
                    self._openai_client = OpenAI(api_key=settings.OPENAI_API_KEY)
                
                response = self._openai_client.chat.completions.create(
                    model="gpt-3.5-turbo",
                    messages=[{"role": "user", "content": prompt}],
                    max_tokens=1000
                )
                return response.choices[0].message.content
            except Exception as e:
                logger.warning(f"OpenAI reasoning failed, falling back to Gemini: {e}")

        # Fallback to Gemini (already configured in GeminiService)
        try:
            import google.generativeai as genai
            model = genai.GenerativeModel("gemini-1.5-flash")
            response = model.generate_content(prompt)
            return response.text
        except Exception as e:
            logger.error(f"LLM reasoning fallback failed: {e}")
            return f"Visual Analysis: Detected {labels_str}. Please consult a local DAE officer for full advisory."

    def _load_local_knowledge(self) -> Dict[str, Any]:
        """Simple local knowledge base for agricultural grounding"""
        return {
            "rice blast": {
                "diagnosis": "Rice Blast (ধানের ব্লাস্ট রোগ)",
                "category": "Disease",
                "source": "brri.gov.bd",
                "advisory": "Maintain water level. Apply Nativo 75WG or Trooper."
            },
            "nitrogen deficiency": {
                "diagnosis": "Nitrogen Deficiency (নাইট্রোজেনের অভাব)",
                "category": "Deficiency",
                "source": "barc.gov.bd",
                "advisory": "Apply Urea in 3 split doses as per BARC 2024 Guide."
            }
        }

    async def analyze_image(self, image_bytes: bytes, query: Optional[str] = None, lang: str = "bn", weather: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Modular analysis: HF Vision Pipeline -> LLM Reasoning -> Grounding"""
        try:
            # 1. Image Classification
            image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
            vision_results = self.classifier(image)
            
            # 2. LLM Reasoning (modular)
            reasoning_text = self._get_llm_reasoning(vision_results, query, lang, weather)
            
            # 3. Grounding & Formatting
            top_label = vision_results[0]['label']
            grounded_data = self._match_knowledge(top_label + " " + reasoning_text)
            
            return {
                "diagnosis": grounded_data.get("diagnosis", top_label.title()),
                "category": grounded_data.get("category", "Other"),
                "confidence": int(vision_results[0]['score'] * 100),
                "advisory": grounded_data.get("advisory", reasoning_text[:500] + "..."),
                "full_text": reasoning_text,
                "official_source": grounded_data.get("source", "Modular AI System (HF + LLM)"),
                "grounding_chunks": [
                    {
                        "source": "HF Vision",
                        "text": f"Detected {top_label} with {round(vision_results[0]['score']*100)}% accuracy."
                    }
                ]
            }
        except Exception as e:
            logger.error(f"Error in modular local analysis: {e}")
            return {
                "diagnosis": "Analysis Failed",
                "category": "Other",
                "confidence": 0,
                "advisory": f"Error: {str(e)}",
                "full_text": str(e),
                "official_source": "System Error"
            }

    def _match_knowledge(self, text: str) -> Dict[str, Any]:
        """Simple keyword matching for local grounding"""
        text = text.lower()
        for key, data in self.knowledge_base.items():
            if key in text:
                return data
        return {}

# Global instance
local_ai_service = LocalAIService()
