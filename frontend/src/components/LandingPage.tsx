import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
    FaSignLanguage, 
    FaHeart, 
    FaRunning, 
    FaVolumeUp, 
    FaArrowRight,
    FaUniversalAccess
} from 'react-icons/fa';

export function LandingPage() {
    const navigate = useNavigate();
    const [speaking, setSpeaking] = useState<string | null>(null);

    const speak = (text: string, id: string) => {
        if (speaking) {
            window.speechSynthesis.cancel();
            if (speaking === id) {
                setSpeaking(null);
                return;
            }
        }
        
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 0.9;
        utterance.pitch = 1.1;
        utterance.onend = () => setSpeaking(null);
        
        setSpeaking(id);
        window.speechSynthesis.speak(utterance);
    };

    const modules = [
        {
            id: 'asl',
            path: '/asl',
            title: "ASL World",
            icon: <FaSignLanguage className="text-5xl text-yellow-400" />,
            desc: "An interactive storytelling adventure. Sign words to move the story forward. Perfect for learning American Sign Language in a fun, immersive way.",
            gradient: "from-yellow-500/20 to-orange-500/20",
            border: "border-yellow-500/30 hover:border-yellow-400"
        },
        {
            id: 'harmony',
            path: '/harmony',
            title: "Harmony",
            icon: <FaHeart className="text-5xl text-pink-400" />,
            desc: "Your social-emotional coach. Practice facial expressions and emotional cues with a gentle, supportive AI mirror.",
            gradient: "from-pink-500/20 to-rose-500/20",
            border: "border-pink-500/30 hover:border-pink-400"
        },
        {
            id: 'reconnect',
            path: '/reconnect',
            title: "Reconnect",
            icon: <FaRunning className="text-5xl text-cyber-cyan" />,
            desc: "AI-powered physical therapy assistant. Recovery exercises with real-time feedback and progress tracking.",
            gradient: "from-cyan-500/20 to-blue-500/20",
            border: "border-cyber-cyan/30 hover:border-cyber-cyan"
        }
    ];

    return (
        <div className="flex flex-col items-center animate-fade-in-up">
            
            {/* Hero Section */}
            <section aria-labelledby="hero-title" className="text-center mb-32 space-y-8 max-w-4xl mt-12">
                <div className="inline-flex items-center gap-2 px-6 py-2 rounded-full bg-white/5 border border-white/10 text-sm font-medium text-cyber-cyan mb-4 hover:bg-white/10 transition-colors cursor-default">
                    <FaUniversalAccess />
                    <span>AI for Everyone</span>
                </div>
                
                <h1 id="hero-title" className="text-6xl md:text-8xl font-bold tracking-tighter leading-[0.9] drop-shadow-2xl">
                    Experience the <br />
                    <span className="bg-clip-text text-transparent bg-gradient-to-r from-cyber-cyan via-purple-500 to-pink-500 animate-gradient-x">
                        Future of Therapy
                    </span>
                </h1>
                
                <p className="max-w-2xl mx-auto text-2xl text-gray-400 leading-relaxed font-light">
                    StorySign bridges the gap between clinical care and daily life using advanced multimodal AI that <span className="text-white font-medium">sees</span>, <span className="text-white font-medium">hears</span>, and <span className="text-white font-medium">understands</span> you.
                </p>
            </section>

            {/* Module Grid */}
            <section aria-label="Available Modules" className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full">
                {modules.map((mod) => (
                    <article 
                        key={mod.id}
                        onClick={() => navigate(mod.path)}
                        className={`
                            relative group overflow-hidden rounded-[2rem] border bg-gray-900/40 p-10 flex flex-col gap-6
                            backdrop-blur-xl transition-all duration-500 cursor-pointer
                            hover:-translate-y-4 hover:shadow-[0_20px_60px_-15px_rgba(0,0,0,0.8)]
                            ${mod.border}
                        `}
                    >
                        {/* Gradient Blob HOVER */}
                        <div className={`absolute -top-20 -right-20 w-80 h-80 bg-gradient-to-br ${mod.gradient} blur-3xl opacity-0 group-hover:opacity-30 transition-opacity duration-700 rounded-full pointer-events-none`} />

                        {/* Header */}
                        <div className="flex justify-between items-start">
                            <div className="p-5 bg-white/5 rounded-2xl backdrop-blur-md border border-white/5 group-hover:scale-110 transition-transform duration-500 shadow-lg">
                                {mod.icon}
                            </div>
                            <button 
                                onClick={(e) => { e.stopPropagation(); speak(mod.desc, mod.id); }}
                                className={`p-4 rounded-full transition-all ${speaking === mod.id ? 'bg-cyber-cyan text-black animate-pulse shadow-[0_0_20px_#06b6d4]' : 'bg-white/5 text-gray-500 hover:text-white hover:bg-white/20'}`}
                                aria-label={`Read description for ${mod.title}`}
                                title="Read Aloud"
                            >
                                <FaVolumeUp className="text-lg" />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="space-y-4 flex-grow z-10">
                            <h2 className="text-3xl font-bold tracking-tight text-white group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r group-hover:from-white group-hover:to-gray-400 transition-all">
                                {mod.title}
                            </h2>
                            <p className="text-gray-400 text-lg leading-relaxed font-light">
                                {mod.desc}
                            </p>
                        </div>

                        {/* Action */}
                        <button
                            className="mt-4 w-full py-5 rounded-xl font-bold text-lg bg-white text-black hover:bg-cyber-cyan transition-all flex items-center justify-center gap-3 group-hover:shadow-[0_0_30px_rgba(255,255,255,0.3)] duration-300 relative z-10"
                            aria-label={`Enter ${mod.title}`}
                        >
                            Enter Module <FaArrowRight className="group-hover:translate-x-1 transition-transform" />
                        </button>
                    </article>
                ))}
            </section>

            <footer className="mt-32 text-gray-600 text-sm font-mono uppercase tracking-widest">
                AI-Powered • Secure • Accessible
            </footer>

        </div>
    );
}

// Removing styleTag, using standard CSS
export const styleTag = null;
