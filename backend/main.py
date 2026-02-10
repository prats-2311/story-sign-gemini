from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from database import init_db
from utils.logging import logger 
import os

# Load Environment
load_dotenv(override=True)

# Initialize Database
init_db()

# Create App
app = FastAPI(title="StorySign Gemini API", version="2.0")

# CORS Setup
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # For development
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- IMPORT ROUTERS ---
# --- IMPORT ROUTERS ---
from routers import session, history, tools, websocket, exercises, plan, harmony, reconnect

# --- INCLUDE ROUTERS ---
app.include_router(session.router)
app.include_router(history.router)
app.include_router(tools.router)
app.include_router(exercises.router)

app.include_router(websocket.router)
app.include_router(plan.router)
app.include_router(harmony.router)
app.include_router(reconnect.router)

@app.get("/")
async def health_check():
    return {
        "status": "ok", 
        "message": "StorySign Tunnel is running (Modular V2)",
        "modules": ["session", "history", "tools", "exercises", "stream"]
    }

logger.info("Application Startup Complete. Routers Loaded.")
