import { useState, useEffect } from 'react';
import { FaArrowRight, FaTimes } from 'react-icons/fa';

export interface TourStep {
    targetId: string; // The ID of the element to highlight
    title: string;
    content: string;
    position?: 'top' | 'bottom' | 'left' | 'right';
}

interface TourOverlayProps {
    steps: TourStep[];
    onComplete: () => void;
    isOpen: boolean;
}

export function TourOverlay({ steps, onComplete, isOpen }: TourOverlayProps) {
    const [currentStepIndex, setCurrentStepIndex] = useState(0);
    const [targetRect, setTargetRect] = useState<DOMRect | null>(null);

    useEffect(() => {
        if (!isOpen) return;
        
        const updateRect = () => {
            const step = steps[currentStepIndex];
            const element = document.getElementById(step.targetId);
            if (element) {
                element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                setTargetRect(element.getBoundingClientRect());
            } else {
                // Skip step if element not found in DOM
                console.warn(`Tour Target ${step.targetId} not found`);
            }
        };

        // Small delay to allow DOM to settle
        const timer = setTimeout(updateRect, 300);
        window.addEventListener('resize', updateRect);
        
        return () => {
             clearTimeout(timer);
             window.removeEventListener('resize', updateRect);
        };
    }, [currentStepIndex, isOpen, steps]);

    if (!isOpen || !targetRect) return null;

    const step = steps[currentStepIndex];
    const isLast = currentStepIndex === steps.length - 1;

    const handleNext = () => {
        if (isLast) {
            onComplete();
        } else {
            setCurrentStepIndex(prev => prev + 1);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] overflow-hidden">
            {/* Dark Overlay with "Hole" using clip-path */}
            {/* Since simple clip-path is hard for dynamic rects, we use 4 divs to frame the target */}
            <div className="absolute inset-0 bg-black/80">
                {/* We can use a massive SVG mask or just composed divs. Let's use specific composed divs for strict spotlight */}
                
                {/* Top */}
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: targetRect.top }} className="bg-black/50 backdrop-blur-sm transition-all duration-300" />
                {/* Bottom */}
                <div style={{ position: 'absolute', top: targetRect.bottom, left: 0, right: 0, bottom: 0 }} className="bg-black/50 backdrop-blur-sm transition-all duration-300" />
                {/* Left */}
                <div style={{ position: 'absolute', top: targetRect.top, left: 0, width: targetRect.left, height: targetRect.height }} className="bg-black/50 backdrop-blur-sm transition-all duration-300" />
                {/* Right */}
                <div style={{ position: 'absolute', top: targetRect.top, left: targetRect.right, right: 0, height: targetRect.height }} className="bg-black/50 backdrop-blur-sm transition-all duration-300" />
                
                {/* The Spotlight Ring */}
                <div 
                    className="absolute border-2 border-cyber-cyan rounded-lg shadow-[0_0_30px_rgba(6,182,212,0.5)] transition-all duration-300 pointer-events-none"
                    style={{
                        top: targetRect.top - 4,
                        left: targetRect.left - 4,
                        width: targetRect.width + 8,
                        height: targetRect.height + 8
                    }}
                />
            </div>

            {/* Tooltip Card */}
            <div 
                className="absolute z-[101] bg-white text-black p-6 rounded-xl shadow-2xl max-w-sm transition-all duration-300 animate-fade-in"
                style={{
                    // Simple positioning logic (improve for production to handle edge detection)
                    top: targetRect.bottom + 20, 
                    left: Math.max(20, Math.min(targetRect.left, window.innerWidth - 340))
                }}
            >
                <div className="flex justify-between items-start mb-2">
                    <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                        Step {currentStepIndex + 1} of {steps.length}
                    </span>
                    <button onClick={onComplete} className="text-gray-400 hover:text-black">
                        <FaTimes />
                    </button>
                </div>
                
                <h3 className="text-xl font-bold mb-2">{step.title}</h3>
                <p className="text-gray-600 mb-6 leading-relaxed text-sm">
                    {step.content}
                </p>

                <div className="flex justify-end gap-3">
                   {!isLast && (
                       <button onClick={onComplete} className="text-sm font-semibold text-gray-500 hover:text-black px-4 py-2">
                           Skip
                       </button>
                   )}
                   <button 
                        onClick={handleNext}
                        className="bg-black text-white px-6 py-2 rounded-lg font-bold hover:bg-gray-800 flex items-center gap-2"
                   >
                        {isLast ? "Finish Tour" : "Next"} <FaArrowRight className="text-xs" />
                   </button>
                </div>
                
                {/* CSS Arrow */}
                <div className="absolute -top-2 left-8 w-4 h-4 bg-white transform rotate-45" />
            </div>
        </div>
    );
}
