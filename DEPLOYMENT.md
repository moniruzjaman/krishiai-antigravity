# Krishi AI - Deployment Guide

Complete guide for deploying Krishi AI frontend and backend to Vercel.

## Prerequisites

- [Vercel Account](https://vercel.com/signup)
- [Vercel CLI](https://vercel.com/docs/cli) installed: `npm i -g vercel`
- Git repository (optional but recommended)
- All API keys ready (Gemini, Supabase, OpenAI, Hugging Face)

---

## Part 1: Deploy Backend First

### Step 1: Prepare Backend

```bash
cd krishi-ai-backend
```

### Step 2: Deploy to Vercel

```bash
vercel
```

Follow the prompts:

- **Set up and deploy**: Yes
- **Which scope**: Select your account
- **Link to existing project**: No (first time)
- **Project name**: `krishi-ai-backend` (or your choice)
- **Directory**: `./` (current directory)
- **Override settings**: No

### Step 3: Configure Environment Variables

Go to your Vercel dashboard → Project Settings → Environment Variables

Add all variables from `.env.production.example`:

```env
SUPABASE_URL=https://nmngzjrrysjzuxfcklrk.supabase.co
SUPABASE_KEY=your_supabase_anon_key
SUPABASE_SERVICE_KEY=your_supabase_service_key
GEMINI_API_KEY=your_gemini_api_key
HF_TOKEN=your_hf_token
OPENAI_API_KEY=your_openai_key
SECRET_KEY=generate_new_secret_for_production
DEBUG=False
ENVIRONMENT=production
ALLOWED_ORIGINS=http://localhost:4173
```

> **Note**: We'll update `ALLOWED_ORIGINS` after frontend deployment.

### Step 4: Redeploy with Environment Variables

```bash
vercel --prod
```

### Step 5: Note Your Backend URL

Your backend will be deployed to something like:

```
https://krishi-ai-backend.vercel.app
```

**Save this URL** - you'll need it for frontend configuration.

### Step 6: Test Backend

Visit these URLs in your browser:

- `https://your-backend.vercel.app/` - Should show service info
- `https://your-backend.vercel.app/docs` - Should show API documentation
- `https://your-backend.vercel.app/api/v1/health` - Should return health status

---

## Part 2: Deploy Frontend

### Step 1: Update Frontend Environment

Edit `krishi-ai-2.0/.env`:

```env
VITE_BACKEND_URL=https://your-backend.vercel.app/api/v1
```

Replace `your-backend.vercel.app` with your actual backend URL from Part 1.

### Step 2: Build Frontend

```bash
cd krishi-ai-2.0
npm run build
```

Verify the build completes without errors.

### Step 3: Deploy to Vercel

```bash
vercel
```

Follow the prompts:

- **Set up and deploy**: Yes
- **Which scope**: Select your account
- **Link to existing project**: No (first time)
- **Project name**: `krishi-ai` (or your choice)
- **Directory**: `./` (current directory)
- **Override settings**: No

### Step 4: Configure Environment Variables

Go to Vercel dashboard → Project Settings → Environment Variables

Add all variables from `.env.production.example`:

```env
VITE_BACKEND_URL=https://your-backend.vercel.app/api/v1
VITE_GEMINI_API_KEY=your_gemini_api_key
VITE_API_KEY=your_gemini_api_key
VITE_HF_TOKEN=your_hf_token
VITE_SUPABASE_URL=https://nmngzjrrysjzuxfcklrk.supabase.co
VITE_SUPABASE_KEY=your_supabase_anon_key
VITE_OPENAI_API_KEY=your_openai_key
```

### Step 5: Redeploy with Environment Variables

```bash
vercel --prod
```

### Step 6: Note Your Frontend URL

Your frontend will be deployed to something like:

```
https://krishi-ai.vercel.app
```

---

## Part 3: Update Backend CORS

### Step 1: Update Backend Environment

Go to Backend Vercel Project → Settings → Environment Variables

Update `ALLOWED_ORIGINS` to include your frontend URL:

```env
ALLOWED_ORIGINS=https://krishi-ai.vercel.app,http://localhost:4173
```

### Step 2: Redeploy Backend

```bash
cd krishi-ai-backend
vercel --prod
```

---

## Part 4: Verification

### Test Backend

1. Visit `https://your-backend.vercel.app/docs`
2. Try the `/api/v1/health` endpoint
3. Check response is valid JSON

### Test Frontend

1. Visit `https://your-frontend.vercel.app`
2. Verify homepage loads with proper styling
3. Open browser DevTools (F12) → Console tab
4. Check for no errors

### Test Integration

1. Click on "AI Scanner" or "Analyzer"
2. Upload a test crop image
3. Verify analysis completes successfully
4. Check Network tab shows successful API calls to backend

### Test Other Features

- Weather widget should load
- Market prices should display
- Navigation should work smoothly
- All tools should be accessible

---

## Troubleshooting

### Frontend Shows Blank Page

- Check browser console for errors
- Verify all environment variables are set in Vercel
- Check that `VITE_BACKEND_URL` is correct

### API Calls Failing (CORS Error)

- Verify `ALLOWED_ORIGINS` in backend includes frontend URL
- Redeploy backend after updating CORS
- Clear browser cache

### Backend Not Responding

- Check Vercel deployment logs
- Verify all environment variables are set
- Test `/health` endpoint directly

### Image Analysis Not Working

- Verify `GEMINI_API_KEY` is set correctly
- Check API quota hasn't been exceeded
- Look at backend logs in Vercel dashboard

---

## Custom Domain (Optional)

### For Frontend

1. Go to Vercel Project → Settings → Domains
2. Add your custom domain (e.g., `krishiai.com`)
3. Follow DNS configuration instructions
4. Update backend `ALLOWED_ORIGINS` to include custom domain

### For Backend

1. Go to Backend Project → Settings → Domains
2. Add API subdomain (e.g., `api.krishiai.com`)
3. Follow DNS configuration instructions
4. Update frontend `VITE_BACKEND_URL` to use custom domain

---

## Maintenance

### Updating Code

```bash
# Make your changes
git commit -am "Update message"
git push

# Or manually redeploy
vercel --prod
```

### Viewing Logs

- Go to Vercel Dashboard → Your Project → Deployments
- Click on a deployment → View Function Logs

### Monitoring

- Check Vercel Analytics for usage stats
- Monitor API usage in Gemini AI Studio
- Check Supabase dashboard for database usage

---

## Security Checklist

- [ ] All API keys are set as environment variables (not in code)
- [ ] `DEBUG=False` in production backend
- [ ] CORS restricted to your frontend domain only
- [ ] Supabase Row Level Security (RLS) enabled
- [ ] Generated new `SECRET_KEY` for production
- [ ] API rate limiting considered
- [ ] HTTPS enforced (automatic with Vercel)

---

## Support

If you encounter issues:

1. Check Vercel deployment logs
2. Review browser console errors
3. Test API endpoints directly
4. Verify environment variables are set correctly

For Vercel-specific issues, see [Vercel Documentation](https://vercel.com/docs)
