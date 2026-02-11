import { motion, AnimatePresence } from 'framer-motion';

interface PWAInstallPromptProps {
    isInstallable: boolean;
    onInstall: () => void;
}

export function PWAInstallPrompt({ isInstallable, onInstall }: PWAInstallPromptProps) {
    if (!isInstallable) return null;

    return (
        <AnimatePresence>
            <motion.button
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                onClick={onInstall}
                className="px-4 py-2 rounded-full bg-cyber-cyan/10 text-cyber-cyan border border-cyber-cyan/30 text-xs font-mono uppercase tracking-widest hover:bg-cyber-cyan/20 transition-all flex items-center gap-2 animate-pulse-slow"
            >
                📲 Install App
            </motion.button>
        </AnimatePresence>
    );
}
