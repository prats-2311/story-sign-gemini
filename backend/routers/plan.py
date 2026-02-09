from fastapi import APIRouter, Depends, Request, HTTPException
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from database import get_db
from services.plan_generator import PlanGenerator
from utils.logging import logger
import os

router = APIRouter(
    prefix="/plan",
    tags=["plan"],
    responses={404: {"description": "Not found"}},
)

# Initialize PlanGenerator
api_key = os.getenv("GEMINI_API_KEY")
planner = PlanGenerator(api_key=api_key) if api_key else None

@router.get("/daily")
async def get_daily_plan(db: Session = Depends(get_db)):
    """Generates or retrieves today's AI recovery plan."""
    if not planner:
        return JSONResponse({"error": "Planner service not available (Missing API Key)"}, status_code=503)
    
    try:
        plan = planner.generate_daily_plan(db)
        return plan
    except Exception as e:
        logger.error(f"Error generating daily plan: {e}")
        return JSONResponse(status_code=500, content={"error": str(e)})

@router.post("/complete")
async def complete_exercise(request: Request, db: Session = Depends(get_db)):
    """Marks an exercise in the daily plan as complete."""
    if not planner:
        return JSONResponse({"error": "Planner service not available"}, status_code=503)
    
    try:
        data = await request.json()
        index = data.get("exercise_index")
        
        if index is None:
             return JSONResponse(status_code=400, content={"error": "Missing exercise_index"})

        result = planner.mark_exercise_complete(db, index)
        return result
    except Exception as e:
        logger.error(f"Error marking exercise complete: {e}")
        return JSONResponse(status_code=500, content={"error": str(e)})
