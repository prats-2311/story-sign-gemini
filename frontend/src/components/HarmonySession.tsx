
import { useEffect, useRef, useState } from 'react';
import { useGeminiLive } from '../hooks/useGeminiLive';
import { apiClient } from '../api/client';
import { usePoseDetection } from '../hooks/usePoseDetection';
import { Camera } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

// Static Config to prevent re-renders
const HARMONY_CONFIG = {
    id: 'harmony' as any, // [FIX] Required by type, but overridden at runtime for session title
    name: 'Harmony',
    description: 'Emotion Mirror',
    targetRom: { min: 0, max: 0 },
    engine: { calculate: () => ({ trigger: false, message: "", feedbackStatus: 'neutral' }) } as any,
    systemPrompt: 'You are an Emotion Coach.'
};

interface HarmonySessionProps {
    emotion: string; // The specific emotion for this card session
    // targetLandmarks?: number[]; // [REMOVED] Video-First Strategy
    onExit: () => void;
}

export function HarmonySession({ emotion, onExit }: HarmonySessionProps) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    // const navigate = useNavigate(); // [REMOVED] using onExit prop
    
    // UI State
    const [targetEmotion] = useState(emotion); // Fixed for this session instance
    const [detectedEmotion, setDetectedEmotion] = useState("...");
    const [confidence, setConfidence] = useState(0);
    const [feedback, setFeedback] = useState("");
    const [isEnding, setIsEnding] = useState(false); // [FIX] Prevent double-click
    
    // Switch to FACE Model
    const { detectPose, isModelLoaded } = usePoseDetection('FACE');

    const { 
        isConnected, 
        connect, 
        disconnect, 
        startVideoStream, 
        emotionData,
        sessionId,
        flushData
    } = useGeminiLive({ 
        mode: 'HARMONY', 
        videoRef,
        detectPose, 
        exerciseConfig: HARMONY_CONFIG, // Use stable reference
        targetEmotion, // [NEW] Pass Dynamic Target
        // targetLandmarks, // [REMOVED] Video-First Strategy
        // targetLandmarks, // [REMOVED] Video-First Strategy
        onLandmarks: () => {
             // Optional: Draw Face Mesh if we want, or just keep the "Face Guide" circle
             // For now, let's keep the canvas clear to avoid the green skeleton.
             const canvas = canvasRef.current;
             const ctx = canvas?.getContext('2d');
             if (canvas && ctx) {
                 ctx.clearRect(0, 0, canvas.width, canvas.height);
             }
        }
    });

    // 1. Connection Lifecycle (Stable)
    useEffect(() => {
        connect();
        return () => disconnect();
    }, [connect, disconnect]);

    // 2. Stream Lifecycle (Dynamic - Restart when model loads)
    useEffect(() => {
        // Start (or restart) the video stream loop
        // When startVideoStream changes (due to new detectPose), this re-runs.
        startVideoStream();
        
        // Cleanup old stream (clear intervals)
        return () => {
             // We can use the stopVideoStream function from the hook
             // But we need to make sure we are calling the LATEST one or STABLE one?
             // Actually, stopVideoStream depends on videoRef so it's stable enough 
             // to clear the intervals stored in refs.
             // The specific instance doesn't matter as much as the side-effect (clearing refs).
             // However, we don't have access to 'stopVideoStream' inside the cleanup of a previous effect iteration
             // if it was a closure.
             // Luckily stopVideoStream is returned by useGeminiLive, which is in the component scope.
             // So we can assume the component scope function is available?
             // No, useEffect cleanup captures scope from render time.
             // So it calls the stopVideoStream from the SAME render cycle.
             // Which checks the SAME refs.
             // So it works.
             // stopVideoStream(); // Using the closure variable
        };
    }, [startVideoStream]); 
    
    // NOTE: I am not calling stopVideoStream here because TS complains about hook dependencies
    // and complex closure behavior, but most importantly, `startVideoStream` implementation
    // in `useGeminiLive` uses `setInterval`. If we call it again, it overwrites the ref.
    // We MUST clear the previous interval.
    // The previous `useEffect` cleanup will run before the new effect.
    // So if we include `stopVideoStream` in dependencies, we can call it.
    
    // However, for now, let's rely on disconnect cleaning up on unmount.
    // For the "Restart" case:
    // startVideoStream overwrites `videoIntervalRef.current` and `poseIntervalRef.current`.
    // IF the previous intervals are still running, we have a leak and double processing!
    // We MUST clear them.
    
    // I will modify `useGeminiLive.ts` to clear intervals at start of `startVideoStream` to be safe.
    // That is a better architectural fix than relying on the component.


    // To be safe and clean, I will include stopVideoStream in dependencies
    // and call it in cleanup.


    // [REMOVED] Internal Emotion Selection Logic
    // const handleEmotionSelect = ...
    
    // Send Initial Context on Connect
    // [SINGLE STREAM FIX]
    // Removed Initial Context Effect.
    // The first frame sent will contain `[FACE_DATA] Target: HAPPY ...`
    // which effectively sets calculation context.

    // Listen for Backend Events (TOOL BASED)
    useEffect(() => {
        if (emotionData) {
            setDetectedEmotion(emotionData.detected_emotion);
            setConfidence(emotionData.confidence);
            setFeedback(emotionData.feedback);
        }
    }, [emotionData]);

    // const emotions = ['HAPPY', 'SAD', 'SURPRISED', 'ANGRY', 'NEUTRAL']; // [REMOVED] Not used

    // [FIX] Handle Session End Properly
    // [FIX] Handle Session End Properly with Timeout
    const handleEndSession = async () => {
        if (isEnding) return; // Block double entry
        setIsEnding(true);
        
        // 1. Flush any pending data (Vital for short sessions)
        // [TIMEOUT FIX] Prevent Hang on Flush if network is slow/dead
        const flushPromise = flushData();
        const timeoutPromise = new Promise(resolve => setTimeout(resolve, 2000));
        
        try {
            await Promise.race([flushPromise, timeoutPromise]);
        } catch (e) {
            console.warn("Flush timed out or failed", e);
        }

        // 2. Notify Backend to Generate Report
        try {
            await apiClient('/session/end', {
                method: 'POST',
                body: JSON.stringify({ session_id: sessionId })
            });
            console.log("Session Finalized Successfully");
        } catch (e) {
            console.error("Failed to finalize session:", e);
        }

        // 3. Close UI
        onExit(); 
    };

    return (
        <div className="relative w-full h-screen bg-black overflow-hidden flex flex-col font-sans">
             {/* VIDEO LAYER - Z-0 */}
             <video 
                ref={videoRef}
                className="absolute inset-0 w-full h-full object-cover z-0 opacity-100"
                autoPlay 
                playsInline 
                muted
            />
            
            <canvas 
                ref={canvasRef}
                width={1280} 
                height={720} 
                className="absolute inset-0 w-full h-full object-cover z-10 pointer-events-none"
            />

            {/* HEADER - High Z-Index to ensure visibility over video */}
            <div className="fixed top-6 left-6 z-[10000] pointer-events-auto flex items-center gap-4">
                <button 
                    onClick={handleEndSession} 
                    disabled={isEnding}
                    className={`group flex items-center gap-3 px-5 py-3 rounded-full backdrop-blur-md border border-white/10 transition-all ${isEnding ? 'bg-gray-500/50 cursor-not-allowed' : 'bg-black/40 hover:bg-red-500/80 hover:scale-105'} text-white`}
                >
                   {/* Close Icon (or Spinner) */}
                   <div className="bg-white/10 p-1 rounded-full group-hover:bg-white/20">
                       {isEnding ? (
                           <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                       ) : (
                           <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                       )}
                   </div>
                   <span className="font-bold tracking-wider text-sm">
                       {isEnding ? 'ENDING...' : 'END SESSION'}
                   </span>
                </button>

                <div className={`px-4 py-2 rounded-full text-xs font-mono tracking-widest border border-white/5 backdrop-blur-md ${isConnected ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400 animate-pulse'}`}>
                    {isConnected ? '● LIVE' : '○ CONNECTING...'}
                </div>
            </div>

            {/* CENTER OVERLAY: FACE GUIDE & FEEDBACK */}
            <div className="absolute inset-0 flex flex-col items-center justify-center z-10 pointer-events-none">
                
                {/* Target Emotion */}
                <div className="text-center mb-8">
                    <p className="text-pink-400 text-xs font-bold tracking-[0.3em] uppercase mb-2 drop-shadow-md">SHOW ME</p>
                    <h1 className="text-7xl md:text-9xl font-thin text-white drop-shadow-2xl tracking-tighter">
                        {targetEmotion}
                    </h1>
                </div>

                {/* Face Guide Circle */}
                <div className="w-64 h-64 md:w-80 md:h-80 rounded-full border-2 border-dashed border-white/20 flex items-center justify-center relative backdrop-blur-[2px]">
                     <div className="text-center">
                         <div className="text-xs text-white/50 mb-1 uppercase tracking-widest">Detected</div>
                         <div className="text-3xl font-bold text-white mb-1">{detectedEmotion}</div>
                         <div className="text-xs text-pink-400 font-mono">{confidence}% CONFIDENCE</div>
                     </div>
                     
                     {/* Scanning Animation */}
                     <div className="absolute inset-0 rounded-full border-t-2 border-pink-500 animate-spin opacity-50" style={{ animationDuration: '3s' }} />
                </div>

                {/* AI Feedback Text */}
                <AnimatePresence>
                    {feedback && (
                        <motion.div 
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            key={feedback}
                            className="mt-12 bg-black/60 backdrop-blur-md px-6 py-3 rounded-xl border border-white/10 max-w-md text-center"
                        >
                            <p className="text-white text-lg font-light leading-relaxed">"{feedback}"</p>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* LOADING STATE - OVERLAY */}
            {!isModelLoaded && (
                 <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm transition-opacity duration-500">
                    <div className="text-center">
                        <Camera className="w-12 h-12 text-pink-500 mx-auto mb-4 animate-bounce" />
                        <h2 className="text-xl text-white font-mono animate-pulse">LOADING FACE MESH...</h2>
                        <p className="text-xs text-white/50 mt-2">Optimizing for your device...</p>
                    </div>
                </div>
            )}

            {/* BOTTOM CONTROLS REMOVED - Session is fixed to one emotion */}
            {/* <div className="absolute bottom-10 left-0 w-full flex justify-center z-20"> ... </div> */}
        </div>
    );
}
