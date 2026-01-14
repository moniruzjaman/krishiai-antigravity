"""
Pydantic models for request/response validation
"""
from pydantic import BaseModel, Field, EmailStr
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum


# Enums
class CropCategory(str, Enum):
    VEGETABLES = "vegetables"
    GRAINS = "grains"
    FRUITS = "fruits"
    SPICES = "spices"


class AnalysisCategory(str, Enum):
    PEST = "Pest"
    DISEASE = "Disease"
    DEFICIENCY = "Deficiency"
    OTHER = "Other"


class UserRole(str, Enum):
    FARMER = "farmer"
    EXPERT = "expert"
    ADMIN = "admin"


# User Models
class UserCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    role: UserRole = UserRole.FARMER
    location: Optional[str] = None


class UserUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    location: Optional[str] = None
    my_crops: Optional[List[str]] = None


class UserResponse(BaseModel):
    id: str
    name: str
    email: Optional[str]
    phone: Optional[str]
    role: str
    location: Optional[str]
    my_crops: List[str]
    created_at: datetime
    
    class Config:
        from_attributes = True


# Crop Analysis Models
class CropAnalysisRequest(BaseModel):
    image_base64: str = Field(..., description="Base64 encoded image")
    mime_type: str = Field(default="image/jpeg")
    crop_family: Optional[str] = None
    query: Optional[str] = None
    lang: str = "bn"
    weather: Optional[Dict[str, Any]] = None
    user_id: Optional[str] = None


class AnalysisResult(BaseModel):
    diagnosis: str
    category: AnalysisCategory
    confidence: int = Field(..., ge=0, le=100)
    advisory: str
    full_text: str
    official_source: str
    grounding_chunks: List[Dict[str, Any]] = []


# Saved Report Models
class SavedReportCreate(BaseModel):
    type: str
    title: str
    content: str
    icon: str = "📄"
    audio_base64: Optional[str] = None


class SavedReportResponse(BaseModel):
    id: str
    user_id: str
    type: str
    title: str
    content: str
    icon: str
    audio_base64: Optional[str]
    timestamp: datetime
    
    class Config:
        from_attributes = True


# User Crop Models
class UserCropCreate(BaseModel):
    name: str
    variety: Optional[str] = None
    planted_date: Optional[str] = None
    expected_harvest: Optional[str] = None
    area: Optional[float] = None
    notes: Optional[str] = None


class UserCropResponse(BaseModel):
    id: str
    user_id: str
    name: str
    variety: Optional[str]
    planted_date: Optional[str]
    expected_harvest: Optional[str]
    area: Optional[float]
    notes: Optional[str]
    created_at: datetime
    
    class Config:
        from_attributes = True


# Weather Models
class WeatherRequest(BaseModel):
    lat: float = Field(..., ge=-90, le=90)
    lng: float = Field(..., ge=-180, le=180)
    lang: str = Field(default="bn")


class WeatherResponse(BaseModel):
    upazila: str
    district: str
    temp: float
    condition: str
    description: str
    humidity: int
    wind_speed: float
    rain_probability: int
    disease_risk: Optional[str] = None


# Market Data Models
class MarketPriceResponse(BaseModel):
    id: str
    name: str
    category: str
    retail: List[float]
    wholesale: List[float]
    unit: str
    trend: str
    change: str
    location: str
    updated_at: datetime
    
    class Config:
        from_attributes = True


# AI Query Models
class AIQueryRequest(BaseModel):
    query: str = Field(..., min_length=1, max_length=1000)
    user_id: Optional[str] = None
    context: Optional[Dict[str, Any]] = None


class AIQueryResponse(BaseModel):
    text: str
    grounding_chunks: List[Dict[str, Any]] = []


# Fertilizer Calculator Models
class FertilizerRequest(BaseModel):
    crop: str
    aez: str
    soil: str
    area_size: float
    unit: str = Field(default="bigha")
    lang: str = Field(default="bn")


# Soil Analysis Models
class SoilAnalysisRequest(BaseModel):
    ph: Optional[str] = None
    n: Optional[str] = None
    p: Optional[str] = None
    k: Optional[str] = None
    user_id: Optional[str] = None


# User Progress Models
class UserProgressUpdate(BaseModel):
    xp: Optional[int] = None
    level: Optional[int] = None
    rank: Optional[str] = None
    scans_count: Optional[int] = None
    achievements: Optional[List[str]] = None


class UserProgressResponse(BaseModel):
    user_id: str
    xp: int
    level: int
    rank: str
    scans_count: int
    achievements: List[str]
    updated_at: datetime
    
    class Config:
        from_attributes = True


# Generic Response Models
class SuccessResponse(BaseModel):
    success: bool = True
    message: str
    data: Optional[Any] = None


class ErrorResponse(BaseModel):
    success: bool = False
    error: str
    details: Optional[str] = None
