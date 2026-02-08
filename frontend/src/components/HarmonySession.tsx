
import { useEffect, useRef, useState } from 'react';
import { useGeminiLive } from '../hooks/useGeminiLive';
import { usePoseDetection } from '../hooks/usePoseDetection';
import { Camera } from 'lucide-react';

export function HarmonySession() {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [lastTranscript, setLastTranscript] = useState("Waiting for sign language...");
    
    // [FIX] Initialize Vision Model
    const { detectPose, isModelLoaded } = usePoseDetection();

    // Hook Init
    const { 
        isConnected, 
        connect, 
        disconnect, 
        startVideoStream, 
        messages 
    } = useGeminiLive({ 
        mode: 'HARMONY', 
        videoRef,
        detectPose, // [FIX] Required for loop to run!
        // [FIX] Dummy Config for Type Satisfaction (Harmony doesn't use the Physics Engine)
        exerciseConfig: {
            id: 'harmony' as any,
            name: 'Harmony',
            description: 'ASL Translation',
            targetRom: { min: 0, max: 0 },
            engine: { calculate: () => ({ trigger: false, message: "", feedbackStatus: 'neutral' }) } as any,
            systemPrompt: 'You are an ASL Translator.'
        },
        onLandmarks: (landmarks: any) => {
            // Draw Hands
            const canvas = canvasRef.current;
            const ctx = canvas?.getContext('2d');
            if (canvas && ctx && landmarks) {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                
                // Draw simple skeleton (Green for Harmony)
                ctx.fillStyle = "#00ff00";
                landmarks.forEach((pt: any) => {
                    ctx.beginPath();
                    ctx.arc(pt.x * canvas.width, pt.y * canvas.height, 4, 0, 2 * Math.PI);
                    ctx.fill();
                });
            }
        }
    });

    useEffect(() => {
        // Auto-connect and Start Video
        connect();
        startVideoStream();
        
        return () => {
             disconnect();
        }
    }, []);

    // Listen for Translation Messages
    useEffect(() => {
        if (messages.length > 0) {
            const lastMsg = messages[messages.length - 1];
            // [FIX] Parse String Message (format: "Gemini: Hello World")
            if (typeof lastMsg === 'string' && lastMsg.startsWith("Gemini: ")) {
                setLastTranscript(lastMsg.replace("Gemini: ", ""));
            }
        }
    }, [messages]);

    return (
        <div className="relative w-full h-[90vh] bg-black overflow-hidden flex flex-col items-center justify-center">
             {/* VIDEO LAYER */}
            <video 
                ref={videoRef}
                className="absolute inset-0 w-full h-full object-cover opacity-80"
                autoPlay 
                playsInline 
                muted
            />
            
            {/* OVERLAY CANVAS */}
            <canvas 
                ref={canvasRef}
                width={1280} 
                height={720} 
                className="absolute inset-0 w-full h-full object-cover pointer-events-none"
            />

            {/* LOADING OVERLAY */}
            {!isModelLoaded && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/90">
                    <div className="text-center animate-pulse">
                        <Camera className="w-12 h-12 text-pink-500 mx-auto mb-4" />
                        <h2 className="text-xl text-white font-mono">INITIALIZING VISION MODELS...</h2>
                    </div>
                </div>
            )}

            {/* UI LAYER */}
            {isModelLoaded && (
                <div className="z-10 absolute bottom-10 left-10 right-10 p-6 bg-black/60 backdrop-blur-md rounded-2xl border border-white/10">
                    <div className="flex items-center gap-4 mb-2">
                        <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
                        <span className="text-sm font-mono text-cyan-400 uppercase tracking-widest">Harmony Translation Engine</span>
                    </div>
                    
                    <h1 className="text-4xl font-bold text-white leading-tight">
                        {lastTranscript}
                    </h1>
                </div>
            )}
            
            {/* CONNECTION STATUS (Only if loaded but not connected) */}
            {isModelLoaded && !isConnected && (
                <div className="z-20 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 flex items-center justify-center pointer-events-none">
                    <div className="text-center bg-black/50 p-4 rounded-xl backdrop-blur-sm">
                        <p className="text-gray-400 text-sm">Connecting to Gemini...</p>
                    </div>
                </div>
            )}
        </div>
    );
}
