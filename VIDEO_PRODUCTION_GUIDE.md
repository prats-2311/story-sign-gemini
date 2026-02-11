# StorySign Video Production Guide

Since I cannot record the video for you (I don't have a webcam or body!), here is the fastest way to produce a high-scoring 3-minute video on your Mac.

## Option A: The "Pro" Way (QuickTime + iMovie/CapCut)
**Best for:** High quality, separate voiceover, editing out mistakes.

### 1. Preparation
*   **Launch the App:** Ensure `docker-compose up` is running. Open `http://localhost` (or your local IP).
*   **Clean Up:** Hide desktop icons. Close irrelevant browser tabs.
*   **Zoom In:** In VS Code, increase font size (`Cmd +`) so the code is readable on mobile screens.

### 2. Recording the Screen (The Assets)
Open **QuickTime Player** -> `File > New Screen Recording`.
*   **Shot 1: The Hero Demo (60s)**
    *   Record yourself (or a friend) using the **Reconnect** module.
    *   *Action:* Do 3 good reps. Then do a **"Bad Form"** rep (lean torso). Then move **"Too Fast"**.
    *   *Goal:* Capture the UI turning RED and the Safety Stop triggering.
*   **Shot 2: The Dashboard (20s)**
    *   Click around the menu. Show the "Deep Think" Report charts.
*   **Shot 3: The Code (30s)**
    *   Open `frontend/src/exercises/AbductionPhysics.ts`. Highlight the vector math.
    *   Open `backend/prompts/reconnect.py`. Highlight the "Clinical Scribe" prompt.
*   **Shot 4: The Intro/Outro (Optional)**
    *   Record your face via Webcam (`New Movie Recording`) introducing the project.

### 3. Editing
*   Open **iMovie** (Free on Mac) or **CapCut** (Web/App).
*   Drag all your clips in.
*   **Trim:** Cut out the silence/setup. Keep it tight.
*   **Voiceover:** Record the voiceover *while watching the edited video* to match the timing of the script.

---

## Option B: The "Fast" Way (Loom)
**Best for:** Running out of time, submission deadline in < 1 hour.

1.  Open **Loom** (or similar tool).
2.  Set to "Screen + Cam" (Bubble mode).
3.  Have your tabs ready:
    *   Tab 1: StorySign App (Active Session).
    *   Tab 2: VS Code (Code Snippet).
    *   Tab 3: GitHub Repo / Diagram.
4.  **Record in One Take:**
    *   Start recording.
    *   "Hi, I'm [Name]. This is StorySign."
    *   *Switch to Tab 1.* "Let me show you..." (Do the exercise).
    *   "How does it work?" *Switch to Tab 2.* "Here is the Physics Engine..."
    *   "Thanks for watching."
5.  **Submit the Link.** (Check if Devpost accepts Loom links, otherwise download the .mp4 from Loom and upload to YouTube).

## Critical Checklist
- [ ] **Audio:** clear? No background noise?
- [ ] **Text:** Is the code readable?
- [ ] **Demo:** Did the "Safety Stop" actually trigger visually? (Red UI is important).
- [ ] **Length:** Is it under 3 minutes? (Devpost is strict).

## Software Recommendations
*   **Recording:** QuickTime Player (Built-in, High Quality) or OBS (Complex but powerful).
*   **Editing:** CapCut (Easiest), iMovie (Reliable), DaVinci Resolve (Overkill).
*   **Compression:** Handbrake (if the file is > 100MB).
