# 🚀 Gemini Hackathon Feature Roadmap

This document outlines the detailed plan for the "Wow" features discussed for the Story Sign / Reconnect platform.

## 1. 🕹️ Arcade Mode ("Bubble Balance") — *Implemented*
**Goal:** Prove real-time latency and "fun" factor in rehab.
*   **Concept:** A "Flappy Bird" style mini-game where the user controls a bubble using their right shoulder height.
*   **Tech Stack:**
    *   **Frontend:** HTML5 Canvas (`ArcadeOverlay.tsx`) running at 60fps.
    *   **Data:** Normalizing `pose_landmarks[12].y` (Right Shoulder) from `useGeminiLive` hook.
    *   **Feedback:** Visual scoring and "Combo" text.
*   **Status:** ✅ Code is written. Ready for VM deployment.

## 2. 🗣️ Voice Navigation (Hands-Free Control) — *Planned*
**Goal:** Accessibility. Users with injuries cannot easily use a mouse/keyboard.
*   **Concept:** User says "Go to History" or "Start Session". Gemini executes the command.
*   **Tech Stack:**
    *   **Gemini Function Calling:** Define a tool `set_view(view_name: str)`.
    *   **Backend:** Add `navigation_tool` to `LiveConnectConfig`.
    *   **Frontend:** 
        *   Handle the `tool_call` event in `useGeminiLive`.
        *   Execute `setView(args.view_name)`.

## 3. ♾️ "Infinite Practice" (Generative Configs) — *Planned*
**Goal:** Remove the need for manually coding 1,000s of exercises.
*   **Concept:** User types a prompt (e.g., "I feel Anxious" or "Sign for 'Coffee'"). The system generates a session on the fly.
*   **Tech Stack:**
    *   **Endpoint:** `/generate_exercise` (POST).
    *   **Prompt Engineering:** 
        *   *Harmony:* "Map emotion '{input}' to distinct facial landmarks (brows, mouth)."
        *   *ASL:* "Convert '{input}' to ASL Gloss and Fingerspelling sequence."
    *   **Visual Output (The "Video" Problem):**
        *   Instead of generating pixel video (too slow), we use **Generative Skeleton Animation**.
        *   Gemini outputs a sequence of Pose Vectors.
        *   Frontend animates the "Ghost Skeleton" guide to match these vectors.

## 4. 🧠 Smart Report Generation — *In Progress*
**Goal:** Clinical value.
*   **Concept:** Turn raw telemetry (velocity, angles) into a written PDF report.
*   **Tech Stack:** 
    *   **Gemini 1.5 Pro / 2.0 Flash:** Deep analysis of the `telemetry` JSON array.
    *   **Output:** Markdown report + Chart Configuration (Chart.js/Recharts).
