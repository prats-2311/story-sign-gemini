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
        
        const leftHip = landmarks[23];
        const leftShoulder = landmarks[11];
        const leftElbow = landmarks[13];

        if (!rightHip || !rightShoulder || !rightElbow || !leftHip || !leftShoulder || !leftElbow) return output;

        // VECTORS
        const torsoVecR = getVector(rightHip, rightShoulder); 
        const armVecR = getVector(rightShoulder, rightElbow);
        
        const torsoVecL = getVector(leftHip, leftShoulder);
        const armVecL = getVector(leftShoulder, leftElbow);
        
        const upVec = { x: 0, y: -1 };

        // 1. SAFETY: Torso Tilt (using average or max lean)
        let leanAngle = getVectorAngle(torsoVecR, upVec); // Simplify to Right side for torso
        
        // CALIBRATION
        if (calibration && calibration.restingTorsoAngle !== undefined) {
             leanAngle = Math.abs(leanAngle - calibration.restingTorsoAngle);
        }

        if (leanAngle > 15) { 
            output.trigger = true;
            output.message = `[CORRECTION] Torso Lean Detected (${leanAngle.toFixed(0)}°). Keep your back straight!`;
            output.feedbackStatus = 'warning';
        }

        // 2. ABDUCTION Logic (BILATERAL)
        const abdR = getVectorAngle(torsoVecR, armVecR);
        const abdL = getVectorAngle(torsoVecL, armVecL);
        
        // Average for simple graph, but MIN for state machine (Weakest Link Rule)
        const avgAbduction = (abdR + abdL) / 2;
        
        let { repState, repCount, minRightElbowAngle, maxRightElbowAngle, angleHistory } = currentStats;

        // State Machine - Require BOTH arms to be UP
        const THRESHOLD_UP = 135; // Lowered slightly to be forgiving for dual arm
        const THRESHOLD_DOWN = 110;

        if (repState === 'DOWN' && abdR > THRESHOLD_UP && abdL > THRESHOLD_UP) {
            repState = 'UP';
        } else if (repState === 'UP' && abdR < THRESHOLD_DOWN && abdL < THRESHOLD_DOWN) {
            repState = 'DOWN';
            repCount += 1;
            output.trigger = true;
            output.message = `[EVENT] Abduction Rep ${repCount} Completed. Good form.`;
            output.feedbackStatus = 'success';
        }

        // 3. Stats Update
        const newHistory = [...angleHistory];
        if (currentStats.frameCount % 5 === 0) {
            newHistory.push(parseFloat(avgAbduction.toFixed(1)));
            if (newHistory.length > 200) newHistory.shift();
        }

        output.statsUpdate = {
            repState,
            repCount,
            minRightElbowAngle: Math.min(minRightElbowAngle, avgAbduction),
            maxRightElbowAngle: Math.max(maxRightElbowAngle, avgAbduction),
            angleHistory: newHistory,
            currentAbduction: avgAbduction,
            currentLean: leanAngle,
            // [DEBUG] Expose to UI
            universalVariables: {
                'Right Arm': parseFloat(abdR.toFixed(1)),
                'Left Arm': parseFloat(abdL.toFixed(1)),
                'Avg Abduction': parseFloat(avgAbduction.toFixed(1)),
                'Torso Lean': parseFloat(leanAngle.toFixed(1)),
                'Rep State': repState === 'UP' ? 1 : 0
            }
        };

        return output;
    }
}
