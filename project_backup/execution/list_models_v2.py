from google import genai
import os

client = genai.Client(api_key="YOUR_GEMINI_API_KEY")

try:
    for m in client.models.list(config={"page_size": 50}):
        print(f"Model: {m.name}")
except Exception as e:
    print(f"Error: {e}")
