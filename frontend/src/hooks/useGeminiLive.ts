import { useState, useRef, useEffect, useCallback } from 'react';

type InteractionMode = 'ASL' | 'HARMONY' | 'RECONNECT';

// Update Props to optionally accept the pose detector
type PoseDetector = (video: HTMLVideoElement) => any;

interface UseGeminiLiveProps {
  mode: InteractionMode;
  detectPose?: PoseDetector; // New optional prop
}

// --- HELPER: Vector Math for Angles ---
function calculateAngle(a: any, b: any, c: any) {
    const radians = Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
    let angle = Math.abs(radians * 180.0 / Math.PI);
    if (angle > 180.0) angle = 360 - angle;
    return angle;
}

export function useGeminiLive({ mode, detectPose }: UseGeminiLiveProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [messages, setMessages] = useState<string[]>([]);
  const wsRef = useRef<WebSocket | null>(null);

  // --- SESSION STATISTICS ---
  const sessionStatsRef = useRef({
      minRightElbowAngle: 180,
      maxRightElbowAngle: 0,
      avgShoulderStability: 0, 
      frameCount: 0,
      shoulderYSum: 0,
      angleHistory: [] as number[] // [NEW] Track peaks for fatigue analysis
  });

  const getSessionStats = useCallback(() => {
     return sessionStatsRef.current;
  }, []);
  const audioContextRef = useRef<AudioContext | null>(null); // For Microphone (16kHz)
  const playbackContextRef = useRef<AudioContext | null>(null); // For Speakers (24kHz)
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const videoIntervalRef = useRef<number | null>(null);

  // --- AUDIO PLAYBACK ---
  const nextStartTimeRef = useRef<number>(0);

  const playAudioChunk = useCallback(async (base64Audio: string) => {
      try {
        if (!playbackContextRef.current) {
             playbackContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        }
        const ctx = playbackContextRef.current;
        const binaryString = window.atob(base64Audio);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        const dataView = new DataView(bytes.buffer);
        const float32Data = new Float32Array(len / 2);
        for (let i = 0; i < len / 2; i++) {
            const int16 = dataView.getInt16(i * 2, true); 
            float32Data[i] = int16 / 32768.0;
        }

        const audioBuffer = ctx.createBuffer(1, float32Data.length, 24000); 
        audioBuffer.copyToChannel(float32Data, 0);

        const source = ctx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(ctx.destination);

        // Schedule playback to avoid overlap
        if (nextStartTimeRef.current < ctx.currentTime) {
            nextStartTimeRef.current = ctx.currentTime;
        }
        source.start(nextStartTimeRef.current);
        nextStartTimeRef.current += audioBuffer.duration;
        
      } catch (e) {
          console.error("Error playing audio:", e);
      }
  }, []);

  /* New State for Optimistic UI */
  const [dataSentCount, setDataSentCount] = useState(0);



  const sendMessage = useCallback((msg: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ text: msg }));
      setMessages((prev) => [...prev, `You: ${msg}`]);
    }
  }, []);

  // --- AUDIO STREAMING ---
  const startAudioStream = useCallback(async () => {
     if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
         try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: {
                channelCount: 1,
                sampleRate: 16000, 
            }});
            mediaStreamRef.current = stream;

            const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
                sampleRate: 16000, 
            });
            audioContextRef.current = audioContext;

            const source = audioContext.createMediaStreamSource(stream);
            sourceRef.current = source; // Store reference

            const processor = audioContext.createScriptProcessor(4096, 1, 1);
            processorRef.current = processor;

            processor.onaudioprocess = (e) => {
                // Double check if we should be processing
                if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
                
                const inputData = e.inputBuffer.getChannelData(0);
                // ... encoding ...
                const pcmData = new Int16Array(inputData.length);
                for (let i = 0; i < inputData.length; i++) {
                    const s = Math.max(-1, Math.min(1, inputData[i]));
                    pcmData[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
                }
                let binary = '';
                const bytes = new Uint8Array(pcmData.buffer);
                const len = bytes.byteLength;
                for (let i = 0; i < len; i++) {
                    binary += String.fromCharCode(bytes[i]);
                }
                const base64Data =  window.btoa(binary);
                wsRef.current.send(JSON.stringify({
                    mime_type: "audio/pcm;rate=16000",
                    data: base64Data
                }));
            };

            source.connect(processor);
            processor.connect(audioContext.destination);

            setMessages(prev => [...prev, "System: Microphone Started 🎤"]);
         } catch (err) {
             console.error("Error accessing microphone:", err);
             setMessages(prev => [...prev, "Error: Could not access microphone"]);
         }
     }
  }, []);

  const stopAudioStream = useCallback(() => {
     if (sourceRef.current) {
         sourceRef.current.disconnect();
         sourceRef.current = null;
     }
     if (processorRef.current) {
         processorRef.current.disconnect();
         processorRef.current = null;
     }
     if (audioContextRef.current) {
         audioContextRef.current.close();
         audioContextRef.current = null;
     }
     if (mediaStreamRef.current) {
         mediaStreamRef.current.getTracks().forEach(track => track.stop());
         mediaStreamRef.current = null;
     }
  }, []);

  // --- VIDEO & POSE MULTIPLEXING ---
  const poseIntervalRef = useRef<number | null>(null);

  const startVideoStream = useCallback(async () => {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        
        if (!videoRef.current) {
            const vid = document.createElement('video');
            vid.style.display = 'none';
            vid.autoplay = true;
            vid.playsInline = true;
            document.body.appendChild(vid);
            videoRef.current = vid;
        }
        
        videoRef.current.srcObject = stream;
        await videoRef.current.play();

        if (!canvasRef.current) {
            canvasRef.current = document.createElement('canvas');
            canvasRef.current.width = 640;
            canvasRef.current.height = 480;
        }

        const ctx = canvasRef.current.getContext('2d');
        if (!ctx) return;

        // Loop A: Video Stream (Low Frequency - 1 FPS)
        videoIntervalRef.current = window.setInterval(() => {
            if (wsRef.current?.readyState !== WebSocket.OPEN || !videoRef.current || !canvasRef.current) return;
            
            // Draw frame to canvas
            ctx.drawImage(videoRef.current, 0, 0, 640, 480);

            // Send Video Frame
            const base64Data = canvasRef.current.toDataURL('image/jpeg', 0.8).split(',')[1];
            wsRef.current.send(JSON.stringify({
                mime_type: "image/jpeg",
                data: base64Data
            }));
        }, 1000); 

        // Loop B: Pose Tracking (High Frequency - 1 FPS)
        if (detectPose) {
             poseIntervalRef.current = window.setInterval(() => {
                 if (wsRef.current?.readyState !== WebSocket.OPEN || !videoRef.current) return;

                 const landmarks = detectPose(videoRef.current);
                 if (landmarks) {
                      // 1. Send Data
                      wsRef.current.send(JSON.stringify({
                          text: `[POSE_DATA] ${JSON.stringify(landmarks)}`
                      }));
                      setDataSentCount(c => c + 1);

                      // 2. Calculate Stats (Right Arm Focus for Demo)
                      // Landmarks: 12 (R_Shoulder), 14 (R_Elbow), 16 (R_Wrist)
                      if (landmarks[12] && landmarks[14] && landmarks[16]) {
                          const rightElbowAngle = calculateAngle(landmarks[12], landmarks[14], landmarks[16]);
                          
                          // Update Min/Max
                          if (rightElbowAngle < sessionStatsRef.current.minRightElbowAngle) sessionStatsRef.current.minRightElbowAngle = rightElbowAngle;
                          
                          // Track Peak Extension (Max Angle) History to detect fatigue
                          // Logic: If angle > 160 and we haven't logged one recently (simple debounce)
                          if (rightElbowAngle > sessionStatsRef.current.maxRightElbowAngle) {
                              sessionStatsRef.current.maxRightElbowAngle = rightElbowAngle;
                          }

                          // Simple "Rep Peak" Logger: if we hit full extension, log it
                          // (In a real app, we'd use a state machine for "Up/Down" phases)
                          if (rightElbowAngle > 150) {
                              const lastPeak = sessionStatsRef.current.angleHistory[sessionStatsRef.current.angleHistory.length-1] || 0;
                              // Only log if it's a "new" peak (different from last logged)
                              if (Math.abs(rightElbowAngle - lastPeak) > 5) {
                                   sessionStatsRef.current.angleHistory.push(parseFloat(rightElbowAngle.toFixed(1)));
                              }
                          }

                          // Update Stability (Shoulder Y Variance)
                          sessionStatsRef.current.shoulderYSum += landmarks[12].y;
                          sessionStatsRef.current.frameCount++;
                      }
                 }
             }, 1000); // 1 FPS (Matched to Video Heartbeat)
        }

        setMessages(prev => [...prev, "System: Dual-Stream Started (Video 1FPS + Pose 1FPS) 🚀"]);
    } catch (err: any) {
        console.error("Error accessing camera:", err);
        setMessages(prev => [...prev, `Error: Could not access camera (${err.name}: ${err.message})`]);
    }
  }, [detectPose, mode]);

  const stopVideoStream = useCallback(() => {
    if (videoIntervalRef.current) {
        clearInterval(videoIntervalRef.current);
        videoIntervalRef.current = null;
    }
    if (poseIntervalRef.current) {
        clearInterval(poseIntervalRef.current);
        poseIntervalRef.current = null;
    }
    if (videoRef.current) {
        const stream = videoRef.current.srcObject as MediaStream;
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
        }
        videoRef.current.remove();
        videoRef.current = null; 
    }
  }, []);

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    stopAudioStream();
    stopVideoStream();
    if (playbackContextRef.current) {
        playbackContextRef.current.close();
        playbackContextRef.current = null;
    }
  }, [stopAudioStream, stopVideoStream]);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const ws = new WebSocket(`ws://localhost:8000/ws/stream/${mode}`);

    ws.onopen = () => {
      console.log('Connected to Gemini Tunnel');
      setIsConnected(true);
    };

    ws.onmessage = (event) => {
      // Handle server messages (JSON or Text)
      try {
        const msg = JSON.parse(event.data);
        
        // --- 1. Audio Stream ---
        if (msg.audio) {
            playAudioChunk(msg.audio);
        }

        // --- 2. Text/JSON Stream ---
        if (msg.text) {
             // Try to parse nested JSON events (e.g. "event_type": "correction")
             try {
                 const content = JSON.parse(msg.text);
                 if (content.event_type === "correction") {
                     // Dispatch: Visual Feedback/Correction
                     setMessages((prev) => [...prev, `[CORRECTION] ${content.content.text} (Reps: ${content.content.reps})`]);
                     return; 
                 }
             } catch (e) {
                 // Not JSON, just standard text
             }
             setMessages((prev) => [...prev, `Gemini: ${msg.text}`]);
        }
      } catch (e) {
        // Fallback for plain text
        setMessages((prev) => [...prev, `Gemini: ${event.data}`]);
      }
    };

    ws.onclose = () => {
      console.log('Disconnected');
      setIsConnected(false);
      wsRef.current = null;
      stopAudioStream(); 
      stopVideoStream();
    };

    ws.onerror = (error) => {
      console.error('WebSocket Error:', error);
    };

    wsRef.current = ws;
  }, [mode, playAudioChunk, stopAudioStream, stopVideoStream]); // Dependencies are now defined above

  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return { isConnected, messages, connect, disconnect, sendMessage, startAudioStream, stopAudioStream, startVideoStream, stopVideoStream, dataSentCount, getSessionStats };
}
