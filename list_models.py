
import os
from dotenv import load_dotenv
from google import genai

load_dotenv(override=True)

client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"), http_options={"api_version": "v1alpha"})

print("Listing available models...")
try:
    for model in client.models.list():
        print(f"- {model.name}")
except Exception as e:
    print(f"Error listing models: {e}")
