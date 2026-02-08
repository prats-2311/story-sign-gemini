import { apiClient } from './client';

export interface ReportResult {
    report_markdown: string;
    chart_config?: any;
    clinical_notes?: string[];
    transcript?: string;
    thoughts?: string;
}

export interface SessionHistoryItem {
   id: number;
   timestamp: string;
   transcript: string;
   clinical_notes: string[];
   report_json: ReportResult;
}

export interface DailyPlan {
    date: string;
    routine: Array<{
        exercise_id: string; 
        reason: string;
        sets: number;
        reps: number;
        completed: boolean;
    }>;
    focus_area: string;
}

export const sessionApi = {
    start: (sessionId: string, exerciseId: string) => {
        return apiClient<{ status: string }>('/session/start', {
            method: 'POST',
            body: JSON.stringify({ session_id: sessionId, exercise_id: exerciseId }),
        });
    },

    sendChunk: (sessionId: string, chunkData: any) => {
        return apiClient<{ status: string }>('/session/chunk', {
            method: 'POST',
            body: JSON.stringify({ session_id: sessionId, ...chunkData }),
        });
    },

    end: (sessionId: string) => {
        return apiClient<ReportResult>('/session/end', {
            method: 'POST',
            body: JSON.stringify({ session_id: sessionId }),
        });
    },

    getHistory: () => {
        return apiClient<SessionHistoryItem[]>('/history');
    },
    
    analyze: (data: any) => {
        return apiClient<ReportResult>('/analyze_session', {
             method: 'POST',
             body: JSON.stringify(data)
        });
    },

    getDailyPlan: () => {
        return apiClient<DailyPlan>('/plan/daily');
    },

    completeExercise: (exerciseIndex: number) => {
        return apiClient<{ status: string }>('/plan/complete', {
            method: 'POST',
            body: JSON.stringify({ exercise_index: exerciseIndex })
        });
    }
};
