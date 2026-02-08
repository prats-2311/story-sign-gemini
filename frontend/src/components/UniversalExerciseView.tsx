import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { UniversalPhysicsEngine } from '../exercises/UniversalPhysicsEngine';
import type { UniversalSchema, ExerciseConfig } from '../types/Exercise';
import { SessionRunner } from './SessionRunner';

export function UniversalExerciseView() {
    const { state } = useLocation();
    const navigate = useNavigate();
    
    // Config State
    const [exerciseConfig, setExerciseConfig] = useState<ExerciseConfig | null>(null);

    useEffect(() => {
        if (state?.config) {
            const schema = state.config as UniversalSchema;
            try {
                // Initialize Engine with Schema
                const engine = new UniversalPhysicsEngine(schema);
                
                // Construct Full Exercise Config
                const config: ExerciseConfig = {
                    id: 'universal-preview', 
                    name: schema.name,
                    description: schema.description,
                    targetRom: { min: 0, max: 100 }, // Dummy generic
                    engine: engine, 
                    systemPrompt: `You are monitoring: ${schema.name}. ${schema.description}. 
                    Focus on: ${Object.values(schema.metrics || {}).map(m => m.id).join(', ')}.
                    Safety Rules: ${(schema.safety_rules || []).map(r => r.message).join(', ')}.` 
                };
                setExerciseConfig(config);
            } catch (e) {
                console.error("Engine Init Failed", e);
                // navigate('/create-exercise');
            }
        } else {
            navigate('/create-exercise');
        }
    }, [state, navigate]);

    if (!exerciseConfig) return <div className="text-white p-10 font-mono">Initializing Universal Engine...</div>;

    return (
        <SessionRunner 
            config={exerciseConfig} 
            onExit={() => navigate('/create-exercise')} 
            mode="BODY" // For now, Universal Engine is Body-focused. 
                        // In future, schema.domain should drive this!
        />
    );
}
