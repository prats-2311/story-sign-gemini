from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from database import get_db, CustomExercise, ExerciseSession, SessionReport
from services.plan_generator import PlanGenerator
from services.exercise_generator import generate_exercise_schema
from pydantic import BaseModel
import uuid
import logging
import os

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/reconnect", tags=["reconnect"])

# Initialize Planner Service
api_key = os.getenv("GEMINI_API_KEY")
planner = PlanGenerator(api_key=api_key) if api_key else None

# --- AI RECOVERY PLAN ---

@router.get("/plan")
async def get_daily_plan(db: Session = Depends(get_db)):
    """Generates or retrieves today's AI recovery plan."""
    if not planner: return JSONResponse({"error": "Planner unavailable"}, status_code=503)
    try:
        return planner.generate_daily_plan(db)
    except Exception as e:
        logger.error(f"Error generating plan: {e}")
        return JSONResponse(status_code=500, content={"error": str(e)})

class CompleteExerciseRequest(BaseModel):
    exercise_index: int

@router.post("/plan/complete")
async def complete_plan_item(request: CompleteExerciseRequest, db: Session = Depends(get_db)):
    """Marks a plan item as complete."""
    if not planner: return JSONResponse(status_code=503)
    try:
        return planner.mark_exercise_complete(db, request.exercise_index)
    except Exception as e:
        logger.error(f"Error completing plan item: {e}")
        return JSONResponse(status_code=500, content={"error": str(e)})

# --- DRILLS (Custom & Standard) ---

@router.get("/drills")
async def get_drills(db: Session = Depends(get_db)):
    """
    Returns standard PT drills + custom user created drills.
    """
    standard_drills = [
        {"id": "elbow-flexion", "name": "Elbow Flexion", "type": "STANDARD"},
        {"id": "shoulder-abduction", "name": "Shoulder Abduction", "type": "STANDARD"},
    ]
    try:
        custom_drills = db.query(CustomExercise).filter(
            (CustomExercise.module == "RECONNECT") | (CustomExercise.domain == "BODY")
        ).order_by(CustomExercise.created_at.desc()).all()
        
        custom_list = [{
            "id": ex.id,
            "name": ex.name,
            "type": "CUSTOM",
            "config": ex.config_json
        } for ex in custom_drills]
        
        return standard_drills + custom_list
    except Exception as e:
        logger.error(f"Error fetching drills: {e}")
        return standard_drills

class CreateDrillRequest(BaseModel):
    description: str

@router.post("/drills/generate")
async def generate_drill_schema(request: CreateDrillRequest, db: Session = Depends(get_db)):
    """
    Uses AI to generate a drill schema from a description (Previously /exercises/generate).
    """
    try:
        schema = await generate_exercise_schema(request.description)
        if "error" in schema: raise HTTPException(status_code=500, detail=schema["error"])
        
        # Save? Or just return schema for review? 
        # For now, just return schema like old endpoint.
        # Frontend calls POST /drills/save (to be implemented) or uses a generic save.
        return schema
    except Exception as e:
        logger.error(f"Error generating drill: {e}")
        raise HTTPException(status_code=500, detail=str(e))

class SaveDrillRequest(BaseModel):
    name: str
    config: dict

@router.post("/drills/save")
async def save_drill(request: SaveDrillRequest, db: Session = Depends(get_db)):
    """Saves a confirmed drill schema."""
    try:
        exercise_id = str(uuid.uuid4())
        new_exercise = CustomExercise(
            id=exercise_id,
            name=request.name,
            domain="BODY",
            module="RECONNECT",
            config_json=request.config
        )
        db.add(new_exercise)
        db.commit()
        return {"status": "created", "id": exercise_id}
    except Exception as e:
        logger.error(f"Error saving drill: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# --- HISTORY ---

@router.get("/history")
async def get_reconnect_history(db: Session = Depends(get_db)):
    """
    Returns session logs strictly for Reconnect (BODY).
    """
    try:
        results = db.query(SessionReport, ExerciseSession).join(
            ExerciseSession, SessionReport.session_id == ExerciseSession.session_uuid
        ).filter(
            (ExerciseSession.domain == "BODY")
        ).order_by(SessionReport.timestamp.desc()).limit(50).all()
        
        history = []
        for report, session in results:
             history.append({
                 "id": session.session_uuid,
                 "domain": "BODY",
                 "timestamp": report.timestamp.isoformat() if report.timestamp else None,
                 "title": session.exercise_name or session.exercise_id, # [FIX] Use Name
                 "status": session.status,
                 "report_summary": report.report_json,
                 "metrics": session.metrics
             })
        return history
    except Exception as e:
        logger.error(f"Reconnect History Error: {e}")
        return []
