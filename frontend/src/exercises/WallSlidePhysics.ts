import type { PhysicsEngine, PhysicsOutput } from '../types/Exercise';

export class WallSlidePhysics implements PhysicsEngine {
    calculate(landmarks: any, currentStats: any, _calibration?: any): PhysicsOutput {
        const output: PhysicsOutput = {
            trigger: false,
            message: "",
            feedbackStatus: 'neutral',
            statsUpdate: {}
        };

        const rightShoulder = landmarks[12];
        // const rightElbow = landmarks[14];
        const rightWrist = landmarks[16];
        const leftShoulder = landmarks[11];
        const leftWrist = landmarks[15];

        if (!rightShoulder || !rightWrist || !leftShoulder || !leftWrist) return output; // Needs both arms ideally

        // LOGIC: Wrists should be ABOVE Shoulders
        // Y-axis is inverted (0 is top). So Wrist Y < Shoulder Y means "Above".
        
        const rightHeight = rightShoulder.y - rightWrist.y; // Positive if wrist is above
        const leftHeight = leftShoulder.y - leftWrist.y;

        const avgHeight = (rightHeight + leftHeight) / 2;
        
        let { repState, repCount, angleHistory } = currentStats;

        // State Machine
        // DOWN: Hands near shoulder level (Height ~ 0 or slightly negative)
        // UP: Hands extended up (Height > 0.3)
        
        if (repState === 'DOWN' && avgHeight > 0.25) {
            repState = 'UP';
        } else if (repState === 'UP' && avgHeight < 0.05) {
            repState = 'DOWN';
            repCount += 1;
            output.trigger = true;
            output.message = `[EVENT] Wall Slide Rep ${repCount} Completed. Nice extension.`;
            output.feedbackStatus = 'success';
        }

        // Stats Update
        const newHistory = [...angleHistory];
        if (currentStats.frameCount % 5 === 0) {
            // Visualize "Height" as the metric instead of angle
            newHistory.push(parseFloat((avgHeight * 100).toFixed(1))); 
            if (newHistory.length > 200) newHistory.shift();
        }

        output.statsUpdate = {
            repState,
            repCount,
            angleHistory: newHistory
        };

        return output;
    }
}
