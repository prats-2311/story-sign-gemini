
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
             const [A, B] = points as any[];
             return Math.abs(A.y - B.y); 
        }

        return null;
    }

    private parseCondition(condition: string): { varName: string, operator: string, value: number } | null {
         const match = condition.match(/^([a-zA-Z0-9_]+)\s*(<|>|<=|>=)\s*([\d\.]+)/);
         if (!match) return null;
         return { varName: match[1], operator: match[2], value: parseFloat(match[3]) };
    }

    calculate(landmarks: any, currentStats: any, _calibration?: any): PhysicsOutput {
        const output: PhysicsOutput = {
            trigger: false,
            message: "",
            feedbackStatus: 'neutral',
            statsUpdate: {}
        };

        // 1. Compute Metrics
        const variables: Record<string, number> = {};
        for (const m of this.schema.metrics) {
            const val = this.computeMetric(landmarks, m);
            if (val !== null) variables[m.id] = val;
        }

        // 2. Evaluate Safety Rules
        for (const rule of this.schema.safety_rules || []) {
             if (rule.metric_id && variables[rule.metric_id] !== undefined) {
                 const parsed = this.parseCondition(rule.condition); 
                 // If condition is just "> 160", we assume variable is implicit rule.metric_id
                 // If condition contains var name, we use that.
                 
                 let met = false;
                 // Handle "Short Form" condition if metric_id is provided
                 if (!parsed && rule.metric_id) {
                      // fallback simple parse "> 50"
                      const simpleMatch = rule.condition.match(/^\s*(<|>)\s*([\d\.]+)/);
                      if (simpleMatch) {
                          const op = simpleMatch[1];
                          const val = parseFloat(simpleMatch[2]);
                          const currentVal = variables[rule.metric_id];
                          if (op === '>') met = currentVal > val;
                          if (op === '<') met = currentVal < val;
                      }
                 } else if (parsed) {
                     // Full form in condition string
                     const currentVal = variables[parsed.varName];
                     if (currentVal !== undefined) {
                         if (parsed.operator === '>') met = currentVal > parsed.value;
                         if (parsed.operator === '<') met = currentVal < parsed.value;
                     }
                 }

                 if (met) {
                     output.trigger = true;
                     output.message = `[SAFETY] ${rule.message}`;
                     output.feedbackStatus = 'critical';
                     return output; 
                 }
             }
        }

        // 3. State Machine Transition
        if (this.schema.states.length > 0) {
            // const currentState = this.schema.states[this.currentStateIndex]; // Unused
            const nextIndex = (this.currentStateIndex + 1) % this.schema.states.length;
            const nextState = this.schema.states[nextIndex];
            
            // Logic: We check if we satisfy the condition to ENTER the NEXT state
            // (Standard Finite State Machine transition logic)
            
            // Does next state have a condition?
            const conditionStr = nextState.condition; 
            const parsed = this.parseCondition(conditionStr);
            
            if (parsed) {
                const val = variables[parsed.varName];
                if (val !== undefined) {
                    let transitionMet = false;
                    if (parsed.operator === '>') transitionMet = val > parsed.value;
                    if (parsed.operator === '<') transitionMet = val < parsed.value;
                    
                    if (transitionMet) {
                        this.currentStateIndex = nextIndex;
                        
                        // Check for Rep Completion (Reset State Reached)
                        // Assuming Cycle: START -> MIDDLE -> START (Rep Trigger on return to START)
                        
                        const counting = this.schema.counting_logic;
                        if (counting) {
                            if (nextState.name === counting.trigger_state) {
                                // e.g. "MIDDLE" - halfway there
                            }
                            if (nextState.name === counting.reset_state) {
                                // "START" - completed loop
                                currentStats.repCount += 1;
                                output.trigger = true;
                                output.message = `[EVENT] Rep ${currentStats.repCount} Completed.`;
                                output.feedbackStatus = 'success';
                            }
                        } else {
                            // Default: If loop completes (Index 0)
                            if (nextIndex === 0 && currentStats.repCount !== undefined) {
                                currentStats.repCount += 1;
                                output.trigger = true;
                                output.message = `[EVENT] Rep ${currentStats.repCount} Completed.`;
                                output.feedbackStatus = 'success';
                            }
                        }
                    }
                }
            }
        }

        // Update Stats for Graphs
        output.statsUpdate = {
             ...currentStats,
             universalVariables: variables 
        };

        return output;
    }
}
