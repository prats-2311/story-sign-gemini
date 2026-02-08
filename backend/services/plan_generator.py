import json
import os
from google import genai
from google.genai import types
from sqlalchemy.orm import Session
try:
    from database import SessionReport, DailyPlan
except ImportError:
    from backend.database import SessionReport, DailyPlan
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

    def _generate_from_gemini(self, db: Session):
        # 1. Fetch History
        reports = db.query(SessionReport).order_by(SessionReport.timestamp.desc()).limit(3).all()
        
        history_summary = []
        for r in reports:
            # Parse the report_json safely
            try:
                data = r.report_json if isinstance(r.report_json, dict) else json.loads(r.report_json)
                history_summary.append({
                    "date": r.timestamp.isoformat(),
                    "analysis": data.get("thoughts", "No analysis"),
                    "chart_data": data.get("chart_config", {}).get("data", [])
                })
            except Exception as e:
                logger.warning(f"Failed to parse report {r.id}: {e}")
                continue

        # 2. Construct Prompt
        # Fallback if no history
        if not history_summary:
            Prompt_Context = "The user is new. Create a gentle introductory routine."
        else:
            Prompt_Context = f"Here is the user's last 3 sessions: {json.dumps(history_summary)}"

        system_instruction = """
        You are an expert Physical Therapist. 
        Your goal is to create a "Daily Activity Plan" for a patient recovering from shoulder/arm injury.
        
        **Rules:**
        1. Analyze the provided history (if any). Look for signs of fatigue (low ROM) or progress.
        2. Create a routine with 2-3 exercises.
        3. Allowed Exercise IDs: 'abduction', 'bicep_curl', 'wall_slide', 'rotation'.
        
        **Output Schema (Strict JSON):**
        {
            "day_id": "YYYY-MM-DD",
            "reasoning": "One sentence explaining why you chose this routine (e.g. 'Based on yesterday's stiffness...')",
            "routine": [
                { "exercise_id": "wall_slide", "sets": 2, "target_reps": 10, "instructions": "Focus on slow movement." }
            ]
        }
        """

        try:
            response = self.client.models.generate_content(
                model="gemini-2.0-flash", # Flash is fast enough for planning
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
