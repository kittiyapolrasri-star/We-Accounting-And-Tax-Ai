/**
 * errorHandler.ts
 *
 * Comprehensive Error Handling Service with Thai Localization
 * Provides user-friendly error messages and error tracking
 */

// Error severity levels
export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';

// Error categories
export type ErrorCategory =
  | 'NETWORK'
  | 'VALIDATION'
  | 'AUTHENTICATION'
  | 'AUTHORIZATION'
  | 'DATABASE'
  | 'FILE'
  | 'CALCULATION'
  | 'INTEGRATION'
  | 'SYSTEM';

// Application error interface
export interface AppError {
  code: string;
  message: string;
  messageTh: string;
  category: ErrorCategory;
  severity: ErrorSeverity;
  recoverable: boolean;
  action?: string;
  actionTh?: string;
  details?: string;
  originalError?: Error;
}

// Error code definitions with Thai messages
const ERROR_DEFINITIONS: Record<string, Omit<AppError, 'code' | 'originalError' | 'details'>> = {
  // Network errors
  'NETWORK_OFFLINE': {
    message: 'No internet connection',
    messageTh: 'ไม่มีการเชื่อมต่ออินเทอร์เน็ต',
    category: 'NETWORK',
    severity: 'high',
    recoverable: true,
    action: 'Check your connection and try again',
    actionTh: 'กรุณาตรวจสอบการเชื่อมต่อและลองใหม่อีกครั้ง'
  },
  'NETWORK_TIMEOUT': {
    message: 'Request timed out',
    messageTh: 'การเชื่อมต่อหมดเวลา',
    category: 'NETWORK',
    severity: 'medium',
    recoverable: true,
    action: 'Please try again',
    actionTh: 'กรุณาลองใหม่อีกครั้ง'
  },
  'NETWORK_ERROR': {
    message: 'Network error occurred',
    messageTh: 'เกิดข้อผิดพลาดในการเชื่อมต่อ',
    category: 'NETWORK',
    severity: 'medium',
    recoverable: true,
    action: 'Please try again later',
    actionTh: 'กรุณาลองใหม่ภายหลัง'
  },

  // Validation errors
  'VALIDATION_REQUIRED': {
    message: 'Required field is missing',
    messageTh: 'กรุณากรอกข้อมูลที่จำเป็น',
    category: 'VALIDATION',
    severity: 'low',
    recoverable: true,
    action: 'Fill in the required field',
    actionTh: 'กรุณากรอกข้อมูลที่จำเป็น'
  },
  'VALIDATION_INVALID_FORMAT': {
    message: 'Invalid format',
    messageTh: 'รูปแบบข้อมูลไม่ถูกต้อง',
    category: 'VALIDATION',
    severity: 'low',
    recoverable: true,
    action: 'Check the format and try again',
    actionTh: 'กรุณาตรวจสอบรูปแบบข้อมูลและลองใหม่'
  },
  'VALIDATION_TAX_ID': {
    message: 'Invalid Tax ID format',
    messageTh: 'เลขประจำตัวผู้เสียภาษีไม่ถูกต้อง',
    category: 'VALIDATION',
    severity: 'low',
    recoverable: true,
    action: 'Tax ID must be 13 digits',
    actionTh: 'เลขประจำตัวผู้เสียภาษีต้องเป็นตัวเลข 13 หลัก'
  },
  'VALIDATION_GL_IMBALANCE': {
    message: 'GL entry is not balanced',
    messageTh: 'รายการบัญชีไม่สมดุล (เดบิต ≠ เครดิต)',
    category: 'VALIDATION',
    severity: 'high',
    recoverable: true,
    action: 'Ensure Debit equals Credit',
    actionTh: 'กรุณาตรวจสอบให้ยอดเดบิตเท่ากับยอดเครดิต'
  },
  'VALIDATION_PERIOD_LOCKED': {
    message: 'Accounting period is locked',
    messageTh: 'งวดบัญชีถูกปิดแล้ว',
    category: 'VALIDATION',
    severity: 'medium',
    recoverable: false,
    action: 'Contact admin to unlock the period',
    actionTh: 'กรุณาติดต่อผู้ดูแลระบบเพื่อเปิดงวดบัญชี'
  },
  'VALIDATION_DUPLICATE': {
    message: 'Duplicate entry detected',
    messageTh: 'พบข้อมูลซ้ำในระบบ',
    category: 'VALIDATION',
    severity: 'medium',
    recoverable: true,
    action: 'Check if entry already exists',
    actionTh: 'กรุณาตรวจสอบว่ามีข้อมูลนี้อยู่ในระบบแล้วหรือไม่'
  },

  // Authentication errors
  'AUTH_INVALID_CREDENTIALS': {
    message: 'Invalid email or password',
    messageTh: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง',
    category: 'AUTHENTICATION',
    severity: 'medium',
    recoverable: true,
    action: 'Check your credentials and try again',
    actionTh: 'กรุณาตรวจสอบอีเมลและรหัสผ่านแล้วลองใหม่'
  },
  'AUTH_SESSION_EXPIRED': {
    message: 'Your session has expired',
    messageTh: 'เซสชันหมดอายุ',
    category: 'AUTHENTICATION',
    severity: 'medium',
    recoverable: true,
    action: 'Please log in again',
    actionTh: 'กรุณาเข้าสู่ระบบใหม่'
  },
  'AUTH_ACCOUNT_DISABLED': {
    message: 'Your account has been disabled',
    messageTh: 'บัญชีของคุณถูกระงับ',
    category: 'AUTHENTICATION',
    severity: 'high',
    recoverable: false,
    action: 'Contact administrator',
    actionTh: 'กรุณาติดต่อผู้ดูแลระบบ'
  },

  // Authorization errors
  'AUTHZ_PERMISSION_DENIED': {
    message: 'Permission denied',
    messageTh: 'ไม่มีสิทธิ์ในการดำเนินการ',
    category: 'AUTHORIZATION',
    severity: 'medium',
    recoverable: false,
    action: 'Contact your manager for access',
    actionTh: 'กรุณาติดต่อผู้จัดการเพื่อขอสิทธิ์'
  },
  'AUTHZ_CLIENT_ACCESS_DENIED': {
    message: 'You are not assigned to this client',
    messageTh: 'คุณไม่ได้รับมอบหมายให้ดูแลลูกค้ารายนี้',
    category: 'AUTHORIZATION',
    severity: 'medium',
    recoverable: false,
    action: 'Request access from manager',
    actionTh: 'กรุณาขอสิทธิ์จากผู้จัดการ'
  },

  // Database errors
  'DB_CONNECTION_FAILED': {
    message: 'Database connection failed',
    messageTh: 'ไม่สามารถเชื่อมต่อฐานข้อมูลได้',
    category: 'DATABASE',
    severity: 'critical',
    recoverable: true,
    action: 'Please try again later',
    actionTh: 'กรุณาลองใหม่ภายหลัง'
  },
  'DB_SAVE_FAILED': {
    message: 'Failed to save data',
    messageTh: 'ไม่สามารถบันทึกข้อมูลได้',
    category: 'DATABASE',
    severity: 'high',
    recoverable: true,
    action: 'Please try again',
    actionTh: 'กรุณาลองใหม่อีกครั้ง'
  },
  'DB_NOT_FOUND': {
    message: 'Record not found',
    messageTh: 'ไม่พบข้อมูลที่ต้องการ',
    category: 'DATABASE',
    severity: 'medium',
    recoverable: false,
    action: 'The data may have been deleted',
    actionTh: 'ข้อมูลอาจถูกลบไปแล้ว'
  },

  // File errors
  'FILE_TOO_LARGE': {
    message: 'File size exceeds limit',
    messageTh: 'ไฟล์มีขนาดใหญ่เกินไป',
    category: 'FILE',
    severity: 'low',
    recoverable: true,
    action: 'Maximum file size is 10MB',
    actionTh: 'ขนาดไฟล์ต้องไม่เกิน 10MB'
  },
  'FILE_INVALID_TYPE': {
    message: 'Invalid file type',
    messageTh: 'ประเภทไฟล์ไม่ถูกต้อง',
    category: 'FILE',
    severity: 'low',
    recoverable: true,
    action: 'Supported formats: PDF, JPG, PNG',
    actionTh: 'รองรับไฟล์: PDF, JPG, PNG'
  },
  'FILE_UPLOAD_FAILED': {
    message: 'File upload failed',
    messageTh: 'ไม่สามารถอัพโหลดไฟล์ได้',
    category: 'FILE',
    severity: 'medium',
    recoverable: true,
    action: 'Please try again',
    actionTh: 'กรุณาลองใหม่อีกครั้ง'
  },

  // Calculation errors
  'CALC_DIVISION_BY_ZERO': {
    message: 'Division by zero error',
    messageTh: 'เกิดข้อผิดพลาดในการคำนวณ (หารด้วยศูนย์)',
    category: 'CALCULATION',
    severity: 'high',
    recoverable: false,
    action: 'Check input values',
    actionTh: 'กรุณาตรวจสอบค่าที่ใส่'
  },
  'CALC_OVERFLOW': {
    message: 'Number overflow',
    messageTh: 'ตัวเลขเกินขีดจำกัด',
    category: 'CALCULATION',
    severity: 'high',
    recoverable: false,
    action: 'Value exceeds maximum limit',
    actionTh: 'ค่าเกินขีดจำกัดสูงสุด'
  },

  // Integration errors
  'INT_AI_UNAVAILABLE': {
    message: 'AI service is unavailable',
    messageTh: 'ระบบ AI ไม่พร้อมใช้งาน',
    category: 'INTEGRATION',
    severity: 'high',
    recoverable: true,
    action: 'Please try again later',
    actionTh: 'กรุณาลองใหม่ภายหลัง'
  },
  'INT_EFILING_ERROR': {
    message: 'E-filing service error',
    messageTh: 'เกิดข้อผิดพลาดในการยื่นภาษีออนไลน์',
    category: 'INTEGRATION',
    severity: 'high',
    recoverable: true,
    action: 'Check Revenue Department website status',
    actionTh: 'กรุณาตรวจสอบสถานะเว็บไซต์กรมสรรพากร'
  },

  // System errors
  'SYS_UNEXPECTED': {
    message: 'An unexpected error occurred',
    messageTh: 'เกิดข้อผิดพลาดที่ไม่คาดคิด',
    category: 'SYSTEM',
    severity: 'high',
    recoverable: true,
    action: 'Please refresh and try again',
    actionTh: 'กรุณารีเฟรชหน้าและลองใหม่'
  },
  'SYS_MAINTENANCE': {
    message: 'System is under maintenance',
    messageTh: 'ระบบอยู่ระหว่างการปรับปรุง',
    category: 'SYSTEM',
    severity: 'high',
    recoverable: false,
    action: 'Please try again later',
    actionTh: 'กรุณาลองใหม่ภายหลัง'
  }
};

/**
 * Create an AppError from error code
 */
export const createError = (code: string, details?: string, originalError?: Error): AppError => {
  const definition = ERROR_DEFINITIONS[code];

  if (definition) {
    return {
      code,
      ...definition,
      details,
      originalError
    };
  }

  // Default error for unknown codes
  return {
    code,
    message: 'An error occurred',
    messageTh: 'เกิดข้อผิดพลาด',
    category: 'SYSTEM',
    severity: 'medium',
    recoverable: true,
    action: 'Please try again',
    actionTh: 'กรุณาลองใหม่',
    details,
    originalError
  };
};

/**
 * Parse JavaScript Error to AppError
 */
export const parseError = (error: unknown): AppError => {
  // Already an AppError
  if (error && typeof error === 'object' && 'code' in error && 'messageTh' in error) {
    return error as AppError;
  }

  // Network errors
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return createError('NETWORK_ERROR', error.message, error);
  }

  // Firebase errors
  if (error && typeof error === 'object' && 'code' in error) {
    const firebaseError = error as { code: string; message: string };

    if (firebaseError.code === 'auth/user-not-found' || firebaseError.code === 'auth/wrong-password') {
      return createError('AUTH_INVALID_CREDENTIALS', firebaseError.message);
    }
    if (firebaseError.code === 'auth/user-disabled') {
      return createError('AUTH_ACCOUNT_DISABLED', firebaseError.message);
    }
    if (firebaseError.code === 'permission-denied') {
      return createError('AUTHZ_PERMISSION_DENIED', firebaseError.message);
    }
  }

  // Generic Error
  if (error instanceof Error) {
    return createError('SYS_UNEXPECTED', error.message, error);
  }

  // Unknown error type
  return createError('SYS_UNEXPECTED', String(error));
};

/**
 * Get user-friendly error message
 */
export const getErrorMessage = (error: AppError, language: 'en' | 'th' = 'th'): string => {
  return language === 'th' ? error.messageTh : error.message;
};

/**
 * Get action suggestion for error
 */
export const getErrorAction = (error: AppError, language: 'en' | 'th' = 'th'): string | undefined => {
  return language === 'th' ? error.actionTh : error.action;
};

/**
 * Check if error is recoverable
 */
export const isRecoverable = (error: AppError): boolean => {
  return error.recoverable;
};

/**
 * Log error for tracking (could be sent to monitoring service)
 */
export const logError = (error: AppError, context?: Record<string, unknown>): void => {
  console.error('[AppError]', {
    code: error.code,
    message: error.message,
    category: error.category,
    severity: error.severity,
    details: error.details,
    context,
    timestamp: new Date().toISOString()
  });

  // TODO: Send to error monitoring service (e.g., Sentry)
};

/**
 * Error toast helper for showing notifications
 */
export const errorToast = (error: AppError): { title: string; description: string; type: 'error' | 'warning' } => {
  return {
    title: error.messageTh,
    description: error.actionTh || '',
    type: error.severity === 'low' ? 'warning' : 'error'
  };
};

export default {
  createError,
  parseError,
  getErrorMessage,
  getErrorAction,
  isRecoverable,
  logError,
  errorToast,
  ERROR_DEFINITIONS
};
