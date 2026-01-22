import { useState, useRef } from 'react';
import { useGeminiLive } from './hooks/useGeminiLive';
import { usePoseDetection } from './hooks/usePoseDetection'; 
import { SpatialAngleGauge } from './components/SpatialAngleGauge';
import { ThinkingLog } from './components/ThinkingLog';
import './App.css';

function App() {
  // --- STATE ---
  const { isModelLoaded, detectPose } = usePoseDetection();
  
  // Real-time Landmarks state for Spatial UI
  const [currentLandmarks, setCurrentLandmarks] = useState<any>(null);
  // Calculate angle for gauge
  const [currentAngle, setCurrentAngle] = useState(0);

  // [FIX] Video Ref for the Main Canvas
  const videoRef = useRef<HTMLVideoElement>(null);

  const { isConnected, messages, connect, disconnect, startAudioStream, stopAudioStream, startVideoStream, stopVideoStream, dataSentCount, getSessionStats } = useGeminiLive({ 
      mode: 'RECONNECT', 
      detectPose,
      videoRef, // [NEW] Pass the ref
      onLandmarks: (landmarks) => {
          setCurrentLandmarks(landmarks);
          // Calc angle for gauge
          if (landmarks[12] && landmarks[14] && landmarks[16]) {
             // Re-calc here for UI sync (or export calc function)
             // Simple version:
             const calculateAngle = (a: any, b: any, c: any) => {
                const radians = Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
                let angle = Math.abs(radians * 180.0 / Math.PI);
                if (angle > 180.0) angle = 360 - angle;
                return angle;
             };
             setCurrentAngle(calculateAngle(landmarks[12], landmarks[14], landmarks[16]));
          }
      }
  }); 

  // UI States
  const [report, setReport] = useState<string | null>(null);
  const [isAnalyzeLoading, setIsAnalyzeLoading] = useState(false);
  const [isMicActive, setIsMicActive] = useState(false);

  // --- HANDLERS ---
  const handleStartSession = async () => {
     await connect();
     setTimeout(async () => {
         await startAudioStream();
         setIsMicActive(true);
         await startVideoStream();
     }, 500);
  };

  const handleStopSession = () => {
      stopAudioStream();
      setIsMicActive(false);
      stopVideoStream();
      disconnect();
  };

  const handleAnalyzeSession = async () => {
    setIsAnalyzeLoading(true);
    try {
      const transcript = messages.join("\n");
      const stats = getSessionStats();

      const biomechanicsSummary = `
      Session Biometrics:
      - Range of Motion: ${Math.round(stats.minRightElbowAngle)}° to ${Math.round(stats.maxRightElbowAngle)}°.
      - Repetition Peaks: [${stats.angleHistory.slice(-10).join(", ")}].
      - Stability Score: ${(stats.shoulderYSum / stats.frameCount || 0).toFixed(4)}.
      `;

      const response = await fetch('/api/analyze_session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            transcript,
            pose_summary: biomechanicsSummary
        })
      });
      const data = await response.json();
      setReport(data.report);
    } catch (e) {
      console.error(e);
      setReport("Failed to generate report.");
    }
    setIsAnalyzeLoading(false);
  };

  return (
    <div className="min-h-screen bg-neural-900 text-white relative font-sans selection:bg-cyber-cyan selection:text-black">
      
      {/* 1. Header */}
      <header className="fixed top-0 left-0 right-0 z-40 bg-neural-900/80 backdrop-blur-md border-b border-neural-800 h-16 flex items-center justify-between px-6">
          <div className="flex items-center gap-2">
              <span className="text-2xl">🧬</span>
              <h1 className="text-xl font-bold tracking-tight">RECONNECT <span className="text-cyber-cyan text-sm font-mono ml-2">PRO</span></h1>
          </div>
          <div className="flex items-center gap-4 text-sm font-mono text-gray-400">
             <span className={isConnected ? "text-cyber-cyan animate-pulse" : "text-gray-600"}>
                {isConnected ? "● LIVE LINK" : "○ DISCONNECTED"}
             </span>
             <span>
                📡 {dataSentCount} PACKETS
             </span>
             <span className={isMicActive ? "text-cyber-red animate-pulse" : "text-gray-600"}>
                {isMicActive ? "🎤 ON AİR" : "🔇 MUTED"}
             </span>
          </div>
      </header>

      {/* 2. Main Content Area */}
      <main className="pt-20 pb-20 px-6 max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6 h-[calc(100vh-80px)]">
          
          {/* LEFT: Camera / Observer HUD */}
          <section className="lg:col-span-8 relative bg-black rounded-2xl overflow-hidden border border-neural-800 shadow-2xl">
              {/* [FIX] The Video Element is now part of the layout */}
              <video 
                ref={videoRef}
                className="w-full h-full object-cover transform scale-x-[-1]" // Mirror effect
                autoPlay 
                muted 
                playsInline
              />

              {/* Spatial UI Layer */}
              {isConnected && currentLandmarks && (
                  <div className="absolute inset-0 z-30 pointer-events-none">
                      {/* Floating Angle Gauge */}
                      <SpatialAngleGauge 
                          angle={currentAngle}
                          x={currentLandmarks[14].x} // Elbow X
                          y={currentLandmarks[14].y} // Elbow Y
                          isCorrect={currentAngle > 165}
                      />
                  </div>
              )}
          </section>

          {/* RIGHT: Metrics & Controls */}
          <section className="lg:col-span-4 flex flex-col gap-4">
              
              {/* Status Card */}
              <div className="bg-neural-800 p-6 rounded-2xl border border-neural-700">
                  <h3 className="text-gray-400 text-xs font-mono uppercase tracking-widest mb-2">System Status</h3>
                  <div className="flex items-center justify-between">
                      <span className="text-2xl font-bold">Trace: {isModelLoaded ? "Active" : "Loading..."}</span>
                      <div className={`w-3 h-3 rounded-full ${isModelLoaded ? 'bg-cyber-cyan shadow-neon-cyan' : 'bg-gray-600'}`}></div>
                  </div>
              </div>

              {/* Controls */}
              <div className="bg-neural-800 p-6 rounded-2xl border border-neural-700 flex-1 flex flex-col justify-end gap-3">
                  {!isConnected ? (
                      <button 
                        onClick={handleStartSession}
                        className="w-full py-4 bg-cyber-cyan text-black font-bold rounded-xl hover:bg-white transition-colors shadow-neon-cyan"
                      >
                        INITIATE SESSION ⚡
                      </button>
                  ) : (
                      <>
                        <button 
                            onClick={handleStopSession}
                            className="w-full py-4 bg-neural-700 text-white font-bold rounded-xl hover:bg-neural-600 transition-colors"
                        >
                            END SESSION ⏹
                        </button>
                        <button 
                            onClick={handleAnalyzeSession} 
                            disabled={isAnalyzeLoading}
                            className="w-full py-4 bg-cyber-amber/10 text-cyber-amber border border-cyber-amber font-bold rounded-xl hover:bg-cyber-amber hover:text-black transition-all"
                        >
                            {isAnalyzeLoading ? "PROCESSING..." : "GENERATE REPORT 🧠"}
                        </button>
                      </>
                  )}
              </div>
          </section>
      </main>

      {/* 3. Thinking Overlay */}
      <ThinkingLog isThinking={isAnalyzeLoading} />

      {/* 4. Report Modal (Bento Grid Style) */}
      {report && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-neural-900 border border-neural-700 rounded-3xl w-full max-w-5xl h-[80vh] overflow-hidden flex flex-col shadow-2xl">
                <div className="p-6 border-b border-neural-800 flex justify-between items-center bg-neural-800/50">
                    <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                        <span className="text-cyber-cyan">🧠</span> GEMINI 3 ANALYSIS
                    </h2>
                    <button onClick={() => setReport(null)} className="text-gray-400 hover:text-white">✕ CLOSE</button>
                </div>
                
                <div className="flex-1 overflow-y-auto p-8">
                    {/* Render simplified markdown or pre for now, but styled */}
                    <div className="prose prose-invert max-w-none">
                        <pre className="font-mono text-sm whitespace-pre-wrap text-gray-300">
                            {report}
                        </pre>
                    </div>
                </div>
            </div>
        </div>
      )}

      {/* Video Element Hider (Since useGeminiLive injects it fixed, we can hide it or style it via CSS if needed, 
          but design said "Keep video view". The hook puts it bottom-right. 
          For the "Main View", we might need to change the hook to attach to a ref, 
          but for Hackathon speed, let's leave the hook's fixed video and just overlay the HUD on top of the "Section" 
          Wait, the HUD relies on normalized coordinates. If the video is fixed bottom-right (240px) and the HUD 
          is in the main big section, they won't align. 
          
          CORRECTION: The user wants "Contextual HUD ... in the video feed". 
          If the video is small bottom-right, the HUD needs to be there. 
          OR we update the hook to render into the Main Section.
          
          For this iteration, I will style the video to be FULL SCREEN in the 'section' via CSS or useEffect ref logic?
          Actually, the hook creates the video element. 
          Let's just update the hook in the next step to attach to a provided Ref if possible, or 
          just use CSS to move the fixed video to the center of the 'section' bounding box.
          
          Simpler: I will just render the SpatialGauge covering the whole screen, 
          and if the video is bottom-right, the gauge will be incorrect relative to the video visual, 
          BUT correct relative to the coordinate system (0-1).
          
          To make it perfect: The video and the Gauge container must match dimensions.
          I will leave the hook's video as is (Bottom Right Preview) for "Self View" 
          but ideally we want the MAIN view to be the video. 
      */}

    </div>
  );
}



export default App;
