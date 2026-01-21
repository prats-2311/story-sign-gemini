

# Design Document: StorySign (Gemini Edition)

## 1. Executive Summary

**StorySign** is a real-time, multimodal therapeutic agent designed to bridge the gap between clinical therapy and daily life. Unlike traditional accessibility tools that rely on static computer vision rules, StorySign uses **Gemini 2.0 Flash (Multimodal Live API)** to "see," "hear," and "reason" about user behavior in real-time.

The platform serves three distinct user needs through a single, unified "Neural Pipeline":

1. **ASL World:** An interactive storytelling companion for deaf children.
2. **Harmony:** A gamified social-emotional learning coach for neurodivergent users.
3. **Reconnect:** An AI physical therapy assistant for stroke rehabilitation.

## 2. System Architecture

The architecture follows the **"Stream-First" Pattern**. We do not process video on the server. We act as a low-latency secure tunnel between the user and Google's Multimodal Live API.

### High-Level Diagram

```mermaid
graph LR
    subgraph "Frontend (React 19)"
        Webcam[Webcam & Mic]
        VibeUI[Generative UI System]
    end

    subgraph "Backend (FastAPI)"
        WSTunnel[WebSocket Tunnel]
        SessionMgr[Session Manager]
    end

    subgraph "Google Cloud AI"
        Gemini[Gemini 2.0 Flash\n(Multimodal Live)]
        DeepThink[Gemini 3 Pro\n(Reasoning Model)]
    end

    subgraph "Persistence"
        TiDB[(TiDB Serverless)]
    end

    %% Data Flow
    Webcam --"AV Chunks (PCM+JPEG)"--> WSTunnel
    WSTunnel --"Bidi Stream"--> Gemini
    Gemini --"Real-time Feedback (JSON)"--> WSTunnel
    WSTunnel --"Feedback Event"--> VibeUI
    
    %% Long Term Memory
    Gemini --"Session Summary"--> DeepThink
    DeepThink --"Progress Report"--> TiDB

```

### Key Technical Decisions

* **Vision Engine:** **Gemini 2.0 Flash**. Replaces MediaPipe/OpenCV. Why? It understands *intent* and *micro-expressions*, not just landmarks.
* **Protocol:** **Bidirectional WebSockets** over HTTP/2. Ensures <500ms latency for "conversational" feel.
* **Backend Logic:** **Zero-Logic Proxy**. The backend strictly authenticates the user and forwards bytes. It does not look at the video frames.
* **Database:** **TiDB Serverless**. Used for storing structured "Deep Think" reports and user progress (e.g., "Range of motion improved by 12%").

---

## 3. The "Gemini Loop" (Data Flow)

This is the core implementation pattern for all three modules.

### Step 1: Client Capture

* **Video:** Resized to 640x480 (standard definition) to minimize bandwidth.
* **Audio:** 16kHz PCM (Raw audio).
* **Frequency:** Chunks sent every 100ms.

### Step 2: The Tunnel (Backend)

The FastAPI backend (`main.py`) handles the connection:

```python
# Pseudo-code for the Tunnel
@app.websocket("/ws/stream/{mode}")
async def stream(websocket: WebSocket, mode: str):
    # 1. Select the Persona based on Mode (ASL, Harmony, Reconnect)
    system_instruction = LOAD_PROMPT(mode)
    
    # 2. Open Bidi Stream to Google
    async with client.aio.live.connect(model="gemini-2.0-flash-exp", config=config) as session:
        # 3. Pipe Data Loop
        await asyncio.gather(
            receive_from_client_and_send_to_gemini(websocket, session),
            receive_from_gemini_and_send_to_client(session, websocket)
        )

```

### Step 3: The Intelligence (JSON Protocol)

Gemini is instructed to output **strict JSON** for every interaction. This allows the Frontend to update the UI programmatically.

**Standard Response Schema:**

```json
{
  "event_type": "feedback" | "story_update" | "correction",
  "content": {
    "text": "Great job! Your eyebrows are perfectly raised.",
    "emotion_detected": "Surprised",
    "confidence": 0.95
  },
  "ui_trigger": "confetti_explosion" // Optional: Tells frontend to play animation
}

```

---

## 4. Core Agents (The Three Minds)

We do not write code for features; we write **System Instructions**.

### Module A: ASL World (The Storyteller)

* **Role:** Interactive Narrator.
* **Input:** User signing words (e.g., "Tree", "Lion").
* **Logic:**
* Maintain story context ("We are in the forest").
* Wait for user input.
* If input matches context -> Advance Story.
* If input is wrong -> Give Handshape Hint.


* **Winning Factor:** The story changes dynamically based on *how* the user signs (e.g., signing "Run" fast makes the character run fast).

### Module B: Harmony (The Mirror)

* **Role:** Social-Emotional Coach.
* **Input:** Facial Expressions.
* **Logic:**
* "Simon Says" mechanic.
* Compare user face vs. Target Emotion.
* **Micro-Correction:** "Lift the left corner of your mouth slightly." (Gemini can see this!)


* **Winning Factor:** It teaches *nuance*, not just binary "Happy/Sad".

### Module C: Reconnect (The Therapist)

* **Role:** Physical Therapy Assistant.
* **Input:** Upper body movement.
* **Logic:**
* Count repetitions (Up/Down).
* Estimate Range of Motion (0-90 degrees).
* **Safety Monitor:** Detect signs of pain (grimacing) -> "Take a break."


* **Winning Factor:** Generates clinical-grade reports for doctors using Gemini 3 Pro.

---

## 5. Persistence & Deep Think (TiDB Integration)

While Gemini Flash handles the "Live" interaction, **Gemini 3 Pro** handles the "Reasoning."

### Database Schema (TiDB)

```sql
CREATE TABLE session_logs (
    id VARCHAR(255) PRIMARY KEY,
    user_id VARCHAR(255),
    mode ENUM('ASL', 'HARMONY', 'RECONNECT'),
    raw_transcript TEXT, -- What happened (JSON dump)
    ai_analysis JSON, -- The "Deep Think" report
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

```

### The "Deep Think" Workflow

1. **Session End:** User clicks "Finish Exercise."
2. **Upload:** Backend sends the session transcript to Gemini 3 Pro.
3. **Prompt:** *"Analyze this physical therapy session. Calculate the average fatigue rate and suggest 3 adjustments for next week."*
4. **Save:** Result stored in TiDB for the user's dashboard.

---

## 6. Implementation Roadmap

### Phase 1: The Skeleton (Days 1-3)

* [ ] Setup FastAPI with `google-genai` SDK.
* [ ] Create "Echo" WebSocket (Frontend sends video, Backend sends it back).
* [ ] Validate `useGeminiLive` hook in React.

### Phase 2: The Brains (Days 4-7)

* [ ] **Prompt Engineering:** Test "Harmony" prompt in AI Studio until 95% reliable.
* [ ] **Prompt Engineering:** Test "Reconnect" prompt for rep counting.
* [ ] Integrate Prompts into Backend `SessionManager`.

### Phase 3: The "Vibe" (Days 8-10)

* [ ] Build "Optimistic UI" (UI reacts instantly to "Start" command).
* [ ] Add Audio Output (Text-to-Speech) for a conversational feel.
* [ ] Polish the "Deep Think" Dashboard.

## 7. Security & Privacy

* **Ephemeral Processing:** Video frames are processed in RAM and discarded. They are never saved to disk.
* **TiDB Security:** All persistent data is encrypted at rest.
* **Safety Filters:** Gemini Safety Settings enabled to prevent inappropriate responses during story mode.

## 8. Development Setup & Run Instructions

### Prerequisites
- Python 3.9+
- Node.js 18+
- [Google AI Studio API Key](https://aistudio.google.com/app/apikey)

### Backend Setup (FastAPI)
1. Navigate to the project root.
2. Create and activate a virtual environment:
   ```bash
   python3 -m venv venv
   source venv/bin/activate  # Windows: venv\\Scripts\\activate
   ```
3. Install dependencies:
   ```bash
   pip install -r backend/requirements.txt
   ```
4. Configure Environment Variables:
   - Edit `backend/.env` and add your `GEMINI_API_KEY`.
5. Run the Server:
   ```bash
   uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
   ```

### Frontend Setup (React + Vite)
1. Navigate to the project root.
2. Install dependencies (if not already done):
   ```bash
   cd frontend && npm install && cd ..
   ```
3. Run the Development Server:
   ```bash
   cd frontend && npm run dev
   ```