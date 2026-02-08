from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from services.exercise_generator import generate_exercise_schema
import os
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/tools", tags=["tools"])

@router.post("/generate-exercise")
async def generate_exercise_tool(request: Request):
    try:
        data = await request.json()
        prompt = data.get("prompt")
        if not prompt:
             return JSONResponse(status_code=400, content={"error": "Missing prompt"})

        # Use the new async function
        result = await generate_exercise_schema(prompt)
        
        if "error" in result:
             return JSONResponse(status_code=500, content=result)
             
        return result
    except Exception as e:
        logger.error(f"Error generating exercise: {e}")
        return JSONResponse(status_code=500, content={"error": str(e)})
