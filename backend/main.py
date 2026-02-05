from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Request, Depends
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
import asyncio
import os
import json
import re
import base64
from google import genai
from google.genai import types
from utils.logging import logger 

load_dotenv(override=True)

api_key = os.getenv("GEMINI_API_KEY")
if not api_key:
    logger.error("GEMINI_API_KEY not found in environment variables.")
else:
    logger.info(f"Loaded GEMINI_API_KEY: {api_key[:4]}...{api_key[-4:]}")

# Initialize Gemini Client
client = genai.Client(api_key=api_key, http_options={"api_version": "v1alpha"})

app = FastAPI()

# Configure CORS
from fastapi.middleware.cors import CORSMiddleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # For development; restrict in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

try:
    # Try importing from current directory (Docker / Run inside backend)
    from session_manager import SessionManager
    from database import init_db, SessionReport, SessionLocal, engine
except ImportError:
    # Try importing as package (Run from root)
    from backend.session_manager import SessionManager
    from backend.database import init_db, SessionReport, SessionLocal, engine

# Init DB on startup
init_db()

# DB Dependency
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@app.get("/")
async def health_check():
    return {"status": "ok", "message": "StorySign Tunnel is running"}

# --- INCREMENTAL REPORTING API ---
try:
    from services.report_drafter import ReportDrafter
except ImportError:
    try:
        from backend.services.report_drafter import ReportDrafter
    except ImportError:
        logger.error("Could not import ReportDrafter service.")
        ReportDrafter = None

drafter = ReportDrafter(api_key=api_key) if ReportDrafter and api_key else None

@app.post("/session/start")
async def start_session_draft(request: Request):
    if not drafter: return JSONResponse(status_code=503, content={"error": "Drafter not initialized"})
    data = await request.json()
    session_id = data.get("session_id")
    success = await drafter.start_session(session_id)
    return {"status": "started" if success else "error"}

@app.post("/session/chunk")
async def ingest_session_chunk(request: Request):
    if not drafter: return JSONResponse(status_code=503, content={"error": "Drafter not initialized"})
    data = await request.json()
    session_id = data.get("session_id")
    success = await drafter.ingest_chunk(session_id, data)
    return {"status": "received" if success else "error"}

@app.post("/session/end")
async def finalize_session_draft(request: Request, db: SessionLocal = Depends(get_db)):
    if not drafter: return JSONResponse(status_code=503, content={"error": "Drafter not initialized"})
    data = await request.json()
    session_id = data.get("session_id")
    
    # 1. Get Final Report from Shadow Brain
    result = await drafter.finalize_report(session_id)
    
    # 2. Save to DB (Same logic as analyze_session)
    if "report_markdown" in result:
        try:
             # Basic persistence - assuming transcript was sent in chunks or finalize body?
             # For this hackathon MVP, we just save the Result JSON.
             db_report = SessionReport(
                 session_id=session_id,
                 transcript="[Incremental Session]", 
                 clinical_notes=[], # They are embedded in the report logic now
                 report_json=result
             )
             db.add(db_report)
             db.commit()
        except Exception as e:
            logger.error(f"DB Save Error: {e}")

    return result

@app.post("/analyze_session")
async def analyze_session(request: Request, db: SessionLocal = Depends(get_db)):
    try:
        data = await request.json()
        
        # safely get fields
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
           - Synthesize the "Notes" with the "Telemetry". 
           - E.g. "The user fatigued at 30s" (Proof: Velocity dropped to 0.1).
        2. **Visual Evidence**: Generate a configuration for a line chart that best proves your point (e.g. "Fatigue Curve" or "Consistency Graph").
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

        # Use Gemini 3 Pro Preview (As requested and available)
        response = client.models.generate_content(
            model="gemini-3-pro-preview", 
            # NOTE: Confirmed available in 'available_models_with_capabilities.txt'
            # Original code said "gemini-3-pro-preview". If that is valid, use it. 
            # Safest is to use the known working prompt/model combo, but let's stick to the user's "Gemini 3" request if possible.
            # Actually, let's use the one that works: "gemini-2.0-flash-exp" is usually safer for preview features unless "gemini-1.5-pro"
            # Let's check the previous code... it used "gemini-3-pro-preview". I will stick with that but be careful.
            # actually, standard is gemini-2.0-flash-exp for now in many envs. I'll stick to what was there.
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json"
            )
        )
        
        # Parse JSON
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
                logger.info(f"Saved Session Report {db_report.id} to DB")
            except Exception as db_e:
                logger.error(f"Failed to save to DB: {db_e}")

            return result
            
        except json.JSONDecodeError:
            logger.error(f"Failed to parse JSON response: {response.text}")
            return {
                "report_markdown": response.text,  # Fallback
                "chart_config": None,
                "thoughts": "Error parsing data visualization."
            }
    except Exception as e:
        logger.error(f"Error in deep think analysis: {e}")
        return JSONResponse(status_code=500, content={"error": str(e)})

@app.get("/history")
async def get_history(db: SessionLocal = Depends(get_db)):
    try:
        reports = db.query(SessionReport).order_by(SessionReport.timestamp.desc()).all()
        return reports
    except Exception as e:
        logger.error(f"Error fetching history: {e}")
        return JSONResponse(status_code=500, content={"error": str(e)})

# Instantiate Session Manager
session_manager = SessionManager()

@app.websocket("/ws/stream/{mode}")
async def stream(websocket: WebSocket, mode: str):
    await websocket.accept()
    logger.info(f"Client connected in mode: {mode}")

    sys_instruct = session_manager.get_system_instruction(mode)

    # Configure the session
    # Use the model identified by the user as supporting both Audio and Video
    model = "gemini-2.5-flash-native-audio-latest" 
    # Valid alternatives: "gemini-2.5-flash-native-audio-preview-12-2025"     
    clinical_tool_func = types.FunctionDeclaration(
        name="log_clinical_note",
        description="Log a clinical observation about the patient's form or progress. Silent.",
        parameters=types.Schema(
            type="OBJECT",
            properties={
                "note": types.Schema(type="STRING", description="The clinical observation.")
            },
            required=["note"]
        )
    )
    
    heartbeat_tool = types.FunctionDeclaration(
        name="log_heartbeat",
        description="Call this immediately when the session starts to confirm tool connectivity.",
        parameters=types.Schema(
            type="OBJECT",
            properties={},
        )
    )

    # Create the LiveConnectConfig with Tools
    try:
        config = types.LiveConnectConfig(
            response_modalities=["AUDIO"],
            system_instruction=types.Content(parts=[types.Part(text=sys_instruct)]),
            tools=[types.Tool(function_declarations=[clinical_tool_func, heartbeat_tool])]
        )
    except Exception as config_err:
        logger.critical(f"Failed to create LiveConnectConfig: {config_err}")
        await websocket.close(code=1008, reason="Configuration Error")
        return

    try:
        logger.info(f"Connecting to Gemini with model: {model}")
        
        async with client.aio.live.connect(model=model, config=config) as session:
            logger.info("Connected to Gemini API")

            # Create a queue for outgoing messages to Gemini to ensure serialization
            gemini_output_queue = asyncio.Queue()
            
            # Connection State for Circuit Breaker
            gemini_connection_active = True

            async def gemini_sender_worker():
                # Worker consuming messages from the queue and sending them to Gemini
                nonlocal gemini_connection_active
                while gemini_connection_active:
                    item = await gemini_output_queue.get()
                    if item is None: # Poison Label
                        break
                        
                    try:
                        func, kwargs = item
                        # [DEBUG] Trace Sending
                        msg_preview = str(kwargs)[:50]
                        logger.debug(f">> Sending to Gemini: {msg_preview}...")
                        
                        await func(**kwargs)
                        
                        logger.debug(f">> Sent to Gemini: {msg_preview}")

                    except Exception as e:
                            logger.error(f"Error in gemini sender worker: {e}")
                            # If 1007 or connection closed, break the circuit
                            if "1007" in str(e) or "closed" in str(e) or "Connection" in str(e):
                                logger.critical("Critical Gemini Error. Breaking Circuit.")
                                gemini_connection_active = False
                                await websocket.close(code=1008, reason="Gemini Protocol Error")
                                break
                    finally:
                        gemini_output_queue.task_done()

            # Start the worker task
            sender_task = asyncio.create_task(gemini_sender_worker())

            async def receive_from_client():
                # Reads from Frontend WebSocket and queues messages for Gemini
                nonlocal gemini_connection_active
                try:
                    while gemini_connection_active:
                        data = await websocket.receive_text()
                        
                        if not gemini_connection_active:
                            break

                        try:
                            msg = json.loads(data)
                            
                            # [NEW PROTOCOL]: Frontend controls the turn trigger
                            should_trigger = msg.get("trigger", False)
                            
                            if "text" in msg:
                                text_msg = msg["text"]
                                processed_as_data = False
                                
                                # Check for Data Header like [POSE_DATA]
                                tag_end = text_msg.find("] ")
                                if tag_end != -1:
                                    tag = text_msg[:tag_end+1]
                                    if tag == "[POSE_DATA]":
                                        try:
                                            json_data = text_msg[tag_end+2:].strip()
                                            
                                            if not json_data:
                                                raise ValueError("Empty JSON data")
                                                
                                            landmarks = json.loads(json_data)
                                            
                                            # [OPTIMIZATION]
                                            RECONNECT_LANDMARKS = {11, 12, 13, 14, 15, 16, 23, 24}
                                            compact_parts = []
                                            if isinstance(landmarks, list):
                                                for idx, lm in enumerate(landmarks):
                                                    if idx in RECONNECT_LANDMARKS:
                                                        x = round(lm.get("x", 0), 2)
                                                        y = round(lm.get("y", 0), 2)
                                                        compact_parts.append(f"{idx}:{x},{y}")
                                            
                                            optimized_msg = f"[POSE] {'|'.join(compact_parts)}"
                                            
                                            # Use the Frontend's Trigger Decision
                                            await gemini_output_queue.put((session.send, {"input": optimized_msg, "end_of_turn": should_trigger}))
                                            processed_as_data = True

                                        except Exception as e:
                                            logger.warning(f"Error optimizing data: {e} | Content: {repr(json_data) if 'json_data' in locals() else 'N/A'}")
                                            # Fall through to send original text
                                
                                if not processed_as_data:
                                    # Regular chat (Default to Trigger unless silenced explicitly)
                                    logger.info(f"backend received text: '{text_msg}'") # [DEBUG]
                                    
                                    # [DEBUG] Manual Force Trigger
                                    if "test note" in text_msg.lower():
                                        logger.info("!!! TRIGGER HIT: Sending Manual Note to Frontend !!!")
                                        await websocket.send_text(json.dumps({
                                            "type": "clinical_note", 
                                            "note": "SYSTEM TEST: This is a forced clinical note to verify UI."
                                        }))
                                    
                                    await gemini_output_queue.put((session.send, {"input": text_msg, "end_of_turn": True}))

                            elif "data" in msg:
                                # Handle Binary Data (Audio/Image)
                                mime_type = msg.get("mime_type")
                                base64_data = msg["data"]
                                
                                try:
                                    if mime_type.startswith("audio/"):
                                        await gemini_output_queue.put((session.send_realtime_input, {"audio": {"mime_type": mime_type, "data": base64_data}}))
                                    elif mime_type.startswith("image/"):
                                        # [FIX]: Make Video Passive ("Silent Observer")
                                        # Only trigger if frontend asked for it (e.g., Rep Completed)
                                        await gemini_output_queue.put((session.send_realtime_input, {"video": {"mime_type": mime_type, "data": base64_data}}))
                                        
                                        if should_trigger:
                                                await gemini_output_queue.put((session.send, {"input": "Analyze form now.", "end_of_turn": True}))

                                except Exception as send_err:
                                    logger.error(f"ERROR: queuing realtime input failed: {send_err}")
                        except json.JSONDecodeError:
                            # If raw text
                            logger.debug(f"Sending raw text to Gemini: {data}")
                            await gemini_output_queue.put((session.send, {"input": data, "end_of_turn": True}))
                except WebSocketDisconnect:
                    logger.info("Client disconnected")
                except Exception as e:
                    logger.error(f"Error receiving from client: {e}")
                finally:
                    gemini_connection_active = False # Signal other loops to stop

            async def receive_from_gemini():
                # Reads from Gemini and sends to Frontend WebSocket
                nonlocal gemini_connection_active
                try:
                    while gemini_connection_active:
                        async for response in session.receive():
                            # [DEBUG] Raw Response Trace
                            logger.debug(f"<< Raw Gemini Response: {response}")

                            # ---------------------------------------------------------
                            # 1. Handle Tool Calls (Top-Level in Live API)
                            # ---------------------------------------------------------
                            tool_call = response.tool_call
                            if tool_call:
                                for call in tool_call.function_calls:
                                    try:
                                        logger.info(f"Tool Call Received via Header: {call.name}")
                                        
                                        if call.name == "log_heartbeat":
                                            logger.info("UseHeartbeat: Alive")
                                            await websocket.send_text(json.dumps({
                                                "type": "clinical_note", 
                                                "note": "System: Tool Connectivity Confirmed (Heartbeat)"
                                            }))
                                            
                                            await gemini_output_queue.put((session.send, {
                                                "input": types.LiveClientToolResponse(
                                                    function_responses=[
                                                        types.FunctionResponse(
                                                            name=call.name,
                                                            id=call.id,
                                                            response={"status": "ok"}
                                                        )
                                                    ]
                                                )
                                            }))

                                        elif call.name == "log_clinical_note":
                                            # Extract arguments
                                            args = call.args
                                            note_text = args.get("note", "No content")
                                            logger.info(f"Tool Call Received: {note_text}")
                                            
                                            # A. Send to Frontend (Silent)
                                            await websocket.send_text(json.dumps({
                                                "type": "clinical_note", 
                                                "note": note_text
                                            }))
                                            
                                            # B. Respond to Gemini (Required)
                                            await gemini_output_queue.put((session.send, {
                                                "input": types.LiveClientToolResponse(
                                                    function_responses=[
                                                        types.FunctionResponse(
                                                            name=call.name,
                                                            id=call.id,
                                                            response={"status": "ok"}
                                                        )
                                                    ]
                                                )
                                            }))
                                            
                                    except Exception as tool_err:
                                        logger.error(f"Error handling tool call {call.name}: {tool_err}")

                            # ---------------------------------------------------------
                            # 2. Handle Content (Text/Audio)
                            # ---------------------------------------------------------
                            server_content = response.server_content
                            if server_content is not None:
                                model_turn = server_content.model_turn
                                if model_turn:
                                    for part in model_turn.parts:
                                        try:
                                            # Text Response
                                            if part.text:
                                                await websocket.send_text(json.dumps({"text": part.text}))
                                            
                                            # Audio Response
                                            elif part.inline_data:
                                                await websocket.send_text(json.dumps({
                                                    "audio": base64.b64encode(part.inline_data.data).decode('utf-8'),
                                                    "mime_type": part.inline_data.mime_type or "audio/pcm;rate=24000" 
                                                }))
                                                
                                        except Exception as content_err:
                                             logger.error(f"Error handling content part: {content_err}")
                                             gemini_connection_active = False
                                             break

                except Exception as e:
                    logger.error(f"Error receiving from Gemini: {e}")
                    gemini_connection_active = False

            # Run both loops
            await asyncio.gather(receive_from_client(), receive_from_gemini())

    except Exception as e:
        logger.error(f"Gemini connection error: {e}")
    finally:
         if 'sender_task' in locals():
             sender_task.cancel()
         # Check state before closing to prevent RuntimeError
         from starlette.websockets import WebSocketState
         try:
             if websocket.client_state == WebSocketState.CONNECTED:
                 await websocket.close()
         except RuntimeError:
             pass
