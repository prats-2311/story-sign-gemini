import os
import json
from google import genai
from google.genai import types
import asyncio
import time
try:
    from utils.logging import logger
except ImportError:
    from backend.utils.logging import logger

class ReportDrafter:
    def __init__(self, api_key: str):
        self.client = genai.Client(api_key=api_key, http_options={"api_version": "v1alpha"})
        self.active_sessions = {} # { session_id: chat_session }
        self.locks = {} # { session_id: asyncio.Lock }
        
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
                model="gemini-3-flash-preview", 
                config=types.GenerateContentConfig(
                    system_instruction=self.SYSTEM_INSTRUCTION,
                    temperature=0.4 # Keep it analytical
                )
            )
            # Store chat AND a hunk counter
            self.active_sessions[session_id] = {"chat": chat, "chunks": 0}
            self.locks[session_id] = asyncio.Lock()
            logger.info(f"[ReportDrafter] Started Shadow Session: {session_id}")
            return True
        except Exception as e:
            logger.error(f"[ReportDrafter] Failed to start session: {e}")
            return False

    async def ingest_chunk(self, session_id: str, chunk_data: dict):
        """Feeds a 10s slice of data to the shadow brain."""
        if session_id not in self.active_sessions:
            # Auto-start if missing (resilience)
            logger.warning(f"[ReportDrafter] Session {session_id} not found. Starting new.")
            await self.start_session(session_id)
        
        session_data = self.active_sessions[session_id]
        chat = session_data["chat"]
        lock = self.locks.get(session_id)
        
        # Increment Counter
        session_data["chunks"] += 1
        chunk_num = session_data["chunks"]
        
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
            # Concurrency Safety: Ensure we don't overlap turns in the same chat
            async with lock:
                response = await chat.send_message(prompt)
                logger.debug(f"[ReportDrafter] Ingested Chunk #{chunk_num}. Brain said: {response.text[:20]}...")
            return True
        except Exception as e:
            logger.error(f"[ReportDrafter] Error ingesting chunk: {e}")
            return False

    async def finalize_report(self, session_id: str):
        """Triggers the final readout."""
        if session_id not in self.active_sessions: return {"error": "Session not found"}
        
        session_data = self.active_sessions[session_id]
        chat = session_data["chat"]
        total_chunks = session_data["chunks"]
        
        logger.info(f"[ReportDrafter] Finalizing Report for {session_id}. Total Chunks Processed: {total_chunks}")
        start_time = time.time()
        
        prompt = """
        [COMMAND: FINALIZE]
        Output the FINAL REPORT based on the chunks received.
        
        **Requirements:**
        1. **Speed:** Be concise. Bullet points over paragraphs.
        2. **Chart Data:** You MUST output the chart data as a SIMPLE ARRAY of objects.
        3. **SAMPLING:** You MUST downsample the data to **EXACTLY 20 POINTS**. Do NOT output raw high-frequency data.
        
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
                    max_output_tokens=8192, # [FIX] Prevent Truncation
                    temperature=0.2, # Lower temp for strict formatting (from legacy)
                )
            )
            
            elapsed = time.time() - start_time
            
            # Extract Thoughts if available (Start of the content usually)
            try:
                for part in response.candidates[0].content.parts:
                    if hasattr(part, 'thought') and part.thought:
                         # Log the thought process (truncated to avoid log spam if massive)
                        logger.info(f"[ReportDrafter] 🧠 Model Thought: {part.thought[:500]}...")
            except Exception:
                pass

            logger.info(f"[ReportDrafter] Report Generated in {elapsed:.2f}s. Usage: {response.usage_metadata}")
            
            # Cleanup
            del self.active_sessions[session_id]
            
            try:
                # [FIX] Strip Markdown Code Blocks
                clean_text = response.text.strip()
                if clean_text.startswith("```"):
                    clean_text = clean_text.split("```json")[-1].split("```")[0].strip()
                elif clean_text.startswith("`"): # sometimes single ticks
                    clean_text = clean_text.replace("`", "")
                
                result = json.loads(clean_text)
                
                # [FIX] Return the raw clinical notes too
                result["clinical_notes"] = list(session_data.get("notes", []))

                # [FIX] Enforce Chart Schema (x, y) if model returns t, val or others
                if result.get("chart_config") and result["chart_config"].get("data"):
                    raw_data = result["chart_config"]["data"]
                    mapped_data = []
                    for pt in raw_data:
                        # Map known aliases to x, y
                        x = pt.get("x") or pt.get("t") or pt.get("time") or 0
                        y = pt.get("y") or pt.get("val") or pt.get("value") or 0
                        mapped_data.append({"x": x, "y": y})
                    result["chart_config"]["data"] = mapped_data

                return result
            except json.JSONDecodeError:
                logger.warning(f"[ReportDrafter] JSON Parse Error. Attempting Repair.")
                
                # [REPAIR] Attempt to salvage truncated JSON
                try:
                    # 1. Find the last complete data point closure "}," inside the data array
                    last_obj_idx = clean_text.rfind("},")
                    if last_obj_idx != -1:
                        # Trim to that point and close the JSON structure
                        # Assumes structure: { ..., "chart_config": { ..., "data": [ { ... }, { ... } <TRUNCATED>
                        repaired_text = clean_text[:last_obj_idx+1] + "]}}" 
                        logger.info(f"[ReportDrafter] Repaired JSON: {repaired_text[-50:]}")
                        
                        result = json.loads(repaired_text)
                        
                        # Apply same schema fix to repaired result
                        if result.get("chart_config") and result["chart_config"].get("data"):
                            raw_data = result["chart_config"]["data"]
                            mapped_data = []
                            for pt in raw_data:
                                x = pt.get("x") or pt.get("t") or pt.get("time") or 0
                                y = pt.get("y") or pt.get("val") or pt.get("value") or 0
                                mapped_data.append({"x": x, "y": y})
                            result["chart_config"]["data"] = mapped_data
                            
                        result["clinical_notes"] = list(session_data.get("notes", []))
                        return result
                except Exception as repair_err:
                    logger.error(f"[ReportDrafter] Repair Failed: {repair_err}")

                return {"report_markdown": response.text, "chart_config": None, "clinical_notes": []}
        except Exception as e:
            logger.error(f"[ReportDrafter] Error finalizing: {e}")
            return {"report_markdown": "Error generating report.", "chart_config": None, "clinical_notes": []}
