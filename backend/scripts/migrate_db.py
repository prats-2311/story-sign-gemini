import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import engine, SessionLocal
from sqlalchemy import text
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("migration")

def run_migration():
    logger.info("Starting manual database migration for Multi-Module Domain Support...")
    
    with engine.connect() as conn:
        # 1. Add 'domain' to exercise_sessions
        try:
            conn.execute(text("ALTER TABLE exercise_sessions ADD COLUMN domain VARCHAR DEFAULT 'BODY'"))
            logger.info("Added 'domain' column to exercise_sessions.")
        except Exception as e:
            logger.info(f"Column 'domain' might already exist or error: {e}")

        # 2. Add 'module' to custom_exercises
        try:
            conn.execute(text("ALTER TABLE custom_exercises ADD COLUMN module VARCHAR DEFAULT 'RECONNECT'"))
            logger.info("Added 'module' column to custom_exercises.")
        except Exception as e:
            logger.info(f"Column 'module' might already exist or error: {e}")

        # 3. Backfill Data
        logger.info("Backfilling exercise_sessions domains...")
        
        # Heuristic: If exercise_id is UPPERCASE and distinctively an emotion name (no hyphens usually, < 20 chars), it's FACE.
        # Otherwise, if it's a UUID or standard ID like 'elbow-flexion', it's BODY.
        # Note: Some custom emotions might have UUIDs if created via API but named something else. 
        # But wait, looking at `exercises.py`, custom exercises have UUIDs.
        # But `ExerciseSession.exercise_id` stores the NAME for Harmony sessions ("HAPPY") or ID for Reconnect?
        # Let's check session.py: "exercise_id": session.exercise_id, which suggests it stores whatever the frontend sends.
        # In Harmony, frontend sends "HAPPY", "SAD".
        
        update_face = text("""
            UPDATE exercise_sessions 
            SET domain = 'FACE' 
            WHERE exercise_id IN ('HAPPY', 'SAD', 'ANGRY', 'SURPRISED', 'FEAR', 'DISGUST')
               OR (length(exercise_id) < 20 AND upper(exercise_id) = exercise_id AND exercise_id NOT LIKE '%-%')
        """)
        conn.execute(update_face)
        
        # Update Custom Exercises
        logger.info("Backfilling custom_exercises modules...")
        update_harmony_custom = text("""
            UPDATE custom_exercises
            SET module = 'HARMONY'
            WHERE domain = 'FACE'
        """)
        conn.execute(update_harmony_custom)
        
        update_reconnect_custom = text("""
            UPDATE custom_exercises
            SET module = 'RECONNECT'
            WHERE domain = 'BODY' OR domain IS NULL
        """)
        conn.execute(update_reconnect_custom)
        
        conn.commit()
        logger.info("Migration Complete.")

if __name__ == "__main__":
    run_migration()
