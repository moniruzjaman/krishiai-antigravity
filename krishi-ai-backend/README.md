# Krishi AI Backend

Python FastAPI backend for Krishi AI agricultural intelligence platform with Supabase integration.

## Features

- 🌾 **Crop Disease Analysis** - AI-powered pest and disease identification
- 🧪 **Soil Analysis** - Interpret soil test results with recommendations
- ⚖️ **Fertilizer Calculator** - BARC-compliant fertilizer recommendations
- 🌤️ **Weather Integration** - Agricultural weather data with caching
- 📊 **Market Prices** - Real-time agricultural commodity prices
- 👤 **User Management** - Complete user profiles and progress tracking
- 🎮 **Gamification** - XP, levels, and achievements system
- 💾 **Report Management** - Save and retrieve analysis reports

## Tech Stack

- **Framework**: FastAPI
- **Database**: Supabase (PostgreSQL)
- **AI**: Google Gemini 2.0
- **Image Processing**: Pillow, OpenCV
- **Authentication**: Supabase Auth
- **Deployment**: Uvicorn

## Setup Instructions

### 1. Install Dependencies

```bash
cd krishi-ai-backend
python -m venv venv
venv\Scripts\activate  # On Windows
# source venv/bin/activate  # On Linux/Mac
pip install -r requirements.txt
```

### 2. Configure Environment

Edit `.env` file with your credentials:

```env
SUPABASE_URL=your_supabase_project_url
SUPABASE_KEY=your_supabase_anon_key
SUPABASE_SERVICE_KEY=your_supabase_service_role_key
GEMINI_API_KEY=your_gemini_api_key
HF_TOKEN=your_huggingface_token
SECRET_KEY=generate-a-secure-secret-key
```

### 3. Setup Supabase Database

1. Go to your Supabase project dashboard
2. Navigate to SQL Editor
3. Copy and paste the contents of `supabase_schema.sql`
4. Execute the SQL to create all tables and policies

### 4. Run the Server

```bash
# Development mode with auto-reload
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Or use Python directly
python -m app.main
```

The API will be available at:
- **API**: http://localhost:8000
- **Docs**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

## API Endpoints

### Health & Info
- `GET /` - Root endpoint with service info
- `GET /health` - Health check

### Users
- `POST /api/v1/users` - Create user
- `GET /api/v1/users/{user_id}` - Get user
- `PUT /api/v1/users/{user_id}` - Update user

### Crop Analysis
- `POST /api/v1/analyze/crop` - Analyze crop (base64)
- `POST /api/v1/analyze/crop/upload` - Analyze crop (file upload)

### Fertilizer
- `POST /api/v1/fertilizer/calculate` - Calculate fertilizer recommendations

### Soil
- `POST /api/v1/soil/analyze` - Analyze soil test results

### Weather
- `POST /api/v1/weather` - Get agricultural weather data

### Search
- `POST /api/v1/search` - Search agricultural information

### Reports
- `POST /api/v1/users/{user_id}/reports` - Save report
- `GET /api/v1/users/{user_id}/reports` - Get saved reports
- `DELETE /api/v1/users/{user_id}/reports/{report_id}` - Delete report

### User Crops
- `POST /api/v1/users/{user_id}/crops` - Add crop
- `GET /api/v1/users/{user_id}/crops` - Get user crops

### Progress
- `GET /api/v1/users/{user_id}/progress` - Get user progress
- `PUT /api/v1/users/{user_id}/progress` - Update progress

### Market
- `GET /api/v1/market/prices` - Get market prices

## Project Structure

```
krishi-ai-backend/
├── app/
│   ├── __init__.py
│   ├── main.py              # FastAPI application
│   ├── config.py            # Configuration management
│   ├── database.py          # Supabase client
│   ├── models.py            # Pydantic models
│   ├── routes.py            # API routes
│   └── services/
│       ├── __init__.py
│       └── gemini_service.py  # Gemini AI integration
├── .env                     # Environment variables
├── requirements.txt         # Python dependencies
├── supabase_schema.sql      # Database schema
└── README.md               # This file
```

## Database Schema

### Tables
- `users` - User profiles
- `user_progress` - Gamification data
- `analysis_reports` - Crop analysis history
- `saved_reports` - User-saved reports
- `user_crops` - User's farm crops
- `market_prices` - Commodity prices
- `weather_cache` - Weather data cache

## Security

- Row Level Security (RLS) enabled on all user tables
- Users can only access their own data
- Service role key used for admin operations
- CORS configured for frontend origins

## Development

### Running Tests
```bash
pytest
```

### Code Formatting
```bash
black app/
```

### Type Checking
```bash
mypy app/
```

## Deployment

### Docker (Recommended)
```bash
docker build -t krishi-ai-backend .
docker run -p 8000:8000 --env-file .env krishi-ai-backend
```

### Cloud Platforms
- **Heroku**: Push to GitHub and deploy using Procfile and runtime.txt
- **Railway**: Connect GitHub repo and deploy
- **Render**: Deploy as Web Service
- **Google Cloud Run**: Deploy containerized app
- **AWS Lambda**: Use Mangum adapter

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `SUPABASE_URL` | Supabase project URL | Yes |
| `SUPABASE_KEY` | Supabase anon key | Yes |
| `SUPABASE_SERVICE_KEY` | Supabase service role key | Yes |
| `GEMINI_API_KEY` | Google Gemini API key | Yes |
| `HF_TOKEN` | Hugging Face token | Yes |
| `SECRET_KEY` | JWT secret key | Yes |
| `ALLOWED_ORIGINS` | CORS allowed origins | No |
| `DEBUG` | Debug mode | No |
| `PORT` | Server port | No |

## License

MIT License - See LICENSE file for details

## Support

For issues and questions, please open an issue on GitHub.
