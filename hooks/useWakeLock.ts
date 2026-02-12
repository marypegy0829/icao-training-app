
import { useEffect, useRef, useCallback } from 'react';

export const useWakeLock = (enabled: boolean) => {
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  const requestLock = useCallback(async () => {
    if (!enabled) return;
    
    // Check if browser supports WakeLock
    if (!('wakeLock' in navigator)) {
        console.warn('Wake Lock API not supported in this browser.');
        return;
    }

    try {
      // If we already have a lock, don't request another one
      if (wakeLockRef.current && !wakeLockRef.current.released) {
          return;
      }

      const lock = await navigator.wakeLock.request('screen');
      wakeLockRef.current = lock;
      console.log('Screen Wake Lock acquired');

      lock.addEventListener('release', () => {
        console.log('Screen Wake Lock released');
      });
    } catch (err: any) {
      console.warn(`Failed to acquire Wake Lock: ${err.name}, ${err.message}`);
    }
  }, [enabled]);

  const releaseLock = useCallback(async () => {
    if (wakeLockRef.current) {
      try {
        await wakeLockRef.current.release();
        wakeLockRef.current = null;
      } catch (err: any) {
        console.warn(`Failed to release Wake Lock: ${err.name}`);
      }
    }
  }, []);

  useEffect(() => {
    // 1. Request lock if enabled
    if (enabled) {
      requestLock();
    } else {
      releaseLock();
    }

    // 2. Handle visibility change (Re-acquire lock if user switches tabs/apps)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && enabled) {
        requestLock();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    // 3. Cleanup on unmount or when disabled
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      releaseLock();
    };
  }, [enabled, requestLock, releaseLock]);
};
