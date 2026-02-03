
import os
import asyncio
from google import genai
from dotenv import load_dotenv

load_dotenv()

async def list_models():
    client = genai.Client(http_options={'api_version': 'v1alpha'})
    try:
        print("Listing models...")
        # The new SDK might use different methods, let's try to list
        # We need to find the equivalent of list_models in the new SDK if it exists
        # or use the standard REST search if needed.
        # But 'genai.Client' suggests the new unified SDK.
        
        # Let's try iterating if possible or catching the structure
        pager = client.models.list()
        for model in pager:
            print(f"Model: {model.name}")
            print(f"  DisplayName: {model.display_name}")
            if hasattr(model, 'supported_generation_methods'):
                print(f"  Supported: {model.supported_generation_methods}")
            else:
                print("  Supported: (attribute not found)")
            
    except Exception as e:
        print(f"Error listing models: {e}")

if __name__ == "__main__":
    asyncio.run(list_models())
