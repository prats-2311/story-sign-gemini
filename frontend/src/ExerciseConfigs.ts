import type { ExerciseConfig } from './types/Exercise';
import { AbductionPhysics } from './exercises/AbductionPhysics';
import { BicepCurlPhysics } from './exercises/BicepCurlPhysics';
import { WallSlidePhysics } from './exercises/WallSlidePhysics';
import { ExternalRotationPhysics } from './exercises/ExternalRotationPhysics';

export const ShoulderAbductionConfig: ExerciseConfig = {
    id: 'abduction',
    name: 'Shoulder Abduction',
    description: 'Lateral raises to improve range of motion. Keep arm straight.',
    targetRom: { min: 90, max: 180 },
    engine: new AbductionPhysics(),
    systemPrompt: `You are observing a patient doing Shoulder Abduction (Lateral Raises).
    - GOAL: Reach 90-180 degrees.
    - FORM: Keep elbow straight. No shrugging.
    - FEEDBACK: Count reps enthusiastically. Correct shrugging immediately.
    - SAFETY: If velocity > 1.0, STOP.`
};

export const BicepCurlConfig: ExerciseConfig = {
    id: 'bicep_curl',
    name: 'Bicep Curls',
    description: 'Elbow flexion for functional strength. Full extension at bottom.',
    targetRom: { min: 45, max: 140 },
    engine: new BicepCurlPhysics(),
    systemPrompt: `You are observing Bicep Curls.
    - GOAL: Full flexion to recenter.
    - FORM: Keep elbow pinned to side. No swinging.
    - FEEDBACK: "Squeeze at the top!"`
};

export const WallSlideConfig: ExerciseConfig = {
    id: 'wall_slide',
    name: 'Wall Slides',
    description: 'Scapular control. Slide arms up while keeping contact with wall.',
    targetRom: { min: 120, max: 180 },
    engine: new WallSlidePhysics(),
    systemPrompt: `You are observing Wall Slides.
    - GOAL: Maximize vertical reach while keeping wrists on wall.
    - CHARTING: Track "wrist_contact" boolean if possible.`
};

export const ExternalRotationConfig: ExerciseConfig = {
    id: 'rotation',
    name: 'Ext. Rotation',
    description: 'Rotator cuff isolation. Keep elbow pinned to side.',
    targetRom: { min: 0, max: 90 },
    engine: new ExternalRotationPhysics(),
    systemPrompt: `You are observing External Rotation.
    - GOAL: Rotate forearm outward without moving elbow away from body.`
};
