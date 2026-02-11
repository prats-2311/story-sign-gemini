import { useEffect, useRef } from 'react';

export function useMobileFeatures() {
    const wakeLockRef = useRef<any>(null);

    // Vibrate wrapper
    const vibrate = (pattern: number | number[]) => {
        if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
            navigator.vibrate(pattern);
        }
    };

    // Wake Lock
    const requestWakeLock = async () => {
        if ('wakeLock' in navigator) {
            try {
                wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
                console.log('Wake Lock is active');
                
                // Re-acquire lock if visibility changes (e.g. user tabs out and back)
                document.addEventListener('visibilitychange', handleVisibilityChange);
            } catch (err: any) {
                console.warn(`${err.name}, ${err.message}`);
            }
        }
    };

    const handleVisibilityChange = async () => {
        if (wakeLockRef.current !== null && document.visibilityState === 'visible') {
            await requestWakeLock();
        }
    };

    const releaseWakeLock = async () => {
        if (wakeLockRef.current) {
            await wakeLockRef.current.release();
            wakeLockRef.current = null;
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            console.log('Wake Lock released');
        }
    };

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            releaseWakeLock();
        };
    }, []);

    return { vibrate, requestWakeLock, releaseWakeLock };
}
