import { useRef, useEffect, useState, useCallback } from 'react';
import { PoseLandmarker, HandLandmarker, FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';

type DetectionMode = 'BODY' | 'HAND' | 'FACE';

export const usePoseDetection = (mode: DetectionMode = 'BODY') => {
    const [detector, setDetector] = useState<PoseLandmarker | HandLandmarker | FaceLandmarker | null>(null);
    const [isModelLoaded, setIsModelLoaded] = useState(false);
    const lastVideoTimeRef = useRef<number>(-1);

    // Initialize MediaPipe Model
    useEffect(() => {
        setIsModelLoaded(false);
        setDetector(null);

        const loadModel = async () => {
            const vision = await FilesetResolver.forVisionTasks(
                "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm"
            );

            let landmarker: PoseLandmarker | HandLandmarker | FaceLandmarker | null = null;
            if (mode === 'BODY') {
                landmarker = await PoseLandmarker.createFromOptions(vision, {
                    baseOptions: {
                        modelAssetPath: "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task",
                        delegate: "GPU"
                    },
                    runningMode: "VIDEO",
                    numPoses: 1
                });
            } else if (mode === 'HAND') {
                landmarker = await HandLandmarker.createFromOptions(vision, {
                    baseOptions: {
                        modelAssetPath: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
                        delegate: "GPU"
                    },
                    runningMode: "VIDEO",
                    numHands: 2
                });
            } else if (mode === 'FACE') {
                landmarker = await FaceLandmarker.createFromOptions(vision, {
                    baseOptions: {
                        modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
                        delegate: "CPU"
                    },
                    runningMode: "VIDEO",
                    numFaces: 1,
                    outputFaceBlendshapes: false
                });
            }

            console.time("MediaPipe Load");
            setDetector(landmarker);
            setIsModelLoaded(true);
            console.timeEnd("MediaPipe Load");
            console.log(`✅ MediaPipe ${mode} Model Loaded`);
        };
        loadModel();
    }, [mode]);

    // Function to process a single video frame
    const detectPose = useCallback((videoElement: HTMLVideoElement) => {
        if (!detector || videoElement.currentTime === lastVideoTimeRef.current) return null;

        if (videoElement.readyState < 2 || videoElement.videoWidth === 0 || videoElement.videoHeight === 0) return null;

        lastVideoTimeRef.current = videoElement.currentTime;
        
        try {
            const result = detector.detectForVideo(videoElement, performance.now());
            
            // Normalize Output to a single list of landmarks (or object)
            if (mode === 'BODY') {
                const res = result as any;
                if (res.landmarks && res.landmarks.length > 0) return res.landmarks[0];
            } else if (mode === 'HAND') {
                const res = result as any;
                // For hands, we might return the first hand, or both?
                // Reconnect treats it as a flat array. Let's return the first hand for now, or a merged array?
                // Returning array of arrays is standard MediaPipe.
                // But UniversalEngine expects `Landmark[]`.
                if (res.landmarks && res.landmarks.length > 0) return res.landmarks[0]; 
            } else if (mode === 'FACE') {
                const res = result as any;
                // Face has `faceLandmarks` and `faceBlendshapes`
                if (res.faceLandmarks && res.faceLandmarks.length > 0) {
                     // Attach blendshapes to the array object if possible? 
                     // Or just return the landmarks.
                     // The Engine might need blendshapes.
                     const landmarks = res.faceLandmarks[0];
                     // Hack: Attach blendshapes as a property
                     (landmarks as any).blendshapes = res.faceBlendshapes ? res.faceBlendshapes[0] : null;
                     return landmarks;
                }
            }
        } catch (e) {
            console.error("Detection Error", e);
        }
        return null;
    }, [detector, mode]);

    return { isModelLoaded, detectPose };
};
