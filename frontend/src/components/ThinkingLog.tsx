import React from 'react';

interface ThinkingLogProps {
    isThinking: boolean;
    thoughts: string | null;
}

export const ThinkingLog: React.FC<ThinkingLogProps> = ({ isThinking, thoughts }) => {
  if (!isThinking && !thoughts) return null;

  // Split raw thoughts into lines for display
  const thoughtLines = thoughts 
    ? thoughts.split('\n').filter(line => line.trim().length > 0)
    : [
        "Ingesting 250 biomechanical data points...",
        "Constructing skeletal motion graph...",
        "Detecting variance in repetition cycles...",
        "Synthesizing clinical prescription..."
    ];

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-neural-900/90 backdrop-blur-xl animate-fade-in">
       <div className="max-w-2xl w-full font-mono text-sm leading-6 p-6 border border-neural-700 rounded-xl bg-neural-800/50 shadow-2xl overflow-hidden flex flex-col max-h-[70vh]">
          <div className="flex items-center gap-2 mb-4 text-cyber-cyan border-b border-neural-700 pb-4 shrink-0">
             <span className="animate-spin text-xl">⚙️</span>
             <span className="font-bold tracking-widest">GEMINI 3 REASONING ENGINE</span>
          </div>
          
          <div className="space-y-3 text-gray-400 overflow-y-auto pr-2 custom-scrollbar">
             {thoughtLines.map((line, idx) => (
                 <p key={idx} className="flex items-start gap-2 animate-slide-up" style={{ animationDelay: `${idx * 100}ms` }}>
                     <span className="text-cyber-cyan mt-1">➤</span> 
                     <span className={line.includes("Error") ? "text-red-400" : "text-gray-300"}>
                        {line}
                     </span>
                 </p>
             ))}
             
             {isThinking && !thoughts && (
                 <p className="flex items-center gap-2 animate-pulse text-cyber-cyan mt-4">
                     Analyzing...
                 </p>
             )}
          </div>
       </div>
    </div>
  );
};
