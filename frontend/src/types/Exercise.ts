export type ExerciseType = string; // Relaxed to support dynamic IDs

export interface PhysicsOutput {
    trigger: boolean;
    message: string;
    feedbackStatus: 'neutral' | 'success' | 'warning' | 'critical';
    statsUpdate: Partial<any>; // Flexible stats update
}

export interface CalibrationData {
    restingTorsoAngle: number;
    // Add more calibration points here as needed
}

export interface PhysicsEngine {
    calculate(landmarks: any, currentStats: any, calibration?: CalibrationData | null): PhysicsOutput;
}

export interface ExerciseConfig {
  id: ExerciseType;
  name: string;
  description: string;
  
  // The Rules
  targetRom: { min: number, max: number };
  
  // The Logic
  engine: PhysicsEngine;
  
  // Gemini Context
  systemPrompt: string; 
}

// --- UNIVERSAL ENGINE TYPES ---

export type MetricType = 'ANGLE' | 'DISTANCE' | 'VERTICAL_DIFF' | 'HORIZONTAL_DIFF';

export interface MetricDef {
    id: string;
    type: MetricType;
    points: (number | string)[]; // Landmark indices or names
}

export interface StateDef {
    name: string;
    condition: string; // e.g. "elbow_angle > 160"
    instruction?: string;
}

export interface SafetyRule {
    metric_id?: string;
    type: 'VELOCITY' | 'ANGLE';
    condition: string; // "> 2.0"
    message: string;
}

export interface UniversalSchema {
    name: string;
    description: string;
    domain: 'BODY' | 'HAND' | 'FACE' | 'HYBRID';
    metrics: MetricDef[];
    states: StateDef[];
    safety_rules: SafetyRule[];
    counting_logic?: {
        trigger_state: string;
        reset_state: string;
    };
}
