import os
import json
import logging
from google import genai
from google.genai import types

logger = logging.getLogger("uvicorn.error")

class ReportDrafter:
    def __init__(self, api_key: str):
        self.client = genai.Client(api_key=api_key, http_options={"api_version": "v1alpha"})
        self.active_sessions = {} # { session_id: chat_session }
        
        # The "Shadow Brain" Instructions
        self.SYSTEM_INSTRUCTION = """
        You are an expert Physical Therapist and Data Analyst. 
        You are observing a live rehabilitation session in real-time.
        
        **Your Goal:**
        Maintain a comprehensive "Running Draft" of the patient's performance. 
        I will send you data in "CHUNKS" (every ~10 seconds).
        
        **Each Chunk Contains:**
        1. "Notes": Real-time AI observations (e.g. "Elbow flare detected").
        2. "Telemetry": Raw sensor data (Time, Angle, Velocity).

        **Protocol:**
        - When you receive a CHUNK: Analyze it. Update your internal model of the patient's status. **Response: "Ack"**.
        - When you receive "FINALIZE": Output the Official Clinical Report based on ALL chunks.
        
        **Final Report Requirements:**
         - Markdown Format.
         - Cite specific telemetry evidence (e.g. "At 15s, velocity spiked to 0.5").
         - Include a "Chart Config" for a visualization that best tells the story.
        """

    async def start_session(self, session_id: str):
        """Initializes a new 'Shadow Brain' chat session."""
        try:
            chat = self.client.aio.chats.create(
                model="gemini-3-pro-preview", # Using the SOTA model as requested
                config=types.GenerateContentConfig(
                    system_instruction=self.SYSTEM_INSTRUCTION,
                    temperature=0.4 # Keep it analytical
                )
            )
            self.active_sessions[session_id] = chat
            logger.info(f"[ReportDrafter] Started Shadow Session: {session_id}")
            return True
        except Exception as e:
            logger.error(f"[ReportDrafter] Failed to start session: {e}")
            return False

    async def ingest_chunk(self, session_id: str, chunk_data: dict):
        """Feeds a 10s slice of data to the shadow brain."""
        if session_id not in self.active_sessions:
            logger.warning(f"[ReportDrafter] Session {session_id} not found. Auto-starting.")
            await self.start_session(session_id)
        
        chat = self.active_sessions[session_id]
        
        # Format the prompt
        prompt = f"""
        [DATA CHUNK]
        Time Window: {chunk_data.get('timestamp_start')}s - {chunk_data.get('timestamp_end')}s
        
        **AI Clinical Notes:**
        {json.dumps(chunk_data.get('notes', []))}
        
        **Telemetry Summary:**
        {json.dumps(chunk_data.get('telemetry', []))}
        """
        
        try:
            # We don't wait long for the Ack, we just fire and forget mostly, 
            # but here we await to ensure sequence.
            response = await chat.send_message(prompt)
            logger.debug(f"[ReportDrafter] Chunk Ingested. Brain said: {response.text[:20]}...")
            return True
        except Exception as e:
            logger.error(f"[ReportDrafter] Error ingesting chunk: {e}")
            return False

    async def finalize_report(self, session_id: str):
        """Triggers the final readout."""
        if session_id not in self.active_sessions:
            return {"error": "Session not active"}

        chat = self.active_sessions[session_id]
        
        prompt = """
        [COMMAND: FINALIZE]
        Output the FINAL REPORT based on the chunks received.
        
        **Requirements:**
        1. **Speed:** Be concise. Bullet points over paragraphs.
        2. **Chart Data:** You MUST output the chart data as a SIMPLE ARRAY of objects, matching the exact schema below. Do NOT use Vega-Lite or complex schemas.
        
        **Output Schema (Strict JSON):**
        {
            "report_markdown": "# Clinical Report\n...",
            "chart_config": {
                "title": "Range of Motion vs Time",
                "data": [
                    {"x": 10, "y": 45},
                    {"x": 20, "y": 90}
                ]
            },
            "thoughts": "Brief analysis summary"
        }
        """
        
        try:
            response = await chat.send_message(
                prompt,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    temperature=0.2 # Lower temp for strict formatting
                )
            )
            
            # Cleanup
            del self.active_sessions[session_id]
            
            return json.loads(response.text)
        except Exception as e:
            logger.error(f"[ReportDrafter] Error finalizing: {e}")
            return {"report_markdown": "Error generating report.", "chart_config": None}
