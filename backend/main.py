from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Request
from dotenv import load_dotenv
import asyncio
import os
import json
import base64
from google import genai
from google.genai import types
from .session_manager import SessionManager
from .utils.logging import logger 

load_dotenv(override=True)

api_key = os.getenv("GEMINI_API_KEY")
if not api_key:
    logger.error("GEMINI_API_KEY not found in environment variables.")
else:
    logger.info(f"Loaded GEMINI_API_KEY: {api_key[:4]}...{api_key[-4:]}")

app = FastAPI()
session_manager = SessionManager()
client = genai.Client(api_key=api_key, http_options={"api_version": "v1alpha"})

@app.get("/")
async def health_check():
    return {"status": "ok", "message": "StorySign Tunnel is running"}

@app.post("/analyze_session")
async def analyze_session(request: Request):
    try:
        data = await request.json()
        transcript = data.get("transcript", "")
        pose_summary = data.get("pose_summary", "")

        prompt = f"""
        You are an expert Physical Therapist analyzing a patient's session.
        
        **Session Context:**
        Transcript: {transcript}
        Pose Data Summary: {pose_summary}

        **Task:**
        Generate a concise but professional "Progress Report" (max 150 words).
        1. Evaluate form correctness based on pose data (e.g. range of motion).
        2. Highlight improvements.
        3. Suggest specific focus areas for next time.
        
        Output format: Markdown.
        """

        # Use Gemini 3 Flash Preview (Confirmed Availability)
        # This provides the superior reasoning capabilities for the Hackathon.
        response = client.models.generate_content(
            model="gemini-3-flash-preview", 
            contents=prompt,
            config=types.GenerateContentConfig(
                thinking_config=types.ThinkingConfig(include_thoughts=True)
            )
        )
        
        return {"report": response.text}
    except Exception as e:
        logger.error(f"Error in deep think analysis: {e}")
        return {"report": "Could not generate report at this time."}

@app.websocket("/ws/stream/{mode}")
async def stream(websocket: WebSocket, mode: str):
    await websocket.accept()
    logger.info(f"Client connected in mode: {mode}")

    sys_instruct = session_manager.get_system_instruction(mode)

    # Configure the session
    # Using the standard experimental model which supports Multimodal Live API (Video + Audio)
    model = "gemini-2.0-flash-exp"

    # Create the LiveConnectConfig
    config = types.LiveConnectConfig(
        response_modalities=["AUDIO"],  # Only one modality allowed for this model
        system_instruction=types.Content(parts=[types.Part(text=sys_instruct)])
    )

    try:
        logger.info(f"Connecting to Gemini with model: {model}")
        
        async with client.aio.live.connect(model=model, config=config) as session:
            logger.info("Connected to Gemini API")

            # Create a queue for outgoing messages to Gemini to ensure serialization
            gemini_output_queue = asyncio.Queue()
            
            # Connection State for Circuit Breaker
            gemini_connection_active = True

            async def gemini_sender_worker():
                """Worker consuming messages from the queue and sending them to Gemini"""
                nonlocal gemini_connection_active
                while gemini_connection_active:
                    item = await gemini_output_queue.get()
                    if item is None: # Poison Label
                        break
                        
                    try:
                        func, kwargs = item
                        await func(**kwargs)
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
                """Reads from Frontend WebSocket and queues messages for Gemini"""
                nonlocal gemini_connection_active
                try:
                    while gemini_connection_active:
                        data = await websocket.receive_text()
                        
                        if not gemini_connection_active:
                            break

                        try:
                            msg = json.loads(data)
                            if "text" in msg:
                                text_msg = msg["text"]
                                # Check for Data Header like [POSE_DATA]
                                tag_end = text_msg.find("] ")
                                if tag_end != -1:
                                    try:
                                        tag = text_msg[:tag_end+1]
                                        json_data = text_msg[tag_end+2:]
                                        
                                        landmarks = json.loads(json_data)
                                        
                                        # [OPTIMIZATION]: Filter for ONLY needed landmarks and use a compact string
                                        # Reconnect Critical Landmarks: Shoulders(11,12), Elbows(13,14), Wrists(15,16)
                                        RECONNECT_LANDMARKS = {11, 12, 13, 14, 15, 16}
                                        compact_parts = []
                                        
                                        if isinstance(landmarks, list):
                                            for idx, lm in enumerate(landmarks):
                                                if idx in RECONNECT_LANDMARKS:
                                                    x = round(lm.get("x", 0), 2)
                                                    y = round(lm.get("y", 0), 2)
                                                    compact_parts.append(f"{idx}:{x},{y}")
                                        
                                        # Format: [POSE] 11:0.45,0.22|12:0.55,0.23...
                                        optimized_msg = f"[POSE] {'|'.join(compact_parts)}"
                                        
                                        # [FIX]: Heartbeat Protocol
                                        # Send pose data WITHOUT end_of_turn (False).
                                        # This builds "context" at low frequency without forcing the model to start a response.
                                        await gemini_output_queue.put((session.send, {"input": optimized_msg, "end_of_turn": False}))

                                    except Exception as e:
                                        logger.warning(f"Error optimizing data: {e}")
                                        await gemini_output_queue.put((session.send, {"input": text_msg, "end_of_turn": True}))
                                else:
                                    # User text messages always trigger a turn
                                    logger.debug(f"Sending text to Gemini: {text_msg}")
                                    await gemini_output_queue.put((session.send, {"input": text_msg, "end_of_turn": True}))

                            elif "data" in msg:
                                # Handle Binary Data (Audio/Image)
                                mime_type = msg.get("mime_type")
                                base64_data = msg["data"]
                                
                                try:
                                    if mime_type.startswith("audio/"):
                                        await gemini_output_queue.put((session.send_realtime_input, {"audio": {"mime_type": mime_type, "data": base64_data}}))
                                    elif mime_type.startswith("image/"):
                                        # [FIX]: Use the 1 FPS Video Frame as the "Heartbeat Trigger"
                                        # 1. Send the image data
                                        await gemini_output_queue.put((session.send_realtime_input, {"video": {"mime_type": mime_type, "data": base64_data}}))
                                        # 2. Trigger the turn explicitly.
                                        await gemini_output_queue.put((session.send, {"input": "Check form.", "end_of_turn": True}))

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
                """Reads from Gemini and sends to Frontend WebSocket"""
                nonlocal gemini_connection_active
                try:
                    while gemini_connection_active:
                        async for response in session.receive():
                            # Gemini returns chunks. We need to parse them.
                            server_content = response.server_content
                            if server_content is None:
                                continue
                            
                            model_turn = server_content.model_turn
                            if model_turn:
                                for part in model_turn.parts:
                                    try:
                                        if part.text:
                                            await websocket.send_text(json.dumps({"text": part.text}))
                                        elif part.inline_data:
                                            await websocket.send_text(json.dumps({
                                                "audio": base64.b64encode(part.inline_data.data).decode('utf-8'),
                                                "mime_type": part.inline_data.mime_type or "audio/pcm;rate=24000" 
                                            }))
                                    except Exception:
                                        # Client disconnected during send
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
