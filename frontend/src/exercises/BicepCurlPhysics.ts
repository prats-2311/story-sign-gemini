import type { PhysicsEngine, PhysicsOutput } from '../types/Exercise';
import { calculateAngle } from '../utils/vectorMath';

export class BicepCurlPhysics implements PhysicsEngine {
    calculate(landmarks: any, currentStats: any, _calibration?: any): PhysicsOutput {
        const output: PhysicsOutput = {
            trigger: false,
            message: "",
            feedbackStatus: 'neutral',
            statsUpdate: {}
        };

        const rightShoulder = landmarks[12];
        const rightElbow = landmarks[14];
        const rightWrist = landmarks[16];

        if (!rightShoulder || !rightElbow || !rightWrist) return output;

        // BICEP Logic (Elbow Angle)
        const angle = calculateAngle(rightShoulder, rightElbow, rightWrist);
        let { repState, repCount, minRightElbowAngle, maxRightElbowAngle, angleHistory } = currentStats;

        // State Machine
        if (repState === 'DOWN' && angle < 50) {
            repState = 'UP';
        } else if (repState === 'UP' && angle > 165) {
            repState = 'DOWN';
            repCount += 1;
            output.trigger = true;
            output.message = `[EVENT] Bicep Curl ${repCount} Completed.`;
            output.feedbackStatus = 'success';
        }

        // Stats Update
        const newHistory = [...angleHistory];
        if (currentStats.frameCount % 5 === 0) {
            newHistory.push(parseFloat(angle.toFixed(1)));
            if (newHistory.length > 200) newHistory.shift();
        }

        output.statsUpdate = {
            repState,
            repCount,
            minRightElbowAngle: Math.min(minRightElbowAngle, angle),
            maxRightElbowAngle: Math.max(maxRightElbowAngle, angle),
            angleHistory: newHistory,
            // Pass through computed values for UI if needed
            currentAbduction: angle, // Reusing field name for graph simplicity, ideally rename to 'currentMetrics'
        };

        return output;
    }
}
