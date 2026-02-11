import { motion, AnimatePresence } from 'framer-motion';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

interface PortalModalProps {
    isOpen: boolean;
    onClose: () => void;
    children: React.ReactNode;
    className?: string;
    hideCloseButton?: boolean; // [NEW] Output control
}

export function PortalModal({ isOpen, onClose, children, className = "", hideCloseButton = false }: PortalModalProps) {
    if (typeof document === 'undefined') return null;

    return createPortal(
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
                    {/* BACKDROP */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
                    />

                    {/* CONTENT */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className={`relative bg-gray-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] w-full ${className}`}
                    >
                         {/* Close Button (Optional/Shared) */}
                         {!hideCloseButton && (
                             <button
                                onClick={onClose}
                                className="absolute top-4 right-4 p-2 bg-black/20 hover:bg-white/10 rounded-full text-white/50 hover:text-white transition-colors z-50"
                             >
                                 <X size={20} />
                             </button>
                         )}

                         {children}
                    </motion.div>
                </div>
            )}
        </AnimatePresence>,
        document.body
    );
}
