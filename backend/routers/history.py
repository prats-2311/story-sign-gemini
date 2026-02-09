from fastapi import APIRouter, Request, Depends
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from database import SessionLocal, SessionReport, get_db
from services.plan_generator import PlanGenerator
from google import genai
from google.genai import types
import os
import json
import logging

logger = logging.getLogger(__name__)

router = APIRouter(tags=["history"])

# Configuration
api_key = os.getenv("GEMINI_API_KEY")

# Initialize Clients
planner = PlanGenerator(api_key=api_key) if api_key else None
client = genai.Client(api_key=api_key, http_options={"api_version": "v1alpha"}) if api_key else None


@router.get("/history")
async def get_history(db: Session = Depends(get_db)):
    try:
        reports = db.query(SessionReport).order_by(SessionReport.timestamp.desc()).limit(20).all()
        history = []
        for r in reports:
            # Parse metrics/JSON safely
            try:
                report_data = r.report_json if isinstance(r.report_json, dict) else json.loads(r.report_json)
            except:
                report_data = {}
            
            history.append({
                "id": r.id,
                "timestamp": r.timestamp.isoformat(),
                "transcript": r.transcript,
                "clinical_notes": r.clinical_notes, 
                "report_json": report_data
            })
        return history
    except Exception as e:
        logger.error(f"History Fetch Error: {e}")
        return []

@router.post("/analyze_session")
async def analyze_session(request: Request, db: Session = Depends(get_db)):
    if not client: return JSONResponse(status_code=503, content={"error": "Gemini Client not available"})
    
    try:
        data = await request.json()
        transcript = data.get("transcript", "")
        clinical_notes = data.get("clinical_notes", [])
        pose_summary = data.get("pose_summary", "")
        telemetry = data.get("telemetry", [])
        
        notes_text = "\n- ".join(clinical_notes) if clinical_notes else "No specific clinical notes recorded."

        prompt = f"""
        You are an expert Physical Therapist and Data Journalist.
        
        **1. Clinical Observations (Notes):**
        - {notes_text}

        **2. Raw Telemetry (Sampled):**
        - Format: [ {{Str: time, Val: measure, Vel: velocity}} ]
        {json.dumps(telemetry)}
        
        **3. Pose Statistics:**
        {pose_summary}

        **Task:**
        1. **Progress Report**: Write a concise markdown report (max 150 words). 
           - **CRITICAL**: If any note mentions "SAFETY_STOP" or "High Velocity", you MUST highlight it in the "Session Summary" as a safety concern.
           - Synthesize the "Notes" with the "Telemetry". 
        2. **Visual Evidence**: Generate a configuration for a line chart.
           - Select the most relevant metric (val or vel) for the Y-Axis.
        
        **Output Schema (Strict JSON):**
        {{
            "report_markdown": "markdown string...",
            "chart_config": {{
                "title": "Elbow Flexion Consistency",
                "xAxis": "Time (s)",
                "yAxis": "Angle (deg)",
                "data": [ {{"x": 1.2, "y": 45}}, ... ] 
            }}
        }}
        """

        response = client.models.generate_content(
            model="gemini-2.0-flash-exp", # Using standard stable model
            contents=prompt,
            config=types.GenerateContentConfig(response_mime_type="application/json")
        )
        
        try:
            result = json.loads(response.text)
            
            # Persist to Database
            try:
                db_report = SessionReport(
                    session_id=data.get("session_id", "unknown"),
                    transcript=str(transcript),
                    clinical_notes=clinical_notes,
                    report_json=result
                )
                db.add(db_report)
                db.commit()
            except Exception as db_e:
                logger.error(f"Failed to save to DB: {db_e}")

            return result
            
        except json.JSONDecodeError:
            return {
                "report_markdown": response.text, 
                "chart_config": None, 
                "thoughts": "Error parsing data visualization."
            }
    except Exception as e:
        logger.error(f"Error in deep think analysis: {e}")
        return JSONResponse(status_code=500, content={"error": str(e)})

