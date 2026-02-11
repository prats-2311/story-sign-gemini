import { useEffect, useState } from 'react';
import { AnalyticsChart } from './AnalyticsChart';
import { apiClient } from '../api/client';
import type { SessionLog } from '../types/SessionLog';
import { PortalModal } from './PortalModal';

interface HistoryViewProps {
    onBack: () => void;
    initialDomain?: string; // [NEW] Optional prop to lock domain (e.g. 'FACE')
}

export function HistoryView({ onBack, initialDomain }: HistoryViewProps) {
    const [sessions, setSessions] = useState<SessionLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedSession, setSelectedSession] = useState<SessionLog | null>(null);
    const [selectedReport, setSelectedReport] = useState<any | null>(null); // [RESTORED]
    
    // [NEW] Search & Filter State
    const [searchTerm, setSearchTerm] = useState("");
    const [domainFilter, setDomainFilter] = useState(initialDomain || "ALL");
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");

    useEffect(() => {
        setLoading(true);
        // [FIX] Use aggregated history endpoint with filters
        const query = new URLSearchParams();
        if (searchTerm) query.append("search", searchTerm);
        
        // If initialDomain is set, force it. Otherwise use filter state.
        const activeDomain = initialDomain || domainFilter;
        if (activeDomain !== "ALL") query.append("domain", activeDomain);

        if (startDate) query.append("start_date", startDate);
        if (endDate) query.append("end_date", endDate);

        apiClient(`/session/history?${query.toString()}`)
            .then(data => {
                setSessions(data as SessionLog[]);
                setLoading(false);
            })
            .catch(err => {
                console.error("Failed to load history", err);
                setLoading(false);
            });
    }, [searchTerm, domainFilter, startDate, endDate, initialDomain]); // Re-fetch on change

    return (
        <div className="w-full max-w-6xl mx-auto p-4 pt-24 md:p-8 md:pt-20">
             <div className="mb-8 flex items-center gap-4">
                <button 
                    onClick={onBack}
                    className="px-4 py-2 bg-neural-800 hover:bg-neural-700 text-white rounded-lg border border-neural-600 transition-colors"
                >
                    ← Back to Dashboard
                </button>
                <h1 className="text-3xl font-bold text-white tracking-tighter text-glow">
                    {initialDomain === 'FACE' ? 'Harmony History' : 'Patient History'}
                </h1>
            </div>

            {/* [NEW] Search & Filter Controls */}
            <div className="mb-6 flex flex-col md:flex-row gap-4">
                <input 
                    type="text" 
                    placeholder="Search by exercise or notes..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="flex-1 bg-neural-900 border border-neural-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-cyber-cyan transition-colors"
                />
                
                {/* Date Filters */}
                <div className="flex gap-2">
                    <input 
                        type="date" 
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="bg-neural-900 border border-neural-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-cyber-cyan transition-colors"
                    />
                    <input 
                        type="date" 
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="bg-neural-900 border border-neural-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-cyber-cyan transition-colors"
                    />
                </div>

                {/* Domain Filter (Only show if NOT fixed) */}
                {!initialDomain && (
                    <select 
                        value={domainFilter}
                        onChange={(e) => setDomainFilter(e.target.value)}
                        className="bg-neural-900 border border-neural-700 rounded-lg px-6 py-3 text-white focus:outline-none focus:border-cyber-cyan transition-colors appearance-none"
                    >
                        <option value="ALL">All Categories</option>
                        <option value="BODY">Reconnect (Body)</option>
                        <option value="FACE">Harmony (Face)</option>
                        <option value="HAND">Hands</option>
                    </select>
                )}
            </div>

            {loading ? (
                <div className="text-white text-center animate-pulse">Loading Records...</div>
            ) : (
                <div className="grid gap-4">
                    {sessions.map(session => (
                        <div key={session.id} className="bg-neural-900 border border-neural-700 p-6 rounded-xl hover:border-cyber-cyan transition-colors">
                            <div className="flex justify-between mb-4">
                                <div>
                                    <h3 className="text-xl font-bold text-cyber-cyan">{session.title}</h3>
                                    <div className="text-cyber-cyan/50 font-mono text-xs mt-1">
                                        {new Date(session.timestamp).toLocaleString()}
                                    </div>
                                    <div className="text-gray-500 font-mono text-[10px] uppercase tracking-widest mt-1 truncate max-w-xs">
                                        ID: {session.id}
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
                                        {session.report_summary?.clinical_notes?.slice(0, 3).map((note: string, i: number) => (
                                            <li key={i}>{note}</li>
                                        )) || (
                                            <li className="text-gray-600 italic">No notes recorded.</li>
                                        )}
                                    </ul>
                                </div>
                                <div>
                                    <h3 className="text-gray-400 text-xs uppercase mb-2">Metrics</h3>
                                    <div className="text-sm text-white">
                                        <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${session.status === 'completed' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                                            {session.status}
                                        </span>
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
            <PortalModal
                isOpen={!!selectedReport}
                onClose={() => setSelectedReport(null)}
                className="max-w-5xl h-[90vh]"
            >
                {selectedReport && selectedSession && ( 
                    <div className="w-full h-full bg-black border border-gray-800 rounded-3xl overflow-hidden flex flex-col shadow-[0_0_50px_rgba(6,182,212,0.1)]">
                        <div className="p-8 border-b border-gray-800 flex justify-between items-center bg-gray-900/50">
                            <div>
                                <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                                     <span className="text-cyber-cyan">🧠</span> SESSION REPORT
                                </h2>
                                <div className="text-gray-500 text-xs font-mono mt-1">
                                    {new Date(selectedSession.timestamp).toLocaleString()}
                                </div>
                            </div>
                            <button onClick={() => setSelectedReport(null)} className="text-gray-400 hover:text-white">✕ CLOSE</button>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto p-8 space-y-8">
                            {/* CHART (If available in report_summary) */}
                            {selectedSession.report_summary?.chart_config && (
                                <div className="animate-slide-in w-full h-[300px]">
                                    <AnalyticsChart config={selectedSession.report_summary.chart_config} />
                                </div>
                            )}

                            {/* TEXT REPORT */}
                            <div className="prose prose-invert max-w-none">
                                 <div className="whitespace-pre-wrap font-mono text-sm text-gray-300 leading-relaxed border-l-2 border-cyber-cyan/30 pl-6">
                                     {selectedSession.report_summary?.report_markdown || selectedSession.report_summary?.report || "No report text content found."}
                                 </div>
                            </div>
                        </div>      
                    </div>
                )}
            </PortalModal>
        </div>
    );
}
