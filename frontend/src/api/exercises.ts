import { apiClient } from './client';
import type { ExerciseConfig } from '../types/Exercise';

export interface CustomExercise {
    id: string;
    name: string;
    domain: 'BODY' | 'HAND' | 'FACE';
    config: ExerciseConfig; // The JSON schema
    created_at: string;
}

export const exercisesApi = {
    create: (name: string, config: ExerciseConfig, domain: 'BODY' | 'HAND' | 'FACE' = 'BODY') => {
        return apiClient<{ id: string; status: string; exercise: CustomExercise }>('/exercises/custom', {
            method: 'POST',
            body: JSON.stringify({ name, config, domain }),
        });
    },

    generate: (description: string) => {
        return apiClient<ExerciseConfig>('/exercises/generate', {
            method: 'POST',
            body: JSON.stringify({ description }),
        });
    },

    list: () => {
        return apiClient<CustomExercise[]>('/exercises/custom');
    },

    delete: (id: string) => {
        return apiClient<{ status: string; id: string }>(`/exercises/custom/${id}`, {
            method: 'DELETE',
        });
    }
};
