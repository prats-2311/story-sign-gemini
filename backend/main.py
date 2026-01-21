from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Request
from dotenv import load_dotenv
import asyncio
import os
import json
import base64
from google import genai
from google.genai import types
from .session_manager import SessionManager

load_dotenv(override=True)

api_key = os.getenv("GEMINI_API_KEY")
if not api_key:
    print("Error: GEMINI_API_KEY not found in environment variables.")
else:
    print(f"Loaded GEMINI_API_KEY: {api_key[:4]}...{api_key[-4:]}")

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

        # Use standard GenAI client for non-streaming response (Deep Think)
        response = client.models.generate_content(
            model="gemini-3-flash-preview",
            contents=prompt
        )
        
        return {"report": response.text}
    except Exception as e:
        print(f"Error in deep think analysis: {e}")
        return {"report": "Could not generate report at this time."}

@app.websocket("/ws/stream/{mode}")
async def stream(websocket: WebSocket, mode: str):
    await websocket.accept()
    print(f"Client connected in mode: {mode}")

    sys_instruct = session_manager.get_system_instruction(mode)

    # Configure the session
    # Using the specific model ID from the Live API documentation
    model = "gemini-2.5-flash-native-audio-preview-12-2025"

    # Create the LiveConnectConfig
    # valid types.LiveConnectConfig args: response_modalities, system_instruction, speech_config, etc.
    config = types.LiveConnectConfig(
        response_modalities=["AUDIO"],  # Only one modality allowed for this model
        system_instruction=types.Content(parts=[types.Part(text=sys_instruct)])
    )

    try:
        print(f"Connecting to Gemini with model: {model}")
        
        async with client.aio.live.connect(model=model, config=config) as session:
            print("Connected to Gemini API")
            # System instruction is now part of the config, no need to send it separately.

            async def receive_from_client():
                """Reads from Frontend WebSocket and sends to Gemini"""
                try:
                    pose_frame_count = 0
                    while True:
                        data = await websocket.receive_text()
                        try:
                            msg = json.loads(data)
                            if "text" in msg:
                                text_msg = msg["text"]
                                if text_msg.startswith("[POSE_DATA]"):
                                    # Parse, Round, and Reserialize to save tokens & bandwidth
                                    try:

                                        pose_frame_count += 1
                                        # Trigger feedback roughly every 3-4 seconds (assuming ~10 FPS of pose updates)
                                        should_speak = (pose_frame_count % 30 == 0)

                                        json_part = text_msg.replace("[POSE_DATA] ", "")
                                        landmarks = json.loads(json_part)
                                        # Round all floats to 2 decimals
                                        simplified_landmarks = []
                                        for lm in landmarks:
                                            simplified_landmarks.append({
                                                "x": round(lm.get("x", 0), 2),
                                                "y": round(lm.get("y", 0), 2),
                                                "z": round(lm.get("z", 0), 2),
                                                "v": round(lm.get("visibility", 0), 2)
                                            })
                                        
                                        optimized_msg = f"[POSE_DATA] {json.dumps(simplified_landmarks)}"
                                        # print(f"DEBUG: Sending Optimized Pose (Frame {pose_frame_count})")
                                        
                                        # 1. Send Data (Context) - NEVER end turn here to avoid 1007 errors
                                        await session.send(input=optimized_msg, end_of_turn=False)

                                        # 2. Control (Trigger Response) - Decoupled trigger
                                        if should_speak:
                                            print(f"DEBUG: Triggering Gemini response (Frame {pose_frame_count})")
                                            await session.send(input="Briefly check my form.", end_of_turn=True)
                                            
                                    except Exception as e:
                                        print(f"Error optimizing pose data: {e}")
                                else:
                                    print(f"Sending text to Gemini: {text_msg}")
                                    await session.send(input=text_msg, end_of_turn=True)
                            elif "data" in msg:
                                # Handle Binary Data (Audio/Image)
                                mime_type = msg.get("mime_type")
                                base64_data = msg["data"]
                                
                                # Send to Gemini using send_realtime_input
                                # Crucial: We must send the BASE64 STRING, not raw bytes.
                                # The SDK's send_realtime_input helper expects the data field to be a base64 string
                                # when it constructs the JSON payload.
                                try:
                                    if mime_type.startswith("audio/"):
                                        # print(f"DEBUG: sending audio: {mime_type}")
                                        await session.send_realtime_input(audio={"mime_type": mime_type, "data": base64_data})
                                    elif mime_type.startswith("image/"):
                                        # print(f"DEBUG: sending video: {mime_type}")
                                        await session.send_realtime_input(video={"mime_type": mime_type, "data": base64_data})
                                except Exception as send_err:
                                    print(f"ERROR: session.send_realtime_input failed: {send_err}")
                                    import traceback
                                    traceback.print_exc()
                        except json.JSONDecodeError:
                            # If raw text
                            print(f"Sending raw text to Gemini: {data}")
                            await session.send(input=data, end_of_turn=True)
                except WebSocketDisconnect:
                    print("Client disconnected")
                except Exception as e:
                    print(f"Error receiving from client: {e}")

            async def receive_from_gemini():
                """Reads from Gemini and sends to Frontend WebSocket"""
                try:
                    while True:
                        async for response in session.receive():
                            # Gemini returns chunks. We need to parse them.
                            server_content = response.server_content
                            if server_content is None:
                                continue
                            
                            model_turn = server_content.model_turn
                            if model_turn:
                                for part in model_turn.parts:
                                    if part.text:
                                        print(f"Gemini: {part.text}")
                                        await websocket.send_text(json.dumps({"text": part.text}))
                                    elif part.inline_data:
                                        # Handle Audio (PCM)
                                        print(f"Gemini: Received audio chunk")
                                        base64_audio = base64.b64encode(part.inline_data.data).decode('utf-8')
                                        await websocket.send_text(json.dumps({
                                            "audio": base64_audio,
                                            "mime_type": part.inline_data.mime_type or "audio/pcm;rate=24000" 
                                        }))
                except Exception as e:
                    print(f"Error receiving from Gemini: {e}")

            # Run both loops
            await asyncio.gather(receive_from_client(), receive_from_gemini())

    except Exception as e:
        print(f"Gemini connection error: {e}")
        await websocket.close()
