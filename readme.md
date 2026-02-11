

# Design Document: StorySign (Gemini Edition)

## 1. Executive Summary

**StorySign** is a real-time, multimodal therapeutic agent designed to bridge the gap between clinical therapy and daily life. Unlike traditional accessibility tools that rely on static computer vision rules, StorySign uses **Gemini 2.5-audio Flash (Multimodal Live API)** to "see," "hear," and "reason" about user behavior in real-time.

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
        Gemini["Gemini 2.5-audio Flash\n(Multimodal Live)"]
        DeepThink["Gemini 3 Pro\n(Reasoning Model)"]
    end

    subgraph "Persistence"
        Postgres[(Postgres Serverless)]
    end

    %% Data Flow
    Webcam --"AV Chunks (PCM+JPEG)"--> WSTunnel
    WSTunnel --"Bidi Stream"--> Gemini
    Gemini --"Real-time Feedback (JSON)"--> WSTunnel
    WSTunnel --"Feedback Event"--> VibeUI
    
    %% Long Term Memory
    Gemini --"Session Summary"--> DeepThink
    DeepThink --"Progress Report"--> Postgres

```

### Key Technical Decisions

* **Vision Engine:** **Gemini 2.5-audio Flash**. Replaces MediaPipe/OpenCV. Why? It understands *intent* and *micro-expressions*, not just landmarks.
* **Protocol:** **Bidirectional WebSockets** over HTTP/2. Ensures <500ms latency for "conversational" feel.
* **Backend Logic:** **Zero-Logic Proxy**. The backend strictly authenticates the user and forwards bytes. It does not look at the video frames.
* **Database:** **Postgres Serverless**. Used for storing structured "Deep Think" reports and user progress (e.g., "Range of motion improved by 12%").

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
    async with client.aio.live.connect(model="gemini-2.5-audio-flash-exp", config=config) as session:
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

## 5. Persistence & Deep Think (Postgres Integration)

While Gemini Flash handles the "Live" interaction, **Gemini 3 Pro** handles the "Reasoning."

### Database Schema (Postgres)

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
4. **Save:** Result stored in Postgres for the user's dashboard.

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
* **Postgres Security:** All persistent data is encrypted at rest.
* **Safety Filters:** Gemini Safety Settings enabled to prevent inappropriate responses during story mode.

## 8. Development Setup & Run Instructions

We support two ways to run StorySign: **Hybrid Mode** (recommended for rapid development) and **Container Mode** (recommended for production/full isolation).

### Option 1: Hybrid Mode (Local Dev)
* **Best for:** Frontend/Backend feature development.
* **Database:** Uses **SQLite** (`local_history.db`) automatically. No Docker required.

#### 1. Backend (FastAPI)
```bash
# Terminal A
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
# Create .env with GEMINI_API_KEY=...
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```
*Backend runs on http://localhost:8000*

#### 2. Frontend (React + Vite)
```bash
# Terminal B
cd frontend
npm install
npm run dev
```
*Frontend runs on http://localhost:5173*

---

### Option 2: Container Mode (Docker)
* **Best for:** Testing full deployment, Caddy routing, and PostgreSQL integration.
* **Database:** Uses **PostgreSQL** in a container.

```bash
# Root Directory
docker-compose up --build
```
*App runs on http://localhost (via Caddy reverse proxy)*

### ⚠️ Database Note
* **Local Mode** uses `sqlite:///./local_history.db`.
* **Docker Mode** uses `postgresql://user:password@db:5432/storysign`.
* **Schema Sync:** The application code (`main.py` -> `init_db()`) automatically creates the schema tables on startup for whichever database is active.
* **Advanced:** To use Docker Postgres with Local Backend, add `DATABASE_URL=postgresql://user:password@localhost:5432/storysign` to your local `.env`.

---

## 9. API Reference & Workflows

### Core Loop: The "Shadow Brain"
StorySign uses a unique **"Two-Brain" Architecture** to handle real-time interaction and deep analysis simultaneously.

1.  **Fast Brain (Gemini 2.5-audio Flash)**: Handles the WebSocket stream (`/ws/stream/{mode}`). It sees the user, counts reps, and gives instant audio feedback. It generates a "transcript" of events.
2.  **Slow Brain (Shadow Drafter)**: The backend collects these events in the background. When the session ends, it sends the full transcript to **Gemini 3 Pro** (or Flash Thinking) to generate a structured JSON report (`SessionReport`), which is then saved to the database.

### API Endpoints
All endpoints are prefix-routed (e.g., `/session`, `/exercises`).

| Module | Method | Endpoint | Description |
| :--- | :--- | :--- | :--- |
| **Session** | `POST` | `/session/start` | Initializes a "Shadow Draft" context for the user. |
| | `POST` | `/session/chunk` | Non-blocking ingestion of session events for the report. |
| | `POST` | `/session/end` | Triggers the AI Analyst to generate the final report & save to DB. |
| | `GET` | `/session/history` | Retrieves past sessions with filtering (Domain, Date). |
| **Exercises** | `POST` | `/exercises/custom` | Create a new custom exercise configuration. |
| | `POST` | `/exercises/generate` | Uses LLM to generate a valid exercise schema from text description. |
| **Plan** | `GET` | `/plan/daily` | Generates a specific recovery plan for the day based on history. |
| **Stream** | `WS` | `/ws/stream/{mode}` | The real-time bidirectional audio/video pipe. |

### Module Specifics

#### 1. Reconnect (Physical Therapy)
*   **Mode:** `RECONNECT`
*   **Tool Used:** `log_clinical_note(note, category)`
*   **Workflow:** The AI watches movement. When it sees an issue (e.g., "Left arm lagging"), it calls `log_clinical_note`. This note is spoken to the user AND saved for the post-session report.

#### 2. Harmony (Emotion Coaching)
*   **Mode:** `HARMONY`
*   **Tool Used:** `update_emotion_ui(emotion, confidence, feedback)`
*   **Workflow:** The AI mimics the user's facial expression. It calls `update_emotion_ui` to drive the frontend visualizer (e.g., filling the "Happy Meter") in real-time.

#### 3. ASL World (Storytelling)
*   **Mode:** `ASL`
*   **Workflow:** Uses a custom `system_instruction` to act as a dungeon master. It waits for specific hand signs (detected by vision) to advance the narrative nodes.

## 10. License

**StorySign** is © 2026 Prateek Srivastava. All rights reserved.

This project is intended for educational and therapeutic demonstration purposes.
