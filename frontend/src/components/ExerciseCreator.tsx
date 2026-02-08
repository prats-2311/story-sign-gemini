
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toolsApi } from '../api/tools';
import { exercisesApi } from '../api/exercises';

export function ExerciseCreator() {
    const [prompt, setPrompt] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [generatedConfig, setGeneratedConfig] = useState<any>(null);
    const navigate = useNavigate();

    const handleGenerate = async () => {
        setIsLoading(true);
        setError('');
        try {
            const data = await toolsApi.generateExercise(prompt);
            setGeneratedConfig(data); // API returns the config directly
        } catch (e: any) {
            setError(e.message);
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
                                    // Save to Backend
                                    try {
                                        const res = await exercisesApi.create(
                                            generatedConfig.name, 
                                            generatedConfig, 
                                            generatedConfig.domain || 'BODY'
                                        );
                                        console.log("Saved:", res);
                                        // Start with persisted ID if possible, but for now just start preview
                                        handleStart();
                                    } catch (e: any) {
                                        console.error("Failed to save", e);
                                        setError("Save Failed: " + e.message);
                                    }
                                }}
                                className="flex-1 py-3 bg-green-600 hover:bg-green-500 text-white font-bold rounded-xl shadow-lg shadow-green-500/20"
                            >
                                SAVE & START
                            </button>
                             <button
                                onClick={handleStart}
                                className="px-6 py-3 border border-gray-600 hover:border-white text-gray-400 hover:text-white font-bold rounded-xl"
                            >
                                PREVIEW ONLY
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
