import type { ExerciseConfig } from '../types/Exercise';
import { ExerciseCard } from './ExerciseCard';
import { AbductionPhysics } from '../exercises/AbductionPhysics';
import { BicepCurlPhysics } from '../exercises/BicepCurlPhysics';
import { WallSlidePhysics } from '../exercises/WallSlidePhysics';
import { ExternalRotationPhysics } from '../exercises/ExternalRotationPhysics';

interface DashboardProps {
    onSelectExercise: (config: ExerciseConfig) => void;
}

// [MOCK] Library Configs
const library: ExerciseConfig[] = [
    {
        id: 'abduction',
        name: 'Shoulder Abduction',
        description: 'Lateral raises to improve range of motion. Keep arm straight.',
        targetRom: { min: 0, max: 180 },
        engine: new AbductionPhysics(),
        systemPrompt: "You are a Physical Therapist monitoring Shoulder Abduction. Watch for hiking shoulders and ensure smooth eccentric control."
    },
    {
        id: 'bicep_curl',
        name: 'Bicep Curls',
        description: 'Elbow flexion for functional strength. Full extension at bottom.',
        targetRom: { min: 40, max: 160 },
        engine: new BicepCurlPhysics(),
        systemPrompt: "You are a Physical Therapist monitoring Bicep Curls. Ensure full extension at the bottom and avoid swinging the torso."
    },
    {
        id: 'wall_slide',
        name: 'Wall Slides',
        description: 'Scapular control. Slide arms up while keeping contact with wall.',
        targetRom: { min: 0, max: 100 },
        engine: new WallSlidePhysics(),
        systemPrompt: "You are a Physical Therapist monitoring Wall Slides. Ensure wrists stay above shoulders and back is flat against the wall."
    },
    {
        id: 'rotation',
        name: 'Ext. Rotation',
        description: 'Rotator cuff isolation. Keep elbow pinned to side.',
        targetRom: { min: 0, max: 90 },
        engine: new ExternalRotationPhysics(),
        systemPrompt: "You are a Physical Therapist monitoring External Rotation. Ensure the elbow stays pinned to the side."
    }
];

export function Dashboard({ onSelectExercise }: DashboardProps) {
    return (
        <div className="w-full max-w-6xl mx-auto p-8 pt-20">
            {/* Header */}
            <div className="mb-12">
                <h1 className="text-5xl font-bold text-white tracking-tighter mb-4 text-glow">
                    RECONNECT <span className="text-cyber-cyan">V2</span>
                </h1>
                <p className="text-xl text-gray-400 max-w-2xl">
                    Your digital recovery clinic. Select a module to begin your monitored session.
                </p>
            </div>

            {/* Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                
                {/* Active Card: Abduction */}
                <ExerciseCard 
                    config={library[0]}
                    statusQuery={{ setsDone: 1, setsTotal: 3, stability: 0.08 }}
                    onStart={onSelectExercise}
                />

                 {/* Active Card: Bicep */}
                 <ExerciseCard 
                    config={library[1]}
                    statusQuery={{ setsDone: 0, setsTotal: 3 }}
                    onStart={onSelectExercise}
                />

                {/* Card 3: Wall Slide */}
                <ExerciseCard 
                    config={library[2]}
                    statusQuery={{ setsDone: 0, setsTotal: 2 }}
                    onStart={onSelectExercise}
                />

                {/* Card 4: Rotation */}
                <ExerciseCard 
                    config={library[3]}
                    statusQuery={{ setsDone: 0, setsTotal: 3 }}
                    onStart={onSelectExercise}
                />

            </div>
        </div>
    );
}
