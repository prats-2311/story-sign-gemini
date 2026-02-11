export type SessionDomain = "FACE" | "BODY" | "HAND";

export interface SessionMetrics {
    reps?: number;
    rom?: number;
    stability?: number;
    [key: string]: any;
}

export interface SessionLog {
    id: string; // UUID
    domain: SessionDomain;
    timestamp: string; // ISO8601
    title: string; // Exercise Name (e.g. "Happy" or "Elbow Flexion")
    status: "started" | "completed" | "abandoned";
    metrics: SessionMetrics;
    report_summary?: any; // Full JSON report or summary string
}
