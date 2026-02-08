from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends
from sqlalchemy.orm import Session
from database import SessionLocal, SessionReport, ExerciseSession, SessionMetrics
try:
    from session_manager import SessionManager
except ImportError:
    from backend.session_manager import SessionManager
import json
import logging
import asyncio
import uuid
import time
import base64
import os

# --- LOGGING SETUP ---
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

router = APIRouter()

# Dependency
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# --- GEMINI CLIENT STUB (Replace with actual Google GenAI SDK if available) ---
try:
    from google import genai
    from google.genai import types
    SDK_INSTALLED = True
except ImportError as e:
    logger.error(f"Google GenAI SDK not found: {e}")
    SDK_INSTALLED = False

try:
    from config import GEMINI_API_KEY
except ImportError:
    GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

if SDK_INSTALLED and GEMINI_API_KEY:
    try:
        client = genai.Client(api_key=GEMINI_API_KEY, http_options={'api_version': 'v1alpha'})
        GEMINI_AVAILABLE = True
        logger.info(f"Gemini Live Client Initialized")
    except Exception as e:
        logger.error(f"Failed to initialize Gemini Client: {e}")
        GEMINI_AVAILABLE = False
        client = None
else:
    logger.warning(f"Gemini Unavailable. SDK: {SDK_INSTALLED}, Key: {bool(GEMINI_API_KEY)}")
    GEMINI_AVAILABLE = False
    client = None

# --- SESSION MANAGER ---
session_manager = SessionManager()

# --- WEBSOCKET CONNECTION MANAGER ---
class ConnectionManager:
    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: str):
        for connection in self.active_connections:
            await connection.send_text(message)

manager = ConnectionManager()

# --- HELPER: SYSTEM INSTRUCTIONS ---
# (Removed hardcoded version, using session_manager instead)

# --- TOOL DEFINITIONS ---
tools = [
    {
        "function_declarations": [
            {
                "name": "log_clinical_note",
                "description": "Log a clinical observation about the user's performance, pain, or improvement.",
                "parameters": {
                    "type": "OBJECT",
                    "properties": {
                        "note": {
                            "type": "STRING",
                            "description": "The observation text."
                        },
                        "category": {
                            "type": "STRING",
                            "enum": ["FORM", "PAIN", "PROGRESS", "GENERAL"],
                            "description": "Category of the observation"
                        }
                    },
                    "required": ["note"]
                }
            },
            {
                "name": "log_heartbeat",
                "description": "Call this immediately when the session starts to confirm tool connectivity.",
                "parameters": {
                    "type": "OBJECT",
                    "properties": {},
                }
            }
        ]
    }
]

@router.websocket("/ws/stream/{mode}")
async def websocket_endpoint(websocket: WebSocket, mode: str, db: Session = Depends(get_db)):
    await manager.connect(websocket)
    logger.info(f"WebSocket connected with mode: {mode}")

    # Initialize Session
    session_id = str(uuid.uuid4())
    logger.info(f"Started Session: {session_id}")
    
    # Notify Frontend of Session ID
    await websocket.send_json({"type": "session_started", "session_id": session_id})

    # --- CONFIGURATION ---
    # [LEGACY ADOPTION] Use the specific model from production code
    model = "gemini-2.5-flash-native-audio-latest" 
    
    # [SIMPLIFIED SYSTEM PROMPT] - Keeping this as it proved to work for Audio output
    sys_instruct = """
    You are an elite fitness coach AI. Your ONLY job is to provide real-time AUDIO feedback on exercises.
    
    INPUTS:
    1. VIDEO: You see the user exercising.
    2. EVENTS: You receive text triggers like "[EVENT] Rep Completed" or "[SAFETY_STOP]".
    
    OUTPUT RULES:
    1. AUDIO ONLY: Speak concisely. Do NOT output long text.
    2. TIMING: React IMMEDIATELY to events. 
    3. STYLE: Energetic, encouraging, professional.
    
    PROTOCOL:
    - Listen for "Rep Completed" events. Count them accurately. Say "One!", "Two!", "Good form!".
    - When you see "[SAFETY_STOP]", SHOUT a warning immediately.
    - When you see "[POSE] ...", analyze it silently. NOTIFY ONLY IF FORM IS BAD.
    
    Do NOT say "I am ready" or "Initializing". Just wait for the workout to start.
    """

    tools = [
        {
            "function_declarations": [
                {
                    "name": "log_clinical_note",
                    "description": "Log a clinical observation about the user's performance, pain, or improvement.",
                    "parameters": {
                        "type": "OBJECT",
                        "properties": {
                            "note": {"type": "STRING", "description": "The observation text."},
                            "category": {"type": "STRING", "enum": ["FORM", "PAIN", "PROGRESS", "GENERAL"]}
                        },
                        "required": ["note"]
                    }
                }
            ]
        }
    ]

    # Create Gemini Config
    # [FIX] Manually construct the config dict structure expected by the SDK
    config = {
        "response_modalities": ["AUDIO"], # Force Audio
        "system_instruction": {"parts": [{"text": sys_instruct}]},
        "tools": tools,
        "speech_config": {
            "voice_config": {"prebuilt_voice_config": {"voice_name": "Aoede"}} # Energetic voice
        }
    }

    try:
        # --- GEMINI LIVE LOOP ---
        if GEMINI_AVAILABLE:
            async with client.aio.live.connect(model=model, config=config) as session:
                logger.info(f"Connected to Gemini API ({model})")

                # ---------------------------------------------------------
                # ARCHITECTURE: ASYNC QUEUE + WORKER
                # Prevents race conditions (Error 1007) and enforces ordering
                # ---------------------------------------------------------
                gemini_output_queue = asyncio.Queue()
                gemini_connection_active = True

                async def gemini_sender_worker():
                    """Consumes messages from the queue and sends them to Gemini sequentially."""
                    nonlocal gemini_connection_active
                    while gemini_connection_active:
                        item = await gemini_output_queue.get()
                        if item is None: # Poison Label
                            break
                            
                        try:
                            func, kwargs = item
                            # [DEBUG] Trace Sending
                            # logger.debug(f">> Sending to Gemini: {str(kwargs)[:50]}...")
                            await func(**kwargs)
                            # logger.debug(f">> Sent success")

                        except Exception as e:
                            logger.error(f"Error in gemini sender worker: {e}")
                            if "1007" in str(e) or "closed" in str(e) or "Connection" in str(e):
                                logger.critical("Critical Gemini Error. Breaking Circuit.")
                                gemini_connection_active = False
                                await websocket.close(code=1008, reason="Gemini Protocol Error")
                                break
                        finally:
                            gemini_output_queue.task_done()

                # Start the worker task
                sender_task = asyncio.create_task(gemini_sender_worker())

                # ---------------------------------------------------------
                # TASK: RECEIVE FROM CLIENT (Frontend -> Queue)
                # ---------------------------------------------------------
                async def receive_from_client():
                    nonlocal gemini_connection_active
                    try:
                        while gemini_connection_active:
                            message = await websocket.receive_text()
                            if not gemini_connection_active:
                                break

                            try:
                                data = json.loads(message)
                                should_trigger = data.get("trigger", False)

                                # 1. HANDLE TEXT / EVENTS / POSE
                                if "text" in data:
                                    text_msg = data["text"]
                                    processed_as_data = False
                                    
                                    # [OPTIMIZATION] Detect and Compact Pose Data
                                    # Expected format: "[POSE_DATA] [{"x":...}, ...]"
                                    tag = "[POSE_DATA] "
                                    if tag in text_msg:
                                        try:
                                            # Extract JSON part
                                            json_part = text_msg.split(tag)[1]
                                            landmarks = json.loads(json_part)
                                            
                                            # Filter to Critical Body Parts (Shoulders, Elbows, Wrists, Hips)
                                            # IDs: 11,12 (Shoulders), 13,14 (Elbows), 15,16 (Wrists), 23,24 (Hips)
                                            RECONNECT_LANDMARKS = {11, 12, 13, 14, 15, 16, 23, 24}
                                            compact_parts = []
                                            
                                            if isinstance(landmarks, list):
                                                for idx, lm in enumerate(landmarks):
                                                    if idx in RECONNECT_LANDMARKS:
                                                        x = round(lm.get("x", 0), 2)
                                                        y = round(lm.get("y", 0), 2)
                                                        # z = round(lm.get("z", 0), 2) # Z is less critical for basic 2D form
                                                        compact_parts.append(f"{idx}:{x},{y}")
                                            
                                            optimized_msg = f"[POSE] {'|'.join(compact_parts)}"
                                            
                                            # Send Optimized Data (Trigger usually False for Pose)
                                            await gemini_output_queue.put((session.send, {"input": optimized_msg, "end_of_turn": should_trigger}))
                                            processed_as_data = True
                                            
                                        except Exception as e:
                                            logger.warning(f"Error optimizing pose data: {e}")
                                            # Fallback to original text if optimization fails
                                    
                                    if not processed_as_data:
                                        # Standard Event (e.g. "[EVENT] Rep Completed")
                                        logger.info(f"Frontend Event: {text_msg} (Trigger: {should_trigger})")
                                        await gemini_output_queue.put((session.send, {"input": text_msg, "end_of_turn": should_trigger}))

                                # 2. HANDLE BINARY (Audio/Image)
                                elif "realtimeInput" in data:
                                     # Audio Chunks from Frontend
                                     media_chunks = data["realtimeInput"]["mediaChunks"]
                                     for chunk in media_chunks:
                                         if chunk["mimeType"] == "audio/pcm":
                                             import base64
                                             await gemini_output_queue.put((session.send, {
                                                 "input": {
                                                     "data": base64.b64decode(chunk["data"]),
                                                     "mime_type": "audio/pcm"
                                                 },
                                                 "end_of_turn": False # Audio is passive stream
                                             }))

                                # 3. HANDLE LEGACY IMAGE/VIDEO
                                elif "mime_type" in data and data["mime_type"] == "image/jpeg":
                                    # Video Frames
                                    import base64
                                    await gemini_output_queue.put((session.send, {
                                        "input": {
                                            "data": base64.b64decode(data["data"]),
                                            "mime_type": "image/jpeg"
                                        },
                                        "end_of_turn": should_trigger # Video can trigger if coupled with event
                                    }))

                            except json.JSONDecodeError:
                                logger.warning("Received invalid JSON from frontend")
                    
                    except WebSocketDisconnect:
                        logger.info("Frontend disconnected")
                    except Exception as e:
                        logger.error(f"Error in receive_from_client: {e}")
                    finally:
                        gemini_connection_active = False
                        await gemini_output_queue.put(None) # Poison Pill

                # ---------------------------------------------------------
                # TASK: RECEIVE FROM GEMINI (Gemini -> Frontend)
                # ---------------------------------------------------------
                async def receive_from_gemini():
                    nonlocal gemini_connection_active
                    try:
                        while gemini_connection_active:
                            async for response in session.receive():
                                server_content = response.server_content
                                if server_content and server_content.model_turn:
                                    for part in server_content.model_turn.parts:
                                        if part.text:
                                            # logger.info(f"Gemini Text: {part.text[:50]}...")
                                            await websocket.send_json({"type": "text", "content": part.text})
                                        
                                        if part.inline_data:
                                            # logger.info(f"Gemini Audio ({len(part.inline_data.data)} bytes)")
                                            import base64
                                            b64_data = base64.b64encode(part.inline_data.data).decode('utf-8')
                                            await websocket.send_json({"type": "audio", "content": b64_data})

                                tool_call = response.tool_call
                                if tool_call:
                                    for fc in tool_call.function_calls:
                                        if fc.name == "log_clinical_note":
                                            args = fc.args
                                            note = args.get("note")
                                            await websocket.send_json({
                                                "type": "clinical_note", 
                                                "note": note,
                                                "category": args.get("category", "GENERAL")
                                            })
                                            
                                            # Acknowledge Tool
                                            await gemini_output_queue.put((session.send, {
                                                "input": types.LiveClientToolResponse(
                                                    function_responses=[
                                                        types.FunctionResponse(
                                                            name=fc.name,
                                                            id=fc.id,
                                                            response={"status": "ok"}
                                                        )
                                                    ]
                                                )
                                            }))

                    except Exception as e:
                         logger.error(f"Error in receive_from_gemini: {e}")
                         gemini_connection_active = False

                # Start Loops
                await asyncio.gather(receive_from_client(), receive_from_gemini())

    except Exception as e:
        logger.error(f"WebSocket Error: {e}")
        try:
            await websocket.close(code=1011)
        except:
            pass
    finally:
         manager.disconnect(websocket)
