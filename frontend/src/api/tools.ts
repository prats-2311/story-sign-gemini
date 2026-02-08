import { apiClient } from './client';
// import type { ExerciseConfig } from '../types/Exercise'; // Removed (unused)

export const toolsApi = {
    generateExercise: (prompt: string, domain: 'BODY' | 'HAND' | 'FACE' = 'BODY') => {
        // Backend returns the content directly (ExerciseConfig)
        return apiClient<any>('/tools/generate-exercise', {
            method: 'POST',
            body: JSON.stringify({ prompt, domain }), 
        });
    }
};
