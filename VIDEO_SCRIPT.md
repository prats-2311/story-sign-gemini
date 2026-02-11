# StorySign Video Submission Script (Max 3 Minutes)

**Goal:** Convince judges that "Reconnect" is a breakthrough in AI therapy because it is *safe*, *fast*, and *intelligent*.

| Time | Section | Visual / Action | Audio / Script Concept |
| :--- | :--- | :--- | :--- |
| **0:00 - 0:25** | **The Hook (The Problem)** | Stock footage of a lonely patient doing rehab exercises wrong, or a split screen of a bored patient vs. an expensive therapist. | "Physical therapy is expensive, inaccessible, and boring. For stroke survivors, practicing alone is dangerous. LLMs can talk, but they can't *see* or *judge* movement safely... until now." |
| **0:25 - 0:45** | **The Solution** | Logo Animation: **StorySign**. Transition to the **"Reconnect"** Dashboard. | "Meet **StorySign**. Our flagship module, **Reconnect**, is the world's first real-time, multimodal AI Physical Therapist powered by Gemini 2.0 Flash." |
| **0:45 - 2:00** | **The Live Demo (The Hero)** | **(Screen Record this live!)**<br>1. User stands in front of camera.<br>2. AI says "Ready when you are."<br>3. User does 3 good reps. AI counts "One, Two, Three" instantly.<br>4. **CRITICAL:** User purposefully leans (cheats). AI stops counting. **Show the HUD turning red.**<br>5. AI says: "Keep your back straight."<br>6. **User moves too fast.** AI shouts "Slow down!" (Safety Stop). | "Watch this. It’s not just watching video; it’s measuring physics at 60 frames per second.<br><br>Notice the latency. As soon as I finish a rep, Gemini speaks. It's sub-100 milliseconds.<br><br>But here's the magic: **Safety.** If I lean too much, or move too fast, the **Physics Engine** intervenes *before* the AI even processes the frame. It's a digital guardrail." |
| **2:00 - 2:30** | **The Tech (Hybrid Engine)** | Show an architecture diagram (React <-> WebSocket <-> Gemini).<br>Flash the code snippet of the `[SAFETY_STOP]` logic or the Vector Math formula. | "How did we make it so fast? We didn't send raw video to the cloud. We built a **Hybrid Engine**.<br><br>The Frontend runs a deterministic **Universal Physics Engine** calculating vector angles on-device. It sends *events* to Gemini via a low-latency WebSocket tunnel. Gemini acts as the 'Clinical Scribe,' reducing hallucination to near zero." |
| **2:30 - 2:50** | **The "Deep Think"** | Show the **Clinical Report** generation (The Markdown/Charts). | "After the session, we use **Gemini 3.0** in 'Deep Think' mode to analyze the raw telemetry and generate a professional clinical report for human doctors." |
| **2:50 - 3:00** | **Outro** | Rapid montage of ASL World and Harmony screens (just to show vision). | "We're starting with Reconnect, but StorySign is a platform for ASL and Emotional Learning too. We're bridging the gap between clinic and home. Thank you." |

## Production Tips
1.  **Don't fake the demo.** Judges love seeing the AI react to your real movements.
2.  **Audio Quality matters.** Use a good mic for your voiceover.
3.  **Zoom in.** When showing the code or the report, zoom in so it's readable on a small screen.
