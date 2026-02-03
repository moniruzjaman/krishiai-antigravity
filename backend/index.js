require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const multer = require('multer'); // For handling multipart/form-data (image uploads)

const app = express();
const port = process.env.PORT || 3001;

// Use multer for multipart/form-data
// Using memory storage as we're just reading the buffer and converting to base64
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// CORS configuration: Allow requests from your frontend domain
// IMPORTANT: In a production environment, replace '*' with your actual frontend domain(s)
app.use(cors({
  origin: '*', // For development, allow all. Change to your frontend URL in production, e.g., 'http://localhost:3000', 'https://your-frontend-domain.com'
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json()); // For application/json

app.post('/api/chat', upload.single('image'), async (req, res) => {
  const { prompt, model } = req.body;
  const imageFile = req.file; // The uploaded image file (if any)

  if (!prompt && !imageFile) {
    return res.status(400).json({ error: 'Prompt or image is required.' });
  }

  console.log(`Received request for model: ${model}`);
  console.log(`Prompt: ${prompt ? prompt.substring(0, 50) + '...' : '[No text prompt]'}`);
  if (imageFile) {
    console.log(`Image received: ${imageFile.originalname}, Mime Type: ${imageFile.mimetype}`);
  }

  try {
    let aiResponseText = '';

    switch (model) {
      case 'gemini':
        if (!process.env.GEMINI_API_KEY) {
          throw new Error('Gemini API key not configured in environment variables.');
        }
        const geminiContents = [
          { role: 'user', parts: [] }
        ];

        if (prompt) {
            geminiContents[0].parts.push({ text: prompt });
        }
        if (imageFile) {
          // Convert image to base64 for Gemini Vision API
          const imageBase64 = imageFile.buffer.toString('base64');
          geminiContents[0].parts.push({
            inline_data: {
              mime_type: imageFile.mimetype,
              data: imageBase64,
            },
          });
        }

        // Use gemini-pro-vision if an image is present, otherwise gemini-pro
        const geminiModel = imageFile ? 'gemini-pro-vision' : 'gemini-pro';

        const geminiResult = await axios.post(
          `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${process.env.GEMINI_API_KEY}`,
          { contents: geminiContents },
          {
            headers: {
              'Content-Type': 'application/json',
            },
          }
        );
        aiResponseText = geminiResult.data.candidates[0].content.parts[0].text;
        break;

      case 'chatgpt':
        if (!process.env.OPENAI_API_KEY) {
          throw new Error('OpenAI API key not configured in environment variables.');
        }
        if (imageFile) {
          // Note: GPT-3.5-turbo does not support image input directly.
          // GPT-4-vision-preview supports it but might be out of free tier.
          return res.status(400).json({ error: 'ChatGPT (gpt-3.5-turbo) does not support image input directly with this setup. Please choose Gemini for multimodal input or remove the image.' });
        }
        const openaiResult = await axios.post(
          'https://api.openai.com/v1/chat/completions',
          {
            model: 'gpt-3.5-turbo', // Cost-effective option
            messages: [{ role: 'user', content: prompt }],
          },
          {
            headers: {
              'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
              'Content-Type': 'application/json',
            },
          }
        );
        aiResponseText = openaiResult.data.choices[0].message.content;
        break;

      case 'huggingface':
        if (!process.env.HF_API_KEY) {
          throw new Error('Hugging Face API key not configured in environment variables.');
        }
        if (imageFile) {
          return res.status(400).json({ error: 'Hugging Face text generation models do not support image input directly with this setup. Please choose Gemini for multimodal input or remove the image.' });
        }
        // IMPORTANT: Choose a suitable Hugging Face model URL.
        // This is a small, general-purpose text model.
        // For specific tasks (e.g., translation, summarization), you'd use a different model.
        const huggingFaceModelUrl = 'https://api-inference.huggingface.co/models/google/flan-t5-small';

        const hfResult = await axios.post(
          huggingFaceModelUrl,
          { inputs: prompt },
          {
            headers: {
              'Authorization': `Bearer ${process.env.HF_API_KEY}`,
              'Content-Type': 'application/json',
            },
          }
        );
        // Hugging Face inference API responses can vary.
        // For text generation models, it's often an array with 'generated_text'.
        aiResponseText = hfResult.data[0].generated_text;
        break;

      default:
        return res.status(400).json({ error: 'Invalid AI model selected.' });
    }

    res.json({ text: aiResponseText });
  } catch (error) {
    console.error('Error in AI orchestration:', error.response ? JSON.stringify(error.response.data) : error.message);
    // Be careful not to expose sensitive internal error details to the frontend in production
    res.status(500).json({
      error: 'Failed to get response from AI service.',
      details: error.message, // Provide general error message
      api_error_details: error.response?.data, // Only include if debugging and safe
    });
  }
});

// Basic health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).send('Backend is healthy');
});


app.listen(port, () => {
  console.log(`Backend server listening on port ${port}`);
});
