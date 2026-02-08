
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { exercisesApi } from '../api/exercises';
import type { ExerciseConfig } from '../types/Exercise';

interface ExerciseCreatorProps {
    onSuccess?: (config: ExerciseConfig) => void;
    onCancel?: () => void;
}

export function ExerciseCreator({ onSuccess, onCancel }: ExerciseCreatorProps) {
    const [prompt, setPrompt] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [generatedConfig, setGeneratedConfig] = useState<any>(null);
    const navigate = useNavigate();

    const handleGenerate = async () => {
        setIsLoading(true);
        setError('');
        try {
            const config = await exercisesApi.generate(prompt);
            setGeneratedConfig(config);
        } catch (e: any) {
            console.error("Generation failed:", e);
            setError(e.message || "Failed to generate exercise");
        } finally {
            setIsLoading(false);
        }
    };

    const handleStart = () => {
        if (!generatedConfig) return;
        navigate('/universal-preview', { state: { config: generatedConfig } });
    };

    return (
        <div className="bg-black min-h-screen text-white p-8">
            <h1 className="text-3xl font-bold mb-8 text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500">
                AI Exercise Generator
            </h1>

            <div className="flex flex-col md:flex-row gap-8">
                {/* INPUT */}
                <div className="flex-1 space-y-4">
                    <textarea
                        className="w-full h-40 bg-gray-900 border border-gray-700 rounded-xl p-4 text-white focus:outline-none focus:border-blue-500"
                        placeholder="Describe the movement (e.g. 'Touch nose with index finger')"
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                    />
                    
                    {error && <div className="text-red-400 text-sm">{error}</div>}

                    <button
                        onClick={handleGenerate}
                        disabled={isLoading || !prompt.trim()}
                        className={`w-full py-3 rounded-xl font-bold transition-all ${
                            isLoading 
                                ? 'bg-gray-800 text-gray-400 cursor-not-allowed'
                                : 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/20'
                        }`}
                    >
                        {isLoading ? 'Generating Physics...' : 'Create Engine'}
                    </button>
                </div>

                {/* PREVIEW */}
                <div className="flex-1 bg-gray-900/50 rounded-xl p-6 border border-gray-800 flex flex-col h-[500px]">
                    <div className="flex-1 overflow-auto font-mono text-xs text-green-400 bg-black/50 p-4 rounded mb-4">
                        {generatedConfig ? JSON.stringify(generatedConfig, null, 2) : '// Schema will appear here...'}
                    </div>
                    
                    {generatedConfig && (
                        <div className="flex gap-4">
                            <button
                                onClick={async () => {
                                    try {
                                        const res = await exercisesApi.create(
                                            generatedConfig.name, 
                                            generatedConfig, 
                                            generatedConfig.domain || 'BODY'
                                        );
                                        console.log("Saved:", res);
                                        
                                        if (onSuccess) {
                                            onSuccess(generatedConfig);
                                        } else {
                                            handleStart();
                                        }
                                    } catch (e: any) {
                                        console.error("Failed to save", e);
                                        setError("Save Failed: " + e.message);
                                    }
                                }}
                                className="flex-1 py-3 bg-green-600 hover:bg-green-500 text-white font-bold rounded-xl shadow-lg shadow-green-500/20"
                            >
                                SAVE & ADD TO LIBRARY
                            </button>
                             <button
                                onClick={handleStart}
                                className="px-6 py-3 border border-gray-600 hover:border-white text-gray-400 hover:text-white font-bold rounded-xl"
                            >
                                PREVIEW ONLY
                            </button>
                        </div>
                    )}

                    {onCancel && (
                        <button 
                            onClick={onCancel}
                            className="absolute top-4 right-4 text-gray-400 hover:text-white"
                        >
                            ✕
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
