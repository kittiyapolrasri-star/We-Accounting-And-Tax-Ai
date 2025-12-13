/**
 * Monitoring Service - Client-side error tracking and performance monitoring
 */

export interface ErrorLog {
  timestamp: string;
  type: 'error' | 'warning' | 'info';
  message: string;
  stack?: string;
  context?: Record<string, unknown>;
  userId?: string;
  url: string;
  userAgent: string;
}

export interface PerformanceMetric {
  name: string;
  value: number;
  unit: 'ms' | 'bytes' | 'count';
  timestamp: string;
  context?: Record<string, unknown>;
}

// In-memory buffer for batching logs
let errorBuffer: ErrorLog[] = [];
let metricsBuffer: PerformanceMetric[] = [];
const BUFFER_FLUSH_INTERVAL = 30000; // 30 seconds
const MAX_BUFFER_SIZE = 50;

// API endpoint for sending logs (Cloud Functions)
const getLoggingEndpoint = () => {
  const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID;
  if (!projectId) return null;
  return `https://asia-southeast1-${projectId}.cloudfunctions.net/api`;
};

/**
 * Initialize monitoring - set up global error handlers
 */
export const initMonitoring = () => {
  // Global error handler
  window.onerror = (message, source, lineno, colno, error) => {
    logError({
      type: 'error',
      message: String(message),
      stack: error?.stack,
      context: {
        source,
        lineno,
        colno,
      },
    });
    return false;
  };

  // Unhandled promise rejection handler
  window.addEventListener('unhandledrejection', (event) => {
    logError({
      type: 'error',
      message: `Unhandled Promise Rejection: ${event.reason}`,
      stack: event.reason?.stack,
      context: {
        type: 'unhandledrejection',
      },
    });
  });

  // Performance observer for long tasks
  if ('PerformanceObserver' in window) {
    try {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.duration > 100) {
            logMetric({
              name: 'long_task',
              value: entry.duration,
              unit: 'ms',
              context: {
                entryType: entry.entryType,
                name: entry.name,
              },
            });
          }
        }
      });
      observer.observe({ entryTypes: ['longtask'] });
    } catch (e) {
      // Long task observer not supported
    }
  }

  // Set up periodic buffer flush
  setInterval(flushBuffers, BUFFER_FLUSH_INTERVAL);

  // Flush on page unload
  window.addEventListener('beforeunload', () => {
    flushBuffers();
  });

  console.log('Monitoring initialized');
};

/**
 * Log an error
 */
export const logError = (options: {
  type: 'error' | 'warning' | 'info';
  message: string;
  stack?: string;
  context?: Record<string, unknown>;
}) => {
  const errorLog: ErrorLog = {
    timestamp: new Date().toISOString(),
    type: options.type,
    message: options.message,
    stack: options.stack,
    context: options.context,
    userId: getCurrentUserId(),
    url: window.location.href,
    userAgent: navigator.userAgent,
  };

  errorBuffer.push(errorLog);

  // Console log for development
  if (import.meta.env.DEV) {
    console.log('[Monitor]', options.type.toUpperCase(), options.message, options.context);
  }

  // Flush immediately for errors
  if (options.type === 'error' || errorBuffer.length >= MAX_BUFFER_SIZE) {
    flushBuffers();
  }
};

/**
 * Log a performance metric
 */
export const logMetric = (options: {
  name: string;
  value: number;
  unit: 'ms' | 'bytes' | 'count';
  context?: Record<string, unknown>;
}) => {
  const metric: PerformanceMetric = {
    name: options.name,
    value: options.value,
    unit: options.unit,
    timestamp: new Date().toISOString(),
    context: options.context,
  };

  metricsBuffer.push(metric);

  if (metricsBuffer.length >= MAX_BUFFER_SIZE) {
    flushBuffers();
  }
};

/**
 * Track page load performance
 */
export const trackPageLoad = () => {
  if ('performance' in window) {
    const timing = performance.timing;
    const pageLoadTime = timing.loadEventEnd - timing.navigationStart;
    const domContentLoaded = timing.domContentLoadedEventEnd - timing.navigationStart;
    const firstPaint = performance.getEntriesByType('paint')
      .find(entry => entry.name === 'first-contentful-paint')?.startTime || 0;

    logMetric({
      name: 'page_load_time',
      value: pageLoadTime,
      unit: 'ms',
    });

    logMetric({
      name: 'dom_content_loaded',
      value: domContentLoaded,
      unit: 'ms',
    });

    if (firstPaint) {
      logMetric({
        name: 'first_contentful_paint',
        value: firstPaint,
        unit: 'ms',
      });
    }
  }
};

/**
 * Track API call performance
 */
export const trackApiCall = (
  endpoint: string,
  duration: number,
  success: boolean,
  statusCode?: number
) => {
  logMetric({
    name: 'api_call',
    value: duration,
    unit: 'ms',
    context: {
      endpoint,
      success,
      statusCode,
    },
  });

  if (!success) {
    logError({
      type: 'warning',
      message: `API call failed: ${endpoint}`,
      context: {
        statusCode,
        duration,
      },
    });
  }
};

/**
 * Track document analysis performance
 */
export const trackDocumentAnalysis = (
  filename: string,
  duration: number,
  success: boolean,
  confidence?: number
) => {
  logMetric({
    name: 'document_analysis',
    value: duration,
    unit: 'ms',
    context: {
      filename,
      success,
      confidence,
    },
  });
};

/**
 * Get current user ID from localStorage or session
 */
const getCurrentUserId = (): string | undefined => {
  try {
    // Try to get from Firebase auth state in localStorage
    const authData = localStorage.getItem('firebase:authUser');
    if (authData) {
      const parsed = JSON.parse(authData) as Record<string, { uid?: string }>;
      const firstValue = Object.values(parsed)[0];
      return firstValue?.uid;
    }
  } catch {
    // Ignore parsing errors
  }
  return undefined;
};

/**
 * Flush buffers to server
 */
const flushBuffers = async () => {
  const endpoint = getLoggingEndpoint();

  // If no endpoint, just clear buffers (development mode)
  if (!endpoint) {
    if (errorBuffer.length > 0 || metricsBuffer.length > 0) {
      console.log('[Monitor] Buffer flush (no endpoint):', {
        errors: errorBuffer.length,
        metrics: metricsBuffer.length,
      });
    }
    errorBuffer = [];
    metricsBuffer = [];
    return;
  }

  const errors = [...errorBuffer];
  const metrics = [...metricsBuffer];
  errorBuffer = [];
  metricsBuffer = [];

  if (errors.length === 0 && metrics.length === 0) {
    return;
  }

  try {
    await fetch(`${endpoint}/api/logs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        errors,
        metrics,
        clientVersion: '1.0.0',
      }),
      // Use keepalive for beforeunload
      keepalive: true,
    });
  } catch (error) {
    // Re-add to buffer if send failed (up to limit)
    if (errors.length + errorBuffer.length <= MAX_BUFFER_SIZE) {
      errorBuffer = [...errors, ...errorBuffer];
    }
    console.error('[Monitor] Failed to send logs:', error);
  }
};

/**
 * Create a wrapped function that tracks execution time
 */
export const withTiming = <T extends (...args: unknown[]) => Promise<unknown>>(
  name: string,
  fn: T
): T => {
  return (async (...args: unknown[]) => {
    const start = performance.now();
    try {
      const result = await fn(...args);
      const duration = performance.now() - start;
      logMetric({
        name: `fn_${name}`,
        value: duration,
        unit: 'ms',
        context: { success: true },
      });
      return result;
    } catch (error) {
      const duration = performance.now() - start;
      logMetric({
        name: `fn_${name}`,
        value: duration,
        unit: 'ms',
        context: { success: false },
      });
      throw error;
    }
  }) as T;
};

export default {
  initMonitoring,
  logError,
  logMetric,
  trackPageLoad,
  trackApiCall,
  trackDocumentAnalysis,
  withTiming,
};
