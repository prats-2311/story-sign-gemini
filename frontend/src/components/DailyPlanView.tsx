import { useEffect, useState } from 'react';
import type { DailyPlan, RoutineItem } from '../types/Plan';
import { apiClient } from '../api/client'; // [FIX] Import apiClient

interface DailyPlanViewProps {
    onSelectExercise: (item: RoutineItem, index: number) => void;
}

export function DailyPlanView({ onSelectExercise }: DailyPlanViewProps) {
    const [plan, setPlan] = useState<DailyPlan | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Refresh plan on mount to get latest completion status
    const fetchPlan = () => {
        setLoading(true);
        // [FIX] Use apiClient to handle /api prefix automatically
        apiClient<DailyPlan>('/plan/daily')
            .then(data => {
                setPlan(data);
                setLoading(false);
            })
            .catch(err => {
                console.error(err);
                setError("Could not load AI Plan.");
                setLoading(false);
            });
    };

    useEffect(() => {
        fetchPlan();
    }, []);

    if (loading) return <div className="text-white p-10 flex flex-col items-center gap-4">
        <div className="text-4xl animate-bounce">🤖</div>
        <p>Consulting AI Therapist...</p>
    </div>;

    if (error) return <div className="text-red-400 p-10">{error}</div>;
    if (!plan) return null;

    return (
        <div className="flex flex-col items-center justify-start h-full p-8 space-y-8 overflow-y-auto">
            {/* Header */}
            <div className="text-center space-y-2">
                <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400">
                    Today's Recovery Plan
                </h1>
                <p className="text-gray-400 text-lg">{plan.day_id}</p>
            </div>

            {/* AI Reasoning Card */}
            <div className="bg-gray-800/50 border border-purple-500/30 p-6 rounded-xl max-w-2xl w-full backdrop-blur-sm">
                <div className="flex items-center gap-2 mb-3">
                    <span className="text-2xl">🩺</span>
                    <h3 className="text-xl font-semibold text-purple-200">Therapist's Note</h3>
                </div>
                <p className="text-gray-300 italic text-lg leading-relaxed">
                    "{plan.reasoning}"
                </p>
            </div>

            {/* Routine List */}
            <h3 className="text-gray-400 uppercase tracking-widest text-sm font-bold mt-4">Select an exercise to start</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 w-full max-w-5xl">
                {plan.routine.map((item, idx) => (
                    <button 
                        key={idx} 
                        onClick={() => onSelectExercise(item, idx)}
                        disabled={item.completed}
                        className={`
                            relative flex flex-col gap-3 p-6 rounded-xl border text-left transition-all duration-300 group
                            ${item.completed 
                                ? 'bg-green-900/20 border-green-500/50 opacity-75 grayscale-[0.5]' 
                                : 'bg-gray-900/80 border-gray-700 hover:border-cyber-cyan hover:shadow-[0_0_20px_rgba(6,182,212,0.2)] hover:-translate-y-1'
                            }
                        `}
                    >
                        {/* Status Badge */}
                        <div className="flex justify-between items-center w-full">
                            <span className={`font-mono text-xs px-2 py-1 rounded ${item.completed ? 'bg-green-500/20 text-green-400' : 'bg-blue-900/50 text-blue-200'}`}>
                                {item.completed ? 'COMPLETED' : `STEP ${idx + 1}`}
                            </span>
                            <span className="text-gray-500 text-xs font-mono">{item.sets} SETS</span>
                        </div>

                        {/* Title */}
                        <h4 className={`text-2xl font-bold capitalize ${item.completed ? 'text-green-200' : 'text-white group-hover:text-cyber-cyan'}`}>
                            {item.exercise_id.replace('_', ' ')}
                        </h4>
                        
                        {/* Desc */}
                        <p className="text-sm text-gray-400 leading-relaxed">
                            {item.instructions}
                        </p>

                        {/* Checkmark Overlay if done */}
                        {item.completed && (
                            <div className="absolute top-4 right-4 text-green-500">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                            </div>
                        )}
                    </button>
                ))}
            </div>
            
            <div className="h-20"></div> {/* Bottom Spacer */}
        </div>
    );
}
