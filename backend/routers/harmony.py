from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from database import get_db, CustomExercise, ExerciseSession, SessionReport
from pydantic import BaseModel
import uuid
import logging
import datetime

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/harmony", tags=["harmony"])

# --- EMOTIONS ---

@router.get("/emotions")
async def get_emotions(db: Session = Depends(get_db)):
    """
    Returns both standard HARDCODED emotions and CUSTOM user-created emotions.
    """
    standard_emotions = [
        {"id": "HAPPY", "name": "Happy", "type": "STANDARD"},
        {"id": "SAD", "name": "Sad", "type": "STANDARD"},
        {"id": "ANGRY", "name": "Angry", "type": "STANDARD"},
        {"id": "SURPRISED", "name": "Surprised", "type": "STANDARD"},
        {"id": "FEAR", "name": "Fear", "type": "STANDARD"},
        {"id": "DISGUST", "name": "Disgust", "type": "STANDARD"},
    ]
    
    try:
        custom_exercises = db.query(CustomExercise).filter(
            (CustomExercise.module == "HARMONY") | (CustomExercise.domain == "FACE")
        ).order_by(CustomExercise.created_at.desc()).all()
        
        custom_list = [{
            "id": ex.id,
            "name": ex.name,
            "type": "CUSTOM",
            "config": ex.config_json
        } for ex in custom_exercises]
        
        return standard_emotions + custom_list
    except Exception as e:
        logger.error(f"Error fetching emotions: {e}")
        return standard_emotions

class CreateEmotionRequest(BaseModel):
    name: str
    target_emotion: str # e.g. "Frustrated" maps to "Angry" internally or new

@router.post("/emotions/generate")
async def generate_emotion(request: CreateEmotionRequest, db: Session = Depends(get_db)):
    """
    Creates a new custom emotion.
    In the future, this could use AI to generate landmarks for complex emotions.
    For now, it saves the name and maps it to a base emotion if needed.
    """
    try:
        exercise_id = str(uuid.uuid4())
        new_exercise = CustomExercise(
            id=exercise_id,
            name=request.name,
            domain="FACE",
            module="HARMONY",
            config_json={"target_emotion": request.target_emotion}
        )
        db.add(new_exercise)
        db.commit()
        db.refresh(new_exercise)
        return {"status": "created", "id": exercise_id, "name": new_exercise.name}
    except Exception as e:
        logger.error(f"Error creating emotion: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# --- HISTORY ---

@router.get("/history")
async def get_harmony_history(db: Session = Depends(get_db)):
    """
    Returns session logs strictly for Harmony (FACE).
    """
    try:
        # Join SessionReport and ExerciseSession
        results = db.query(SessionReport, ExerciseSession).join(
            ExerciseSession, SessionReport.session_id == ExerciseSession.session_uuid
        ).filter(
            ExerciseSession.domain == "FACE"
        ).order_by(SessionReport.timestamp.desc()).limit(50).all()
        
        history = []
        for report, session in results:
             history.append({
                 "id": session.session_uuid, # UUID
                 "domain": "FACE",
                 "timestamp": report.timestamp.isoformat() if report.timestamp else None,
                 "title": session.exercise_id, # This should be the Name (e.g. "Happy")
                 "status": session.status,
                 "report_summary": report.report_json, # Full report for details
                 "metrics": session.metrics
             })
        return history
    except Exception as e:
        logger.error(f"Harmony History Error: {e}")
        return []
