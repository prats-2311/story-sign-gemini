from fastapi import APIRouter, Request, Depends, BackgroundTasks
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from database import SessionLocal, ExerciseSession, SessionReport, get_db
from services.report_drafter import ReportDrafter
from datetime import datetime
import os
import logging

# Setup Logger
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/session", tags=["session"])

# Initialize Services
api_key = os.getenv("GEMINI_API_KEY")
drafter = ReportDrafter(api_key=api_key) if api_key else None

if not drafter:
    logger.warning("ReportDrafter could not be initialized (Missing API Key).")

# Dependency

@router.post("/start")
async def start_session_draft(request: Request, db: Session = Depends(get_db)):
    if not drafter: return JSONResponse(status_code=503, content={"error": "Drafter not initialized"})
    
    data = await request.json()
    session_id = data.get("session_id")
    exercise_id = data.get("exercise_id", "unknown")
    domain = data.get("domain", "BODY") # Default to BODY if not specified
    
    exercise_name = data.get("exercise_name", "Unknown Exercise")
    
    # [STRICT VALIDATION] Ensure domain is valid
    if domain not in ["BODY", "FACE", "HAND"]:
        domain = "BODY" # Fallback
    
    # 1. Start Shadow Brain Context
    success = await drafter.start_session(session_id, domain=domain, exercise_name=exercise_name)
    
    # 2. Create Persistent Record
    try:
        new_session = ExerciseSession(
            session_uuid=session_id,
            exercise_id=exercise_id,
            exercise_name=exercise_name, # [FIX] Persist Name
            domain=domain,
            status="started"
        )
        db.add(new_session)
        db.commit()
    except Exception as e:
        logger.error(f"Failed to persist session start: {e}")

    return {"status": "started" if success else "error", "session_id": session_id}

@router.post("/chunk")
async def ingest_session_chunk(request: Request, background_tasks: BackgroundTasks):
    if not drafter: return JSONResponse(status_code=503, content={"error": "Drafter not initialized"})
    data = await request.json()
    session_id = data.get("session_id")
    
    # [OPTIMIZATION] Non-Blocking Ingestion
    background_tasks.add_task(drafter.ingest_chunk, session_id, data)
    
    return JSONResponse(status_code=202, content={"status": "queued"})

@router.post("/end")
async def finalize_session_draft(request: Request, db: Session = Depends(get_db)):
    if not drafter: return JSONResponse(status_code=503, content={"error": "Drafter not initialized"})
    data = await request.json()
    session_id = data.get("session_id")
    
    # 1. Get Final Report from Shadow Brain
    result = await drafter.finalize_report(session_id)
    
    # 2. Update Persisted Record (ExerciseSession)
    try:
        session_record = db.query(ExerciseSession).filter(ExerciseSession.session_uuid == session_id).first()
        if session_record:
            session_record.end_time = datetime.utcnow()
            session_record.status = "completed"
            db.commit()
    except Exception as e:
        logger.error(f"Failed to update session end: {e}")

    # 3. Save Report (SessionReport - Legacy/Detail)
    if "report_markdown" in result:
        try:
             db_report = SessionReport(
                 session_id=session_id,
                 transcript="[Incremental Session]", 
                 clinical_notes=result.get("clinical_notes", []), 
                 report_json=result
             )
             db.add(db_report)
             db.commit()
        except Exception as e:
            logger.error(f"DB Save Error: {e}")

    return result

@router.get("/history")
@router.get("/logs")
async def get_session_logs(
    search: str = None, 
    domain: str = None, 
    start_date: str = None, 
    end_date: str = None, 
    limit: int = 50, 
    db: Session = Depends(get_db)
):
    try:
        # Join SessionReport and ExerciseSession
        query = db.query(SessionReport, ExerciseSession).join(
            ExerciseSession, SessionReport.session_id == ExerciseSession.session_uuid
        ).order_by(SessionReport.timestamp.desc())
        
        # [FILTER] Domain
        if domain and domain != "ALL":
             query = query.filter(ExerciseSession.domain == domain)

        # [FILTER] Date Range
        if start_date:
            try:
                start_dt = datetime.fromisoformat(start_date.replace('Z', '+00:00'))
                query = query.filter(SessionReport.timestamp >= start_dt)
            except ValueError:
                pass # Ignore invalid dates
        
        if end_date:
            try:
                # Set to end of day if only date is provided, or exact timestamp
                end_dt = datetime.fromisoformat(end_date.replace('Z', '+00:00'))
                # If it's just a date (YYYY-MM-DD), add 23:59:59 behavior if needed, 
                # but simple comparison works if UI sends full ISO or we assume inclusive.
                # Let's assume the UI sends YYYY-MM-DD and we want inclusive.
                if len(end_date) == 10: 
                    end_dt = end_dt.replace(hour=23, minute=59, second=59)
                query = query.filter(SessionReport.timestamp <= end_dt)
            except ValueError:
                pass

        # [FILTER] Search
        if search:
            search_query = f"%{search}%"
            query = query.filter(
                (ExerciseSession.exercise_name.ilike(search_query)) | 
                (ExerciseSession.exercise_id.ilike(search_query)) | 
                (SessionReport.transcript.ilike(search_query))
            )
        
        results = query.limit(limit).all()
        
        history = []
        for report, session in results:
             history.append({
                 "id": session.session_uuid,
                 "session_id": session.session_uuid,
                 "exercise_id": session.exercise_id,
                 "title": session.exercise_name or session.exercise_id, 
                 "timestamp": report.timestamp.isoformat() if report.timestamp else None,
                 "report_summary": report.report_json, 
                 "status": session.status,
                 "domain": session.domain
             })
             
        return history
    except Exception as e:
        logger.error(f"History Fetch Error: {e}")
        return []
