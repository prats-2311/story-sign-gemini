from sqlalchemy import create_engine, Column, Integer, String, JSON, DateTime
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os
import datetime

# Get DB URL from Environment (set in docker-compose)
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./local_history.db") # Fallback to SQLite for non-docker local dev

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

class SessionReport(Base):
    __tablename__ = "sessions"

    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)
    session_id = Column(String, index=True) # "demo_session_1"
    transcript = Column(String)
    clinical_notes = Column(JSON) # List of strings
    report_json = Column(JSON) # The full Gemini 3 analysis

def init_db():
    Base.metadata.create_all(bind=engine)
