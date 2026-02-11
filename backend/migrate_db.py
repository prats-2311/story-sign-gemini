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
        logger.info("Checking for missing columns...")
        
        try:
            # Check exercise_name column
            result = conn.execute(text("SELECT column_name FROM information_schema.columns WHERE table_name='exercise_sessions' AND column_name='exercise_name'"))
            if result.fetchone():
                logger.info("Column 'exercise_name' already exists.")
            else:
                logger.info("Column 'exercise_name' missing. Adding it...")
                conn.execute(text("ALTER TABLE exercise_sessions ADD COLUMN exercise_name VARCHAR DEFAULT 'Unknown Exercise'"))
                conn.commit()
                logger.info("Successfully added 'exercise_name' column.")
            
            # Check domain column
            result = conn.execute(text("SELECT column_name FROM information_schema.columns WHERE table_name='exercise_sessions' AND column_name='domain'"))
            if result.fetchone():
                logger.info("Column 'domain' already exists.")
            else:
                logger.info("Column 'domain' missing. Adding it...")
                conn.execute(text("ALTER TABLE exercise_sessions ADD COLUMN domain VARCHAR DEFAULT 'BODY'"))
                conn.execute(text("CREATE INDEX ix_exercise_sessions_domain ON exercise_sessions (domain)"))
                conn.commit()
                logger.info("Successfully added 'domain' column.")
                
        except Exception as e:
            logger.error(f"Migration Failed: {e}")

if __name__ == "__main__":
    migrate()
