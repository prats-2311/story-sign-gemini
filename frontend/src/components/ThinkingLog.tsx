import React from 'react';

interface ThinkingLogProps {
    isThinking: boolean;
}

export const ThinkingLog: React.FC<ThinkingLogProps> = ({ isThinking }) => {
  if (!isThinking) return null;

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-neural-900/90 backdrop-blur-xl animate-fade-in">
       <div className="max-w-md w-full font-mono text-sm leading-6 p-6 border border-neural-700 rounded-xl bg-neural-800/50 shadow-2xl">
          <div className="flex items-center gap-2 mb-6 text-cyber-cyan border-b border-neural-700 pb-4">
             <span className="animate-spin text-xl">⚙️</span>
             <span className="font-bold tracking-widest">GEMINI 3 REASONING ENGINE</span>
          </div>
          
          <div className="space-y-3 text-gray-400">
             <p className="flex items-center gap-2">
                 <span className="text-cyber-cyan">✓</span> 
                 <span>Ingesting 250 biomechanical data points...</span>
             </p>
             <p className="flex items-center gap-2 animate-pulse delay-75">
                 <span className="text-cyber-cyan">✓</span>
                 <span>Constructing skeletal motion graph...</span>
             </p>
             <p className="flex items-center gap-2 animate-pulse delay-150">
                 <span className="text-cyber-amber">!</span>
                 <span className="text-cyber-amber">Variance detected in reps 15-20...</span>
             </p>
             <p className="flex items-center gap-2 animate-pulse delay-300">
                 <span className="text-white">➤</span>
                 <span>Synthesizing clinical prescription...</span>
             </p>
          </div>
       </div>
    </div>
  );
};
