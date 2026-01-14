"""
API Routes for Krishi AI Backend
"""
from fastapi import APIRouter, HTTPException, UploadFile, File, Depends
from app.models import *
from app.database import supabase_client
from app.services.gemini_service import gemini_service
from app.services.local_ai_service import local_ai_service
from typing import List
import base64
import logging

logger = logging.getLogger(__name__)

router = APIRouter()


# Health Check
@router.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "Krishi AI Backend"}


# User Routes
@router.post("/users", response_model=UserResponse)
async def create_user(user: UserCreate):
    """Create a new user"""
    try:
        user_data = user.model_dump()
        user_data["my_crops"] = []
        result = await supabase_client.create_user(user_data)
        return result
    except Exception as e:
        logger.error(f"Error creating user: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/users/{user_id}", response_model=UserResponse)
async def get_user(user_id: str):
    """Get user by ID"""
    user = await supabase_client.get_user(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.put("/users/{user_id}", response_model=UserResponse)
async def update_user(user_id: str, updates: UserUpdate):
    """Update user data"""
    try:
        result = await supabase_client.update_user(user_id, updates.model_dump(exclude_unset=True))
        if not result:
            raise HTTPException(status_code=404, detail="User not found")
        return result
    except Exception as e:
        logger.error(f"Error updating user: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# Crop Analysis Routes
@router.post("/analyze/crop", response_model=AnalysisResult)
async def analyze_crop(request: CropAnalysisRequest):
    """Analyze crop image using Gemini AI"""
    try:
        logger.info(f"Analyzing crop image. Crop Family: {request.crop_family}, Query: {request.query}")
        image_data = base64.b64decode(request.image_base64)
        result = await gemini_service.analyze_crop_image(
            image_data=image_data,
            crop_family=request.crop_family,
            query=request.query,
            lang=request.lang
        )
        logger.info(f"Analysis complete: {result['diagnosis']}")
        
        if request.user_id:
            await supabase_client.save_analysis_report({
                "user_id": request.user_id,
                "diagnosis": result["diagnosis"],
                "category": result["category"],
                "advisory": result["advisory"]
            })
            
        return result
    except Exception as e:
        logger.error(f"Error in Gemini analysis: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/analyze/local/crop", response_model=AnalysisResult)
async def analyze_crop_local(request: CropAnalysisRequest):
    """Analyze crop image using Local Vision Model"""
    try:
        image_data = base64.b64decode(request.image_base64)
        result = await local_ai_service.analyze_image(
            image_bytes=image_data,
            query=request.query,
            lang=request.lang,
            weather=request.weather
        )
        return result
    except Exception as e:
        logger.error(f"Error in Local analysis: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/analyze/crop/upload")
async def analyze_crop_upload(
    file: UploadFile = File(...),
    crop_family: Optional[str] = None,
    query: Optional[str] = None,
    user_id: Optional[str] = None
):
    """Analyze crop image uploaded as file"""
    try:
        # Read file
        image_data = await file.read()
        
        # Analyze with Gemini
        result = await gemini_service.analyze_crop_image(
            image_data=image_data,
            crop_family=crop_family,
            query=query,
            lang="bn"
        )
        
        # Save to database if user_id provided
        if user_id:
            report_data = {
                "user_id": user_id,
                "type": "crop_analysis",
                "diagnosis": result["diagnosis"],
                "category": result["category"],
                "confidence": result["confidence"],
                "advisory": result["advisory"],
                "full_report": result["full_text"]
            }
            await supabase_client.save_analysis_report(report_data)
        
        return result
        
    except Exception as e:
        logger.error(f"Error analyzing crop upload: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# Fertilizer Calculator
@router.post("/fertilizer/calculate")
async def calculate_fertilizer(request: FertilizerRequest):
    """Calculate fertilizer recommendations"""
    try:
        result = await gemini_service.get_fertilizer_advice(
            crop=request.crop,
            aez=request.aez,
            soil=request.soil,
            area_size=request.area_size,
            unit=request.unit,
            lang=request.lang
        )
        return {"advice": result}
    except Exception as e:
        logger.error(f"Error calculating fertilizer: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# Soil Analysis
@router.post("/soil/analyze")
async def analyze_soil(request: SoilAnalysisRequest):
    """Analyze soil test results"""
    try:
        soil_data = request.model_dump(exclude_unset=True, exclude={"user_id"})
        result = await gemini_service.interpret_soil_report(soil_data)
        return {"advice": result}
    except Exception as e:
        logger.error(f"Error analyzing soil: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# Weather
@router.post("/weather", response_model=WeatherResponse)
async def get_weather(request: WeatherRequest):
    """Get agricultural weather data"""
    try:
        # Check cache first
        cache_key = f"{request.lat},{request.lng}"
        cached = await supabase_client.get_cached_weather(cache_key)
        
        if cached:
            return cached["data"]
        
        # Get fresh data
        result = await gemini_service.get_weather_data(
            lat=request.lat,
            lng=request.lng,
            lang=request.lang
        )
        
        # Cache it
        await supabase_client.cache_weather_data(cache_key, result)
        
        return result
    except Exception as e:
        logger.error(f"Error getting weather: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# AI Search
@router.post("/search", response_model=AIQueryResponse)
async def search_info(request: AIQueryRequest):
    """Search agricultural information"""
    try:
        result = await gemini_service.search_agricultural_info(request.query)
        return result
    except Exception as e:
        logger.error(f"Error searching info: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/ai/news")
async def get_news(request: Dict[str, str]):
    """Get agricultural news"""
    try:
        lang = request.get("lang", "bn")
        news = await gemini_service.get_agri_news(lang)
        return {"news": news}
    except Exception as e:
        logger.error(f"Error fetching news: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/ai/biocontrol")
async def get_biocontrol_advice(request: Dict[str, str]):
    """Get biocontrol expert advice"""
    try:
        query = request.get("query", "")
        advice = await gemini_service.get_biocontrol_expert_advice(query)
        return {"text": advice}
    except Exception as e:
        logger.error(f"Error fetching biocontrol advice: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/ai/pesticide/advice")
async def get_pesticide_advice(request: Dict[str, str]):
    """Get pesticide expert advice"""
    try:
        query = request.get("query", "")
        lang = request.get("lang", "bn")
        result = await gemini_service.get_pesticide_expert_advice(query, lang)
        return result
    except Exception as e:
        logger.error(f"Error fetching pesticide advice: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/chat")
async def chat(request: Dict[str, Any]):
    """Handle chat messages"""
    try:
        result = await gemini_service.chat(
            history=request.get("history", []),
            message=request.get("message", ""),
            persona=request.get("persona", "General"),
            role=request.get("role", "User"),
            weather=request.get("weather"),
            crops=request.get("crops")
        )
        return result
    except Exception as e:
        logger.error(f"Error in chat: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# Saved Reports
@router.post("/users/{user_id}/reports", response_model=SavedReportResponse)
async def save_report(user_id: str, report: SavedReportCreate):
    """Save a report to user's collection"""
    try:
        result = await supabase_client.save_user_report(user_id, report.model_dump())
        return result
    except Exception as e:
        logger.error(f"Error saving report: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/users/{user_id}/reports", response_model=List[SavedReportResponse])
async def get_saved_reports(user_id: str):
    """Get all saved reports for a user"""
    try:
        reports = await supabase_client.get_saved_reports(user_id)
        return reports
    except Exception as e:
        logger.error(f"Error fetching reports: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/users/{user_id}/reports/{report_id}")
async def delete_report(user_id: str, report_id: str):
    """Delete a saved report"""
    try:
        success = await supabase_client.delete_saved_report(report_id, user_id)
        if not success:
            raise HTTPException(status_code=404, detail="Report not found")
        return {"success": True, "message": "Report deleted"}
    except Exception as e:
        logger.error(f"Error deleting report: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# User Crops
@router.post("/users/{user_id}/crops", response_model=UserCropResponse)
async def add_user_crop(user_id: str, crop: UserCropCreate):
    """Add a crop to user's farm"""
    try:
        result = await supabase_client.add_user_crop(user_id, crop.model_dump())
        return result
    except Exception as e:
        logger.error(f"Error adding crop: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/users/{user_id}/crops", response_model=List[UserCropResponse])
async def get_user_crops(user_id: str):
    """Get all crops for a user"""
    try:
        crops = await supabase_client.get_user_crops(user_id)
        return crops
    except Exception as e:
        logger.error(f"Error fetching crops: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# User Progress
@router.get("/users/{user_id}/progress", response_model=UserProgressResponse)
async def get_user_progress(user_id: str):
    """Get user progress and gamification data"""
    try:
        progress = await supabase_client.get_user_progress(user_id)
        if not progress:
            # Create default progress
            default_progress = {
                "xp": 0,
                "level": 1,
                "rank": "Beginner",
                "scans_count": 0,
                "achievements": []
            }
            progress = await supabase_client.update_user_progress(user_id, default_progress)
        return progress
    except Exception as e:
        logger.error(f"Error fetching progress: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/users/{user_id}/progress", response_model=UserProgressResponse)
async def update_progress(user_id: str, updates: UserProgressUpdate):
    """Update user progress"""
    try:
        result = await supabase_client.update_user_progress(
            user_id, 
            updates.model_dump(exclude_unset=True)
        )
        return result
    except Exception as e:
        logger.error(f"Error updating progress: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# Market Prices
@router.get("/market/prices", response_model=List[MarketPriceResponse])
async def get_market_prices(location: Optional[str] = None):
    """Get current market prices"""
    try:
        prices = await supabase_client.get_market_prices(location)
        return prices
    except Exception as e:
        logger.error(f"Error fetching market prices: {e}")
        raise HTTPException(status_code=500, detail=str(e))
# Additional AI Services
@router.post("/ai/speech")
async def generate_speech(request: Dict[str, str]):
    """Generate speech from text"""
    try:
        text = request.get("text", "")
        audio_base64 = await gemini_service.generate_speech(text)
        return {"audio_base64": audio_base64}
    except Exception as e:
        logger.error(f"Error generating speech: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/ai/image")
async def generate_image(request: Dict[str, str]):
    """Generate image from prompt"""
    try:
        prompt = request.get("prompt", "")
        image_url = await gemini_service.generate_image(prompt)
        return {"image_url": image_url}
    except Exception as e:
        logger.error(f"Error generating image: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/analyze/precision/parameters")
async def get_precision_parameters(request: Dict[str, Any]):
    """Get parameters needed for deep audit"""
    try:
        result = await gemini_service.get_precision_parameters(
            image_base64=request.get("image_base64"),
            mime_type=request.get("mime_type"),
            crop_family=request.get("crop_family"),
            lang=request.get("lang", "bn")
        )
        return result
    except Exception as e:
        logger.error(f"Error getting precision parameters: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/analyze/deep")
async def perform_deep_audit(request: Dict[str, Any]):
    """Perform deep scientific audit"""
    try:
        result = await gemini_service.perform_deep_audit(
            image_base64=request.get("image_base64"),
            mime_type=request.get("mime_type"),
            crop_family=request.get("crop_family"),
            dynamic_data=request.get("dynamic_data"),
            lang=request.get("lang", "bn"),
            weather=request.get("weather")
        )
        return result
    except Exception as e:
        logger.error(f"Error performing deep audit: {e}")
        raise HTTPException(status_code=500, detail=str(e))
