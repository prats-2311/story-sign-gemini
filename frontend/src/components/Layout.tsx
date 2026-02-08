import { Outlet, Link, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';

export function Layout() {
    const [theme, setTheme] = useState<'midnight' | 'twilight'>('midnight');
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
    const location = useLocation();

    useEffect(() => {
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            setDeferredPrompt(e);
        });
    }, []);

    const handleInstall = () => {
        if (deferredPrompt) {
            deferredPrompt.prompt();
            deferredPrompt.userChoice.then((choiceResult: any) => {
                if (choiceResult.outcome === 'accepted') {
                    setDeferredPrompt(null);
                }
            });
        }
    };

    // Determine current module for header highlight? (Optional polish)
    
    return (
        <div className={`min-h-screen font-sans selection:bg-cyber-cyan selection:text-black overflow-x-hidden relative transition-colors duration-1000 ${theme === 'midnight' ? 'bg-[#050505] text-white' : 'bg-[#1a103c] text-white'}`}>
            
            {/* BACKGROUND: Aurora Mesh Gradient (Shared) */}
            <div className="fixed inset-0 z-0 pointer-events-none">
                <div className={`absolute top-[-10%] left-[-10%] w-[60%] h-[60%] rounded-full blur-[120px] animate-pulse transition-colors duration-1000 ${theme === 'midnight' ? 'bg-purple-900/40' : 'bg-pink-600/30'}`} />
                <div className={`absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] rounded-full blur-[120px] animate-pulse delay-700 transition-colors duration-1000 ${theme === 'midnight' ? 'bg-cyber-cyan/20' : 'bg-purple-500/30'}`} />
                <div className="absolute top-[20%] left-[30%] w-[40%] h-[40%] bg-blue-900/30 rounded-full blur-[100px] animate-pulse delay-1000 mix-blend-screen" />
            </div>

            {/* SHARED HEADER */}
            <header className="fixed top-0 w-full z-50 bg-white/5 backdrop-blur-md border-b border-white/5">
                <div className="max-w-7xl mx-auto px-6 h-24 flex items-center justify-between">
                    <Link to="/" className="flex items-center gap-4 group cursor-pointer">
                         {/* NEW LOGO */}
                         <img src="/logo.svg" alt="StorySign Logo" className="w-12 h-12 drop-shadow-[0_0_15px_rgba(168,85,247,0.4)] group-hover:scale-110 transition-transform duration-300" />
                        <span className="text-3xl font-bold tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-400">StorySign</span>
                    </Link>

                    {/* DESKTOP NAV */}
                    <div className="hidden md:flex items-center gap-6">
                        <nav className="flex gap-6 text-sm font-bold uppercase tracking-widest text-gray-400">
                             <Link to="/reconnect" className={`hover:text-cyber-cyan transition-colors ${location.pathname.startsWith('/reconnect') ? 'text-cyber-cyan' : ''}`}>Reconnect</Link>
                             <Link to="/asl" className={`hover:text-yellow-400 transition-colors ${location.pathname.startsWith('/asl') ? 'text-yellow-400' : ''}`}>ASL World</Link>
                             <Link to="/harmony" className={`hover:text-pink-400 transition-colors ${location.pathname.startsWith('/harmony') ? 'text-pink-400' : ''}`}>Harmony</Link>
                        </nav>

                        {/* THEME TOGGLE */}
                        <button 
                            onClick={() => setTheme(prev => prev === 'midnight' ? 'twilight' : 'midnight')}
                            className="px-4 py-2 rounded-full border border-white/10 bg-white/5 text-xs font-mono uppercase tracking-widest hover:bg-white/10 transition-all flex items-center gap-2"
                        >
                            <span className={`w-2 h-2 rounded-full ${theme === 'midnight' ? 'bg-blue-500' : 'bg-purple-500'}`}/>
                            {theme === 'midnight' ? 'Midnight' : 'Twilight'}
                        </button>

                        {/* INSTALL PWA BUTTON */}
                        {deferredPrompt && (
                            <button 
                                onClick={handleInstall}
                                className="px-4 py-2 rounded-full bg-cyber-cyan/10 text-cyber-cyan border border-cyber-cyan/30 text-xs font-mono uppercase tracking-widest hover:bg-cyber-cyan/20 transition-all flex items-center gap-2"
                            >
                                📲 Install App
                            </button>
                        )}
                    </div>

                    {/* MOBILE HAMBURGER BUTTON */}
                    <button 
                        className="md:hidden text-white p-2"
                        onClick={() => setIsMenuOpen(!isMenuOpen)}
                    >
                        {isMenuOpen ? (
                             <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        ) : (
                             <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
                        )}
                    </button>
                </div>

                {/* MOBILE MENU DROPDOWN */}
                {isMenuOpen && (
                    <div className="md:hidden absolute top-24 left-0 w-full bg-[#050505]/95 backdrop-blur-xl border-b border-white/10 p-6 flex flex-col gap-6 shadow-2xl animate-fade-in-down">
                        <Link 
                            to="/reconnect" 
                            onClick={() => setIsMenuOpen(false)}
                            className="text-2xl font-bold text-white hover:text-cyber-cyan flex items-center gap-4"
                        >
                            <span className="w-2 h-2 bg-cyber-cyan rounded-full"/> Reconnect
                        </Link>
                        <Link 
                            to="/asl" 
                            onClick={() => setIsMenuOpen(false)}
                            className="text-2xl font-bold text-white hover:text-yellow-400 flex items-center gap-4"
                        >
                            <span className="w-2 h-2 bg-yellow-400 rounded-full"/> ASL World
                        </Link>
                        <Link 
                            to="/harmony" 
                            onClick={() => setIsMenuOpen(false)}
                            className="text-2xl font-bold text-white hover:text-pink-400 flex items-center gap-4"
                        >
                            <span className="w-2 h-2 bg-pink-400 rounded-full"/> Harmony
                        </Link>
                        
                        <div className="h-px bg-white/10 my-2" />
                        
                        <button 
                            onClick={() => { setTheme(prev => prev === 'midnight' ? 'twilight' : 'midnight'); setIsMenuOpen(false); }}
                            className="text-sm font-mono uppercase tracking-widest text-gray-400 flex items-center gap-3"
                        >
                             <span className={`w-3 h-3 rounded-full ${theme === 'midnight' ? 'bg-blue-500' : 'bg-purple-500'}`}/>
                             Switch Theme ({theme})
                        </button>

                        {deferredPrompt && (
                            <button 
                                onClick={() => { handleInstall(); setIsMenuOpen(false); }}
                                className="text-sm font-mono uppercase tracking-widest text-cyber-cyan flex items-center gap-3"
                            >
                                 📲 Install App
                            </button>
                        )}
                    </div>
                )}
            </header>

            {/* PAGE CONTENT */}
            <main className="relative z-10 pt-32 pb-20 px-6 max-w-7xl mx-auto min-h-screen">
                <Outlet />
            </main>

            {/* BRANDED FOOTER */}
            <footer className="relative z-10 border-t border-white/5 bg-black/20 backdrop-blur-md mt-20">
                <div className="max-w-7xl mx-auto px-6 py-12 flex flex-col md:flex-row justify-between items-center gap-8">
                    <div className="flex items-center gap-4 grayscale opacity-50 hover:grayscale-0 hover:opacity-100 transition-all duration-500">
                        <img src="/logo.svg" alt="StorySign Footer Logo" className="w-8 h-8" />
                        <span className="text-sm font-mono tracking-widest text-gray-400">STORYSIGN © 2024</span>
                    </div>
                    
                    <div className="flex gap-8 text-xs font-bold text-gray-500 uppercase tracking-widest">
                        <a href="#" className="hover:text-cyber-cyan transition-colors">Privacy</a>
                        <a href="#" className="hover:text-cyber-cyan transition-colors">Safety</a>
                        <a href="#" className="hover:text-cyber-cyan transition-colors">Contact</a>
                    </div>
                </div>
            </footer>
        </div>
    );
}
