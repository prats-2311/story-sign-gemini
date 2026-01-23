export type ExerciseType = 'abduction' | 'bicep_curl' | 'wall_slide' | 'rotation';

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
