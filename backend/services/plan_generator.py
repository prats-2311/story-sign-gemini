import json
import os
from google import genai
from google.genai import types
from sqlalchemy.orm import Session
try:
    from database import SessionReport, DailyPlan, CustomExercise, ExerciseSession
except ImportError:
    from backend.database import SessionReport, DailyPlan, CustomExercise, ExerciseSession
try:
    from utils.logging import logger
except ImportError:
    from backend.utils.logging import logger
import datetime

class PlanGenerator:
    def __init__(self, api_key: str):
        self.client = genai.Client(api_key=api_key, http_options={"api_version": "v1alpha"})

    def generate_daily_plan(self, db: Session):
        """
        Get today's plan.
        1. Check DB for existing plan for today.
        2. If exists, return it (with completion status).
        3. If not, generate via Gemini, save to DB, and return.
        """
        today = datetime.date.today()
        
        # 1. Check Cache
        cached_plan = db.query(DailyPlan).filter(DailyPlan.date == today).first()
        if cached_plan:
            # Merge completion status into the plan JSON for the frontend
            plan_data = cached_plan.plan_json
            if isinstance(plan_data, str): plan_data = json.loads(plan_data)
            
            # Inject completion status
            # Frontend expects: { ..., routine: [{..., completed: true}] }
            status = cached_plan.completion_status or {}
            for idx, item in enumerate(plan_data.get("routine", [])):
                item["completed"] = status.get(str(idx), False)
            
            return plan_data

        # 2. Generate New Plan (Gemini)
        generated_plan = self._generate_from_gemini(db)
        
        # 3. Save to DB
        try:
            new_db_plan = DailyPlan(
                date=today,
                plan_json=generated_plan,
                completion_status={}
            )
            db.add(new_db_plan)
            db.commit()
        except Exception as e:
            logger.error(f"Failed to save generated plan: {e}")
            
        return generated_plan

    def _get_exercise_menu(self, db: Session):
        """
        Returns a list of all available exercises (Hardcoded + Custom).
        """
        # 1. Hardcoded Defaults
        menu = [
            {"id": "abduction", "name": "Shoulder Abduction", "domain": "BODY"},
            {"id": "bicep_curl", "name": "Bicep Curls", "domain": "BODY"},
            {"id": "wall_slide", "name": "Wall Slides", "domain": "BODY"},
            {"id": "rotation", "name": "External Rotation", "domain": "BODY"},
        ]
        
        # 2. Fetch Custom Exercises
        try:
            custom_exercises = db.query(CustomExercise).all()
            for ex in custom_exercises:
                menu.append({
                    "id": ex.id,
                    "name": ex.name,
                    "domain": ex.domain
                })
        except Exception as e:
            logger.warning(f"Failed to fetch custom exercises: {e}")
            
        return menu

    def _get_session_context(self, db: Session):
        """
        Summarizes the last 7 days of activity.
        Primary Source: ExerciseSession (Raw Log)
        Secondary Source: SessionReport (Detailed Analysis) - used if primary is empty.
        """
        seven_days_ago = datetime.datetime.utcnow() - datetime.timedelta(days=7)
        history = []
        
        # 1. Fetch from ExerciseSession (Raw)
        try:
            raw_sessions = db.query(ExerciseSession).filter(
                ExerciseSession.start_time >= seven_days_ago
            ).order_by(ExerciseSession.start_time.asc()).all()
            
            for s in raw_sessions:
                # Calculate simple volume if metrics exist
                reps = s.metrics.get("reps", 0) if s.metrics else 0
                history.append({
                    "date": s.start_time.strftime("%Y-%m-%d"),
                    "exercise_id": s.exercise_id,
                    "source": "raw_log",
                    "status": s.status,
                    "reps": reps
                })
        except Exception as e:
            logger.warning(f"Failed to fetch exercise sessions: {e}")

        # 2. Fetch from SessionReport (Analysis) if history is sparse (< 3)
        if len(history) < 3:
            try:
                reports = db.query(SessionReport).filter(
                    SessionReport.timestamp >= seven_days_ago
                ).order_by(SessionReport.timestamp.asc()).all()

                for r in reports:
                    # Parse JSON
                    data = r.report_json if isinstance(r.report_json, dict) else json.loads(r.report_json)
                    
                    # Extract Activity Name from various paths
                    activity = "Unknown"
                    if "activity_name" in data: activity = data["activity_name"]
                    elif "session_overview" in data:
                        if isinstance(data["session_overview"], dict):
                            activity = data["session_overview"].get("activity", "Unknown")
                        elif isinstance(data["session_overview"], list):
                            for line in data["session_overview"]:
                                if "Activity:" in line:
                                    activity = line.split(":", 1)[1].strip()
                                    break
                    
                    # Deduplicate: Only add if we don't have a raw log for this time (approx match)
                    # For simplicity, we just check if this date is already in history
                    r_date = r.timestamp.strftime("%Y-%m-%d")
                    if not any(h["date"] == r_date and h["exercise_id"] == activity for h in history):
                         history.append({
                            "date": r_date,
                            "exercise_id": activity, # Use name as ID for fallback
                            "source": "session_report",
                            "status": "completed",
                            "reps": "unknown"
                        })

            except Exception as e:
                logger.warning(f"Failed to fetch session reports: {e}")

        # Sort combined history by date
        history.sort(key=lambda x: x["date"])
        return history

    def _generate_from_gemini(self, db: Session):
        # 1. Gather Data
        menu = self._get_exercise_menu(db)
        history = self._get_session_context(db)
        
        # 2. Construct Prompt
        Prompt_Context = f"""
        ### AVAILABLE EXERCISES (MENU)
        {json.dumps(menu, indent=2)}

        ### USER ACTIVITY (LAST 7 DAYS)
        {json.dumps(history, indent=2)}
        
        ### GOAL
        Plan tomorrow's routine based on the history.
        - If they did "BODY" / Arm exercises yesterday with high intensity, suggest lighter work or focus on a different domain.
        - Ensure variety.
        - If they are consistent, slightly increase volume.
        """

        system_instruction = """
        You are an expert Physical Therapist. 
        Your goal is to create a "Daily Activity Plan" for a patient recovering from injury.
        
        **Rules:**
        1. **Inventory:** You MUST ONLY choose exercises from the provided 'MENU'. Use the exact 'id'.
        2. **Fatigue Management:** Analyze the 'USER ACTIVITY'. Avoid hitting the same muscle group hard two days in a row.
        3. **Progression:** If the user completed previous sessions successfully, increase sets/reps slightly.
        4. **Variety:** Mix different exercises.
        
        **Output Schema (Strict JSON):**
        {
            "day_id": "YYYY-MM-DD",
            "reasoning": "One sentence explaining details. Mention specific past sessions if relevant (e.g., 'Since you did 10 curls yesterday...')",
            "routine": [
                { "exercise_id": "string (must match menu id)", "sets": 2, "target_reps": 10, "instructions": "string" }
            ]
        }
        """

        try:
            response = self.client.models.generate_content(
                model="gemini-3-flash-preview", # Flash is fast enough for planning
                contents=Prompt_Context,
                config=types.GenerateContentConfig(
                    system_instruction=system_instruction,
                    response_mime_type="application/json",
                    temperature=0.3
                )
            )
            
            return json.loads(response.text)

        except Exception as e:
            logger.error(f"Plan Generation Failed: {e}")
            # Fallback Routine
            return {
                "day_id": datetime.date.today().isoformat(),
                "reasoning": "We couldn't reach the AI therapist, so here is a standard maintenance routine.",
                "routine": [
                    { "exercise_id": "wall_slide", "sets": 2, "target_reps": 8, "instructions": "Warm up." },
                    { "exercise_id": "abduction", "sets": 2, "target_reps": 10, "instructions": "Keep steady." }
                ]
            }

    def mark_exercise_complete(self, db: Session, exercise_index: int):
        today = datetime.date.today()
        plan = db.query(DailyPlan).filter(DailyPlan.date == today).first()
        
        if not plan:
            return {"error": "No plan found for today"}
        
        # Update completion status
        # Note: SQLAlchemy requires re-assignment for JSON mutation to be detected or flag_modified
        current_status = dict(plan.completion_status) if plan.completion_status else {}
        current_status[str(exercise_index)] = True
        
        plan.completion_status = current_status
        db.commit()
        return {"status": "updated", "completion": current_status}
