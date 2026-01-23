import { useState, useRef, useEffect, useCallback } from 'react';
import type { ExerciseConfig, CalibrationData } from '../types/Exercise';
import { getVector, getVectorAngle } from '../utils/vectorMath';

type InteractionMode = 'ASL' | 'HARMONY' | 'RECONNECT';

// Update Props to optionally accept the pose detector
type PoseDetector = (video: HTMLVideoElement) => any;

interface UseGeminiLiveProps {
  mode: InteractionMode;
  exerciseConfig: ExerciseConfig;
  detectPose?: PoseDetector;
  onLandmarks?: (landmarks: any) => void;
  videoRef: React.RefObject<HTMLVideoElement | null>; // [FIX] Driven by App.tsx
}

export function useGeminiLive({ mode, exerciseConfig, detectPose, onLandmarks, videoRef }: UseGeminiLiveProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [messages, setMessages] = useState<string[]>([]);
  const [feedbackStatus, setFeedbackStatus] = useState<'neutral' | 'success' | 'warning' | 'critical'>('neutral');
  const [isCalibrating, setIsCalibrating] = useState(false); // New Calibration State

  const wsRef = useRef<WebSocket | null>(null);
  
  // Calibration Refs
  const calibrationRef = useRef<CalibrationData | null>(null);
  const calibrationBufferRef = useRef<number[]>([]);

  // const videoRef = useRef<HTMLVideoElement | null>(null); // [REMOVED] Shadowing prop
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const videoIntervalRef = useRef<number | null>(null);
  const poseIntervalRef = useRef<number | null>(null); // [FIX] Restored
  const videoStreamRef = useRef<MediaStream | null>(null); // [FIX] Restored

  // --- SESSION STATISTICS ---
  const sessionStatsRef = useRef({
      minRightElbowAngle: 180,
      maxRightElbowAngle: 0,
      avgShoulderStability: 0, 
      frameCount: 0,
      shoulderYSum: 0,
      angleHistory: [] as number[],
      repCount: 0, 
      repState: 'DOWN' as 'DOWN' | 'UP',
      lastWristPos: null as any, // [FIX] Added for Velocity Check
      lastShoulderY: null as number | null // [FIX] For Stability
  });

  const getSessionStats = useCallback(() => {
     return sessionStatsRef.current;
  }, []);

  // [FIX] Restore missing refs for Audio/Media
  const audioContextRef = useRef<AudioContext | null>(null); 
  const playbackContextRef = useRef<AudioContext | null>(null); 
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);

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
  // const poseIntervalRef = useRef<number | null>(null); // Moved up

  const startVideoStream = useCallback(async () => {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { width: 640, height: 480, frameRate: 15 } 
        });
        videoStreamRef.current = stream;
        
        // Use the External Ref!
        if (videoRef.current) {
            videoRef.current.srcObject = stream;
        }

        // Start Calibration Phase
        setIsCalibrating(true);
        calibrationBufferRef.current = [];
        calibrationRef.current = null;
        setMessages(prev => [...prev, "System: CALIBRATING... STAND STILL."]);

        // --- Loop A: Video Frame Sender (1 FPS) ---
        // Sends visual context to Gemini.
        // NOW PASSIVE: "trigger: false"
        videoIntervalRef.current = window.setInterval(() => {
            if (wsRef.current?.readyState === WebSocket.OPEN && videoRef.current) {
                // [PERF] Reuse canvas ref
                if (!canvasRef.current) {
                    canvasRef.current = document.createElement('canvas');
                    canvasRef.current.width = videoRef.current.videoWidth || 640;
                    canvasRef.current.height = videoRef.current.videoHeight || 480;
                }
                
                const ctx = canvasRef.current.getContext('2d');
                if (ctx) {
                    ctx.drawImage(videoRef.current, 0, 0);
                    const base64Data = canvasRef.current.toDataURL('image/jpeg', 0.5).split(',')[1];
                    
                    // PASSIVE FRAME (No Trigger)
                    wsRef.current.send(JSON.stringify({
                        mime_type: "image/jpeg",
                        data: base64Data,
                        trigger: false 
                    }));
                    setDataSentCount(c => c + 1);
                }
            }
        }, 1000);

        // --- Loop B: Pose Tracking (High Frequency - 4 FPS) ---
        // Handles "Smart Counting" and triggers Gemini only on events.
        if (detectPose) {
             poseIntervalRef.current = window.setInterval(() => {
                 if (wsRef.current?.readyState !== WebSocket.OPEN || !videoRef.current) return;

                 const landmarks = detectPose(videoRef.current);
                 if (landmarks) {
                      if (onLandmarks) onLandmarks(landmarks);

                      // [GLOBAL] Get Key Landmarks
                      const rightHip = landmarks[24];
                      const rightShoulder = landmarks[12];
                      const rightElbow = landmarks[14];
                      const rightWrist = landmarks[16];

                      // --- PHASE 1: CALIBRATION ---
                      if (calibrationRef.current === null) {
                          if (rightHip && rightShoulder) {
                              const torsoVec = getVector(rightHip, rightShoulder);
                              const upVec = { x: 0, y: -1 };
                              const currentLean = getVectorAngle(torsoVec, upVec);
                              
                              calibrationBufferRef.current.push(currentLean);
                              
                              if (calibrationBufferRef.current.length > 24) { // ~3 seconds @ 8fps
                                  const avgLean = calibrationBufferRef.current.reduce((a, b) => a + b, 0) / calibrationBufferRef.current.length;
                                  calibrationRef.current = { restingTorsoAngle: avgLean };
                                  setIsCalibrating(false);
                                  setMessages(prev => [...prev, "System: CALIBRATION COMPLETE. GO!"]);
                                  // Announce to Gemini?
                                  wsRef.current.send(JSON.stringify({
                                      text: `[SYSTEM] Calibration Complete. Resting Torso Lean: ${avgLean.toFixed(1)} degrees.`,
                                      trigger: false
                                  }));
                              }
                          }
                          return; // Skip physics until calibrated
                      }

                      // --- PHASE 2: ACTIVE SESSION ---

                      // 1. Calculate Biometrics
                      let shouldTrigger = false;
                      let triggerMessage = "";

                      // ---------------------------------------------------------
                      // GLOBAL SAFETY CHECK (Runs for ALL exercises)
                      // ---------------------------------------------------------
                      let velocity = 0;
                      if (rightWrist) {
                           // Velocity (Jerk Detection)
                           const lastWrist = sessionStatsRef.current.lastWristPos;
                           if (lastWrist) {
                               const dist = Math.sqrt(Math.pow(rightWrist.x - lastWrist.x, 2) + Math.pow(rightWrist.y - lastWrist.y, 2));
                               velocity = dist; // dist per 125ms
                               
                               // Threshold: > 0.35
                               if (velocity > 0.35) {
                                    shouldTrigger = true;
                                    triggerMessage = `[SAFETY_STOP] High Velocity Detected (Speed: ${velocity.toFixed(2)}). Possible Spasm or Drop. STOP IMMEDIATELY.`;
                                    console.warn("🚨 SAFETY STOP: High Velocity Detected", velocity);
                                    setFeedbackStatus('critical');
                                    setTimeout(() => setFeedbackStatus('neutral'), 4000);
                               }
                           }
                           // Update Stats
                           sessionStatsRef.current.lastWristPos = { x: rightWrist.x, y: rightWrist.y };
                      }

                      // ---------------------------------------------------------
                      // 2. EXERCISE ENGINE (Strategy Pattern)
                      // ---------------------------------------------------------
                      // PASS CALIBRATION DATA
                      const engineOutput = exerciseConfig.engine.calculate(
                          landmarks, 
                          sessionStatsRef.current,
                          calibrationRef.current 
                      );
                      
                      // Merge Output
                      if (engineOutput.trigger) {
                          shouldTrigger = true;
                          triggerMessage = engineOutput.message;
                          setFeedbackStatus(engineOutput.feedbackStatus);
                          if (engineOutput.feedbackStatus !== 'neutral') {
                             setTimeout(() => setFeedbackStatus('neutral'), 2000);
                          }
                      }
                      
                      // Merge Stats
                      if (engineOutput.statsUpdate) {
                          sessionStatsRef.current = { ...sessionStatsRef.current, ...engineOutput.statsUpdate };
                      }
                      
                      // Increment Frame
                      sessionStatsRef.current.frameCount++;

                      // 3. Send Data
                      if (shouldTrigger) {
                          wsRef.current.send(JSON.stringify({
                              text: triggerMessage,
                              trigger: true
                          }));
                      } else {
                          wsRef.current.send(JSON.stringify({
                              text: `[POSE_DATA] ${JSON.stringify(landmarks)}`,
                              trigger: false
                          }));
                      }
                      
                      setDataSentCount(c => c + 1);

                      // Update generic stats (using whatever available)
                      if (rightElbow) sessionStatsRef.current.frameCount++;
                 }
                  // --- REF: 8 FPS for High Fidelity ---
                  }, 125); 
        }

    } catch (err: any) {
        console.error("Error accessing camera:", err);
        setMessages(prev => [...prev, `Error: Could not access camera (${err.name}: ${err.message})`]);
    }
  }, [detectPose, mode, onLandmarks, videoRef, exerciseConfig.engine]); // Added exerciseConfig.engine dependency

  const stopVideoStream = useCallback(() => {
    if (videoStreamRef.current) {
        videoStreamRef.current.getTracks().forEach(track => track.stop());
        videoStreamRef.current = null;
    }
    if (videoIntervalRef.current) {
        clearInterval(videoIntervalRef.current);
        videoIntervalRef.current = null;
    }
    if (poseIntervalRef.current) {
        clearInterval(poseIntervalRef.current);
        poseIntervalRef.current = null;
    }
    // Clear Ref
    if (videoRef.current) videoRef.current.srcObject = null;
  }, [videoRef]);

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
             const lower = msg.text.toUpperCase();
             if (lower.includes("[SAFETY_STOP]")) {
                 setFeedbackStatus('critical');
                 setTimeout(() => setFeedbackStatus('neutral'), 4000);
             } else if (lower.includes("[CORRECTION]") || lower.includes("TORSO LEAN")) {
                 setFeedbackStatus('warning');
                 setTimeout(() => setFeedbackStatus('neutral'), 3000);
             } else if (lower.includes("[EVENT]")) {
                 setFeedbackStatus('success'); // Good Rep
                 setTimeout(() => setFeedbackStatus('neutral'), 2000);
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

  return { isConnected, messages, connect, disconnect, sendMessage, startAudioStream, stopAudioStream, startVideoStream, stopVideoStream, dataSentCount, getSessionStats, feedbackStatus, isCalibrating };
}
