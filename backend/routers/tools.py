from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from services.exercise_generator import ExerciseGenerator
import os
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/tools", tags=["tools"])

api_key = os.getenv("GEMINI_API_KEY")
generator = ExerciseGenerator(api_key=api_key) if api_key else None

if not generator:
    logger.warning("ExerciseGenerator could not be initialized (Missing API Key).")

@router.post("/generate-exercise")
async def generate_exercise_tool(request: Request):
    if not generator:
        return JSONResponse({"error": "Exercise Generator service not available"}, status_code=503)
    
    try:
        data = await request.json()
        prompt = data.get("prompt")
        if not prompt:
             return JSONResponse(status_code=400, content={"error": "Missing prompt"})

        result = generator.generate_exercise(prompt)
        return result
    except Exception as e:
        logger.error(f"Error generating exercise: {e}")
        return JSONResponse(status_code=500, content={"error": str(e)})
