import { useState, useRef, useEffect, useCallback } from 'react';
import type { ExerciseConfig, CalibrationData } from '../types/Exercise';
import { getVector, getVectorAngle } from '../utils/vectorMath';
import { apiClient } from '../api/client';
// import { getUniqueLandmarks } from '../utils/FaceLandmarks'; // [REMOVED] Video-First Strategy

type InteractionMode = 'ASL' | 'HARMONY' | 'RECONNECT';

// Update Props to optionally accept the pose detector
type PoseDetector = (video: HTMLVideoElement) => any;

interface UseGeminiLiveProps {
  mode: InteractionMode;
  exerciseConfig: ExerciseConfig;
  detectPose?: PoseDetector;
  onLandmarks?: (landmarks: any) => void;
  videoRef: React.RefObject<HTMLVideoElement | null>; // [FIX] Driven by App.tsx
  targetEmotion?: string; // [NEW] For Single-Stream Harmony
  // targetLandmarks?: number[]; // [REMOVED] Video-First Strategy
}

export function useGeminiLive({ mode, exerciseConfig, detectPose, onLandmarks, videoRef, targetEmotion }: UseGeminiLiveProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [messages, setMessages] = useState<string[]>([]);
  const [feedbackStatus, setFeedbackStatus] = useState<'neutral' | 'success' | 'warning' | 'critical'>('neutral');
  const [isCalibrating, setIsCalibrating] = useState(false); // New Calibration State
  // Clinical Notes State (Strategy A)
  const [clinicalNotes, setClinicalNotes] = useState<string[]>([]);
  const clinicalNotesRef = useRef<string[]>([]); // [FIX] Mirror for Interval Access
  
  // Harmony State
  const [emotionData, setEmotionData] = useState<{detected_emotion: string, confidence: number, feedback: string} | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  
  // Calibration Refs
  const calibrationRef = useRef<CalibrationData | null>(null);
  const calibrationBufferRef = useRef<number[]>([]);

  // const videoRef = useRef<HTMLVideoElement | null>(null); // [REMOVED] Shadowing prop
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  // const noteBufferRef = useRef<string>(""); // [REMOVED] Legacy Buffer
  const videoIntervalRef = useRef<number | null>(null);
  const poseIntervalRef = useRef<number | null>(null); // [FIX] Restored
  const videoStreamRef = useRef<MediaStream | null>(null); // [FIX] Restored
  const targetEmotionRef = useRef<string | undefined>(targetEmotion); // [NEW] 
  const forceTriggerRef = useRef<boolean>(false); // [NEW] Missing ref from previous context
  const lastSentLandmarksRef = useRef<any[] | null>(null); // [THROTTLING]
  const lastSentTimeRef = useRef<number>(0);             // [THROTTLING]

  // [SYNC] Keep Ref In Sync with Prop
  useEffect(() => {
    targetEmotionRef.current = targetEmotion;
  }, [targetEmotion]);

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
      lastShoulderY: null as number | null, // [FIX] For Stability
      telemetry: [] as { t: number, val: number, vel: number }[], // [STRATEGY C]
      universalVariables: {} as Record<string, number>, // [NEW] For Debugging
      startTime: Date.now() 
  });

  // [INCREMENTAL REPORTING] State
  const sessionIdRef = useRef<string>(crypto.randomUUID());
  const chunkIntervalRef = useRef<number | null>(null);
  const lastChunkIndexRef = useRef({ telemetry: 0, notes: 0 });

  const [repCount, setRepCount] = useState(0); // [FIX] UI State for Reps

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
        
        // [FIX] Auto-resume if suspended (browser policy)
        if (ctx.state === 'suspended') {
            await ctx.resume();
        }

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
            console.log("[GeminiLive] AudioContext started at:", audioContext.sampleRate, "Hz");

            const source = audioContext.createMediaStreamSource(stream);
            sourceRef.current = source; // Store reference

            const processor = audioContext.createScriptProcessor(4096, 1, 1);
            processorRef.current = processor;

            processor.onaudioprocess = (e) => {
                // Double check if we should be processing
                if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
                const inputData = e.inputBuffer.getChannelData(0);
                
                // Simple Downsampling/Encoding 
                // (Assuming 16kHz context as set above, so just converting Float32 -> Int16)
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
                
                if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                    // [CRITICAL FIX] Match Backend Schema: realtimeInput -> mediaChunks -> mimeType
                    wsRef.current.send(JSON.stringify({
                        realtimeInput: {
                            mediaChunks: [{
                                mimeType: "audio/pcm",
                                data: base64Data
                            }]
                        }
                    }));
                }
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

  // [STABILITY] Wrap callbacks in refs to avoid dependency churn restarting the stream
  const detectPoseRef = useRef(detectPose);
  const onLandmarksRef = useRef(onLandmarks);

  useEffect(() => {
      detectPoseRef.current = detectPose;
      onLandmarksRef.current = onLandmarks;
  }, [detectPose, onLandmarks]);

  const startVideoStream = useCallback(async () => {
    // [FIX] Robustness: Clear existing loops if this function is called again
    if (videoIntervalRef.current) clearInterval(videoIntervalRef.current);
    if (poseIntervalRef.current) clearInterval(poseIntervalRef.current);

    try {
        // [OPTIMIZATION] If stream already exists and is active, don't re-request camera
        if (!videoStreamRef.current || !videoStreamRef.current.active) {
             const stream = await navigator.mediaDevices.getUserMedia({ 
                video: { width: 640, height: 480, frameRate: 15 } 
            });
            videoStreamRef.current = stream;
             // Use the External Ref!
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
            }
        } else {
            console.log("[GeminiLive] Reusing existing video stream");
             // Ensure video ref is still attached
             if (videoRef.current && !videoRef.current.srcObject) {
                 videoRef.current.srcObject = videoStreamRef.current;
             }
        }
        
        // Start Calibration Phase
        setIsCalibrating(true);
        calibrationBufferRef.current = [];
        calibrationRef.current = null;
        setMessages(prev => [...prev, "System: CALIBRATING... STAND STILL."]);

        // --- Loop A: Video Frame Sender (1 FPS) ---
        // Sends visual context to Gemini.
        // [REFACTOR] Extracted Logic
        const sendVideoFrame = (trigger: boolean, contextText?: string) => {
             if (wsRef.current?.readyState === WebSocket.OPEN && videoRef.current) {
                // [PERF] Reuse canvas ref
                if (!canvasRef.current) {
                    canvasRef.current = document.createElement('canvas');
                    // [PERF] Use 320x240 for 4x faster transmission/inference
                    canvasRef.current.width = 320; 
                    canvasRef.current.height = 240;
                }
                
                const ctx = canvasRef.current.getContext('2d');
                if (ctx) {
                    // [PERF] Draw Scaled Image
                    ctx.drawImage(videoRef.current, 0, 0, canvasRef.current.width, canvasRef.current.height);
                    const base64Data = canvasRef.current.toDataURL('image/jpeg', 0.5).split(',')[1];
                    
                    // 1. Send Image
                    wsRef.current.send(JSON.stringify({
                        mime_type: "image/jpeg",
                        data: base64Data,
                        trigger: false // Image itself doesn't trigger response
                    }));

                    // 2. If Trigger, Send Context Text immediately after
                    if (trigger && contextText) {
                         wsRef.current.send(JSON.stringify({
                             text: contextText, 
                             trigger: true 
                         }));
                    }
                    
                    setDataSentCount(c => c + 1);
                }
            }
        };

        videoIntervalRef.current = window.setInterval(() => {
            sendVideoFrame(false);
        }, 1000);

        // --- Loop B: Pose Tracking (High Frequency - 4 FPS) ---
        // Handles "Smart Counting" and triggers Gemini only on events.
        // ALWAYS start the interval, check for detector inside
        poseIntervalRef.current = window.setInterval(() => {
             if (wsRef.current?.readyState !== WebSocket.OPEN || !videoRef.current) return;

             const detector = detectPoseRef.current; // access fresh ref
             if (!detector) return;

             const landmarks = detector(videoRef.current);
             if (landmarks) {
                  if (onLandmarksRef.current) onLandmarksRef.current(landmarks);

                   // [GLOBAL] Get Key Landmarks
                   // [FIX] Safety check for Body Mode
                   let rightHip, rightShoulder, rightElbow, rightWrist;
                   
                   // [DEBUG] AGGRESSIVE LOGGING
                   if (sessionStatsRef.current.frameCount % 50 === 0) {
                       console.log(`[GeminiLive] Loop Check. Mode: ${mode}, Landmarks:`, landmarks);
                   }

                   // Distinguish Face vs Body (Correct Object Structure)
                   const isFace = mode === 'HARMONY'; 

                   // --- CASE 1: FACE (Harmony) ---
                   if (isFace) {
                       // [HARMONY STRATEGY: SMART THROTTLING]
                       // Instead of fixed intervals, we check for Motion Delta.
                       // Rules:
                       // 1. Min Interval: 500ms (Max 2 FPS) - Prevent Token Storm
                       // 2. Max Interval: 3000ms (Keep Alive) - Prevent Context Loss
                       // 3. Motion Threshold: Only send if face moves significant amount
                       
                       const now = Date.now();
                       const timeSinceLast = now - lastSentTimeRef.current;
                       const MIN_INTERVAL = 300; // [TUNING] Faster updates (previously 500) 
                       const MAX_INTERVAL = 3000;
                       
                       const isForcedTrigger = forceTriggerRef.current; // User Request (e.g. Button)
                       
                       // 1. CAP RATE (Unless Forced)
                       if (!isForcedTrigger && timeSinceLast < MIN_INTERVAL) return;

                       // 2. CHECK MOTION
                       let shouldSend = false;
                       const currentLandmarks = landmarks as any[];
                       
                       // Calculate Motion Delta (Euclidean Distance of Key Points)
                       // We use nose (1), mouth corners (61, 291), and eyebrows (105, 334) as proxies
                       const PROXY_INDICES = [1, 61, 291, 105, 334]; 
                       let delta = 0;
                       
                       if (lastSentLandmarksRef.current) {
                           for (const idx of PROXY_INDICES) {
                               const p1 = currentLandmarks[idx];
                               const p2 = lastSentLandmarksRef.current[idx];
                               if (p1 && p2) {
                                   delta += Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
                               }
                           }
                       } else {
                           delta = 999; // First Frame always send
                       }

                       // DECISION LOGIC
                       if (isForcedTrigger) {
                           console.log("[GeminiLive] Force Trigger");
                           shouldSend = true;
                           forceTriggerRef.current = false; // Reset
                       } else if (timeSinceLast > MAX_INTERVAL) {
                           // KeepAlive
                           // console.log("[GeminiLive] KeepAlive Trigger");
                           shouldSend = true;
                       } else if (delta > 0.02) { // [TUNING] More sensitive (previously 0.05)
                           // Significant Motion
                           shouldSend = true;
                       }

                       if (shouldSend) {
                           const currentTarget = targetEmotionRef.current || "Neutral";
                           
                           // [VIDEO-FIRST STRATEGY]
                           // Send Trigger Text. sendVideoFrame will handle image + text.
                           sendVideoFrame(true, `[CHECK_EXPRESSION] Target: ${currentTarget}`);
                           
                           lastSentLandmarksRef.current = currentLandmarks;
                           lastSentTimeRef.current = now;
                       }
                       return; // Done for this frame
                   }

                   // --- CASE 2: BODY (ASL/Exercises) ---
                   if (landmarks.length >= 33) {
                       rightHip = landmarks[24];
                       rightShoulder = landmarks[12];
                       rightElbow = landmarks[14];
                       rightWrist = landmarks[16];
                   }
                  
                  if (landmarks.length >= 33) {
                       // ... PHASE 1: CALIBRATION ...
                       if (calibrationRef.current === null) {
                           if (rightHip && rightShoulder) {
                               const torsoVec = getVector(rightHip, rightShoulder);
                               const upVec = { x: 0, y: -1 };
                               const currentLean = getVectorAngle(torsoVec, upVec);
                               
                               calibrationBufferRef.current.push(currentLean);
                               
                               if (calibrationBufferRef.current.length > 24) { 
                                   const avgLean = calibrationBufferRef.current.reduce((a, b) => a + b, 0) / calibrationBufferRef.current.length;
                                   calibrationRef.current = { restingTorsoAngle: avgLean };
                                   setIsCalibrating(false);
                                   setMessages(prev => [...prev, "System: CALIBRATION COMPLETE. GO!"]);
                                   wsRef.current.send(JSON.stringify({
                                       text: `[SYSTEM] Calibration Complete. Resting Torso Lean: ${avgLean.toFixed(1)} degrees.`,
                                       trigger: false
                                   }));
                               }
                           }
                           return; 
                       }

                       // ... PHASE 2: ACTIVE SESSION ...
                       let shouldTrigger = false;
                       let triggerMessage = "";
                       let velocity = 0;

                       if (rightWrist) {
                            const lastWrist = sessionStatsRef.current.lastWristPos;
                            if (lastWrist) {
                                const dist = Math.sqrt(Math.pow(rightWrist.x - lastWrist.x, 2) + Math.pow(rightWrist.y - lastWrist.y, 2));
                                velocity = dist;
                                if (velocity > 0.5) {
                                    const note = `[SAFETY_STOP] High Velocity Detected (Speed: ${velocity.toFixed(2)}).`;
                                    setClinicalNotes(prev => [...prev, note]);
                                    clinicalNotesRef.current.push(note);
                                     shouldTrigger = true;
                                     triggerMessage = `[SAFETY_STOP] High Velocity Detected (Speed: ${velocity.toFixed(2)}). Possible Spasm or Drop. STOP IMMEDIATELY.`;
                                     console.warn("🚨 SAFETY STOP: High Velocity Detected", velocity);
                                     setFeedbackStatus('critical');
                                     setTimeout(() => setFeedbackStatus('neutral'), 4000);
                                }
                            }
                            sessionStatsRef.current.lastWristPos = { x: rightWrist.x, y: rightWrist.y };
                       }

                       // 2. EXERCISE ENGINE
                       const engineOutput = exerciseConfig.engine.calculate(
                           landmarks, 
                           sessionStatsRef.current,
                           calibrationRef.current 
                       );
                       
                       if (engineOutput.trigger) {
                           shouldTrigger = true;
                           triggerMessage = engineOutput.message;
                           setClinicalNotes(prev => [...prev, engineOutput.message]);
                           clinicalNotesRef.current.push(engineOutput.message);
                           setFeedbackStatus(engineOutput.feedbackStatus);
                           if (engineOutput.feedbackStatus !== 'neutral') {
                              setTimeout(() => setFeedbackStatus('neutral'), 2000);
                           }
                       }
                       if (engineOutput.statsUpdate) {
                           sessionStatsRef.current = { ...sessionStatsRef.current, ...engineOutput.statsUpdate };
                           if (engineOutput.statsUpdate.repCount !== undefined) {
                                setRepCount(sessionStatsRef.current.repCount);
                           }
                        }
                       
                       sessionStatsRef.current.frameCount++;

                        // 3. SEND BODY DATA
                        if (shouldTrigger) {
                            console.log("[GeminiLive] Triggering Response:", triggerMessage);
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

                       if (rightElbow) sessionStatsRef.current.frameCount++;
                  }
             }
              // --- REF: 8 FPS for High Fidelity ---
              }, 125); 
    } catch (err: any) {
        console.error("Error accessing camera:", err);
        setMessages(prev => [...prev, `Error: Could not access camera (${err.name}: ${err.message})`]);
    }
  }, [mode, videoRef, exerciseConfig.engine]); // Removed detectPose to stabilize identity

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
    // [FLUSH] Send any pending data before closing (The "Trailing" Chunk)
    const stats = sessionStatsRef.current;
    const allNotes = clinicalNotesRef.current;
    
    // Check what hasn't been sent yet
    const tStart = lastChunkIndexRef.current.telemetry;
    const nStart = lastChunkIndexRef.current.notes;
    
    // If there is NEW data
    if (stats.telemetry.length > tStart || allNotes.length > nStart) {
        console.log("[GeminiLive] Flushing final chunk...", { 
            telemetryCount: stats.telemetry.length - tStart, 
            notesCount: allNotes.length - nStart 
        });
        
        const newTelemetry = stats.telemetry.slice(tStart);
        const newNotes = allNotes.slice(nStart);
        
        const payload = {
            session_id: sessionIdRef.current,
            timestamp_start: tStart > 0 ? stats.telemetry[tStart].t : 0,
            timestamp_end: Date.now(), // Approximate end time for flush
            telemetry: newTelemetry,
            notes: newNotes 
        };
        
        // Fire and Forget (using keepalive if possible, but standard fetch usually works for small payloads)
        // [FIX] Use absolute path /api/session/chunk
        fetch('/api/session/chunk', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
                keepalive: true // Crucial for requests during unload
        }).catch(e => console.error("Flush Error", e));
    }

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
    
    // Clear Chunk Loop
    if (chunkIntervalRef.current) {
        clearInterval(chunkIntervalRef.current);
        chunkIntervalRef.current = null;
    }
  }, [stopAudioStream, stopVideoStream]);

  const connect = useCallback(() => {
    if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) return;

    // Reset Session ID for new run
    sessionIdRef.current = crypto.randomUUID();
    lastChunkIndexRef.current = { telemetry: 0, notes: 0 };
    sessionStatsRef.current.telemetry = [];
    setClinicalNotes([]);
    clinicalNotesRef.current = [];

    // 1. Wake up Shadow Brain
    const startPayload = { 
        session_id: sessionIdRef.current,
        domain: mode === 'HARMONY' ? 'FACE' : 'BODY',
        // [FIX] Prioritize 'targetEmotion' (e.g. HAPPY) over generic config ID for Harmony
        exercise_id: (mode === 'HARMONY' && targetEmotion) 
            ? targetEmotion 
            : ((exerciseConfig as any)?.id || 'unknown')
    };
    
    apiClient('/session/start', {
        method: 'POST',
        body: JSON.stringify(startPayload)
    }).catch(e => console.error("Start Session Error", e));

    // 2. Start Chunk Loop (Every 10s)
    chunkIntervalRef.current = window.setInterval(() => {
        const stats = sessionStatsRef.current;
        const allNotes = clinicalNotesRef.current; 
        
        const tStart = lastChunkIndexRef.current.telemetry;
        const nStart = lastChunkIndexRef.current.notes;

        const newTelemetry = stats.telemetry.slice(tStart);
        const newNotes = allNotes.slice(nStart);
        
        // Skip if empty? No, keep heartbeat alive?
        if (newTelemetry.length === 0 && newNotes.length === 0) return;

        // Simple slice for telemetry
        const payload = {
            session_id: sessionIdRef.current,
            timestamp_start: tStart > 0 ? stats.telemetry[tStart].t : 0,
            timestamp_end: stats.telemetry.length > 0 ? stats.telemetry[stats.telemetry.length - 1].t : 0,
            telemetry: newTelemetry,
            notes: newNotes 
        };

        // Send Chunk
        apiClient('/session/chunk', {
             method: 'POST',
             body: JSON.stringify(payload)
        }).then(() => {
             // Success
             lastChunkIndexRef.current.telemetry = stats.telemetry.length;
             lastChunkIndexRef.current.notes = allNotes.length;
        }).catch(e => console.error("Chunk Error", e));

    }, 8000); // 8 seconds

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws/stream/${mode}`);

    ws.onopen = () => {
      if (ws !== wsRef.current) return; // Ignore stale
      console.log('Connected to Gemini Tunnel');
      setIsConnected(true);
      // [SILENT STARTUP] Don't provoke the model
      ws.send(JSON.stringify({
          text: "[SYSTEM] Session Connected. Ready for stream.",
          trigger: false 
      }));
    };

    ws.onmessage = (event) => {
      if (ws !== wsRef.current) return; // Ignore stale
      // Handle server messages (JSON or Text)
      // [DEBUG] Log Raw Message
      // console.log("[WS IN]", event.data.substring(0, 100)); // Print first 100 chars
      try {
        const msg = JSON.parse(event.data);
        
        // [DEBUG] Log Parsed Message 
        if (msg.type) console.log("[WS MSG TYPE]", msg.type);
        
        // --- 1. Audio Stream ---
        if (msg.type === 'audio') {
            playAudioChunk(msg.content);
        }

         // --- 2. Text/JSON Stream ---
         if (msg.type === 'clinical_note') {
             // [NEW] Handle Silent Tool Call Event
             console.log("[GeminiLive] Received Silent Clinical Note:", msg.note);
             setClinicalNotes(prev => {
                 const updated = [...prev, msg.note];
                 clinicalNotesRef.current = updated; // Sync Ref
                 return updated;
             });
         } else if (msg.type === 'emotion_ui_update') {
             console.log("[GeminiLive] Emotion Update:", msg.content);
             setEmotionData(msg.content);
             
             // [FIX] Log to Clinical Notes for Report Generation
             const note = `[EMOTION] Detected: ${msg.content.detected_emotion} (${msg.content.confidence}%) - Feedback: ${msg.content.feedback}`;
             setClinicalNotes(prev => {
                  const updated = [...prev, note];
                  clinicalNotesRef.current = updated; 
                  return updated;
             });
         } else if (msg.type === 'text') {
             const textContent = msg.content;
             const lower = textContent.toUpperCase();
             // Standard UI Triggers
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

             // [CLEANUP] No more Regex Buffering. The text is just text (Audio transcript).
             setMessages((prev) => [...prev, `Gemini: ${textContent}`]);
         }
       } catch (e) {
         // Fallback for plain text
         setMessages((prev) => [...prev, `Gemini: ${event.data}`]);
       }
    };
    
    ws.onclose = () => {
      if (ws !== wsRef.current) {
          console.log('Ignoring onclose from stale socket');
          return;
      }
      console.log('Disconnected');
      setIsConnected(false);
      wsRef.current = null;
      stopAudioStream(); 
      stopVideoStream();
    };

    ws.onerror = (error) => {
      if (ws !== wsRef.current) return; // Ignore stale
      console.error('WebSocket Error:', error);
    };

    wsRef.current = ws;
  }, [mode, playAudioChunk, stopAudioStream, stopVideoStream]);

  // Expose flushData for manual triggering
  const flushData = async () => {
        const stats = getSessionStats();
        const allNotes = clinicalNotesRef.current;

        if (lastChunkIndexRef.current.telemetry >= stats.telemetry.length && 
            lastChunkIndexRef.current.notes >= allNotes.length) {
             console.log("[GeminiLive] No new data to flush.");
             return;
        }

        console.log("[GeminiLive] Flushing final chunk...");
        
        // Slice new data
        const tStart = lastChunkIndexRef.current.telemetry;
        const newTelemetry = stats.telemetry.slice(tStart);
        const newNotes = allNotes.slice(lastChunkIndexRef.current.notes);
        
        const payload = {
            session_id: sessionIdRef.current,
            timestamp_start: tStart > 0 ? stats.telemetry[tStart].t : 0,
            timestamp_end: stats.telemetry.length > 0 ? stats.telemetry[stats.telemetry.length - 1].t : 0,
            telemetry: newTelemetry,
            notes: newNotes 
        };

        // Send Chunk and Wait
        try {
            await apiClient('/session/chunk', {
                method: 'POST',
                body: JSON.stringify(payload)
            });
            // Success
            lastChunkIndexRef.current.telemetry = stats.telemetry.length;
            lastChunkIndexRef.current.notes = allNotes.length;
        } catch (e) {
            console.error("Flush Failed", e);
        }
  };

  // Instant Trigger for UI Events
  // Instant Trigger for UI Events
  const triggerInstantAnalysis = useCallback(() => {
      console.log("[GeminiLive] Force Trigger Requested");
      forceTriggerRef.current = true;
  }, []);

  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return { isConnected, messages, clinicalNotes, connect, disconnect, sendMessage, startAudioStream, stopAudioStream, startVideoStream, stopVideoStream, dataSentCount, getSessionStats, feedbackStatus, isCalibrating, sessionId: sessionIdRef.current, flushData, repCount, emotionData, triggerInstantAnalysis };
}
