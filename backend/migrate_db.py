from sqlalchemy import create_engine, text
import os
import logging

# Setup Logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("migration")

# Database Connection
# Use environment variable (Docker) or localhost fallback (if running locally with port forwarding)
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://user:password@localhost:5432/storysign")

def migrate():
    engine = create_engine(DATABASE_URL)
    with engine.connect() as conn:
        logger.info("Starting schema migration...")
        
        try:
            # --- 1. EXERCISE SESSIONS TABLE ---
            # Check exercise_name column
            result = conn.execute(text("SELECT column_name FROM information_schema.columns WHERE table_name='exercise_sessions' AND column_name='exercise_name'"))
            if not result.fetchone():
                logger.info("Column 'exercise_name' missing in exercise_sessions. Adding it...")
                conn.execute(text("ALTER TABLE exercise_sessions ADD COLUMN exercise_name VARCHAR DEFAULT 'Unknown Exercise'"))
                conn.commit()
                logger.info("Successfully added 'exercise_name' column.")
            else:
                logger.info("Column 'exercise_name' already exists in exercise_sessions.")
            
            # Check domain column
            result = conn.execute(text("SELECT column_name FROM information_schema.columns WHERE table_name='exercise_sessions' AND column_name='domain'"))
            if not result.fetchone():
                logger.info("Column 'domain' missing in exercise_sessions. Adding it...")
                conn.execute(text("ALTER TABLE exercise_sessions ADD COLUMN domain VARCHAR DEFAULT 'BODY'"))
                conn.execute(text("CREATE INDEX IF NOT EXISTS ix_exercise_sessions_domain ON exercise_sessions (domain)"))
                conn.commit()
                logger.info("Successfully added 'domain' column.")
            else:
                 logger.info("Column 'domain' already exists in exercise_sessions.")

            # --- 2. CUSTOM EXERCISES TABLE ---
            # Check module column
            result = conn.execute(text("SELECT column_name FROM information_schema.columns WHERE table_name='custom_exercises' AND column_name='module'"))
            if not result.fetchone():
                logger.info("Column 'module' missing in custom_exercises. Adding it...")
                conn.execute(text("ALTER TABLE custom_exercises ADD COLUMN module VARCHAR DEFAULT 'RECONNECT'"))
                conn.commit()
                logger.info("Successfully added 'module' column.")
            else:
                 logger.info("Column 'module' already exists in custom_exercises.")

            # Check config_json column (just in case)
            result = conn.execute(text("SELECT column_name FROM information_schema.columns WHERE table_name='custom_exercises' AND column_name='config_json'"))
            if not result.fetchone():
                logger.info("Column 'config_json' missing in custom_exercises. Adding it...")
                conn.execute(text("ALTER TABLE custom_exercises ADD COLUMN config_json JSON"))
                conn.commit()
                logger.info("Successfully added 'config_json' column.")
            else:
                 logger.info("Column 'config_json' already exists in custom_exercises.")

            logger.info("Migration Complete.")
                
        except Exception as e:
            logger.error(f"Migration Failed: {e}")

if __name__ == "__main__":
    migrate()
