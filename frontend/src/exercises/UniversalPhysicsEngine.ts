
import type { PhysicsEngine, PhysicsOutput, UniversalSchema, MetricDef } from '../types/Exercise';
import { getVector, getVectorAngle } from '../utils/vectorMath';

// Landmark Mapping (Body)
const BODY_MAP: Record<string, number> = {
    'NOSE': 0, 'LEFT_EYE_INNER': 1, 'LEFT_EYE': 2, 'LEFT_EYE_OUTER': 3,
    'RIGHT_EYE_INNER': 4, 'RIGHT_EYE': 5, 'RIGHT_EYE_OUTER': 6,
    'LEFT_EAR': 7, 'RIGHT_EAR': 8, 'MOUTH_LEFT': 9, 'MOUTH_RIGHT': 10,
    'LEFT_SHOULDER': 11, 'RIGHT_SHOULDER': 12,
    'LEFT_ELBOW': 13, 'RIGHT_ELBOW': 14,
    'LEFT_WRIST': 15, 'RIGHT_WRIST': 16,
    'LEFT_PINKY': 17, 'RIGHT_PINKY': 18,
    'LEFT_INDEX': 19, 'RIGHT_INDEX': 20,
    'LEFT_THUMB': 21, 'RIGHT_THUMB': 22,
    'LEFT_HIP': 23, 'RIGHT_HIP': 24,
    'LEFT_KNEE': 25, 'RIGHT_KNEE': 26,
    'LEFT_ANKLE': 27, 'RIGHT_ANKLE': 28,
    'LEFT_HEEL': 29, 'RIGHT_HEEL': 30,
    'LEFT_FOOT_INDEX': 31, 'RIGHT_FOOT_INDEX': 32
};

export class UniversalPhysicsEngine implements PhysicsEngine {
    private schema: UniversalSchema;
    private currentStateIndex: number; 
    private lastRepTime: number = 0;

    constructor(schema: UniversalSchema) {
        this.schema = schema;
        this.currentStateIndex = 0; // Default to first state
    }

    private getPoint(landmarks: any, ref: string | number): { x: number, y: number, z: number } | null {
        let index = typeof ref === 'number' ? ref : BODY_MAP[ref];
        return landmarks[index] || null;
    }

    private computeMetric(landmarks: any, metric: MetricDef): number | null {
        const points = metric.points.map(p => this.getPoint(landmarks, p));
        if (points.some(p => !p)) return null;

        if (metric.type === 'ANGLE') {
            // 3 Points: A-B-C (Angle at B)
            if (points.length !== 3) return null;
            const [A, B, C] = points as any[];
            const vecBA = getVector(B, A);
            const vecBC = getVector(B, C);
            return getVectorAngle(vecBA, vecBC);
        }
        
        if (metric.type === 'VERTICAL_DIFF') {
             // A.y - B.y (Positive means separation in Y)
             if (points.length < 2) return null;
             const [A, B] = points as any[];
             return Math.abs(A.y - B.y); 
        }

        return null;
    }

    private lastStateChangeTime: number = 0;

    public calculate(landmarks: any, _currentStats: any, _calibration?: any): PhysicsOutput {
        const now = Date.now();
        const stage = this.schema.stages?.[this.currentStateIndex];
        
        // Safety Fallback if schema is malformed
        if (!stage) {
            return { 
                trigger: false, 
                message: "", 
                feedbackStatus: 'neutral', 
                statsUpdate: {} 
            };
        }

        // 1. Calculate Metrics
        const metrics: Record<string, number> = {};
        if (this.schema.metrics) {
            for (const [key, def] of Object.entries(this.schema.metrics)) {
                const val = this.computeMetric(landmarks, def as MetricDef);
                if (val !== null) metrics[key] = val;
            }
        }

        // 2. Check Conditions for Current Stage
        let allMet = true;
        if (stage.conditions) {
            for (const cond of stage.conditions) {
                const val = metrics[cond.metric];
                if (val === undefined) { allMet = false; continue; }

                let met = false;
                const tolerance = cond.tolerance || 0;
                
                if (cond.op === 'GT') met = val > cond.target;
                else if (cond.op === 'LT') met = val < cond.target;
                else if (cond.op === 'BETWEEN') met = val >= (cond.target - tolerance) && val <= (cond.target + tolerance);
                
                if (!met) allMet = false;
            }
        }

        // 3. State Transition
        let trigger = false;
        let message = "";
        let feedbackStatus: 'neutral' | 'success' | 'warning' = 'neutral';
        const updatedStats: any = { 
            currentStage: this.currentStateIndex,
            ...metrics 
        };

        if (allMet) {
            // Check Hold Time (Default 500ms debounce if not specified)
            const requiredHold = (stage.hold_time || 0.5) * 1000;
            
            if (now - this.lastStateChangeTime > requiredHold) {
                // Advance Stage
                if (this.currentStateIndex < (this.schema.stages?.length || 0) - 1) {
                    this.currentStateIndex++;
                    const nextStageName = this.schema.stages?.[this.currentStateIndex].name || "Next Stage";
                    message = `Good! Now ${nextStageName}`;
                    feedbackStatus = 'success';
                    trigger = true;
                    this.lastStateChangeTime = now;
                } else {
                    // Exercise Complete (Round Trip)
                    // [FIX] Min Rep Interval (Prevent Rapid Cycling/Double Counting)
                    if (now - this.lastRepTime > 1500) { // 1.5 seconds minimum per rep
                        const newCount = (_currentStats.repCount || 0) + 1;
                        
                        this.currentStateIndex = 0;
                        message = `Rep Complete! (Total: ${newCount})`;
                        feedbackStatus = 'success';
                        trigger = true;
                        
                        // Increment Rep Count
                        updatedStats.repCount = newCount;
                        this.lastRepTime = now;
                        this.lastStateChangeTime = now;
                    }
                }
            }
        } else {
            // Reset hold timer if conditions broken? 
            // Actually, we usually want to wait until conditions ARE met for X time.
            // For now, simple debounce is "Last Change was > X ago" AND "Conditions Met Now".
            // A better "Hold" implementation requires tracking "First Cond Met Time".
            // Implementation detail: Let's stick to simple State Debounce for now to fix rapid fire.
        }

        return {
            trigger,
            message,
            feedbackStatus,
            statsUpdate: updatedStats
        };
    }
}
