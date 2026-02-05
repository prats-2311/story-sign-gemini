from google import genai
import os
from dotenv import load_dotenv

load_dotenv(override=True)
api_key = os.getenv("GEMINI_API_KEY")

client = genai.Client(api_key=api_key, http_options={"api_version": "v1alpha"})

print("--- AVAILABLE MODELS ---")
for m in client.models.list():
    if "gemini" in m.name:
        print(f"{m.name} | {m.display_name}")
