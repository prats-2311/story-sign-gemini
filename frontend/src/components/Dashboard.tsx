import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import type { ExerciseConfig } from '../types/Exercise';
import { ExerciseCard } from './ExerciseCard';
import { AbductionPhysics } from '../exercises/AbductionPhysics';
import { BicepCurlPhysics } from '../exercises/BicepCurlPhysics';
import { WallSlidePhysics } from '../exercises/WallSlidePhysics';
import { ExternalRotationPhysics } from '../exercises/ExternalRotationPhysics';
import { ExerciseCreator } from './ExerciseCreator';
import { exercisesApi } from '../api/exercises';
import { UniversalPhysicsEngine } from '../exercises/UniversalPhysicsEngine';

interface DashboardProps {
    onSelectExercise: (config: ExerciseConfig) => void;
}

// [MOCK] Library Configs
const STATIC_LIBRARY: ExerciseConfig[] = [
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
    const navigate = useNavigate();
    const [showCreator, setShowCreator] = useState(false);
    const [customExercises, setCustomExercises] = useState<ExerciseConfig[]>([]);

    useEffect(() => {
        loadCustomExercises();
    }, []);

    const loadCustomExercises = async () => {
        try {
            const data = await exercisesApi.list();
            // Convert to ExerciseConfig objects with Universal Engine
            const configs = data.map(item => ({
                id: item.id,
                name: item.name,
                description: "Custom AI Generated Exercise",
                targetRom: { min: 0, max: 180 },
                // Hydrate the Universal Engine with the stored JSON config
                engine: new UniversalPhysicsEngine(item.config as any),
                systemPrompt: `You are monitoring ${item.name}. ${JSON.stringify((item.config as any).stages || [])}`,
                _rawSchema: item.config as any // Attach raw schema for re-hydration in SessionRoute
            }));
            setCustomExercises(configs);
        } catch (e) {
            console.error("Failed to load custom exercises", e);
        }
    };

    const handleDeleteExercise = async (id: string) => {
        try {
            await exercisesApi.delete(id);
            setCustomExercises(prev => prev.filter(e => e.id !== id));
        } catch (e) {
            console.error("Failed to delete exercise", e);
            alert("Failed to delete exercise");
        }
    };

    return (
        <div className="w-full h-full relative"> 
            {/* Header Area */}
            <div className="mb-12 flex justify-between items-end animate-fade-in-up">
                <div>
                    <h1 className="text-5xl font-bold text-white tracking-tighter mb-4 text-glow">
                        RECONNECT <span className="text-cyber-cyan">V2</span>
                    </h1>
                    <p className="text-xl text-gray-400 max-w-2xl">
                        Your digital recovery clinic. Select a module to begin your monitored session.
                    </p>
                </div>
                <div className="flex gap-4">
                    <button 
                      onClick={() => setShowCreator(true)}
                      className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white rounded-lg transition-all font-mono uppercase tracking-wider text-sm shadow-lg hover:shadow-pink-500/20 flex items-center gap-2"
                    >
                        <span>+</span> New Exercise
                    </button>

                    <button 
                      id="btn-generate-plan"
                      onClick={() => navigate('/reconnect/plan')}
                      className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white rounded-lg transition-all font-mono uppercase tracking-wider text-sm shadow-lg hover:shadow-purple-500/20"
                    >
                        ✨ Generate AI Plan
                    </button>
                    <button 
                      id="btn-view-history"
                      onClick={() => navigate('/reconnect/history')}
                      className="px-6 py-3 bg-neural-800/80 backdrop-blur border border-neural-600 hover:border-cyber-cyan text-white rounded-lg transition-colors font-mono uppercase tracking-wider text-sm"
                    >
                        View History
                    </button>
                </div>
            </div>

            {/* Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-fade-in-up delay-200 pb-20">
                {/* Custom Exercises (With Delete) */}
                {customExercises.map((config) => (
                    <ExerciseCard 
                        key={config.id}
                        id={`card-${config.id}`}
                        config={config}
                        statusQuery={{ setsDone: 0, setsTotal: 3 }} 
                        onStart={onSelectExercise}
                        onDelete={handleDeleteExercise}
                    />
                ))}

                {/* Static Library (No Delete) */}
                {STATIC_LIBRARY.map((config) => (
                    <ExerciseCard 
                        key={config.id}
                        id={`card-${config.id}`}
                        config={config}
                        statusQuery={{ setsDone: 0, setsTotal: 3 }} 
                        onStart={onSelectExercise}
                    />
                ))}
            </div>

            {/* CREATOR MODAL */}
            {showCreator && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-8 animate-fade-in">
                    <div className="w-full max-w-6xl h-[90vh] bg-gray-950 border border-gray-800 rounded-2xl overflow-hidden shadow-2xl relative">
                        <ExerciseCreator 
                            onSuccess={() => {
                                setShowCreator(false);
                                loadCustomExercises(); // Refresh list
                            }}
                            onCancel={() => setShowCreator(false)}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}
