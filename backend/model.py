
import os
import asyncio
from google import genai
from dotenv import load_dotenv

load_dotenv()

async def list_live_models():
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        print("Error: GEMINI_API_KEY not found in environment variables.")
        return

    client = genai.Client(api_key=api_key, http_options={'api_version': 'v1alpha'})
    
    print("\n🔍 Checking for models supporting Live API (BIDI_GENERATE_CONTENT)...")
    print("-" * 60)
    
    print(f"SDK Version: {genai.__version__}")
    try:
        pager = client.models.list()
        for model in pager:
            print(f"Model: {model.name}")
            print(f"  Authored: {getattr(model, 'display_name', 'N/A')}")
            # print(f"  Full Dump: {model}") 
            # Check supported methods manually
            methods = getattr(model, 'supported_generation_methods', [])
            print(f"  Methods: {methods}")
            print("-" * 20)

    except Exception as e:
        print(f"❌ Error listing models: {e}")

if __name__ == "__main__":
    asyncio.run(list_live_models())
