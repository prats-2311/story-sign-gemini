import type { ExerciseConfig } from '../types/Exercise';

interface ExerciseCardProps {
    id?: string;
    config: ExerciseConfig;
    isLocked?: boolean;
    statusQuery?: { setsDone: number, setsTotal: number, stability?: number };
    onStart: (config: ExerciseConfig) => void;
    onDelete?: (id: string) => void;
}

export function ExerciseCard({ id, config, isLocked = false, statusQuery, onStart, onDelete }: ExerciseCardProps) {
    return (
        <div 
            id={id}
            className={`
            relative p-6 rounded-2xl border transition-all duration-300
            ${isLocked 
                ? 'border-gray-800 bg-gray-900/50 opacity-60 cursor-not-allowed' 
                : 'border-cyber-cyan/30 bg-gray-900/80 hover:border-cyber-cyan hover:shadow-[0_0_20px_rgba(0,255,255,0.2)] cursor-pointer group'}
        `}
        onClick={() => !isLocked && onStart(config)}
        >
            <div className="flex justify-between items-start mb-4">
                <div className={`
                    p-3 rounded-lg 
                    ${isLocked ? 'bg-gray-800' : 'bg-cyber-cyan/10 text-cyber-cyan'}
                `}>
                    {/* Placeholder Icon */}
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                </div>
                
                <div className="flex gap-2">
                    {onDelete && !isLocked && (
                        <button 
                            onClick={(e) => {
                                e.stopPropagation();
                                if (window.confirm("Delete this exercise?")) {
                                    onDelete(config.id);
                                }
                            }}
                            className="p-2 text-gray-500 hover:text-red-500 transition-colors z-10"
                            title="Delete Exercise"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                        </button>
                    )}
                    
                    {isLocked && (
                        <span className="text-gray-500 text-xs font-mono uppercase tracking-widest border border-gray-700 px-2 py-1 rounded">Locked</span>
                    )}
                </div>
            </div>

            <h3 className="text-xl font-bold text-white mb-2 font-mono">{config.name}</h3>
            <p className="text-gray-400 text-sm mb-6">{config.description}</p>

            {/* Stats / Progress */}
            {!isLocked && statusQuery && (
                <div className="flex gap-4 border-t border-gray-800 pt-4">
                    <div>
                        <div className="text-xs text-gray-500 font-mono">SETS</div>
                        <div className="text-white font-bold">{statusQuery.setsDone}/{statusQuery.setsTotal}</div>
                    </div>
                    {statusQuery.stability !== undefined && (
                         <div>
                            <div className="text-xs text-gray-500 font-mono">STABILITY</div>
                            <div className="text-cyber-green font-bold">{statusQuery.stability.toFixed(2)}</div>
                        </div>
                    )}
                </div>
            )}
            
            {/* Hover Action (Mobile: Always Visible / Desktop: Hover) */}
            {!isLocked && (
                <div className="absolute bottom-6 right-6 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                    <button className="bg-cyber-cyan text-black font-bold px-4 py-2 rounded-lg text-sm tracking-wide shadow-lg shadow-cyber-cyan/20">
                        START SESSION →
                    </button>
                </div>
            )}
        </div>
    );
}
