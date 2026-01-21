import { useState } from 'react';
import { useGeminiLive } from './hooks/useGeminiLive';
import { usePoseDetection } from './hooks/usePoseDetection'; // [NEW]
import './App.css';

function App() {
  const { isModelLoaded, detectPose } = usePoseDetection(); // [NEW]
  // Initialize hook with RECONNECT mode and pass the detector
  const { isConnected, messages, connect, disconnect, sendMessage, startAudioStream, stopAudioStream, startVideoStream, stopVideoStream, dataSentCount, getSessionStats } = useGeminiLive({ 
      mode: 'RECONNECT', 
      detectPose 
  }); 

  const [input, setInput] = useState('');
  const [isMicActive, setIsMicActive] = useState(false);

  const [report, setReport] = useState<string | null>(null);
  const [isAnalyzeLoading, setIsAnalyzeLoading] = useState(false);

  const handleStartMic = async () => {
    await startAudioStream();
    setIsMicActive(true);
  };

  const handleStopMic = () => {
    stopAudioStream();
    setIsMicActive(false);
  };

  const handleAnalyzeSession = async () => {
    setIsAnalyzeLoading(true);
    try {
      // Gather context (simple concatenation of logs for now)
      const transcript = messages.join("\n");
      const stats = getSessionStats();

      // Create a data-driven summary
      const biomechanicsSummary = `
      Session Biometrics:
      - Range of Motion (Right Elbow): ${Math.round(stats.minRightElbowAngle)}° (Flexion) to ${Math.round(stats.maxRightElbowAngle)}° (Extension).
      - Avg Shoulder Stability: ${(stats.shoulderYSum / stats.frameCount || 0).toFixed(4)} (Y-axis variance).
      `;

      const response = await fetch('/api/analyze_session', { // note: need proxy or full URL if CORS not set
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
    <div className="app-container">
      <h1>StorySign - Gemini Tunnel Test (Reconnect Mode)</h1>
      
      <div className="status-bar">
        Status: <span className={isConnected ? 'connected' : 'disconnected'}>
          {isConnected ? 'Connected' : 'Disconnected'}
        </span>
        <span style={{marginLeft: '20px'}}>
             Pose Model: {isModelLoaded ? "✅ Ready" : "⏳ Loading..."}
        </span>
        <span style={{marginLeft: '20px'}}>
             Data Packets: {dataSentCount} 📡
        </span>
      </div>

      <div className="controls">
        <button onClick={connect} disabled={isConnected}>Connect</button>
        <button onClick={disconnect} disabled={!isConnected}>Disconnect</button>
        <div className="divider"></div>
        <button onClick={handleStartMic} disabled={!isConnected || isMicActive}>Start Mic 🎤</button>
        <button onClick={handleStopMic} disabled={!isConnected || !isMicActive}>Stop Mic ⏹️</button>
        <div className="divider"></div>
        <button onClick={startVideoStream} disabled={!isConnected || !isModelLoaded}>Start Cam + Pose 🦴</button>
        <button onClick={stopVideoStream} disabled={!isConnected}>Stop Cam ⏹️</button>
        <div className="divider"></div>
        <button onClick={handleAnalyzeSession} disabled={isAnalyzeLoading}>
            {isAnalyzeLoading ? "Thinking... 🧠" : "Deep Think Analyze 🧠"}
        </button>
      </div>

      {report && (
        <div className="modal-overlay">
            <div className="modal-content">
                <h2>Gemini 3 Deep Think Report 🧠</h2>
                <div className="report-body">
                    <pre>{report}</pre>
                </div>
                <button onClick={() => setReport(null)}>Close</button>
            </div>
        </div>
      )}

      <div className="message-area">
        <input 
          type="text" 
          value={input} 
          onChange={(e) => setInput(e.target.value)} 
          placeholder="Type a message..."
          disabled={!isConnected}
        />
        <button onClick={() => { sendMessage(input); setInput(''); }} disabled={!isConnected}>
          Send Echo
        </button>
      </div>

      <div className="logs">
        <h3>Logs:</h3>
        {messages.map((msg, idx) => (
            <div key={idx} className="log-entry">{msg}</div>
        ))}
      </div>
    </div>
  );
}


export default App;
