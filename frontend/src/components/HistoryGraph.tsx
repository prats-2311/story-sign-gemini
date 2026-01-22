import React from 'react';

interface HistoryGraphProps {
  data: number[]; // Array of last N stats (e.g. Max ROM)
  label: string;
  color?: string;
  height?: number;
}

export const HistoryGraph: React.FC<HistoryGraphProps> = ({ 
  data, 
  label, 
  color = "#00F2FF", 
  height = 80 
}) => {
  if (!data || data.length < 2) {
    return (
      <div className="flex items-center justify-center bg-neural-800 rounded-xl border border-neural-700" style={{ height }}>
        <span className="text-xs text-gray-500 font-mono">NOT ENOUGH DATA</span>
      </div>
    );
  }

  // Normalization
  const max = Math.max(...data, 100); // Expect at least 100deg context
  const min = Math.min(...data);
  const range = max - min || 1;
  const width = 100; // viewBox width

  const points = data.map((val, idx) => {
    const x = (idx / (data.length - 1)) * width;
    const y = height - ((val - min) / range) * (height * 0.6) - (height * 0.2); // Padding
    return `${x},${y}`;
  }).join(' ');

  return (
    <div className="bg-neural-800 p-4 rounded-xl border border-neural-700 flex flex-col gap-2">
      <div className="flex justify-between items-end">
        <span className="text-xs text-gray-400 font-mono uppercase tracking-widest">{label}</span>
        <span className="text-xl font-bold text-white" style={{ color }}>{data[data.length - 1]}°</span>
      </div>
      
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full overflow-visible">
        {/* Gradient Definition */}
        <defs>
          <linearGradient id={`grad-${label}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.3" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Fill Area */}
        <path 
          d={`M 0,${height} L ${points.split(' ')[0]} ${points} L 100,${height} Z`} 
          fill={`url(#grad-${label})`} 
        />

        {/* Line Path */}
        <polyline 
          points={points} 
          fill="none" 
          stroke={color} 
          strokeWidth="2" 
          vectorEffect="non-scaling-stroke"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Dots */}
        {data.map((val, idx) => {
            const x = (idx / (data.length - 1)) * width;
            const y = height - ((val - min) / range) * (height * 0.6) - (height * 0.2);
            return (
                <circle cx={x} cy={y} r="1.5" fill="white" key={idx} />
            );
        })}
      </svg>
    </div>
  );
};
