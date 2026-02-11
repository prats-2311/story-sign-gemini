from fastapi import APIRouter, Request, Depends, HTTPException
from sqlalchemy.orm import Session
from database import SessionLocal, CustomExercise, get_db
import uuid
import logging
from pydantic import BaseModel
from services.exercise_generator import generate_exercise_schema

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/exercises", tags=["exercises"])


@router.post("/custom")
async def create_custom_exercise(request: Request, db: Session = Depends(get_db)):
    try:
        data = await request.json()
        
        # Validations
        if not data.get("name") or not data.get("config"):
            raise HTTPException(status_code=400, detail="Missing name or config")

        exercise_id = str(uuid.uuid4())
        
        new_exercise = CustomExercise(
            id=exercise_id,
            name=data["name"],
            domain=data.get("domain", "BODY"),
            config_json=data["config"]
        )
        
        db.add(new_exercise)
        db.commit()
        db.refresh(new_exercise)
        
        return {"id": exercise_id, "status": "created", "exercise": {
            "id": new_exercise.id,
            "name": new_exercise.name,
            "domain": new_exercise.domain,
            "config": new_exercise.config_json
        }}
    except Exception as e:
        logger.error(f"Error creating custom exercise: {e}")
        raise HTTPException(status_code=500, detail=str(e))

class GenerateRequest(BaseModel):
    description: str

@router.post("/generate")
async def generate_exercise(request: GenerateRequest):
    try:
        if not request.description:
            raise HTTPException(status_code=400, detail="Description is required")
            
        schema = await generate_exercise_schema(request.description)
        
        if "error" in schema:
             raise HTTPException(status_code=500, detail=schema["error"])
             
        return schema
    except Exception as e:
        logger.error(f"Error generating exercise: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/custom")
async def get_custom_exercises(domain: str = "BODY", db: Session = Depends(get_db)):
    try:
        query = db.query(CustomExercise)
        if domain:
            query = query.filter(CustomExercise.domain == domain)
        exercises = query.order_by(CustomExercise.created_at.desc()).all()
        return [{
            "id": ex.id,
            "name": ex.name,
            "domain": ex.domain,
            "config": ex.config_json,
            "created_at": ex.created_at.isoformat()
        } for ex in exercises]
    except Exception as e:
        logger.error(f"Error fetching exercises: {e}")
        return []

@router.get("/custom/{exercise_id}")
async def get_custom_exercise(exercise_id: str, db: Session = Depends(get_db)):
    try:
        ex = db.query(CustomExercise).filter(CustomExercise.id == exercise_id).first()
        if not ex:
            raise HTTPException(status_code=404, detail="Exercise not found")
        
        return {
            "id": ex.id,
            "name": ex.name,
            "domain": ex.domain,
            "config": ex.config_json,
            "created_at": ex.created_at.isoformat()
        }
    except Exception as e:
        logger.error(f"Error fetching exercise {exercise_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/custom/{exercise_id}")
async def delete_custom_exercise(exercise_id: str, db: Session = Depends(get_db)):
    try:
        ex = db.query(CustomExercise).filter(CustomExercise.id == exercise_id).first()
        if not ex:
            raise HTTPException(status_code=404, detail="Exercise not found")
        
        db.delete(ex)
        db.commit()
        return {"status": "deleted", "id": exercise_id}
    except Exception as e:
        logger.error(f"Error deleting exercise: {e}")
        raise HTTPException(status_code=500, detail=str(e))
