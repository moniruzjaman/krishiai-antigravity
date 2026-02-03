# Krishi AI - Vercel Deployment Guide

## 📋 Prerequisites

1. **Vercel Account**: Create an account at [vercel.com](https://vercel.com)
2. **Vercel CLI**: Already installed ✅
3. **Environment Variables**: Prepare all API keys and credentials

## 🚀 Deployment Process

### Step 1: Authenticate with Vercel

```powershell
vercel login
```

- Visit the provided URL
- Authorize the CLI
- Press ENTER to continue

### Step 2: Deploy Backend

#### Option A: Using the Script (Recommended)

```powershell
.\deploy_backend.ps1
```

#### Option B: Manual Deployment

1. Navigate to backend directory:

   ```powershell
   cd krishi-ai-backend
   ```

2. Set environment variables in Vercel Dashboard:
   - Go to [vercel.com/dashboard](https://vercel.com/dashboard)
   - Create a new project or select existing
   - Go to Settings → Environment Variables
   - Add the following:

   ```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your_supabase_anon_key_here
SUPABASE_SERVICE_KEY=your_supabase_service_key_here
GEMINI_API_KEY=your_gemini_api_key_here
HF_TOKEN=your_huggingface_token_here
OPENAI_API_KEY=your_openai_api_key_here
   SECRET_KEY=<GENERATE_NEW_SECRET_KEY>
   DEBUG=False
   ENVIRONMENT=production
   ALLOWED_ORIGINS=https://your-frontend-url.vercel.app
   ```

3. Deploy:

   ```powershell
   vercel --prod
   ```

4. **Copy the deployment URL** (e.g., `https://krishi-ai-backend.vercel.app`)

### Step 3: Deploy Frontend

#### Option A: Using the Script (Recommended)

```powershell
.\deploy_frontend.ps1
```

When prompted, enter the backend URL from Step 2.

#### Option B: Manual Deployment

1. Navigate to frontend directory:

   ```powershell
   cd krishi-ai-2.0
   ```

2. Set environment variables in Vercel Dashboard:

   ```
VITE_API_KEY=your_gemini_api_key_here
VITE_HF_TOKEN=your_huggingface_token_here
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_KEY=your_supabase_anon_key_here
VITE_GEMINI_API_KEY=your_gemini_api_key_here
VITE_OPENAI_API_KEY=your_openai_api_key_here
   VITE_BACKEND_URL=<YOUR_BACKEND_URL_FROM_STEP_2>
   ```

3. Deploy:

   ```powershell
   vercel --prod
   ```

4. **Copy the frontend deployment URL**

### Step 4: Update Backend CORS

1. Go to your backend project in Vercel Dashboard
2. Navigate to Settings → Environment Variables
3. Update `ALLOWED_ORIGINS` with your frontend URL:

   ```
   ALLOWED_ORIGINS=https://your-frontend-url.vercel.app,https://www.your-domain.com
   ```

4. Redeploy the backend:

   ```powershell
   cd krishi-ai-backend
   vercel --prod
   ```

## 🔒 Security Recommendations

### For Production

1. **Generate a new SECRET_KEY** for the backend:

   ```python
   import secrets
   print(secrets.token_urlsafe(32))
   ```

2. **Rotate API Keys**: Consider creating production-specific API keys

3. **Enable Vercel Authentication**: Add password protection if needed

4. **Set up Custom Domain**: Configure your own domain in Vercel

## 🐛 Troubleshooting

### Build Fails

- Check that all environment variables are set correctly
- Verify `vercel.json` configuration
- Check build logs in Vercel Dashboard

### CORS Errors

- Ensure `ALLOWED_ORIGINS` in backend includes your frontend URL
- Check that both URLs use HTTPS

### API Errors

- Verify all API keys are valid
- Check Supabase connection
- Review backend logs in Vercel Dashboard

## 📊 Monitoring

After deployment, monitor your apps:

1. **Vercel Dashboard**: View deployment logs and analytics
2. **Supabase Dashboard**: Monitor database usage
3. **API Usage**: Track Gemini API quota

## 🔄 Redeployment

To redeploy after changes:

```powershell
# Backend
cd krishi-ai-backend
vercel --prod

# Frontend
cd krishi-ai-2.0
vercel --prod
```

## 📝 Notes

- **First deployment** may take 5-10 minutes
- **Subsequent deployments** are faster (1-3 minutes)
- **Environment variables** changes require redeployment
- **Free tier** has usage limits - monitor your usage

## 🎉 Success

Once deployed, your Krishi AI application will be live at:

- **Frontend**: `https://your-app.vercel.app`
- **Backend API**: `https://your-api.vercel.app`

Share the frontend URL with your users! 🌾
