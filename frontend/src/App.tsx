import { useState, useRef } from 'react';
import { useGeminiLive } from './hooks/useGeminiLive';
import { usePoseDetection } from './hooks/usePoseDetection'; 
import { ThinkingLog } from './components/ThinkingLog';
import { HistoryGraph } from './components/HistoryGraph'; 
import { Dashboard } from './components/Dashboard'; 
import type { ExerciseConfig } from './types/Exercise';
import { AnalyticsChart } from './components/AnalyticsChart';
import './App.css';

function App() {
  // --- NAVIGATION STATE ---
  const [view, setView] = useState<'dashboard' | 'session'>('dashboard');
  const [currentConfig, setCurrentConfig] = useState<ExerciseConfig | null>(null);

  const handleStartSession = (config: ExerciseConfig) => {
      setCurrentConfig(config);
      setView('session');
  };

  const handleExitSession = () => {
      setView('dashboard');
      setCurrentConfig(null);
  };

  return (
    <div className="bg-black min-h-screen font-sans selection:bg-cyber-cyan selection:text-black">
      
      {/* VIEW: DASHBOARD */}
      {view === 'dashboard' && (
          <Dashboard onSelectExercise={handleStartSession} />
      )}

      {/* VIEW: SESSION (Only mounts when active, forcing fresh hooks) */}
      {view === 'session' && currentConfig && (
          <SessionRunner config={currentConfig} onExit={handleExitSession} />
      )}

    </div>
  );
}

// --- SUB-COMPONENT: SESSION RUNNER ---
// This contains the logic that used to be in the main App. 
// By isolating it, we guarantee a "Clean Slate" every time we enter.
function SessionRunner({ config, onExit }: { config: ExerciseConfig, onExit: () => void }) {
  const { isModelLoaded, detectPose } = usePoseDetection();
  
  // Video Ref
  const videoRef = useRef<HTMLVideoElement>(null);

  // Hook Init (FRESH INSTANCE)
  const { isConnected, messages, connect, disconnect, startAudioStream, stopAudioStream, startVideoStream, stopVideoStream, getSessionStats, feedbackStatus, isCalibrating, clinicalNotes } = useGeminiLive({ 
      mode: 'RECONNECT', 
      detectPose,
      videoRef,
      exerciseConfig: config, 
      onLandmarks: (_landmarks) => {
          // Unused for now
      }
  });

  // Report State
  const [report, setReport] = useState<string | null>(null);
  const [thoughts, setThoughts] = useState<string | null>(null);
  const [chartConfig, setChartConfig] = useState<any>(null); // [STRATEGY C]
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);

  // Handlers
  const handleStart = async () => {
    connect();
    // Wait for connection... ideally handled by useEffect or promise, but simple timeout works for demo
    setTimeout(async () => {
        await startAudioStream();
        await startVideoStream();
    }, 1000);
  };

  const handleStop = () => {
      stopAudioStream();
      stopVideoStream();
      disconnect();
  };

   const handleGenerateReport = async () => {
      console.log("Generating Report...");
      setIsGeneratingReport(true);
      try {
           const stats = getSessionStats();
           
           // Inject logic based on Exercise Type?
           // For now, using the generalized backend endpoint
           const poseSummary = JSON.stringify({
               exercise: config.name,
               reps: stats.repCount,
               average_rom: ((stats.minRightElbowAngle + stats.maxRightElbowAngle) / 2).toFixed(1),
               stability_metric: (stats.shoulderYSum / (stats.frameCount || 1)).toFixed(3),
               recent_angles: stats.angleHistory.slice(-20) 
           });

           // [STRATEGY C] Downsampling Logic
           // We want max ~100 points to keep context light.
           const rawTelemetry = stats.telemetry || [];
           const sampleRate = Math.ceil(Math.max(1, rawTelemetry.length / 100));
           const sampledTelemetry = rawTelemetry.filter((_, i) => i % sampleRate === 0);
           
           console.log(`[Strategy C] Telemetry: Raw ${rawTelemetry.length} -> Sampled ${sampledTelemetry.length}`);

           const payload = {
            session_id: "demo_session_1",
            duration_seconds: 45, 
            transcript: messages.join("\n"),
            clinical_notes: clinicalNotes, // Strategy A Input
            pose_summary: poseSummary,
            telemetry: sampledTelemetry,   // [STRATEGY C] Input
            include_thoughts: true
           };

           console.log("[App] Generating Report payload:", payload);
           const response = await fetch('http://localhost:8000/analyze_session', {
               method: 'POST',
               headers: {'Content-Type': 'application/json'},
               body: JSON.stringify(payload)
           });
           
           const data = await response.json();
           setReport(data.report_markdown || data.report); // Handle both formats
           if (data.thoughts) setThoughts(data.thoughts);
           if (data.chart_config) setChartConfig(data.chart_config); // [STRATEGY C]

      } catch (e) {
          console.error("Report Error", e);
          setReport("Error generating report. Check backend console.");
      } finally {
          setIsGeneratingReport(false);
      }
  };

  // Extract Rep Count for UI
  const repCount = getSessionStats().repCount || 0;

  return (
      <div className="relative h-screen flex flex-col overflow-hidden">
          
          {/* HEADER HUD */}
          <header className="fixed top-0 left-0 right-0 z-50 p-6 flex justify-between items-start pointer-events-none">
              <div>
                  <h1 className="text-4xl font-bold italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-cyber-cyan to-blue-600 drop-shadow-[0_0_10px_rgba(6,182,212,0.5)]">
                      RECONNECT
                  </h1>
                  <div className="flex items-center gap-2 mt-1">
                      <div className={`w-2 h-2 rounded-full ${isModelLoaded ? 'bg-green-500 shadow-[0_0_8px_#22c55e]' : 'bg-yellow-500 animate-pulse'}`}></div>
                      <span className="text-[10px] font-mono text-gray-400 uppercase tracking-widest">
                          {config.name.toUpperCase()}
                      </span>
                  </div>
              </div>
              
              <div className="pointer-events-auto flex items-center gap-4">
                  <button onClick={() => { handleStop(); onExit(); }} className="text-gray-400 hover:text-white flex items-center gap-2 font-mono text-xs border border-gray-800 px-4 py-2 rounded bg-black/50">
                     ← DASHBOARD
                  </button>

                  {!isConnected ? (
                      <button 
                        onClick={handleStart}
                        disabled={!isModelLoaded}
                        className="bg-cyber-cyan text-black font-bold text-sm px-6 py-3 rounded clip-path-polygon hover:bg-white transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(6,182,212,0.3)]"
                      >
                          INITIALIZE LINK
                      </button>
                  ) : (
                      <button 
                        onClick={handleStop}
                        className="bg-red-500/10 border border-red-500 text-red-500 font-bold text-sm px-6 py-3 rounded hover:bg-red-500 hover:text-white transition-all backdrop-blur-md"
                      >
                          TERMINATE LINK
                      </button>
                  )}
              </div>
          </header>

          {/* CALIBRATION OVERLAY */}
          {isCalibrating && (
              <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-fade-in">
                  <div className="text-center space-y-4">
                      <div className="text-6xl animate-pulse text-cyber-cyan">⌖</div>
                      <h2 className="text-3xl font-bold text-white tracking-[0.2em] animate-pulse">CALIBRATING</h2>
                      <p className="text-gray-400 font-mono text-xs uppercase tracking-widest max-w-sm mx-auto border-t border-gray-800 pt-4">
                          Stand still in neutral position...
                      </p>
                  </div>
              </div>
          )}

          {/* MAIN VIEWPORT */}
          <main className="relative h-full w-full flex items-center justify-center bg-gray-900">
               
               {/* VIDEO LAYER */}
               <div className="relative w-full h-full">
                   <video 
                      ref={videoRef} 
                      className="w-full h-full object-cover opacity-60" 
                      autoPlay 
                      playsInline 
                      muted
                   />
                   {/* Vignette Overlay */}
                   <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,black_100%)] pointer-events-none"></div>
                   
                   {/* FEEDBACK BORDERS */}
                   {feedbackStatus === 'critical' && (
                       <div className="absolute inset-0 border-[20px] border-red-600 animate-pulse mix-blend-overlay pointer-events-none"></div>
                   )}
                   {feedbackStatus === 'warning' && (
                       <div className="absolute inset-0 border-[10px] border-yellow-500/50 mix-blend-overlay pointer-events-none"></div>
                   )}
                   {feedbackStatus === 'success' && (
                       <div className="absolute inset-0 border-[10px] border-green-500/50 mix-blend-overlay pointer-events-none"></div>
                   )}
               </div>


               {/* LIVE CLINICAL FEED (Right Side) */}
               <div className="absolute top-32 right-10 w-80 pointer-events-auto flex flex-col gap-4">
                   <div className="bg-black/40 backdrop-blur-md rounded-xl border border-white/10 p-4 shadow-xl">
                       <h3 className="text-xs text-cyber-cyan font-bold mb-3 uppercase tracking-widest flex items-center gap-2">
                           <span className="w-2 h-2 bg-cyber-cyan rounded-full animate-pulse"/>
                           Live Observations
                       </h3>
                       <div className="space-y-3 max-h-96 overflow-y-auto mask-fade-bottom">
                           {clinicalNotes.length === 0 ? (
                               <div className="text-gray-600 text-xs italic animate-pulse">Monitoring session...</div>
                           ) : (
                               clinicalNotes.map((note, i) => (
                                   <div key={i} className="bg-gray-900/80 border-l-2 border-cyber-cyan p-3 rounded-r text-xs text-gray-300 animate-slide-in">
                                       {note}
                                   </div>
                               ))
                           )}
                           <div ref={(el) => el?.scrollIntoView({ behavior: "smooth" })} /> 
                       </div>
                   </div>
               </div>

               {/* SPATIAL UI LAYER */}
               <div className="absolute inset-0 pointer-events-none">
                    {/* 1. Velocity / Stability Gauge (Left) */}
                    <div className="absolute left-10 top-1/2 -translate-y-1/2 w-64 pointer-events-auto">
                        <div className="bg-black/50 backdrop-blur border border-gray-800 p-4 rounded-xl">
                            <h3 className="text-xs text-gray-500 font-bold mb-2 uppercase tracking-widest">ROM / Stability</h3>
                            <HistoryGraph data={[0]} color="#06b6d4" label="ROM" /> 
                            {/* NOTE: Stats need to be piped via context or hook to be real */}
                        </div>
                    </div>

                    {/* 2. Rep Counter (Right) */}
                    <div className="absolute right-10 top-1/2 -translate-y-1/2 text-right">
                        <div className="text-[120px] font-bold text-white leading-none tracking-tighter drop-shadow-2xl">
                            {repCount.toString().padStart(2, '0')}
                        </div>
                        <div className="text-cyber-cyan font-mono text-xl tracking-[0.5em] mr-2">REPS</div>
                    </div>
               </div>

               {/* CHAT/LOG OVERLAY (Bottom Left) */}
               <div className="absolute bottom-10 left-10 w-96 h-64 pointer-events-auto flex flex-col gap-4">
                   <div className="flex-1 overflow-y-auto font-mono text-xs text-cyber-cyan space-y-1 p-4 bg-black/50 backdrop-blur-md rounded-xl border border-white/10 shadow-2xl mask-fade-bottom">
                       {messages.map((m, i) => (
                           <div key={i} className="opacity-80 hover:opacity-100 transition-opacity">
                               <span className="text-gray-500">[{new Date().toLocaleTimeString()}]</span> {m}
                           </div>
                       ))}
                   </div>
                   
                   {/* REPORT BUTTON */}
                   <button 
                     onClick={handleGenerateReport}
                     disabled={!isConnected && messages.length === 0}
                     className="w-full bg-gray-900 border border-gray-700 hover:border-cyber-cyan text-gray-400 hover:text-white py-3 rounded-lg text-xs font-bold tracking-widest transition-all "
                   >
                     {isGeneratingReport ? 'ANALYZING BIOMETRICS...' : 'GENERATE REPORT_V2.0'}
                   </button>
               </div>
          </main>

          {/* REPORT MODAL */}
          {report && (
            <div className="fixed inset-0 bg-black/90 backdrop-blur-xl z-[100] flex items-center justify-center p-20 animate-in fade-in duration-300">
                <div className="max-w-5xl w-full h-full bg-black border border-gray-800 rounded-3xl overflow-hidden flex flex-col shadow-[0_0_50px_rgba(6,182,212,0.1)]">
                    
                    <div className="p-8 border-b border-gray-800 flex justify-between items-center bg-gray-900/50">
                        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                             <span className="text-cyber-cyan">🧠</span> GEMINI 3 ANALYSIS
                        </h2>
                    <button onClick={() => { setReport(null); setThoughts(null); setChartConfig(null); }} className="text-gray-400 hover:text-white">✕ CLOSE</button>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto p-8 space-y-8">
                        {/* CHART SECTION (Strategy C) */}
                        {chartConfig && (
                            <div className="animate-slide-in">
                                <AnalyticsChart config={chartConfig} />
                            </div>
                        )}

                        {/* TEXT REPORT */}
                        <div className="prose prose-invert max-w-none">
                             <div className="whitespace-pre-wrap font-mono text-sm text-gray-300 leading-relaxed border-l-2 border-cyber-cyan/30 pl-6">
                                 {report}
                             </div>
                        </div>
                    </div>      {/* Hidden Thoughts Layer - Only show if actively thinking or user toggled? 
                             Actually, if report is present, we shouldn't block it. 
                             Let's only show ThinkingLog if we are waiting, OR if we want to debug.
                             For now, let's remove the BLOCKING overlay once report is here, 
                             but maybe render it inline? 
                             
                             FIX: Only render if we don't have a report yet, OR if we explicitly want to see thoughts.
                             Since 'thoughts' come WITH 'report', this was always blocking.
                          */}
                         {isGeneratingReport && (
                             <ThinkingLog thoughts={thoughts} isThinking={true} />
                         )}
                    </div>
                </div>

          )}

      </div>
  );
}

export default App;
