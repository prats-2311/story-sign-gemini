This detailed plan is designed to transform **Reconnect** from a technical prototype into a flagship-level "Medical AI" product for your Gemini 3 Hackathon submission.

The goal is to move away from a "chat-app-with-camera" feel toward a **"Cybernetic Physical Therapy Lab"** experience.

---

### **Phase 1: Visual Foundation & Theme**

* **The Look:** "Deep Neural Pro." A high-contrast dark mode foundation using Charcoal (`#0F1117`) and Midnight Blue (`#1A1D26`).
* **Accents:** Electric Cyan (`#00F2FF`) for "Correct Form" and Warm Amber (`#FFB800`) for "Correction Needed."
* **Components:** Use **Glassmorphism** (frosted panels with `backdrop-blur-xl`) to keep the UI light and modern while overlapping the camera feed.
* **Typography:** A clean, geometric Sans-Serif like *Inter* or *Geist* for a high-tech feel.

---

### **Phase 2: The "Live Observer" HUD (Session UI)**

The live view should look like a professional athlete’s training dashboard.

* **The Cyber-Skeleton:** * Overlay the MediaPipe landmarks with a glowing "Pulse Line" rather than solid stick-figures.
* **Dynamic Highlighting:** If the Elbow Angle is within the target range (e.g., 170°+), the joint connection glows neon Cyan. If stability variance is too high, the shoulder joint pulses in Amber.


* **The Floating HUD (Heads-Up Display):**
* **Angle Gauge:** A semi-circular radial progress bar in the top-right corner that moves in real-time as the arm flexes.
* **Rep Counter:** A large, high-visibility "Digital Score" count in the center-top.
* **Stability Sparkline:** A small, live-scrolling graph in the bottom-left showing the "Y-axis variance" (Shoulder Stability) to give the user immediate visual feedback on "wobble."


* **Voice Assistant Visualization:** * Instead of a text transcript at the bottom, place a minimalist "Neural Wave" (a pulsing SVG wave) that reacts when Gemini speaks, making the AI feel present in the room.

---

### **Phase 3: The "Deep Think" Trigger & Interaction**

This is where you showcase the **Gemini 3** intelligence.

* **The Reasoning State:** When the user stops the session and clicks "Generate Analysis," do not just show a loading spinner.
* **Visual:** Show a "Neural Processing" animation with text like: *"Gemini 3 is analyzing 250 biomechanical data points..."* followed by *"Applying clinical reasoning for Neuromuscular Rehab..."*
* **The Transition:** Use a smooth slide-up animation to transition from the camera view to the Analysis Dashboard.



---

### **Phase 4: The Analysis Dashboard (Bento Grid Layout)**

Organize the Gemini 3 report into an "Intelligence Dashboard" rather than a block of text.

* **Bento Card 1: ROM Peak Analysis:** A card showing a bar chart of the last 10 repetitions, highlighting the "Fatigue Drop-off" identified by Gemini.
* **Bento Card 2: Stability Score:** A "Speedometer" style gauge showing the 0.4078 stability score, with a color-coded range (Optimal vs. Compensatory).
* **Bento Card 3: The PT Prescription:** Use a clean, bulleted list for the "Next Session Focus" (e.g., Terminal Range Consistency).
* **Bento Card 4: Historical Comparison:** A small trend line showing how today’s 180° ROM compares to the 160° baseline from last week.

---

### **Phase 5: User Flow & Experience (The "PT Journey")**

1. **Calibration:** A 3-second countdown where the UI highlights the user's silhouette in blue once they are fully in frame.
2. **Engagement:** During the set, the HUD stays minimal. If form degrades, a "Ghost Trace" appears on screen showing where the arm *should* be.
3. **Review:** Immediate transition to the Gemini 3 "Thinking" screen.
4. **Actionable Exit:** A "Save to Recovery Log" button that exports the Markdown report to a PDF or user profile.

---

### **Phase 6: Technical "Hackathon" Implementation Details**

To ensure Antigravity can code this accurately, include these technical requirements:

* **Layout:** Responsive `flex-col` on mobile, but on Desktop, the camera feed should take 70% of the screen with a sidebar for "Current Metrics."
* **Accessibility:** * **Voice-over:** Ensure every form correction is also delivered via the Gemini Live audio stream for users with visual impairment.
* **Touch Targets:** Large, easy-to-hit buttons (min 44px) for users who might have limited hand mobility.


* **Hybrid Model Architecture:** * **Gemini 2.0 Flash Exp** powers the real-time HUD and audio cues (Eyes).
* **Gemini 3 Flash Preview** (with Thinking Mode enabled) powers the POST-session `/analyze_session` report (The Brain).



---

### **The "Why" for Antigravity**

Explain to Antigravity that this design isn't just for "looks"—it is to **visualize the data**. If Gemini 3 says the user is "fatiguing," the UI should prove it by showing the bar chart of decreasing angles. This "Evidence-Based UI" is what wins hackathons.

**Next Step for Antigravity:** Ask them to provide the **Tailwind CSS configuration** for the "Deep Neural Pro" theme and the **React components** for the radial Angle Gauge.