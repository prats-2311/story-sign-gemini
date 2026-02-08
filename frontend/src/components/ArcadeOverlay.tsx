import { useEffect, useRef, useState } from 'react';

interface ArcadeOverlayProps {
    shoulderY: number; // Normalized 0-1 (0 is top, 1 is bottom)
    isPlaying: boolean;
}

export function ArcadeOverlay({ shoulderY, isPlaying }: ArcadeOverlayProps) {
    const [score, setScore] = useState(0);
    const [combo, setCombo] = useState(0);
    const [feedback, setFeedback] = useState<string | null>(null);

    // Game State Refs (for Loop)
    const gameState = useRef({
        bubbleY: 0.5, // Current visual position
        targetY: 0.5, // Where the shoulder is
        zoneY: 0.5,   // Center of the Green Zone
        zoneSpeed: 0.005, // How fast the zone moves
        zoneDirection: 1,
        scoreLocal: 0
    });

    const canvasRef = useRef<HTMLCanvasElement>(null);
    const requestRef = useRef<number | undefined>(undefined);

    // Game Loop
    useEffect(() => {
        if (!isPlaying) return;

        const animate = () => {
            const state = gameState.current;
            const ctx = canvasRef.current?.getContext('2d');
            const canvas = canvasRef.current;

            if (ctx && canvas) {
                // 1. Update Logic
                // Smooth Bubble Movement (Lerp)
                state.targetY = shoulderY;
                state.bubbleY += (state.targetY - state.bubbleY) * 0.1; // Smooth ease

                // Move Zone (Ping Pong)
                state.zoneY += state.zoneSpeed * state.zoneDirection;
                if (state.zoneY < 0.2 || state.zoneY > 0.8) {
                    state.zoneDirection *= -1;
                }

                // Check Scorable Logic
                const distance = Math.abs(state.bubbleY - state.zoneY);
                if (distance < 0.15) { // Hit Box
                    state.scoreLocal += 1;
                    if (state.scoreLocal % 60 === 0) { // Every ~1 second
                        setScore(s => s + 10 + (state.scoreLocal > 300 ? 50 : 0));
                        setCombo(c => c + 1);
                        setFeedback("PERFECT! 🔥");
                        setTimeout(() => setFeedback(null), 1000);
                    }
                } else {
                    setCombo(0); // Break Combo
                }

                // 2. Render
                ctx.clearRect(0, 0, canvas.width, canvas.height);

                // Draw Tube Background
                const centerX = canvas.width - 50;
                const tubeWidth = 60;
                ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
                ctx.fillRect(centerX - tubeWidth/2, 20, tubeWidth, canvas.height - 40);
                
                // Draw Green Zone
                const zoneHeight = canvas.height * 0.3; // 30% of screen
                const zonePixelY = state.zoneY * canvas.height;
                ctx.fillStyle = 'rgba(6, 182, 212, 0.3)'; // Cyber Cyan
                ctx.shadowBlur = 20;
                ctx.shadowColor = '#06b6d4';
                ctx.fillRect(centerX - tubeWidth/2, zonePixelY - zoneHeight/2, tubeWidth, zoneHeight);
                ctx.shadowBlur = 0; // Reset

                // Draw Threshold Lines
                ctx.strokeStyle = '#06b6d4';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(centerX - tubeWidth/2, zonePixelY - zoneHeight/2);
                ctx.lineTo(centerX + tubeWidth/2, zonePixelY - zoneHeight/2);
                ctx.moveTo(centerX - tubeWidth/2, zonePixelY + zoneHeight/2);
                ctx.lineTo(centerX + tubeWidth/2, zonePixelY + zoneHeight/2);
                ctx.stroke();

                // Draw Bubble (Player)
                const bubblePixelY = state.bubbleY * canvas.height;
                ctx.beginPath();
                ctx.arc(centerX, bubblePixelY, 20, 0, Math.PI * 2);
                ctx.fillStyle = distance < 0.15 ? '#22c55e' : '#ef4444'; // Green if in zone, else Red
                ctx.fill();
                ctx.strokeStyle = 'white';
                ctx.lineWidth = 3;
                ctx.stroke();

                // Draw Labels
                ctx.font = 'bold 12px monospace';
                ctx.fillStyle = 'white';
                ctx.textAlign = 'right';
                ctx.fillText('YOU ▶', centerX - 30, bubblePixelY + 5);
                
                ctx.textAlign = 'left';
                ctx.fillStyle = '#06b6d4';
                ctx.fillText('◀ TARGET', centerX + 40, zonePixelY + 5);
            }

            requestRef.current = requestAnimationFrame(animate);
        };

        requestRef.current = requestAnimationFrame(animate);
        return () => cancelAnimationFrame(requestRef.current!);
    }, [isPlaying, shoulderY]);


    if (!isPlaying) return null;

    return (
        <div className="absolute inset-0 pointer-events-none z-40">
            <canvas 
                ref={canvasRef} 
                width={window.innerWidth} 
                height={window.innerHeight} 
                className="absolute inset-0"
            />
            
            {/* HUD */}
            <div className="absolute top-32 right-32 text-right">
                <div className="text-6xl font-bold text-white drop-shadow-[0_0_10px_rgba(34,197,94,0.8)] font-mono">
                    {score}
                </div>
                <div className="text-xl text-cyber-cyan tracking-widest uppercase">SCORE</div>
                
                {combo > 5 && (
                     <div className="mt-2 text-4xl text-yellow-400 font-bold animate-bounce">
                        x{combo} COMBO
                    </div>
                )}
            </div>

            {/* Feedback Popups */}
            {feedback && (
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-4xl font-bold text-white bg-black/50 px-6 py-2 rounded-full backdrop-blur border border-white/20 animate-ping-once">
                    {feedback}
                </div>
            )}
        </div>
    );
}

// Add CSS for one-time ping animation if needed, or use tailwind 'animate-ping' class logic
