
import json
import os
from google import genai
from google.genai import types
from services.plan_generator import logger
try:
    from backend.prompts.generator import GENERATOR_SYSTEM_INSTRUCTION
except ImportError:
    from prompts.generator import GENERATOR_SYSTEM_INSTRUCTION

class ExerciseGenerator:
    def __init__(self, api_key: str):
        # Use a "Thinking" model (or robust equivalent) for complex reasoning
        # [UPDATE] Switching to Gemini 2.5 Flash as requested
        self.model_name = "gemini-2.5-flash" 
        self.client = genai.Client(api_key=api_key, http_options={"api_version": "v1alpha"})

    def generate_exercise(self, user_request: str):
        """
        Translates natural language request -> Universal Engine JSON
        """
        logger.info(f"Generating exercise for: '{user_request}' using {self.model_name}")

        try:
            response = self.client.models.generate_content(
                model=self.model_name,
                contents=f"User Request: {user_request}",
                config=types.GenerateContentConfig(
                    system_instruction=GENERATOR_SYSTEM_INSTRUCTION,
                    response_mime_type="application/json",
                    temperature=0.2, # Low temp for strict JSON
                )
            )

            # [DEBUG]
            logger.debug(f"Generator Response: {response.text[:100]}...")

            return json.loads(response.text)

        except Exception as e:
            logger.error(f"Exercise Generation Failed: {e}")
            # Fallback (Mock) if model fails or quota exceeded
            return {
                "error": str(e),
                "fallback": True,
                "name": "Fallback Squat",
                "description": "Simple squat (Generation Failed)",
                "domain": "BODY",
                "metrics": [{"id": "knee_angle", "type": "ANGLE", "points": [23, 25, 27]}],
                "states": [{"name": "START", "condition": "knee_angle > 160"}, {"name": "SQUAT", "condition": "knee_angle < 90"}]
            }
