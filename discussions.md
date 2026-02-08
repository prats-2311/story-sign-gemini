# StorySign Gemini: Architectural Discussions

This file serves as a scratchpad and record for our brainstorming sessions regarding the "Neural Pipeline" architecture, database schema, and module integration.

## Topic 1: The "Neural Pipeline" Proposal (2026-02-08)

### Context
We are exploring a unified architecture to support ASL, Harmony, and Reconnect modules with a shared underlying logic.

### Key Questions for Discussion
1.  **Universal Schema Viability**: can ASL signs (sequences of handshapes) and Harmony emotions (face blendshapes) purely be described by the JSON schema currently designed for Reconnect (States + Metrics)?
    *   *Challenge*: ASL might need a "Sequence" or "Time-Window" primitive that is more complex than simple state transitions.
2.  **Performance Trade-offs**: The "Passive/Active" frame idea sounds good for cost, but will it hurt the "Live" feel?
    *   *Risk*: If we stop sending frames, Gemini might lose context of *movement flow*.
3.  **Database Migration**: Renaming `ExerciseSession` to `ActivitySession`.
    *   *Impact*: Needs a migration script if production data exists (TiDB Serverless).

### Action Items
- [ ] Discuss the specific data structures needed for ASL (beyond simple landmarks).
- [ ] validate if governing Flash *needs* a constant video stream to be effective as a "Coach".

## Topic 2: Universal Engine Deep Dive (2026-02-08)

### Current Capabilities
The engine currently supports:
-   **Metrics**: Angles (3 points), Vertical Diff (2 points).
-   **State Machine**: Linear transitions based on numeric thresholds.
-   **Safety**: Immediate "Critical" feedback based on velocity or range of motion.

### The "Universal" Challenge
To make this work for **ASL** and **Harmony**, we need to expand the schema.

#### 1. ASL Patterns (The "Sequence" Problem)
*   *Current*: State 1 -> State 2 -> State 3 (Good for Reps).
*   *ASL Need*: "Hold Handshape A" -> "Move to Location B" -> "Transition to Handshape C".
*   *Gap*: We lack a `TimeWindow` or `HoldDuration` primitive. ASL isn't just about *reaching* a state, but *holding* it or *moving* through it at a specific speed.

#### 2. Harmony Patterns (The "Blendshape" Problem)
*   *Current*: Uses Body Landmarks (0-32).
*   *Harmony Need*: Needs Face Mesh Blendshapes (e.g., `browInnerUp`, `mouthSmile`).
*   *Proposal*: Add `domain: 'FACE'` to the schema. If set, the `points` array references Blendshape names instead of Landmark indices.

### Proposed Schema Extensions for V2
```typescript
interface UniversalSchema {
    // ... existing ...
    domain: 'BODY' | 'HAND' | 'FACE'; 
    constraints?: {
        hold_time?: number; // ms to hold state before transition
        max_time?: number; // max time allowed to complete transition
    };
}
```

## Topic 3: UI/UX Analysis (Based on Screenshots)

### Observations
1.  **Reconnect V2**:
    *   *Style*: Dashboard, Card-based, Data-heavy.
    *   *Metrics*: Displays "Stability: 0.08" and "Sets: 1/3".
    *   *Implication*: The Universal Engine MUST return real-time floating-point metrics (not just boolean success) to drive these UI counters.
2.  **ASL World**:
    *   *Style*: Gamified "Saga Map", Linear Progression.
    *   *Camera*: Small PIP (Picture-in-Picture) at bottom right.
    *   *Challenge*: If we use the Universal Engine for ASL, where do we show the "Skeleton Overlay"? On the small PIP? Or do we need a full-screen "Practice Mode" separate from the map?
3.  **Harmony**:
    *   *Style*: Immersive, Full-screen Mirror.
    *   *Interaction*: "Show me HAPPY".
    *   *Implication*: The engine needs to trigger events (`ON_MATCH`) that instantly update the large text overlays.

### Unification Strategy
*   **The "Active Session" Layout**: We might need a standardized "Active Session" layout that can switch between **Full Body** (Reconnect), **Face** (Harmony), and **Hands** (ASL).
*   **Overlay System**: A shared `<CanvasOverlay />` component that draws the relevant landmarks (Face mesh vs. Pose skeleton) regardless of the module.

## Topic 4: Reconnect Data Flow Verification (2026-02-08)

### Confirmed Architecture
The user's understanding of the "Shadow Brain" pipeline is **Correct**.

1.  **Real-time Loop (The "Coach")**:
    *   Frontend sends Audio/Video to `Gemini Flash` via WebSocket (`/ws/stream/RECONNECT`).
    *   Gemini Flash observes form and calls tool `log_clinical_note(note="...")`.
    *   Backend sends this note to Frontend via WebSocket (`type: "clinical_note"`).

2.  **Asynchronous Analysis (The "Doctor")**:
    *   Frontend accumulates notes.
    *   Frontend sends data chunks to `/session/chunk`.
    *   Backend (`main.py`) calls `ReportDrafter.ingest_chunk()` (Background Task).
    *   On exit, Frontend calls `/session/end`.
    *   Backend calls `ReportDrafter.finalize_report()` -> Uses `Gemini 3 Pro` (or similar high-reasoning model) to generate the final Markdown report.

### Key Observation
The **Frontend is the source of truth** for the session state. It re-circulates the "Clinical Notes" back to the backend. This is a robust "Stateless Backend" pattern, though it relies on client connectivity.

## Topic 5: Dynamic Experience Gap Analysis (2026-02-08)

### The User's Vision
1.  **Input**: User types "Jumping Jacks" -> `Gemini 2.5 Flash` generates JSON.
2.  **Integration**: The new exercise appears in the **Reconnect Dashboard** as a first-class citizen.
3.  **Execution**: Clicking it launches a **Live Session** (Audio/Video) with `Gemini 2.5 Native Audio`.

### The Current Reality (Broken)
1.  **Generation**: Works (`ExerciseGenerator` uses `gemini-2.5-flash`).
2.  **Integration**: **Missing.** The generated JSON is passed to a temporary `UniversalExerciseView` via React Router state (`navigate(..., { state: { config } })`). It is **NOT** saved to the database or the Reconnect Dashboard list.
3.  **UI/UX**: `UniversalExerciseView` is a bare-bones debug view. It lacks the polish of `SessionRunner`.

### The Fix: "Just-in-Time" Configuration
We don't need a separate `UniversalExerciseView`.
1.  **Refactor**: Modify `SessionRunner` (the polished Reconnect view) to accept a dynamic `ExerciseConfig` prop.
2.  **Persist**: When an exercise is generated, save it to `LocalStorage` (or Backend DB) so it appears in the Reconnect Dashboard grid.
3.  **Launch**: Clicking the new card opens `SessionRunner` with `mode='RECONNECT'` and the *Custom Engine* instance derived from the JSON.

This unifies the experience: **One Runner, Infinite Exercises.**

## Topic 6: Dynamic Multi-Modal Feasibility (2026-02-08)

### The Challenge
The user wants a button inside Reconnect to generate exercises that might use **Body**, **Hands**, or **Face**.

### Technical Feasibility Analysis

1.  **Backend (Generator)**: ✅ **READY**
    *   The `GENERATOR_SYSTEM_INSTRUCTION` in `backend/prompts/generator.py` already supports a `domain` field (`BODY` | `HAND` | `FACE`).
    *   It knows about landmarks for all three domains.

2.  **Frontend (Hook)**: ❌ **GAP**
    *   `usePoseDetection.ts` checks `poseLandmarker`.
    *   It treats the model URL as hardcoded: `pose_landmarker_full.task`.
    *   **Fix Required**: The hook needs to accept a `domain` prop.
        *   If `domain === 'BODY'`, load `pose_landmarker`.
        *   If `domain === 'HAND'`, load `hand_landmarker`.
        *   If `domain === 'FACE'`, load `face_landmarker`.
    *   *Note*: MediaPipe has separate tasks for these. We can't just use one model for everything (unless we use the heavy Holistic model, which might kill performance).

### Proposed UI for "Create Exercise" Button
1.  **Location**: Reconnect Dashboard (Top Right).
2.  **Interaction**:
    *   Click "New AI Exercise".
    *   Input: "Make me smile more" -> Generator infers `domain: 'FACE'`.
    *   Input: "Finger counting" -> Generator infers `domain: 'HAND'`.
3.  **Result**: New Card appears with a specific icon (Running Man / Hand / Smile).

### Decision Point
Do we implement the **Holistic Model** (All-in-one) or **Dynamic Model Loading** (Swap based on exercise)?
*   *Recommendation*: **Dynamic Loading**. It's lighter. If I'm doing squats, I don't need to track my eyebrows.

## Topic 7: Safety & Dynamics Logic (2026-02-08)

### Addressing User Questions

#### 1. "What if I only raise one hand?" (Partial Reps)
*   **Current Behavior**: The strict state machine waits for *ALL* conditions to be met.
    *   Example: `(left_arm_angle > 160) AND (right_arm_angle > 160)`.
    *   Result: If you raise one arm, the condition is `False`. The state never changes. The rep count stays at 0.
*   **Dynamic Enhancement**: We can add **"Form Hints"**.
    *   *Idea*: If `left_arm == OK` but `right_arm == BAD`, trigger a specific hint: *"Raise your RIGHT arm higher!"*.
    *   *Implementation*: The API/Generator generates "Hint Conditions" alongside State Conditions.

#### 2. "What if I move too fast?" (Velocity Safety)
*   **Current Behavior**: The `UniversalPhysicsEngine` already calculates velocity.
    *   It checks `safety_rules` array.
    *   If `velocity > max_velocity`, it triggers a `CRITICAL` feedback status.
*   **Dynamic Enhancement**:
    *   The `ExerciseGenerator` needs to be prompt-engineered to *always* include reasonable velocity limits for dynamic exercises (e.g., "For squats, max downward velocity = 2.0 m/s").

#### 3. "Are there only 3 domains?"
*   **MediaPipe Domains**:
    *   `POSE` (Body)
    *   `HAND` (Fingers / ASL)
    *   `FACE` (Expressions)
    *   **HOLISTIC** (All of the above combined).
*   **Our domains**: We effectively have 4: `BODY`, `HAND`, `FACE`, and `HYBRID` (which uses the Holistic model).
*   **Recommendation**: Use `HYBRID` only when necessary (e.g., "Touch your nose") because it's computationally heavier.

## Topic 8: Backend Refactoring Strategy (2026-02-08)

### The Problem
`backend/main.py` is over 600 lines long, mixing App Setup, HTTP Routes, and complex WebSocket Logic.

### The Solution: `APIRouter` Pattern
We will split the application into logical modules:

```text
backend/
├── main.py              # App Init, CORS, Middleware
├── routers/
│   ├── session.py       # /session/* (Report Drafter)
│   ├── history.py       # /history, /analyze_session
│   ├── tools.py         # /tools/* (Generators)
│   └── websocket.py     # /ws/* (The Live Loop)
└── services/            # Business Logic (keep as is)
```

### Benefits
1.  **Readability**: Each file focuses on one domain.
2.  **Scalability**: Easier to add new routes (e.g., `/auth`) without touching `main.py`.
3.  **Safety**: Isolates the delicate WebSocket loop from simple CRUD routes.

### Execution
This refactor can be done *first*, ensuring a clean slate before we implement the "Dynamic Exercise" API changes.

## Topic 9: Frontend Modularization (SessionRunner) (2026-02-08)

### The Vision: "Universal Canvas"
We are extracting the `SessionRunner` component (currently inline in `App.tsx`) into a standalone `frontend/src/components/SessionRunner.tsx`.

### Why?
1.  **Shared Kernel**: It manages the WebSocket, MediaPipe, and Video Stream—core infrastructure needed by *all* modules.
2.  **Scalability**:
    *   **Reconnect** uses it for Rep Counting (`mode='BODY'`).
    *   **ASL** uses it for Handshape Detection (`mode='HAND'`).
    *   **Harmony** uses it for Emotion Analysis (`mode='FACE'`).
3.  **Maintenance**: Fixing a WebSocket bug in `SessionRunner` fixes it for the entire app.

### Implementation Strategy
*   **Props**: `config: ExerciseConfig`, `mode: 'BODY'|'HAND'|'FACE'`, `onExit: () => void`.
*   **Dynamic Hooks**: It will use the refactored `usePoseDetection` to load the correct AI model based on the `mode` prop.

