
// StorySign Studio - Facial Landmark Definitions (MediaPipe Face Mesh)
// Optimized for "Hybrid Anchor" Strategy

// --- 1. ANCHOR POINTS (Always Sent) ---
// Used for Head Pose Estimation (Yaw/Pitch/Roll) and Scale Normalization
export const FACE_ANCHORS = [
    1,   // Nose Tip
    152, // Chin
    234, // Left Ear (Cheekbone edge)
    454  // Right Ear (Cheekbone edge)
];

// --- 2. REGION GROUPS ---

// MOUTH (Lips Inner + Outer)
export const LIPS = [
    61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291, 185, 40, 39, 37, 0, 267, 269, 270, 409
];

// EYES (Eyelids + Corners + Iris Center approx) - Good for Blink/Widen
export const LEFT_EYE = [33, 133, 159, 145, 153, 144, 163, 7, 246];
export const RIGHT_EYE = [362, 263, 386, 374, 380, 373, 390, 249, 466];

// EYEBROWS (Inner + Arch + Outer) - Good for Frown/Surprise
export const BROWS = [
    70, 63, 105, 107, 46, // Left
    336, 296, 334, 300, 276 // Right
];

// CHEEKS & NOSE (For Duchenne Smile & Disgust)
export const CHEEKS_NOSE = [
    1, 2, 94, 195, 4, 218, // Nose Bridge/Tip
    50, 280, 205, 425      // Cheek Centers (Approx)
];

export const JAW = [172, 136, 150, 149, 176, 148, 152, 377, 400, 378, 379, 365, 397];


// --- 3. EMOTION PRESETS (Optimized Lists) ---

export const EMOTION_LANDMARKS: Record<string, number[]> = {
    // HAPPY: Requires Mouth (Smile) + Cheeks (Lift) + Eyes (Squint/Crow's Feet)
    'HAPPY': [...LIPS, ...CHEEKS_NOSE, ...LEFT_EYE, ...RIGHT_EYE],

    // SAD: Requires Mouth (Frown) + Brows (Inner Lift) + Eyelids (Droop)
    'SAD': [...LIPS, ...BROWS, 159, 145, 386, 374], // Only lids needed from eyes

    // SURPRISED: Requires Mouth (Open O) + Brows (High Arch) + Eyes (Wide Open)
    'SURPRISED': [...LIPS, ...BROWS, ...LEFT_EYE, ...RIGHT_EYE],

    // ANGRY: Requires Brows (Furrow) + Mouth (Tight) + Jaw (Clench) + Eyes (Glare)
    'ANGRY': [...BROWS, ...LIPS, ...JAW, ...LEFT_EYE, ...RIGHT_EYE],

    // DEFAULT (Full Fidelity for unknown custom emotions)
    'DEFAULT': [
        ...LIPS, ...LEFT_EYE, ...RIGHT_EYE, ...BROWS, ...CHEEKS_NOSE
    ]
};

// Helper to get unique sorted indices
export function getUniqueLandmarks(targetEmotion: string = 'DEFAULT', customList?: number[]): number[] {
    const base = EMOTION_LANDMARKS[targetEmotion.toUpperCase()] || EMOTION_LANDMARKS['DEFAULT'];
    const combined = [...FACE_ANCHORS, ...(customList || base)];
    return Array.from(new Set(combined)).sort((a, b) => a - b);
}
