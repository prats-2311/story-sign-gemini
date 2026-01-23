import { useRef, useEffect, useState, useCallback } from 'react';
import { PoseLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';

export const usePoseDetection = () => {
    const [poseLandmarker, setPoseLandmarker] = useState<PoseLandmarker | null>(null);
    const [isModelLoaded, setIsModelLoaded] = useState(false);
    const lastVideoTimeRef = useRef<number>(-1);

    // Initialize MediaPipe Pose Model
    useEffect(() => {
        const loadModel = async () => {
            const vision = await FilesetResolver.forVisionTasks(
                "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm"
            );
            const landmarker = await PoseLandmarker.createFromOptions(vision, {
                baseOptions: {
                    modelAssetPath: "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task",
                    delegate: "GPU"
                },
                runningMode: "VIDEO",
                numPoses: 1
            });
            setPoseLandmarker(landmarker);
            setIsModelLoaded(true);
            console.log("✅ MediaPipe Pose Model Loaded");
        };
        loadModel();
    }, []);

    // Function to process a single video frame
    const detectPose = useCallback((videoElement: HTMLVideoElement) => {
        if (!poseLandmarker || videoElement.currentTime === lastVideoTimeRef.current) return null;

        if (videoElement.readyState < 2 || videoElement.videoWidth === 0 || videoElement.videoHeight === 0) return null;

        lastVideoTimeRef.current = videoElement.currentTime;
        const result = poseLandmarker.detectForVideo(videoElement, performance.now());
        
        // Return 33 keypoints if detected
        if (result.landmarks && result.landmarks.length > 0) {
            return result.landmarks[0]; // First detected person
        }
        return null;
    }, [poseLandmarker]);

    return { isModelLoaded, detectPose };
};
