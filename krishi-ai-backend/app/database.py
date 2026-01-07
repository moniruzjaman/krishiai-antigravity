"""
Supabase database client and utilities
"""
from supabase import create_client, Client
from app.config import settings
from typing import Dict, List, Optional, Any
import logging

logger = logging.getLogger(__name__)


class SupabaseClient:
    """Wrapper for Supabase client with common operations"""
    
    def __init__(self):
        self.client: Client = create_client(
            settings.SUPABASE_URL,
            settings.SUPABASE_KEY
        )
        self.service_client: Client = create_client(
            settings.SUPABASE_URL,
            settings.SUPABASE_SERVICE_KEY
        )
    
    # User Management
    async def create_user(self, user_data: Dict[str, Any]) -> Dict:
        """Create a new user in the database"""
        try:
            response = self.client.table("users").insert(user_data).execute()
            return response.data[0] if response.data else None
        except Exception as e:
            logger.error(f"Error creating user: {e}")
            raise
    
    async def get_user(self, user_id: str) -> Optional[Dict]:
        """Get user by ID"""
        try:
            response = self.client.table("users").select("*").eq("id", user_id).execute()
            return response.data[0] if response.data else None
        except Exception as e:
            logger.error(f"Error fetching user: {e}")
            return None
    
    async def update_user(self, user_id: str, updates: Dict[str, Any]) -> Dict:
        """Update user data"""
        try:
            response = self.client.table("users").update(updates).eq("id", user_id).execute()
            return response.data[0] if response.data else None
        except Exception as e:
            logger.error(f"Error updating user: {e}")
            raise
    
    # Crop Analysis Reports
    async def save_analysis_report(self, report_data: Dict[str, Any]) -> Dict:
        """Save crop analysis report"""
        try:
            response = self.client.table("analysis_reports").insert(report_data).execute()
            return response.data[0] if response.data else None
        except Exception as e:
            logger.error(f"Error saving analysis report: {e}")
            raise
    
    async def get_user_reports(self, user_id: str, limit: int = 50) -> List[Dict]:
        """Get all analysis reports for a user"""
        try:
            response = (
                self.client.table("analysis_reports")
                .select("*")
                .eq("user_id", user_id)
                .order("created_at", desc=True)
                .limit(limit)
                .execute()
            )
            return response.data if response.data else []
        except Exception as e:
            logger.error(f"Error fetching user reports: {e}")
            return []
    
    # User Progress & Gamification
    async def update_user_progress(self, user_id: str, progress_data: Dict[str, Any]) -> Dict:
        """Update user progress and XP"""
        try:
            response = (
                self.client.table("user_progress")
                .upsert({"user_id": user_id, **progress_data})
                .execute()
            )
            return response.data[0] if response.data else None
        except Exception as e:
            logger.error(f"Error updating user progress: {e}")
            raise
    
    async def get_user_progress(self, user_id: str) -> Optional[Dict]:
        """Get user progress data"""
        try:
            response = (
                self.client.table("user_progress")
                .select("*")
                .eq("user_id", user_id)
                .execute()
            )
            return response.data[0] if response.data else None
        except Exception as e:
            logger.error(f"Error fetching user progress: {e}")
            return None
    
    # Saved Reports
    async def save_user_report(self, user_id: str, report_data: Dict[str, Any]) -> Dict:
        """Save a report to user's saved collection"""
        try:
            data = {
                "user_id": user_id,
                **report_data
            }
            response = self.client.table("saved_reports").insert(data).execute()
            return response.data[0] if response.data else None
        except Exception as e:
            logger.error(f"Error saving report: {e}")
            raise
    
    async def get_saved_reports(self, user_id: str) -> List[Dict]:
        """Get all saved reports for a user"""
        try:
            response = (
                self.client.table("saved_reports")
                .select("*")
                .eq("user_id", user_id)
                .order("timestamp", desc=True)
                .execute()
            )
            return response.data if response.data else []
        except Exception as e:
            logger.error(f"Error fetching saved reports: {e}")
            return []
    
    async def delete_saved_report(self, report_id: str, user_id: str) -> bool:
        """Delete a saved report"""
        try:
            self.client.table("saved_reports").delete().eq("id", report_id).eq("user_id", user_id).execute()
            return True
        except Exception as e:
            logger.error(f"Error deleting report: {e}")
            return False
    
    # User Crops
    async def add_user_crop(self, user_id: str, crop_data: Dict[str, Any]) -> Dict:
        """Add a crop to user's farm"""
        try:
            data = {
                "user_id": user_id,
                **crop_data
            }
            response = self.client.table("user_crops").insert(data).execute()
            return response.data[0] if response.data else None
        except Exception as e:
            logger.error(f"Error adding user crop: {e}")
            raise
    
    async def get_user_crops(self, user_id: str) -> List[Dict]:
        """Get all crops for a user"""
        try:
            response = (
                self.client.table("user_crops")
                .select("*")
                .eq("user_id", user_id)
                .execute()
            )
            return response.data if response.data else []
        except Exception as e:
            logger.error(f"Error fetching user crops: {e}")
            return []
    
    async def update_user_crop(self, crop_id: str, updates: Dict[str, Any]) -> Dict:
        """Update crop data"""
        try:
            response = (
                self.client.table("user_crops")
                .update(updates)
                .eq("id", crop_id)
                .execute()
            )
            return response.data[0] if response.data else None
        except Exception as e:
            logger.error(f"Error updating crop: {e}")
            raise
    
    # Market Data
    async def get_market_prices(self, location: Optional[str] = None) -> List[Dict]:
        """Get current market prices"""
        try:
            query = self.client.table("market_prices").select("*")
            if location:
                query = query.eq("location", location)
            response = query.order("updated_at", desc=True).execute()
            return response.data if response.data else []
        except Exception as e:
            logger.error(f"Error fetching market prices: {e}")
            return []
    
    # Weather Data Cache
    async def cache_weather_data(self, location: str, weather_data: Dict[str, Any]) -> Dict:
        """Cache weather data for a location"""
        try:
            data = {
                "location": location,
                "data": weather_data,
                "cached_at": "now()"
            }
            response = (
                self.client.table("weather_cache")
                .upsert(data, on_conflict="location")
                .execute()
            )
            return response.data[0] if response.data else None
        except Exception as e:
            logger.error(f"Error caching weather data: {e}")
            raise
    
    async def get_cached_weather(self, location: str, max_age_minutes: int = 30) -> Optional[Dict]:
        """Get cached weather data if not expired"""
        try:
            response = (
                self.client.table("weather_cache")
                .select("*")
                .eq("location", location)
                .gte("cached_at", f"now() - interval '{max_age_minutes} minutes'")
                .execute()
            )
            return response.data[0] if response.data else None
        except Exception as e:
            logger.error(f"Error fetching cached weather: {e}")
            return None


# Global Supabase client instance
supabase_client = SupabaseClient()
