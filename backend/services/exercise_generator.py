
import logging
import json
import os
try:
    from google import genai
    from google.genai import types
except ImportError:
    import google.generativeai as genai 

from config import GEMINI_API_KEY
from pydantic import BaseModel

logger = logging.getLogger(__name__)

# --- SCHEMA DEFINITION ---
# strict JSON schema for the Universal Physics Engine
EXERCISE_SCHEMA = """
{
  "name": "string",
  "domain": "BODY" | "HAND" | "FACE",
  "metrics": {
    "metric_id_key": {
      "type": "ANGLE" | "DISTANCE" | "VERTICAL_DIFF",
      "points": ["string (landmark name, e.g. LEFT_SHOULDER)", "string", "string"]
    }
  },
  "stages": [
    {
      "name": "string (e.g., Start Position)",
      "description": "string",
      "conditions": [
        {
          "metric": "string (must match a key in metrics)",
          "op": "GT" | "LT" | "BETWEEN",
          "target": 160,
          "tolerance": 10
        }
      ],
      "hold_time": 0.5
    }
  ]
}
"""

SYSTEM_INSTRUCTION = f"""
You are an expert Biomechanics Engineer and JSON Architect.
Your goal is to convert a user's natural language description of an exercise into a valid JSON configuration for the Universal Physics Engine.

### SCHEMA
{EXERCISE_SCHEMA}

### RULES
1. **Valid JSON Only:** Output *only* the JSON object. No markdown, no explanations.
2. **Biomechanics:**
    - Use correct MediaPipe landmarks (e.g., LEFT_SHOULDER, RIGHT_WRIST, NOSE).
    - Angles are typically 0-180 degrees.
    - "Extension" usually means ~180 degrees. "Flexion" usually means < 90 degrees.
3. **Safety:** Always include a 'secondary_metric' for stability if applicable (e.g., Torso Lean for arm exercises).
4. **Naming:** Give the exercise a clear, short name.

### EXAMPLE
Input: "A simple bicep curl"
Output:
{{
  "name": "Bicep Curl",
  "domain": "BODY",
  "metrics": {{
    "elbow_angle": {{ "type": "ANGLE", "points": ["LEFT_SHOULDER", "LEFT_ELBOW", "LEFT_WRIST"] }},
    "torso_vertical": {{ "type": "VERTICAL_DIFF", "points": ["LEFT_SHOULDER", "LEFT_HIP"] }}
  }},
  "stages": [
    {{ "name": "Start", "conditions": [{{ "metric": "elbow_angle", "op": "GT", "target": 160 }}] }},
    {{ "name": "Curl", "conditions": [{{ "metric": "elbow_angle", "op": "LT", "target": 45 }}] }}
  ]
}}
"""

async def generate_exercise_schema(description: str) -> dict:
    """
    Generates an exercise schema from a description using Gemini.
    """
    if not GEMINI_API_KEY:
        raise ValueError("GEMINI_API_KEY is not set")

    try:
        # Initialize Client
        client = genai.Client(api_key=GEMINI_API_KEY, http_options={'api_version': 'v1alpha'})
        
        # Generation Config
        config = {
            "temperature": 0.2, # Low temperature for strict schema adherence
            "response_mime_type": "application/json"
        }

        logger.info(f"Generating exercise for: {description}")
        
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=[description],
            config=types.GenerateContentConfig(
                system_instruction=SYSTEM_INSTRUCTION,
                temperature=0.2,
                response_mime_type="application/json"
            )
        )

        # Parse JSON
        result_json = json.loads(response.text)
        logger.info("Successfully generated exercise schema")
        return result_json

    except Exception as e:
        logger.error(f"Error generating exercise: {e}")
        # Fallback / Error handling
        return {"error": str(e), "fallback": "Could not generate exercise."}
