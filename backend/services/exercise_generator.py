
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
3. **Cyclic Nature:**
    - Exercises must be LOOPS.
    - Stage 1: "Start Position" (e.g., Arm Down).
    - Stage 2: "Action/Peak" (e.g., Arm Up).
    - The engine automatically loops back to Stage 1.
4. **Safety:** Always include a 'secondary_metric' for stability if applicable.
5. **Naming:** Give the exercise a clear, short name.

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
    {{ "name": "Start (Extension)", "conditions": [{{ "metric": "elbow_angle", "op": "GT", "target": 160 }}], "hold_time": 0.5 }},
    {{ "name": "Curl (Flexion)", "conditions": [{{ "metric": "elbow_angle", "op": "LT", "target": 45 }}], "hold_time": 0.5 }}
  ]
}}
"""

def validate_schema(schema: dict) -> dict:
    """
    Sanitizes and validates the generated schema.
    """
    if "metrics" not in schema or "stages" not in schema:
        raise ValueError("Schema missing 'metrics' or 'stages'")
    
    # 1. Validate Metrics exist
    valid_metrics = set(schema["metrics"].keys())
    
    # 2. Validate Stages
    for i, stage in enumerate(schema["stages"]):
        if "conditions" not in stage:
            continue
        for cond in stage["conditions"]:
            if cond["metric"] not in valid_metrics:
                # [Fix] If AI hallucinates a metric, try to find a close match or remove condition
                logger.warning(f"Invalid metric {cond['metric']} in stage {i}. Removing condition.")
                stage["conditions"].remove(cond)
    
    # 3. Ensure at least 2 stages for a dynamic exercise
    if len(schema["stages"]) < 2:
        # If AI only gave 1 stage, auto-generate a "Return" stage? 
        # For now, just warn.
        logger.warning("Exercise has fewer than 2 stages. Might not loop correctly.")

    return schema

async def generate_exercise_schema(description: str) -> dict:
    """
    Generates an exercise schema from a description using Gemini.
    """
    if not GEMINI_API_KEY:
        raise ValueError("GEMINI_API_KEY is not set")

    try:
        # Initialize Client
        client = genai.Client(api_key=GEMINI_API_KEY, http_options={'api_version': 'v1alpha'})
        
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
        
        # Validate
        validated_json = validate_schema(result_json)
        
        logger.info("Successfully generated and validated exercise schema")
        return validated_json

    except Exception as e:
        logger.error(f"Error generating exercise: {e}")
        # Fallback / Error handling
        return {"error": str(e), "fallback": "Could not generate exercise."}
