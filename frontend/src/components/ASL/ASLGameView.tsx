import { useRef, useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useGeminiLive } from '../../hooks/useGeminiLive';
import { usePoseDetection } from '../../hooks/usePoseDetection';
import { ASL_LEVELS } from './LevelData';
import { motion, AnimatePresence } from 'framer-motion';

export function ASLGameView() {
    const { levelId } = useParams();
    const navigate = useNavigate();
    const videoRef = useRef<HTMLVideoElement>(null);
    const { isModelLoaded, detectPose } = usePoseDetection();

    // Level State
    const level = ASL_LEVELS.find(l => l.id === levelId);
    const [currentWordIndex, setCurrentWordIndex] = useState(0);
    const [score, setScore] = useState(0);
    const [gameState, setGameState] = useState<'intro' | 'playing' | 'feedback' | 'completed'>('intro');

    // Gemini Hook
    // Defined outside or memoized to prevent re-renders in hook
    const aslConfig = useRef<any>({ id: 'asl', name: 'ASL', target_joint: 'wrist', required_rom: 0 }).current;
    const handleLandmarks = useRef(() => {}).current;

    const { connect, disconnect, startVideoStream, isConnected, messages } = useGeminiLive({
        mode: 'ASL',
        detectPose,
        videoRef,
        exerciseConfig: aslConfig,
        onLandmarks: handleLandmarks 
    });

    // EFFECT: Handle Backend Feedack
    useEffect(() => {
        if (messages.length > 0) {
            const lastMessage = messages[messages.length - 1];
            try {
                // Try to find JSON in the message
                const jsonMatch = lastMessage.match(/\{.*\}/s);
                if (jsonMatch) {
                    const data = JSON.parse(jsonMatch[0]);
                    if (data.event_type === 'evaluation' && data.content?.is_correct) {
                        simulateSuccess(); // Re-use the success trigger
                    }
                }
            } catch (e) {
                // Ignore parse errors, might be normal chat
            }
        }
    }, [messages]);

    useEffect(() => {
        // Start camera on mount
        connect();
        setTimeout(() => {
             startVideoStream();
             // startAudioStream(); // Keep disabled for now to start silent
        }, 1000);

        return () => disconnect();
    }, []);

    if (!level) return <div className="p-20 text-center">Level Not Found</div>;


    const [showHint, setShowHint] = useState(false);
    const currentWordData = level.words[currentWordIndex];
    
    // Debugging: Ensure we are getting the right data
    console.log('[ASLGameView] Word Data:', currentWordData);

    let currentWord = 'LOADING';
    let currentHint = 'No hint available';

    if (currentWordData) {
        if (typeof currentWordData === 'string') {
            currentWord = currentWordData;
        } else if (typeof currentWordData === 'object' && 'word' in currentWordData) {
            currentWord = currentWordData.word;
            currentHint = currentWordData.hint;
        }
    }

    const progress = ((currentWordIndex) / level.words.length) * 100;

    const handleNext = () => {
        if (currentWordIndex < level.words.length - 1) {
            setGameState('playing');
            setCurrentWordIndex(prev => prev + 1);
            setShowHint(false); // Reset hint for next word
        } else {
            setGameState('completed');
        }
    };

    // [SIMULATION] Mocking feedback for now until prompt is wired
    const simulateSuccess = () => {
        if (gameState !== 'playing') return; // Prevent double triggers
        setGameState('feedback');
        setScore(prev => prev + 100);
        setTimeout(handleNext, 2000);
    };

    return (
        <div className="relative h-screen bg-black overflow-hidden flex flex-col">
            
            {/* BACKGROUND VIDEO FEED */}
            <div className="absolute inset-0 z-0">
                <video ref={videoRef} className="w-full h-full object-cover opacity-40" autoPlay playsInline muted />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black/50" />
            </div>

            {/* HUD HEADER */}
            <div className="relative z-10 p-6 flex justify-between items-center">
                <div className="flex items-center gap-4">
                    <button onClick={() => navigate('/asl')} className="bg-white/10 hover:bg-white/20 p-2 rounded-full backdrop-blur">
                        ✕
                    </button>
                    
                    {/* CONNECTION STATUS */}
                    <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500 shadow-[0_0_10px_#22c55e]' : 'bg-red-500 animate-pulse'}`} />

                    {/* PROGRESS BAR */}
                    <div className="w-64 h-4 bg-gray-800 rounded-full overflow-hidden border border-gray-700">
                        <div className="h-full bg-yellow-500 transition-all duration-500" style={{ width: `${progress}%` }} />
                    </div>
                </div>
                <div className="text-2xl font-black text-yellow-500 drop-shadow-[0_0_10px_rgba(234,179,8,0.5)]">
                    {score} PTS
                </div>
            </div>

            {/* MAIN GAME AREA */}
            <div className="relative z-10 flex-1 flex flex-col items-center justify-center p-10">
                
                <AnimatePresence mode="wait">
                    {gameState === 'intro' && (
                        <motion.div 
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 1.2, opacity: 0 }}
                            className="text-center"
                        >
                            <h1 className="text-6xl font-black text-white mb-4">{level.title}</h1>
                            <p className="text-xl text-gray-300 mb-8">{level.description}</p>
                            
                            {!isModelLoaded ? (
                                <div className="text-yellow-500 font-mono animate-pulse">INITIALIZING VISION MODELS...</div>
                            ) : (
                                <button 
                                    onClick={() => setGameState('playing')}
                                    className="bg-yellow-500 text-black font-bold text-xl px-12 py-4 rounded-full hover:scale-105 transition-transform shadow-[0_0_30px_rgba(234,179,8,0.5)]"
                                >
                                    START
                                </button>
                            )}
                        </motion.div>
                    )}

                    {gameState === 'playing' && (
                        <motion.div 
                            key={currentWord}
                            initial={{ y: 50, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            exit={{ y: -50, opacity: 0 }}
                            className="text-center bg-black/40 backdrop-blur-xl p-12 rounded-3xl border border-white/10 shadow-2xl max-w-2xl w-full"
                        >
                            <div className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-2">Sign This Word</div>
                            <div className="text-7xl md:text-8xl font-black text-white mb-6 drop-shadow-lg">{currentWord}</div>
                            
                            {/* HINT AREA */}
                            <AnimatePresence>
                                {showHint && (
                                    <motion.div 
                                        initial={{ height: 0, opacity: 0 }} 
                                        animate={{ height: 'auto', opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        className="mb-8 overflow-hidden"
                                    >
                                        <div className="bg-yellow-500/10 border border-yellow-500/30 p-4 rounded-xl text-yellow-200 text-lg font-medium">
                                            💡 {currentHint}
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            {/* CONTROLS */}
                            <div className="flex flex-col md:flex-row gap-4 justify-center">
                                <button 
                                    onClick={() => setShowHint(!showHint)}
                                    className="px-6 py-3 bg-white/5 rounded-full text-sm font-bold hover:bg-white/10 transition-colors border border-white/5"
                                >
                                    {showHint ? 'Hide Hint' : '💡 Show Hint'}
                                </button>
                                <button onClick={simulateSuccess} className="px-6 py-3 bg-green-500/20 text-green-400 border border-green-500/50 rounded-full text-sm font-bold hover:bg-green-500/30 transition-colors">
                                    [DEV] Mark Valid
                                </button>
                            </div>
                        </motion.div>
                    )}

                    {gameState === 'feedback' && (
                        <motion.div
                            initial={{ scale: 0.5, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.8, opacity: 0 }}
                            className="absolute inset-0 flex items-center justify-center z-50 pointer-events-none"
                        >
                            <div className="text-center">
                                <div className="text-9xl mb-4 animate-bounce">✨</div>
                                <div className="text-6xl font-black text-green-400 drop-shadow-[0_0_20px_rgba(74,222,128,0.8)]">
                                    PERFECT!
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {gameState === 'completed' && (
                        <motion.div className="text-center bg-black/80 backdrop-blur p-12 rounded-3xl border border-yellow-500/30">
                            <div className="text-6xl mb-4">🏆</div>
                            <h2 className="text-4xl font-bold text-white mb-2">Level Complete!</h2>
                            <p className="text-2xl text-yellow-500 font-mono mb-8">Score: {score}</p>
                            <button 
                                onClick={() => navigate('/asl')}
                                className="bg-white text-black font-bold px-8 py-3 rounded-full hover:bg-gray-200"
                            >
                                Back to Map
                            </button>
                        </motion.div>
                    )}
                </AnimatePresence>

            </div>
        </div>
    );
}
