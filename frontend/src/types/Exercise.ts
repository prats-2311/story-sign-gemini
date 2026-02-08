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

export interface StageDef {
    name: string;
    description?: string;
    conditions: {
        metric: string;
        op: 'GT' | 'LT' | 'BETWEEN';
        target: number;
        tolerance?: number;
    }[];
    hold_time?: number;
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
    metrics: Record<string, MetricDef>; // Changed to Record for ID lookup
    stages: StageDef[];
    safety_rules?: SafetyRule[];
    counting_logic?: {
        trigger_state: string;
        reset_state: string;
    };
}
