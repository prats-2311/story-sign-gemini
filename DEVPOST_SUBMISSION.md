# StorySign: The AI Physical Therapist

## Inspiration
Physical therapy is often expensive, inaccessible, or simply boring. Patients recovering from strokes or injuries need **immediate, continuous feedback**, not just a weekly appointment. We realized that while large language models are great at text, they lacked the "eyes" to guide physical movement in real-time. With the release of **Gemini 2.0 Flash** and its Multimodal Live API, we saw an opportunity to build **Reconnect**—a _"digital therapist"_ that doesn't just watch but *understands* user intent, biomechanics, and safety—bridging the gap between clinical care and daily life.

## What it does
StorySign is a real-time multimodal AI platform. Our flagship module, **Reconnect**, is a fully functional AI Physical Therapist that:

1.  **Monitors Form in Real-Time:** Uses computer vision to track skeletal landmarks at 60 FPS.
2.  **Counts & Corrects:** Automatically counts repetitions (e.g., "Five!") and detects specific form errors (e.g., "Keep your back straight") using a deterministic physics engine.
3.  **Ensures Safety:** Instantly triggers a `[SAFETY_STOP]` if it detects high-velocity spasms or dangerous ranges of motion.
4.  **Generates Clinical Reports:** Uses **Gemini 3.0** ("Deep Think") to analyze the session's telemetry and generate a professional progress report for human therapists.

### Platform Vision (Beta Modules)
We are also expanding StorySign to include:
*   **ASL World:** An interactive storyteller for deaf children.
*   **Harmony:** A social-emotional learning coach for neurodivergent users.

## How we built it
We adopted a **"Stream-First" Hybrid Architecture** to balance ultra-low latency with high intelligence.

### 1. The "Reflex" Layer (React 19 + Physics)
We use client-side computer vision (Mediapipe) to run 60 FPS physics checks. The core innovation is our **Universal Physics Engine**, which calculates biomechanical angles in real-time using vector math.

For example, to detect if a patient is "cheating" during a shoulder exercise by leaning their torso, we calculate the vector angle $\theta$ between the Torso Vector $\vec{v}_{torso}$ and the Vertical Axis $\vec{v}_{up}$ using the dot product formula:

$$
\theta = \arccos \left( \frac{\vec{v}_{torso} \cdot \vec{v}_{up}}{|\vec{v}_{torso}| |\vec{v}_{up}|} \right)
$$

If $\theta > 15^\circ$, the system triggers a `[SAFETY_STOP]` event before the AI even speaks.

### 2. The "Brain" Layer (Gemini Tunnel)
When a significant event works, we tunnel it through a **FastAPI WebSocket** directly to Gemini. We devised a "Clinical Scribe" protocol to prevent the model from hallucinating or talking over the user.

```python
# The System Prompt enforces a "Scribe" persona
RECONNECT_SYSTEM_INSTRUCTION = """
You are a Clinical Scribe and Therapist.
- TRIGGER: If you see [EVENT] Rep 5, say "Five!".
- CONSTRAINT: NEVER read the JSON headers aloud.
- SAFETY: If [SAFETY_STOP] is received, interrupt immediately.
"""
```

### 3. The "Reasoning" Layer (Gemini 3.0)
After the session, we use **Gemini 3.0 Flash Preview** ("Thinking Mode") to analyze the raw telemetry logs. It synthesizes thousands of data points into a human-readable progress report.

## Challenges we ran into
*   **The "Silence" Problem:** Early versions of the model were too chatty. We had to implement a specific protocol that keeps the model silent until a relevant event is triggered.
*   **Race Conditions:** Coordinating the WebSocket stream with the async Gemini API caused message ordering issues. We solved this by implementing an `asyncio.Queue` worker pattern.
*   **Prompt Engineering for Biomechanics:** Teaching a text model to understand 3D space was difficult. We switched to a hybrid approach where the frontend sends **Semantic Tags** (e.g., `[EVENT] TORSO_LEAN`) instead of raw coordinates.

## Accomplishments that we're proud of
*   **Sub-100ms Latency:** The system feels truly conversational.
*   **Evidence-Based UI:** Our "Deep Think" reports provide actual medical value, not just generic advice.
*   **Universal Physics Engine:** We can generate new physical therapy exercises on the fly just by describing them in plain English.

## What we learned
We learned that **Hybrid AI** is the future of real-time apps. You cannot delegate *everything* to the LLM; you need deterministic code for safety components (like the physics engine), combined with the LLM's reasoning for context and empathy.

## What's next for StorySign
*   [ ] **Clinical Validation:** Partnering with local PT clinics.
*   [ ] **Avatar Integration:** Replacing voice-only feedback with a 3D avatar.
*   [ ] **Wearable Support:** Integrating Apple Watch heart-rate data.
