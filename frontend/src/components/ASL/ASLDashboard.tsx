import { useNavigate } from 'react-router-dom';
import { ASL_LEVELS } from './LevelData';
import { motion } from 'framer-motion';

export function ASLDashboard() {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen py-10 px-4 relative overflow-hidden">
             {/* Background Elements */}
             <div className="absolute top-20 left-10 text-[200px] opacity-5 select-none animate-pulse">👋</div>
             <div className="absolute bottom-20 right-10 text-[200px] opacity-5 select-none animate-bounce delay-1000">🌍</div>

            <div className="max-w-4xl mx-auto relative z-10">
                <div className="text-center mb-16">
                    <h1 className="text-5xl font-black italic text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-500 drop-shadow-[0_4px_10px_rgba(234,179,8,0.4)] mb-4">
                        ASL WORLD
                    </h1>
                    <p className="text-gray-400 font-mono text-sm tracking-widest uppercase">
                        Master the language of signs, one adventure at a time.
                    </p>
                </div>

                {/* LEVEL MAP */}
                <div className="flex flex-col items-center gap-12 relative">
                    {/* Snake Path Line - Visual only */}
                    <svg className="absolute top-0 bottom-0 w-full h-full pointer-events-none opacity-20" style={{ zIndex: -1 }}>
                        <path d="M450 50 Q 600 150 450 250 T 450 450" fill="none" stroke="white" strokeWidth="4" strokeDasharray="10 10" />
                    </svg>

                    {ASL_LEVELS.map((level, index) => {
                        const isLocked = level.status === 'locked';
                        // Simple zigzag layout logic for visual interest
                        const zigzag = index % 2 === 0 ? 'translate-x-0' : 'translate-x-12'; 
                        
                        return (
                            <motion.div 
                                key={level.id}
                                initial={{ opacity: 0, y: 50 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.1 }}
                                className={`relative group ${zigzag}`}
                            >
                                <button 
                                    onClick={() => !isLocked && navigate(`/asl/level/${level.id}`)}
                                    disabled={isLocked}
                                    className={`
                                        w-32 h-32 rounded-full border-4 flex items-center justify-center text-4xl shadow-[0_0_30px_rgba(0,0,0,0.5)] transition-all transform
                                        ${isLocked 
                                            ? 'bg-gray-800 border-gray-700 opacity-50 cursor-not-allowed grayscale' 
                                            : `bg-gradient-to-br ${level.color} border-white/20 hover:scale-110 hover:shadow-[0_0_50px_rgba(255,255,255,0.4)] cursor-pointer`
                                        }
                                    `}
                                >
                                    {isLocked ? '🔒' : level.icon}
                                    
                                    {/* STARS INDICATOR */}
                                    {!isLocked && (
                                        <div className="absolute -bottom-2 flex gap-1">
                                            {[1, 2, 3].map(s => (
                                                <div key={s} className={`w-4 h-4 rounded-full border border-black ${s <= level.stars ? 'bg-yellow-400' : 'bg-gray-700'}`} />
                                            ))}
                                        </div>
                                    )}
                                </button>
                                
                                {/* MOBILE TITLE (Always Visible) */}
                                <div className="md:hidden mt-2 text-center">
                                    <span className={`text-sm font-bold tracking-widest uppercase ${isLocked ? 'text-gray-600' : 'text-white'}`}>
                                        {level.title}
                                    </span>
                                </div>

                                {/* LEVEL INFO POPUP (Hover) */}
                                <div className="absolute top-1/2 left-40 -translate-y-1/2 w-64 bg-gray-900/90 backdrop-blur border border-white/10 p-4 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20">
                                    <h3 className="font-bold text-lg text-white">{level.title}</h3>
                                    <p className="text-gray-400 text-xs mt-1">{level.description}</p>
                                    <div className="mt-3 flex flex-wrap gap-1">
                                        {level.words.map((w: any) => {
                                            const wordText = typeof w === 'string' ? w : w.word;
                                            return (
                                                <span key={wordText} className="text-[10px] bg-white/10 px-2 py-1 rounded text-gray-300">{wordText}</span>
                                            );
                                        })}
                                    </div>
                                </div>
                            </motion.div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
