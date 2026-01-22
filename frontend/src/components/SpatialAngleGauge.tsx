import React from 'react';

interface SpatialGaugeProps {
  angle: number;
  x: number; // Normalized X (0-1) from MediaPipe
  y: number; // Normalized Y (0-1)
  isCorrect: boolean; // Triggers the Cyan Shockwave
}

export const SpatialAngleGauge: React.FC<SpatialGaugeProps> = ({ angle, x, y, isCorrect }) => {
  // Convert normalized coords to simple style calc
  // We offset it slightly to the right of the elbow (translate x)
  const style: React.CSSProperties = {
    left: `${x * 100}%`,
    top: `${y * 100}%`,
    transform: 'translate(40px, -50%)', 
    position: 'absolute',
    pointerEvents: 'none',
    transition: 'all 0.1s linear' // Fast update for position
  };

  // SVG Calculation
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  // We want a full circle gauge or partial? Design said "Radial Arc".
  // Let's do a 360 ring for the "Clinical" look, but fill it based on current angle/180
  const normalizedFill = Math.min(angle, 180) / 180;
  const strokeDashoffset = circumference - (normalizedFill * circumference);

  return (
    <div style={style}>
      <div className={`relative flex items-center justify-center w-20 h-20 rounded-full bg-neural-900/80 backdrop-blur-md border border-neural-700 ${isCorrect ? 'animate-shockwave border-cyber-cyan ring-4 ring-cyber-cyan ring-opacity-50' : ''}`}>
        
        {/* SVG Ring */}
        <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
           {/* Track */}
           <circle cx="50" cy="50" r="40" stroke="#2A2F3D" strokeWidth="6" fill="none" />
           {/* Active Value */}
           <circle cx="50" cy="50" r="40" 
                   stroke={isCorrect ? '#00F2FF' : '#FFB800'} 
                   strokeWidth="6" 
                   fill="none"
                   strokeDasharray={circumference} 
                   strokeDashoffset={strokeDashoffset}
                   strokeLinecap="round"
                   className="transition-all duration-300 ease-out" />
        </svg>

        {/* Digital Number */}
        <div className="absolute flex flex-col items-center">
            <span className="text-xl font-bold text-white font-mono leading-none">
                {Math.round(angle)}°
            </span>
        </div>
      </div>
    </div>
  );
};
