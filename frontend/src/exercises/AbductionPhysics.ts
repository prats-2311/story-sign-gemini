import type { PhysicsEngine, PhysicsOutput } from '../types/Exercise';
import { getVector, getVectorAngle } from '../utils/vectorMath';

export class AbductionPhysics implements PhysicsEngine {
    calculate(landmarks: any, currentStats: any, calibration?: any): PhysicsOutput {
        const output: PhysicsOutput = {
            trigger: false,
            message: "",
            feedbackStatus: 'neutral',
            statsUpdate: {}
        };

        const rightHip = landmarks[24];
        const rightShoulder = landmarks[12];
        const rightElbow = landmarks[14];
        // const rightWrist = landmarks[16];

        if (!rightHip || !rightShoulder || !rightElbow) return output;

        // VECTORS
        const torsoVec = getVector(rightHip, rightShoulder); 
        const armVec = getVector(rightShoulder, rightElbow);
        const upVec = { x: 0, y: -1 };

        // 1. SAFETY: Torso Tilt
        let leanAngle = getVectorAngle(torsoVec, upVec);
        
        // CALIBRATION: Normalize lean relative to resting pose
        if (calibration && calibration.restingTorsoAngle !== undefined) {
             leanAngle = Math.abs(leanAngle - calibration.restingTorsoAngle);
        }

        if (leanAngle > 15) { 
            output.trigger = true;
            output.message = `[CORRECTION] Torso Lean Detected (${leanAngle.toFixed(0)}°). Keep your back straight!`;
            output.feedbackStatus = 'warning';
        }

        // 2. ABDUCTION Logic
        const abduction = getVectorAngle(torsoVec, armVec);
        let { repState, repCount, minRightElbowAngle, maxRightElbowAngle, angleHistory } = currentStats;

        // State Machine
        if (repState === 'DOWN' && abduction > 140) {
            repState = 'UP';
        } else if (repState === 'UP' && abduction < 110) {
            repState = 'DOWN';
            repCount += 1;
            output.trigger = true;
            output.message = `[EVENT] Abduction Rep ${repCount} Completed. Good form.`;
            output.feedbackStatus = 'success';
        }

        // 3. Stats Update
        const newHistory = [...angleHistory];
        if (currentStats.frameCount % 5 === 0) {
            newHistory.push(parseFloat(abduction.toFixed(1)));
            if (newHistory.length > 200) newHistory.shift();
        }

        output.statsUpdate = {
            repState,
            repCount,
            minRightElbowAngle: Math.min(minRightElbowAngle, abduction),
            maxRightElbowAngle: Math.max(maxRightElbowAngle, abduction),
            angleHistory: newHistory,
            // Pass through computed values for UI if needed
            currentAbduction: abduction,
            currentLean: leanAngle
        };

        return output;
    }
}
