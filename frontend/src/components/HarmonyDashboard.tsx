
import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { HarmonySession } from './HarmonySession';
import { apiClient } from '../api/client';
import { Plus, X, Heart, Smile, Frown, ShieldAlert, Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { PortalModal } from './PortalModal'; // Added this import
import { StorySignReportModal } from './StorySignReportModal';

interface CustomExercise {
    id: string;
    name: string;
    domain: string;
    config: any;
}

const PRESET_EMOTIONS = [
    { name: 'HAPPY', icon: Smile, color: 'text-yellow-400', bg: 'bg-yellow-500/20', border: 'border-yellow-500/50' },
    { name: 'SAD', icon: Frown, color: 'text-blue-400', bg: 'bg-blue-500/20', border: 'border-blue-500/50' },
    { name: 'ANGRY', icon: ShieldAlert, color: 'text-red-400', bg: 'bg-red-500/20', border: 'border-red-500/50' },
    { name: 'SURPRISED', icon: Zap, color: 'text-purple-400', bg: 'bg-purple-500/20', border: 'border-purple-500/50' },
];

export function HarmonyDashboard() {
    const navigate = useNavigate();
    const [activeSession, setActiveSession] = useState<{ name: string } | null>(null);
    const [customExercises, setCustomExercises] = useState<CustomExercise[]>([]);
    
    // Dynamic Creation State
    const [isCreating, setIsCreating] = useState(false);
    const [newEmotionName, setNewEmotionName] = useState("");
    
    // History State - [REMOVED] Now using full screen view
    // const [isHistoryOpen, setIsHistoryOpen] = useState(false);
    // const [historyItems, setHistoryItems] = useState<any[]>([]);
    const [selectedReport, setSelectedReport] = useState<any | null>(null);

    // Fetch Custom Exercises
    const loadCustomExercises = () => {
        apiClient('/exercises/custom?domain=FACE').then((data: any) => {
            setCustomExercises(data as CustomExercise[]);
        }).catch(err => console.error("Failed to load custom exercises", err));
    };
    useEffect(() => {
        loadCustomExercises();
    }, [activeSession]); // Reload when session ends

    const handleStartSession = (emotion: string) => {
        setActiveSession({ name: emotion });
    };

    const handleEndSession = () => {
        setActiveSession(null);
    };

    // [REMOVED] handleHistoryOpen replaced by navigation

    const handleCreateDynamic = async () => {
        if (!newEmotionName.trim()) return;
        
        const emotion = newEmotionName.toUpperCase();

        // 1. Optimistic UI: Start immediately
        setActiveSession({ name: emotion });
        setIsCreating(false);
        setNewEmotionName("");

        // 2. Persist in Background
        try {
            await apiClient('/exercises/custom', {
                method: 'POST',
                body: JSON.stringify({
                    name: emotion,
                    domain: 'FACE',
                    config: { emotion: emotion }
                })
            });
            loadCustomExercises(); 
        } catch (e) {
            console.error("Failed to save custom emotion", e);
        }
    };

    return (
        <div className="min-h-screen bg-black text-white p-8 font-sans relative overflow-hidden">
             
             {/* BACKGROUND ACCENTS */}
             <div className="absolute top-0 left-0 w-full h-96 bg-gradient-to-b from-purple-900/20 to-transparent pointer-events-none" />

             {/* HEADER */}
             <header className="relative z-10 flex justify-between items-center mb-12">
                 <div>
                     <h1 className="text-4xl font-thin tracking-tighter mb-2">
                        Harmony <span className="text-purple-400 font-bold">Studio</span>
                     </h1>
                     <p className="text-white/50 text-sm uppercase tracking-widest">Emotion Intelligence Service v2.0</p>
                 </div>
                 <div className="flex gap-4">
                     <button onClick={() => navigate('/harmony/history')} className="bg-white/5 hover:bg-white/10 px-6 py-2 rounded-full text-sm font-mono border border-white/10 transition-colors">
                        HISTORY
                     </button>
                     <button onClick={() => navigate('/')} className="bg-white/5 hover:bg-white/10 px-6 py-2 rounded-full text-sm font-mono border border-white/10">
                        ← HOME
                     </button>
                 </div>
             </header>

             {/* MAIN GRID */}
             <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                 
                 {/* 1. PRESETS */}
                 {PRESET_EMOTIONS.map(emo => (
                     <motion.button
                        key={emo.name}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => handleStartSession(emo.name)}
                        className={`aspect-square rounded-3xl ${emo.bg} ${emo.border} border backdrop-blur-sm flex flex-col items-center justify-center gap-4 transition-all group relative overflow-hidden`}
                     >
                         <div className={`absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity`} />
                         <emo.icon className={`w-16 h-16 ${emo.color} drop-shadow-[0_0_15px_rgba(255,255,255,0.3)]`} />
                         <span className="text-xl font-bold tracking-widest">{emo.name}</span>
                     </motion.button>
                 ))}

                 {/* 2. CUSTOM EXERCISES (Saved) */}
                 {customExercises.map(ex => (
                     <motion.button
                        key={ex.id}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => handleStartSession(ex.name)}
                        className="aspect-square rounded-3xl bg-gray-900/50 border border-white/10 backdrop-blur-sm flex flex-col items-center justify-center gap-4 hover:border-purple-500/50 transition-all group relative"
                     >
                         <Heart className="w-12 h-12 text-pink-400/50 group-hover:text-pink-400 transition-colors" />
                         <div className="text-center">
                             <span className="block text-lg font-bold text-gray-300 group-hover:text-white">{ex.name}</span>
                             <span className="text-xs text-gray-600 uppercase">Custom</span>
                         </div>
                     </motion.button>
                 ))}

                 {/* 3. CREATE NEW (Dynamic) */}
                <motion.button
                     whileHover={{ scale: 1.05, borderColor: 'rgba(168, 85, 247, 0.8)' }}
                     whileTap={{ scale: 0.95 }}
                     onClick={() => setIsCreating(true)}
                     className="aspect-square rounded-3xl bg-transparent border-2 border-dashed border-white/20 flex flex-col items-center justify-center gap-4 text-white/40 hover:text-purple-400 hover:bg-purple-500/5 transition-all"
                  >
                      <Plus className="w-16 h-16" />
                      <span className="text-sm font-mono uppercase tracking-widest">Create New</span>
                  </motion.button>
 
              </div>

             {/* DYNAMIC CREATION MODAL */}
             <PortalModal 
                isOpen={isCreating} 
                onClose={() => setIsCreating(false)}
                className="max-w-md h-auto"
                hideCloseButton={true}
             >
                  <div className="p-8">
                      <div className="flex justify-between items-center mb-6">
                          <h3 className="text-xl font-bold text-white">New Emotion Card</h3>
                          <button onClick={() => setIsCreating(false)}><X className="text-gray-500 hover:text-white" /></button>
                      </div>
                      
                      <input 
                         autoFocus
                         type="text" 
                         placeholder="E.g. FRUSTRATED, EXCITED..." 
                         value={newEmotionName}
                         onChange={e => setNewEmotionName(e.target.value)}
                         onKeyDown={e => e.key === 'Enter' && handleCreateDynamic()}
                         className="w-full bg-black/50 border border-white/10 rounded-lg p-4 text-white placeholder-gray-600 focus:border-purple-500 focus:outline-none mb-6 text-lg"
                      />
                      
                      <button 
                         onClick={handleCreateDynamic}
                         disabled={!newEmotionName.trim()}
                         className="w-full bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-4 rounded-xl transition-all"
                      >
                          START SESSION
                      </button>
                  </div>
             </PortalModal>



             {/* ACTIVE SESSION RUNNER (MODAL) PORTAL */}
             {createPortal(
                 <AnimatePresence mode="wait">
                 {activeSession && (
                     <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[9999] bg-black"
                     >
                         <HarmonySession 
                            emotion={activeSession.name} 
                            onExit={handleEndSession} 
                         />
                     </motion.div>
                 )}
                 </AnimatePresence>,
                 document.body
             )}


              {/* REPORT MODAL PORTAL */}
              {createPortal(
                  selectedReport && (
                      <StorySignReportModal 
                          report={selectedReport} 
                          onClose={() => setSelectedReport(null)} 
                      />
                  ),
                  document.body
              )}

        </div>
    );
}
