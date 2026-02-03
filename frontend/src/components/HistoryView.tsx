import { useEffect, useState } from 'react';
import { AnalyticsChart } from './AnalyticsChart';

interface SessionRecord {
    id: number;
    timestamp: string;
    transcript: string;
    clinical_notes: string[];
    report_json: any; 
}

interface HistoryViewProps {
    onBack: () => void;
}

export function HistoryView({ onBack }: HistoryViewProps) {
    const [sessions, setSessions] = useState<SessionRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedSession, setSelectedSession] = useState<SessionRecord | null>(null);

    useEffect(() => {
        fetch('http://localhost:8000/history')
            .then(res => res.json())
            .then(data => {
                setSessions(data);
                setLoading(false);
            })
            .catch(err => {
                console.error("Failed to load history", err);
                setLoading(false);
            });
    }, []);

    return (
        <div className="w-full max-w-6xl mx-auto p-8 pt-20">
             <div className="mb-8 flex items-center gap-4">
                <button 
                    onClick={onBack}
                    className="px-4 py-2 bg-neural-800 hover:bg-neural-700 text-white rounded-lg border border-neural-600 transition-colors"
                >
                    ← Back to Dashboard
                </button>
                <h1 className="text-3xl font-bold text-white tracking-tighter text-glow">
                    Patient History
                </h1>
            </div>

            {loading ? (
                <div className="text-white text-center animate-pulse">Loading Records...</div>
            ) : (
                <div className="grid gap-4">
                    {sessions.map(session => (
                        <div key={session.id} className="bg-neural-900 border border-neural-700 p-6 rounded-xl hover:border-cyber-cyan transition-colors">
                            <div className="flex justify-between mb-4">
                                <div>
                                    <div className="text-cyber-cyan font-mono text-sm">
                                        {new Date(session.timestamp).toLocaleString()}
                                    </div>
                                    <div className="text-gray-400 font-mono text-xs uppercase tracking-widest mt-1">
                                        SESSION #{session.id}
                                    </div>
                                </div>
                                <div>
                                    <button 
                                        onClick={() => setSelectedSession(session)}
                                        className="bg-cyber-cyan/10 hover:bg-cyber-cyan/20 text-cyber-cyan border border-cyber-cyan/50 px-4 py-2 rounded text-xs font-bold uppercase tracking-widest transition-all"
                                    >
                                        View Report
                                    </button>
                                </div>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <h3 className="text-gray-400 text-xs uppercase mb-2">Clinical Notes</h3>
                                    <ul className="text-sm text-gray-300 list-disc pl-4 space-y-1">
                                        {session.clinical_notes?.slice(0, 3).map((note, i) => (
                                            <li key={i}>{note}</li>
                                        ))}
                                    </ul>
                                </div>
                                <div>
                                    <h3 className="text-gray-400 text-xs uppercase mb-2">Metrics</h3>
                                    <div className="text-sm text-white">
                                        <span className="text-gray-500 italic">Analysis Archived</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                    
                    {sessions.length === 0 && (
                        <div className="text-gray-500 text-center py-12">
                            No sessions recorded yet. Complete a workout to see history.
                        </div>
                    )}
                </div>
            )}

            {/* REPORT MODAL */}
            {selectedSession && (
                <div className="fixed inset-0 bg-black/90 backdrop-blur-xl z-[100] flex items-center justify-center p-20 animate-in fade-in duration-300">
                    <div className="max-w-5xl w-full h-full bg-black border border-gray-800 rounded-3xl overflow-hidden flex flex-col shadow-[0_0_50px_rgba(6,182,212,0.1)]">
                        
                        <div className="p-8 border-b border-gray-800 flex justify-between items-center bg-gray-900/50">
                            <div>
                                <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                                     <span className="text-cyber-cyan">🧠</span> SESSION REPORT
                                </h2>
                                <div className="text-gray-500 text-xs font-mono mt-1">
                                    {new Date(selectedSession.timestamp).toLocaleString()}
                                </div>
                            </div>
                            <button onClick={() => setSelectedSession(null)} className="text-gray-400 hover:text-white">✕ CLOSE</button>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto p-8 space-y-8">
                            {/* CHART (If available in report_json) */}
                            {selectedSession.report_json?.chart_config && (
                                <div className="animate-slide-in">
                                    <AnalyticsChart config={selectedSession.report_json.chart_config} />
                                </div>
                            )}

                            {/* TEXT REPORT */}
                            <div className="prose prose-invert max-w-none">
                                 <div className="whitespace-pre-wrap font-mono text-sm text-gray-300 leading-relaxed border-l-2 border-cyber-cyan/30 pl-6">
                                     {selectedSession.report_json?.report_markdown || selectedSession.report_json?.report || "No report text content found."}
                                 </div>
                            </div>
                        </div>      
                    </div>
                </div>
            )}
        </div>
    );
}
