import { useEffect, useRef, useCallback } from 'react';

/**
 * Custom hook for setTimeout with automatic cleanup
 * Prevents memory leaks by clearing timeout on unmount
 */
export const useTimeout = (callback: () => void, delay: number | null) => {
  const savedCallback = useRef(callback);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Remember the latest callback
  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  // Set up the timeout
  useEffect(() => {
    if (delay === null) return;

    timeoutRef.current = setTimeout(() => {
      savedCallback.current();
    }, delay);

    // Cleanup on unmount or delay change
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [delay]);

  // Return function to clear timeout manually
  const clear = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  return clear;
};

/**
 * Custom hook for setInterval with automatic cleanup
 */
export const useInterval = (callback: () => void, delay: number | null) => {
  const savedCallback = useRef(callback);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  useEffect(() => {
    if (delay === null) return;

    intervalRef.current = setInterval(() => {
      savedCallback.current();
    }, delay);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [delay]);

  const clear = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  return clear;
};

/**
 * Custom hook for debounced value
 */
export const useDebounce = <T>(value: T, delay: number): T => {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
};

import { useState } from 'react';

/**
 * Custom hook for notification with auto-dismiss
 */
export const useNotification = (dismissDelay: number = 3000) => {
  const [notification, setNotification] = useState<{
    message: string;
    type: 'success' | 'error' | 'warning' | 'info';
  } | null>(null);

  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const showNotification = useCallback(
    (message: string, type: 'success' | 'error' | 'warning' | 'info' = 'success') => {
      // Clear existing timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      setNotification({ message, type });

      // Auto dismiss
      timeoutRef.current = setTimeout(() => {
        setNotification(null);
      }, dismissDelay);
    },
    [dismissDelay]
  );

  const hideNotification = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setNotification(null);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return { notification, showNotification, hideNotification };
};
