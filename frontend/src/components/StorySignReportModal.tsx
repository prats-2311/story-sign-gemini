
import { motion, AnimatePresence } from 'framer-motion';
import { X, Calendar, Activity, Brain, Share2 } from 'lucide-react';
import { 
    LineChart, Line, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, CartesianGrid 
} from 'recharts';

interface StorySignReportModalProps {
    report: any; // SessionLog or raw history item
    onClose: () => void;
}

export function StorySignReportModal({ report, onClose }: StorySignReportModalProps) {
    if (!report) return null;

    // Extract Data safely
    const summary = report.report_summary || {};
    const chartData = summary.chart_config?.data || [];
    const markdownContent = summary.report_markdown || "No detailed report available.";
    const thoughts = summary.thoughts || "";
    const dateStr = new Date(report.timestamp).toLocaleDateString(undefined, { 
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
    });
    const timeStr = new Date(report.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 md:p-8">
                {/* Backdrop */}
                <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={onClose}
                    className="absolute inset-0 bg-black/80 backdrop-blur-sm"
                />

                {/* Modal Content */}
                <motion.div 
                    initial={{ scale: 0.9, opacity: 0, y: 20 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.9, opacity: 0, y: 20 }}
                    className="relative bg-gray-900 border border-white/10 w-full max-w-4xl max-h-[90vh] rounded-2xl overflow-hidden shadow-2xl flex flex-col"
                >
                    {/* Header */}
                    <div className="flex justify-between items-start p-6 border-b border-white/10 bg-black/20">
                        <div>
                            <div className="flex items-center gap-3 mb-1">
                                <span className={`px-2 py-1 rounded text-xs font-bold uppercase tracking-wider ${report.domain === 'FACE' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-blue-500/20 text-blue-400'}`}>
                                    {report.domain}
                                </span>
                                <h2 className="text-2xl font-bold text-white tracking-tight">{report.title || "Session Report"}</h2>
                            </div>
                            <div className="flex items-center gap-4 text-sm text-gray-400">
                                <span className="flex items-center gap-1"><Calendar size={14} /> {dateStr} at {timeStr}</span>
                                <span className="flex items-center gap-1 ml-2"><Activity size={14} /> Status: {report.status}</span>
                            </div>
                        </div>
                        <div className="flex gap-2">
                             <button className="p-2 hover:bg-white/10 rounded-full transition-colors text-white/60 hover:text-white">
                                <Share2 size={20} />
                            </button>
                            <button onClick={onClose} className="p-2 hover:bg-red-500/20 rounded-full transition-colors text-white/60 hover:text-red-400">
                                <X size={24} />
                            </button>
                        </div>
                    </div>

                    {/* Scrollable Body */}
                    <div className="flex-1 overflow-y-auto p-6 space-y-8">
                        
                        {/* 1. AI Thoughts / Summary */}
                        <section className="bg-purple-900/10 border border-purple-500/20 rounded-xl p-6 relative overflow-hidden">
                             <div className="absolute top-0 right-0 p-4 opacity-10"><Brain size={100} /></div>
                             <h3 className="text-purple-400 font-bold mb-2 flex items-center gap-2">
                                <Brain size={18} /> AI Analysis
                             </h3>
                             <p className="text-gray-300 leading-relaxed italic">"{thoughts}"</p>
                        </section>

                        {/* 2. Performance Chart */}
                        {chartData.length > 0 && (
                            <section>
                                <h3 className="text-white font-bold mb-4 flex items-center gap-2">
                                    <Activity size={18} className="text-blue-400" />
                                    Performance Metrics
                                </h3>
                                <div className="h-64 w-full bg-black/20 rounded-xl border border-white/5 p-4">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <LineChart data={chartData}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                                            <XAxis dataKey="x" stroke="#666" fontSize={12} tickFormatter={(val) => `${val}s`} />
                                            <YAxis stroke="#666" fontSize={12} domain={[0, 100]} />
                                            <RechartsTooltip 
                                                contentStyle={{ backgroundColor: '#111', borderColor: '#333' }}
                                                itemStyle={{ color: '#fff' }}
                                            />
                                            <Line 
                                                type="monotone" 
                                                dataKey="y" 
                                                stroke="#8b5cf6" 
                                                strokeWidth={3} 
                                                dot={false} 
                                                activeDot={{ r: 6 }} 
                                            />
                                        </LineChart>
                                    </ResponsiveContainer>
                                </div>
                            </section>
                        )}

                        {/* 3. Detailed Markdown Report */}
                        <section>
                            <h3 className="text-white font-bold mb-4 border-b border-white/10 pb-2">Full Clinical Report</h3>
                            <div className="prose prose-invert max-w-none text-gray-300">
                                {/* Simple Markdown Rendering (whitespace-pre-wrap handles newlines) */}
                                <div className="whitespace-pre-wrap font-mono text-sm leading-relaxed">
                                    {markdownContent}
                                </div>
                            </div>
                        </section>

                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
