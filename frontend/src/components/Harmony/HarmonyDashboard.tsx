import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

export function HarmonyDashboard() {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen relative overflow-hidden bg-[#1a103c] text-white">
             {/* Abstract Background */}
             <div className="absolute top-[-20%] left-[-10%] w-[70%] h-[70%] bg-purple-900/30 rounded-full blur-[150px] animate-pulse" />
             <div className="absolute bottom-[-20%] right-[-10%] w-[70%] h-[70%] bg-blue-900/30 rounded-full blur-[150px] animate-pulse delay-700" />

            <div className="max-w-6xl mx-auto px-6 py-20 relative z-10">
                <div className="text-center mb-20">
                    <h1 className="text-6xl font-thin tracking-tighter mb-4 text-transparent bg-clip-text bg-gradient-to-r from-pink-300 via-purple-300 to-indigo-300">
                        Harmony
                    </h1>
                    <p className="text-purple-300/60 font-mono text-xs tracking-[0.3em] uppercase">
                        Emotional Regulation & Social Connection
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-12 max-w-4xl mx-auto">
                    
                    {/* CARD 1: EMOTION MIRROR */}
                    <motion.div 
                        initial={{ opacity: 0, x: -50 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.2 }}
                        onClick={() => navigate('/harmony/mirror')}
                        className="group relative h-96 rounded-3xl overflow-hidden cursor-pointer border border-white/5 hover:border-pink-400/50 transition-colors bg-gradient-to-b from-white/5 to-transparent backdrop-blur-sm"
                    >
                        <div className="absolute inset-0 bg-pink-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                        
                        <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center">
                            <div className="text-8xl mb-6 transform group-hover:scale-110 transition-transform duration-500">🪞</div>
                            <h2 className="text-3xl font-light mb-2">Emotion Mirror</h2>
                            <p className="text-sm text-gray-400 leading-relaxed max-w-xs">
                                Practice facial expressions and see how AI interprets your emotions in real-time.
                            </p>
                        </div>
                    </motion.div>

                    {/* CARD 2: GUIDED JOURNAL (Future) */}
                    <motion.div 
                        initial={{ opacity: 0, x: 50 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.4 }}
                        className="group relative h-96 rounded-3xl overflow-hidden cursor-not-allowed border border-white/5 grayscale opacity-50"
                    >
                        <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center">
                            <div className="text-8xl mb-6">📓</div>
                            <h2 className="text-3xl font-light mb-2">Silent Journal</h2>
                            <p className="text-sm text-gray-400 leading-relaxed max-w-xs">
                                Sign your thoughts to a private AI confidant. <br/>(Coming Soon)
                            </p>
                        </div>
                    </motion.div>

                </div>
            </div>
        </div>
    );
}
