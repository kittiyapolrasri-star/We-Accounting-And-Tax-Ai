/**
 * auditTrail.ts
 *
 * Comprehensive Audit Trail System
 * Tracks all significant actions for compliance, accountability, and security
 * Required for Thai accounting firm operations and DBD compliance
 */

import { collection, addDoc, query, where, orderBy, getDocs, Timestamp, limit } from 'firebase/firestore';
import { db, isFirebaseConfigured } from './firebase';

// Audit action categories
export type AuditCategory =
  | 'AUTHENTICATION'
  | 'DOCUMENT'
  | 'GL_ENTRY'
  | 'CLIENT'
  | 'STAFF'
  | 'TAX'
  | 'REPORT'
  | 'SETTINGS'
  | 'DATA'
  | 'SECURITY';

// Specific audit actions
export type AuditAction =
  // Authentication
  | 'LOGIN'
  | 'LOGOUT'
  | 'LOGIN_FAILED'
  | 'PASSWORD_CHANGE'
  | 'SESSION_TIMEOUT'
  // Document actions
  | 'DOCUMENT_UPLOAD'
  | 'DOCUMENT_VIEW'
  | 'DOCUMENT_EDIT'
  | 'DOCUMENT_DELETE'
  | 'DOCUMENT_APPROVE'
  | 'DOCUMENT_REJECT'
  | 'DOCUMENT_BATCH_APPROVE'
  // GL Entry actions
  | 'GL_POST'
  | 'GL_EDIT'
  | 'GL_DELETE'
  | 'GL_REVERSE'
  | 'GL_VALIDATION_FAIL'
  | 'PERIOD_CLOSE'
  | 'PERIOD_REOPEN'
  // Client actions
  | 'CLIENT_CREATE'
  | 'CLIENT_EDIT'
  | 'CLIENT_DELETE'
  | 'CLIENT_ARCHIVE'
  | 'CLIENT_ASSIGN_STAFF'
  // Staff actions
  | 'STAFF_CREATE'
  | 'STAFF_EDIT'
  | 'STAFF_DELETE'
  | 'STAFF_ROLE_CHANGE'
  | 'STAFF_DEACTIVATE'
  // Tax actions
  | 'TAX_PREPARE'
  | 'TAX_FILE'
  | 'TAX_GENERATE_CERTIFICATE'
  | 'VAT_RETURN_GENERATE'
  | 'WHT_CERTIFICATE_GENERATE'
  // Report actions
  | 'REPORT_GENERATE'
  | 'REPORT_EXPORT'
  | 'REPORT_PUBLISH'
  | 'REPORT_PRINT'
  // Settings actions
  | 'SETTINGS_CHANGE'
  | 'FIRM_PROFILE_UPDATE'
  // Data actions
  | 'BACKUP_CREATE'
  | 'BACKUP_RESTORE'
  | 'DATA_EXPORT'
  | 'DATA_IMPORT'
  // Security actions
  | 'PERMISSION_DENIED'
  | 'SUSPICIOUS_ACTIVITY'
  | 'RATE_LIMIT_EXCEEDED';

// Audit log entry
export interface AuditLogEntry {
  id?: string;
  timestamp: string;
  category: AuditCategory;
  action: AuditAction;
  userId: string;
  userName: string;
  userRole: string;
  clientId?: string;
  clientName?: string;
  resourceType?: string;
  resourceId?: string;
  resourceName?: string;
  details: string;
  detailsTh: string;
  oldValue?: string;
  newValue?: string;
  ipAddress?: string;
  userAgent?: string;
  status: 'success' | 'failure' | 'warning';
  metadata?: Record<string, unknown>;
}

// Audit query filters
export interface AuditQueryFilters {
  startDate?: string;
  endDate?: string;
  category?: AuditCategory;
  action?: AuditAction;
  userId?: string;
  clientId?: string;
  status?: 'success' | 'failure' | 'warning';
  searchTerm?: string;
  limit?: number;
}

// Thai action names for display
const ACTION_NAMES_TH: Record<AuditAction, string> = {
  // Authentication
  LOGIN: 'เข้าสู่ระบบ',
  LOGOUT: 'ออกจากระบบ',
  LOGIN_FAILED: 'เข้าสู่ระบบล้มเหลว',
  PASSWORD_CHANGE: 'เปลี่ยนรหัสผ่าน',
  SESSION_TIMEOUT: 'หมดเวลา session',
  // Document
  DOCUMENT_UPLOAD: 'อัพโหลดเอกสาร',
  DOCUMENT_VIEW: 'ดูเอกสาร',
  DOCUMENT_EDIT: 'แก้ไขเอกสาร',
  DOCUMENT_DELETE: 'ลบเอกสาร',
  DOCUMENT_APPROVE: 'อนุมัติเอกสาร',
  DOCUMENT_REJECT: 'ปฏิเสธเอกสาร',
  DOCUMENT_BATCH_APPROVE: 'อนุมัติเอกสารแบบกลุ่ม',
  // GL Entry
  GL_POST: 'ลงบัญชี',
  GL_EDIT: 'แก้ไขรายการบัญชี',
  GL_DELETE: 'ลบรายการบัญชี',
  GL_REVERSE: 'กลับรายการบัญชี',
  GL_VALIDATION_FAIL: 'ตรวจสอบบัญชีไม่ผ่าน',
  PERIOD_CLOSE: 'ปิดงวดบัญชี',
  PERIOD_REOPEN: 'เปิดงวดบัญชีใหม่',
  // Client
  CLIENT_CREATE: 'สร้างลูกค้าใหม่',
  CLIENT_EDIT: 'แก้ไขข้อมูลลูกค้า',
  CLIENT_DELETE: 'ลบลูกค้า',
  CLIENT_ARCHIVE: 'เก็บถาวรลูกค้า',
  CLIENT_ASSIGN_STAFF: 'มอบหมายพนักงาน',
  // Staff
  STAFF_CREATE: 'สร้างพนักงานใหม่',
  STAFF_EDIT: 'แก้ไขข้อมูลพนักงาน',
  STAFF_DELETE: 'ลบพนักงาน',
  STAFF_ROLE_CHANGE: 'เปลี่ยนสิทธิ์พนักงาน',
  STAFF_DEACTIVATE: 'ปิดการใช้งานพนักงาน',
  // Tax
  TAX_PREPARE: 'เตรียมแบบภาษี',
  TAX_FILE: 'ยื่นภาษี',
  TAX_GENERATE_CERTIFICATE: 'ออกหนังสือรับรอง',
  VAT_RETURN_GENERATE: 'สร้างแบบ ภ.พ.30',
  WHT_CERTIFICATE_GENERATE: 'สร้างหนังสือหัก ณ ที่จ่าย',
  // Report
  REPORT_GENERATE: 'สร้างรายงาน',
  REPORT_EXPORT: 'ส่งออกรายงาน',
  REPORT_PUBLISH: 'เผยแพร่รายงาน',
  REPORT_PRINT: 'พิมพ์รายงาน',
  // Settings
  SETTINGS_CHANGE: 'เปลี่ยนการตั้งค่า',
  FIRM_PROFILE_UPDATE: 'แก้ไขข้อมูลสำนักงาน',
  // Data
  BACKUP_CREATE: 'สำรองข้อมูล',
  BACKUP_RESTORE: 'กู้คืนข้อมูล',
  DATA_EXPORT: 'ส่งออกข้อมูล',
  DATA_IMPORT: 'นำเข้าข้อมูล',
  // Security
  PERMISSION_DENIED: 'ถูกปฏิเสธสิทธิ์',
  SUSPICIOUS_ACTIVITY: 'กิจกรรมน่าสงสัย',
  RATE_LIMIT_EXCEEDED: 'เกินจำนวนครั้งที่อนุญาต'
};

// Category names in Thai
const CATEGORY_NAMES_TH: Record<AuditCategory, string> = {
  AUTHENTICATION: 'การยืนยันตัวตน',
  DOCUMENT: 'เอกสาร',
  GL_ENTRY: 'รายการบัญชี',
  CLIENT: 'ลูกค้า',
  STAFF: 'พนักงาน',
  TAX: 'ภาษี',
  REPORT: 'รายงาน',
  SETTINGS: 'การตั้งค่า',
  DATA: 'ข้อมูล',
  SECURITY: 'ความปลอดภัย'
};

// In-memory storage for non-Firebase mode
const inMemoryAuditLogs: AuditLogEntry[] = [];

/**
 * Log an audit event
 */
export const logAuditEvent = async (entry: Omit<AuditLogEntry, 'id' | 'timestamp'>): Promise<string> => {
  const fullEntry: AuditLogEntry = {
    ...entry,
    timestamp: new Date().toISOString(),
    detailsTh: entry.detailsTh || ACTION_NAMES_TH[entry.action] || entry.details
  };

  // Try to save to Firebase
  if (isFirebaseConfigured && db) {
    try {
      const docRef = await addDoc(collection(db, 'audit_logs'), {
        ...fullEntry,
        timestamp: Timestamp.now()
      });
      return docRef.id;
    } catch (error) {
      console.error('Error saving audit log to Firebase:', error);
    }
  }

  // Fallback to in-memory storage
  const id = `AUDIT-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  fullEntry.id = id;
  inMemoryAuditLogs.unshift(fullEntry);

  // Keep only last 10000 entries in memory
  if (inMemoryAuditLogs.length > 10000) {
    inMemoryAuditLogs.pop();
  }

  return id;
};

/**
 * Query audit logs with filters
 */
export const queryAuditLogs = async (filters: AuditQueryFilters): Promise<AuditLogEntry[]> => {
  // Try Firebase first
  if (isFirebaseConfigured && db) {
    try {
      let q = query(
        collection(db, 'audit_logs'),
        orderBy('timestamp', 'desc'),
        limit(filters.limit || 100)
      );

      if (filters.category) {
        q = query(q, where('category', '==', filters.category));
      }
      if (filters.action) {
        q = query(q, where('action', '==', filters.action));
      }
      if (filters.userId) {
        q = query(q, where('userId', '==', filters.userId));
      }
      if (filters.clientId) {
        q = query(q, where('clientId', '==', filters.clientId));
      }
      if (filters.status) {
        q = query(q, where('status', '==', filters.status));
      }

      const snapshot = await getDocs(q);
      const logs: AuditLogEntry[] = [];

      snapshot.forEach(doc => {
        const data = doc.data();
        logs.push({
          id: doc.id,
          ...data,
          timestamp: data.timestamp?.toDate?.()?.toISOString() || data.timestamp
        } as AuditLogEntry);
      });

      // Apply date and search filters client-side
      return logs.filter(log => {
        if (filters.startDate && log.timestamp < filters.startDate) return false;
        if (filters.endDate && log.timestamp > filters.endDate) return false;
        if (filters.searchTerm) {
          const searchLower = filters.searchTerm.toLowerCase();
          return (
            log.details.toLowerCase().includes(searchLower) ||
            log.detailsTh.toLowerCase().includes(searchLower) ||
            log.userName.toLowerCase().includes(searchLower) ||
            (log.clientName?.toLowerCase().includes(searchLower) ?? false)
          );
        }
        return true;
      });
    } catch (error) {
      console.error('Error querying audit logs from Firebase:', error);
    }
  }

  // Fallback to in-memory
  let logs = [...inMemoryAuditLogs];

  if (filters.category) {
    logs = logs.filter(log => log.category === filters.category);
  }
  if (filters.action) {
    logs = logs.filter(log => log.action === filters.action);
  }
  if (filters.userId) {
    logs = logs.filter(log => log.userId === filters.userId);
  }
  if (filters.clientId) {
    logs = logs.filter(log => log.clientId === filters.clientId);
  }
  if (filters.status) {
    logs = logs.filter(log => log.status === filters.status);
  }
  if (filters.startDate) {
    logs = logs.filter(log => log.timestamp >= filters.startDate!);
  }
  if (filters.endDate) {
    logs = logs.filter(log => log.timestamp <= filters.endDate!);
  }
  if (filters.searchTerm) {
    const searchLower = filters.searchTerm.toLowerCase();
    logs = logs.filter(log =>
      log.details.toLowerCase().includes(searchLower) ||
      log.detailsTh.toLowerCase().includes(searchLower) ||
      log.userName.toLowerCase().includes(searchLower) ||
      (log.clientName?.toLowerCase().includes(searchLower) ?? false)
    );
  }

  return logs.slice(0, filters.limit || 100);
};

/**
 * Get audit statistics for dashboard
 */
export const getAuditStatistics = async (
  startDate: string,
  endDate: string
): Promise<{
  totalActions: number;
  byCategory: Record<AuditCategory, number>;
  byStatus: Record<string, number>;
  topUsers: { userId: string; userName: string; count: number }[];
  securityAlerts: number;
}> => {
  const logs = await queryAuditLogs({ startDate, endDate, limit: 10000 });

  const byCategory: Record<string, number> = {};
  const byStatus: Record<string, number> = { success: 0, failure: 0, warning: 0 };
  const userCounts: Record<string, { userName: string; count: number }> = {};
  let securityAlerts = 0;

  logs.forEach(log => {
    // Count by category
    byCategory[log.category] = (byCategory[log.category] || 0) + 1;

    // Count by status
    byStatus[log.status] = (byStatus[log.status] || 0) + 1;

    // Count by user
    if (!userCounts[log.userId]) {
      userCounts[log.userId] = { userName: log.userName, count: 0 };
    }
    userCounts[log.userId].count++;

    // Count security alerts
    if (log.category === 'SECURITY' || log.status === 'failure') {
      securityAlerts++;
    }
  });

  // Get top 10 users
  const topUsers = Object.entries(userCounts)
    .map(([userId, data]) => ({ userId, ...data }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return {
    totalActions: logs.length,
    byCategory: byCategory as Record<AuditCategory, number>,
    byStatus,
    topUsers,
    securityAlerts
  };
};

/**
 * Export audit logs to CSV
 */
export const exportAuditLogsToCSV = (logs: AuditLogEntry[]): string => {
  const headers = [
    'Timestamp',
    'Category',
    'Action',
    'User',
    'Client',
    'Details',
    'Status',
    'Resource Type',
    'Resource ID'
  ];

  const rows = logs.map(log => [
    log.timestamp,
    CATEGORY_NAMES_TH[log.category],
    ACTION_NAMES_TH[log.action],
    log.userName,
    log.clientName || '-',
    log.detailsTh,
    log.status === 'success' ? 'สำเร็จ' : log.status === 'failure' ? 'ล้มเหลว' : 'เตือน',
    log.resourceType || '-',
    log.resourceId || '-'
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
  ].join('\n');

  // Add BOM for Excel Thai support
  return '\uFEFF' + csvContent;
};

/**
 * Helper function to create common audit entries
 */
export const auditHelpers = {
  // Authentication
  logLogin: (userId: string, userName: string, userRole: string, success: boolean) =>
    logAuditEvent({
      category: 'AUTHENTICATION',
      action: success ? 'LOGIN' : 'LOGIN_FAILED',
      userId,
      userName,
      userRole,
      details: success ? `User ${userName} logged in` : `Failed login attempt for ${userName}`,
      detailsTh: success ? `${userName} เข้าสู่ระบบ` : `${userName} เข้าสู่ระบบล้มเหลว`,
      status: success ? 'success' : 'failure'
    }),

  logLogout: (userId: string, userName: string, userRole: string) =>
    logAuditEvent({
      category: 'AUTHENTICATION',
      action: 'LOGOUT',
      userId,
      userName,
      userRole,
      details: `User ${userName} logged out`,
      detailsTh: `${userName} ออกจากระบบ`,
      status: 'success'
    }),

  // Document
  logDocumentAction: (
    action: 'DOCUMENT_UPLOAD' | 'DOCUMENT_VIEW' | 'DOCUMENT_EDIT' | 'DOCUMENT_DELETE' | 'DOCUMENT_APPROVE' | 'DOCUMENT_REJECT',
    userId: string,
    userName: string,
    userRole: string,
    docId: string,
    docName: string,
    clientId?: string,
    clientName?: string
  ) =>
    logAuditEvent({
      category: 'DOCUMENT',
      action,
      userId,
      userName,
      userRole,
      clientId,
      clientName,
      resourceType: 'document',
      resourceId: docId,
      resourceName: docName,
      details: `${ACTION_NAMES_TH[action]}: ${docName}`,
      detailsTh: `${ACTION_NAMES_TH[action]}: ${docName}`,
      status: 'success'
    }),

  // GL Entry
  logGLPost: (
    userId: string,
    userName: string,
    userRole: string,
    entryCount: number,
    totalDebit: number,
    clientId: string,
    clientName: string
  ) =>
    logAuditEvent({
      category: 'GL_ENTRY',
      action: 'GL_POST',
      userId,
      userName,
      userRole,
      clientId,
      clientName,
      details: `Posted ${entryCount} GL entries, total debit: ${totalDebit}`,
      detailsTh: `ลงบัญชี ${entryCount} รายการ ยอดเดบิตรวม ${totalDebit.toLocaleString()} บาท`,
      status: 'success',
      metadata: { entryCount, totalDebit }
    }),

  logGLValidationFail: (
    userId: string,
    userName: string,
    userRole: string,
    reason: string,
    clientId: string,
    clientName: string
  ) =>
    logAuditEvent({
      category: 'GL_ENTRY',
      action: 'GL_VALIDATION_FAIL',
      userId,
      userName,
      userRole,
      clientId,
      clientName,
      details: `GL validation failed: ${reason}`,
      detailsTh: `ตรวจสอบบัญชีไม่ผ่าน: ${reason}`,
      status: 'failure'
    }),

  // Tax
  logTaxAction: (
    action: 'TAX_PREPARE' | 'TAX_FILE' | 'VAT_RETURN_GENERATE' | 'WHT_CERTIFICATE_GENERATE',
    userId: string,
    userName: string,
    userRole: string,
    taxType: string,
    period: string,
    clientId: string,
    clientName: string
  ) =>
    logAuditEvent({
      category: 'TAX',
      action,
      userId,
      userName,
      userRole,
      clientId,
      clientName,
      details: `${ACTION_NAMES_TH[action]}: ${taxType} for ${period}`,
      detailsTh: `${ACTION_NAMES_TH[action]}: ${taxType} งวด ${period}`,
      status: 'success',
      metadata: { taxType, period }
    }),

  // Security
  logPermissionDenied: (
    userId: string,
    userName: string,
    userRole: string,
    permission: string,
    resourceType?: string,
    resourceId?: string
  ) =>
    logAuditEvent({
      category: 'SECURITY',
      action: 'PERMISSION_DENIED',
      userId,
      userName,
      userRole,
      resourceType,
      resourceId,
      details: `Permission denied: ${permission}`,
      detailsTh: `ถูกปฏิเสธสิทธิ์: ${permission}`,
      status: 'warning'
    })
};

export default {
  logAuditEvent,
  queryAuditLogs,
  getAuditStatistics,
  exportAuditLogsToCSV,
  auditHelpers,
  ACTION_NAMES_TH,
  CATEGORY_NAMES_TH
};
