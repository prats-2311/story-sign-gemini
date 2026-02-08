import { useRef, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGeminiLive } from '../../hooks/useGeminiLive';
import { usePoseDetection } from '../../hooks/usePoseDetection';
import { motion } from 'framer-motion';

const EMOTIONS = ['HAPPY', 'SAD', 'SURPRISED', 'ANGRY', 'NEUTRAL'];

export function HarmonyMirror() {
    const navigate = useNavigate();
    const videoRef = useRef<HTMLVideoElement>(null);
    const { isModelLoaded, detectPose } = usePoseDetection();
    const [targetEmotion, setTargetEmotion] = useState(EMOTIONS[0]);
    const [detectedEmotion, setDetectedEmotion] = useState<string | null>(null);
    const [confidence, setConfidence] = useState(0);

    // Gemini Hook
    const { connect, disconnect, startVideoStream, isConnected, messages } = useGeminiLive({
        mode: 'HARMONY',
        detectPose,
        videoRef,
        exerciseConfig: { id: 'harmony', name: 'Harmony', target_joint: 'face', required_rom: 0 } as any,
        onLandmarks: () => {} 
    });

    // Handle Backend Feedback
    useEffect(() => {
        if (messages.length > 0) {
            const lastMessage = messages[messages.length - 1];
            try {
                const jsonMatch = lastMessage.match(/\{.*\}/s);
                if (jsonMatch) {
                    const data = JSON.parse(jsonMatch[0]);
                    if (data.event_type === 'emotion_analysis') {
                        setDetectedEmotion(data.content.detected_emotion);
                        setConfidence(data.content.confidence);
                    }
                }
            } catch (e) {
                // Ignore
            }
        }
    }, [messages]);

    useEffect(() => {
        connect();
        setTimeout(() => startVideoStream(), 1000);
        return () => disconnect();
    }, []);

    const isMatch = detectedEmotion === targetEmotion;

    if (!isModelLoaded) {
        return (
            <div className="h-screen bg-black flex items-center justify-center text-white font-mono animate-pulse">
                INITIALIZING VISION MODELS...
            </div>
        );
    }

    return (
        <div className="relative h-screen bg-black overflow-hidden flex flex-col bg-[#1a103c]">
            {/* VIDEO LAYER */}
            <div className="absolute inset-0 z-0">
                <video ref={videoRef} className="w-full h-full object-cover opacity-60" autoPlay playsInline muted />
                <div className="absolute inset-0 bg-gradient-to-t from-[#1a103c] via-transparent to-[#1a103c]/50" />
            </div>

            {/* HEADER */}
            <div className="relative z-10 p-8 flex justify-between items-start">
                <button onClick={() => navigate('/harmony')} className="text-white/50 hover:text-white transition-colors">
                    ← EXIT
                </button>
                <div className={`px-4 py-1 rounded-full text-xs font-mono border ${isConnected ? 'border-green-500 text-green-500' : 'border-red-500 text-red-500 animate-pulse'}`}>
                    {isConnected ? 'AI CONNECTED' : 'CONNECTING...'}
                </div>
            </div>

            {/* MAIN CONTENT */}
            <div className="relative z-10 flex-1 flex flex-col items-center justify-center">
                
                <div className="text-center mb-10">
                    <p className="text-pink-300 font-mono text-sm tracking-widest uppercase mb-4">Show me</p>
                    <h1 className="text-7xl font-thin text-white tracking-tighter drop-shadow-[0_0_30px_rgba(236,72,153,0.5)]">
                        {targetEmotion}
                    </h1>
                </div>

                {/* VISUALIZER CIRCLE */}
                <div className="relative w-64 h-64 mb-10 flex items-center justify-center">
                    {/* Base Ring */}
                    <div className="absolute inset-0 border border-white/10 rounded-full" />
                    
                    {/* Pulsing Match Ring */}
                    {isMatch && (
                        <motion.div 
                            className="absolute inset-0 border-4 border-green-400 rounded-full"
                            animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
                            transition={{ repeat: Infinity, duration: 1.5 }}
                        />
                    )}

                    {/* Detected Text */}
                    <div className="text-center">
                        <div className="text-xs text-gray-400 uppercase tracking-widest mb-1">Detected</div>
                        <div className={`text-2xl font-bold ${isMatch ? 'text-green-400' : 'text-white'}`}>
                            {detectedEmotion || '...'}
                        </div>
                        <div className="text-[10px] text-gray-500 font-mono mt-1">
                            conf: {(confidence * 100).toFixed(0)}%
                        </div>
                    </div>
                </div>

                {/* CONTROLS */}
                <div className="flex gap-4">
                    {EMOTIONS.map(e => (
                        <button 
                            key={e}
                            onClick={() => setTargetEmotion(e)}
                            className={`px-4 py-2 rounded-full text-xs font-bold transition-all border ${
                                targetEmotion === e 
                                    ? 'bg-pink-500 border-pink-500 text-white shadow-[0_0_20px_rgba(236,72,153,0.4)]' 
                                    : 'bg-transparent border-white/20 text-gray-400 hover:border-pink-500/50'
                            }`}
                        >
                            {e}
                        </button>
                    ))}
                </div>

            </div>
        </div>
    );
}
