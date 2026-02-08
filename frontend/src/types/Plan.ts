import type { ExerciseType } from './Exercise';

export interface RoutineItem {
    exercise_id: ExerciseType;
    sets: number;
    target_reps: number;
    instructions: string;
    completed?: boolean;
}

export interface DailyPlan {
    day_id: string;
    reasoning: string;
    routine: RoutineItem[];
}
