content = """SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your_supabase_anon_key_here
SUPABASE_SERVICE_KEY=your_supabase_service_key_here
GEMINI_API_KEY=your_gemini_api_key_here
HF_TOKEN=your_huggingface_token_here
APP_NAME=Krishi AI Backend
APP_VERSION=1.0.0
DEBUG=True
ENVIRONMENT=development
SECRET_KEY=your_secret_key_here
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:5174,http://localhost:5175
HOST=0.0.0.0
PORT=8000"""
with open(".env", "w", encoding="utf-8") as f:
    f.write(content)
