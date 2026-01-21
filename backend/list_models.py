from google import genai
import os
from dotenv import load_dotenv

load_dotenv(override=True)
api_key = os.getenv("GEMINI_API_KEY")

client = genai.Client(api_key=api_key, http_options={"api_version": "v1alpha"})

print("Listing models...")
try:
    models = client.models.list()
    for m in models:
        # Filter for relevant models to reduce noise
        if "gemini" in m.name:
            print(f"Model: {m.name}, Display: {m.display_name}")
except Exception as e:
    print(f"Error listing models: {e}")
