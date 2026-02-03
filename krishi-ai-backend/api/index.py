"""
Vercel Serverless Function Entry Point
This file serves as the entry point for Vercel serverless deployment
"""

import sys
import os

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Import the FastAPI app from the main module
from app.main import app

# Vercel handler - this is required for serverless deployment
# The app variable is used by Vercel's Python runtime
handler = app
