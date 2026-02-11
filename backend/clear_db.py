from sqlalchemy import create_engine, text
import os
import logging

# Setup Logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("cleanup")

# Database Connection
# Use environment variable (Docker) or localhost fallback
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://user:password@localhost:5432/storysign")

def clear_data():
    engine = create_engine(DATABASE_URL)
    with engine.connect() as conn:
        logger.warning("⚠️  STARTING DATA CLEANUP ⚠️")
        logger.warning("This will delete ALL history logs. Custom Exercises and Plans will be preserved.")
        
        try:
            # Truncate tables with CASCADE to handle foreign keys if any
            # We preserve 'daily_plans' and 'custom_exercises' typically, but here we focus on session history.
            
            conn.execute(text("TRUNCATE TABLE session_metrics, exercise_sessions, sessions RESTART IDENTITY CASCADE"))
            conn.commit()
            
            logger.info("✅ Successfully cleared: session_metrics, exercise_sessions, sessions")
            
        except Exception as e:
            logger.error(f"Cleanup Failed: {e}")

if __name__ == "__main__":
    response = input("Are you sure you want to delete all session history? (y/n): ")
    if response.lower() == 'y':
        clear_data()
    else:
        logger.info("Cleanup cancelled.")
