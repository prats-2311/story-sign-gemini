import type { PhysicsEngine, PhysicsOutput } from '../types/Exercise';


export class ExternalRotationPhysics implements PhysicsEngine {
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

        // LOGIC: Upper arm should be vertical (pinned to side), Forearm rotates OUT
        // We can track the Elbow angle, but specifically in the horizontal plane?
        // For 2D video, if the user turns slightly (Standing 45 deg), we see the angle clearly.
        // Assuming "Elbow Flexion" is constant ~90deg.
        // We track the angle of "Forearm Vector" relative to "Vertical".
        
        // Let's use simple Elbow Angle for now as a proxy, 
        // assuming the user keeps their elbow pinned.
        // Rotation OUT opens the angle in 2D view if viewed from front/side properly.
        
        // Actually, best metric for 2D Front View: Wrist X distance from Elbow X.
        const xDist = rightWrist.x - rightElbow.x; 
        
        let { repState, repCount, angleHistory } = currentStats;

        // State Machine
        // IN: Wrist X close to Elbow X
        // OUT: Wrist X far from Elbow X
        
        if (repState === 'DOWN' && xDist > 0.15) { // Moving Out
            repState = 'UP';
        } else if (repState === 'UP' && xDist < 0.05) { // Moving In
            repState = 'DOWN';
            repCount += 1;
            output.trigger = true;
            output.message = `[EVENT] Ext. Rotation Rep ${repCount} Completed.`;
            output.feedbackStatus = 'success';
        }

        // Stats Update
        const newHistory = [...angleHistory];
        if (currentStats.frameCount % 5 === 0) {
             // Normalized metric 0-100 based on X-distance
            newHistory.push(parseFloat((xDist * 500).toFixed(1))); 
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
