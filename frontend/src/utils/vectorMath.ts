export const getVector = (p1: any, p2: any) => ({ x: p2.x - p1.x, y: p2.y - p1.y });

export const getMagnitude = (v: any) => Math.sqrt(v.x * v.x + v.y * v.y);

export const getDotProduct = (v1: any, v2: any) => v1.x * v2.x + v1.y * v2.y;

export const getVectorAngle = (v1: any, v2: any) => {
    const dot = getDotProduct(v1, v2);
    const mag1 = getMagnitude(v1);
    const mag2 = getMagnitude(v2);
    if (mag1 === 0 || mag2 === 0) return 0;
    const val = Math.max(-1, Math.min(1, dot / (mag1 * mag2)));
    return Math.acos(val) * 180 / Math.PI;
};

// Simple 3-point angle (A-B-C)
export const calculateAngle = (a: any, b: any, c: any) => {
    const radians = Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
    let angle = Math.abs(radians * 180.0 / Math.PI);
    if (angle > 180.0) angle = 360 - angle;
    return angle;
};
