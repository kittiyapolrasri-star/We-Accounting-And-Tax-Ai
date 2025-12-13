/**
 * rbac.ts - Role-Based Access Control System
 *
 * Comprehensive RBAC for Thai accounting firm operations
 * Controls access to features based on user roles
 */

// Available roles in the system
export type UserRole =
  | 'ADMIN'           // System administrator - full access
  | 'PARTNER'         // Partner/Owner - full access to client data
  | 'MANAGER'         // Accounting Manager - manages team & reviews
  | 'SENIOR_ACCOUNTANT' // Senior - can approve, post GL, file taxes
  | 'JUNIOR_ACCOUNTANT' // Junior - can process, needs approval
  | 'INTERN'          // Intern - view only, learning
  | 'CLIENT';         // Client portal - view own data only

// Permission categories
export type PermissionCategory =
  | 'documents'
  | 'gl_entries'
  | 'clients'
  | 'staff'
  | 'reports'
  | 'tax_filing'
  | 'settings'
  | 'audit_log'
  | 'backup';

// Specific permissions
export type Permission =
  // Document permissions
  | 'documents.view'
  | 'documents.upload'
  | 'documents.edit'
  | 'documents.delete'
  | 'documents.approve'
  | 'documents.batch_approve'
  // GL Entry permissions
  | 'gl.view'
  | 'gl.post'
  | 'gl.edit'
  | 'gl.delete'
  | 'gl.reverse'
  | 'gl.period_close'
  | 'gl.period_reopen'
  // Client permissions
  | 'clients.view'
  | 'clients.create'
  | 'clients.edit'
  | 'clients.delete'
  | 'clients.assign_staff'
  // Staff permissions
  | 'staff.view'
  | 'staff.create'
  | 'staff.edit'
  | 'staff.delete'
  | 'staff.assign_role'
  // Report permissions
  | 'reports.view'
  | 'reports.generate'
  | 'reports.export'
  | 'reports.publish'
  // Tax filing permissions
  | 'tax.view'
  | 'tax.prepare'
  | 'tax.file'
  | 'tax.generate_certificate'
  // Settings permissions
  | 'settings.view'
  | 'settings.edit'
  | 'settings.firm_profile'
  // Audit permissions
  | 'audit.view'
  | 'audit.export'
  // Backup permissions
  | 'backup.create'
  | 'backup.restore'
  | 'backup.download';

// Role-Permission mapping
const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  ADMIN: [
    // Full access to everything
    'documents.view', 'documents.upload', 'documents.edit', 'documents.delete', 'documents.approve', 'documents.batch_approve',
    'gl.view', 'gl.post', 'gl.edit', 'gl.delete', 'gl.reverse', 'gl.period_close', 'gl.period_reopen',
    'clients.view', 'clients.create', 'clients.edit', 'clients.delete', 'clients.assign_staff',
    'staff.view', 'staff.create', 'staff.edit', 'staff.delete', 'staff.assign_role',
    'reports.view', 'reports.generate', 'reports.export', 'reports.publish',
    'tax.view', 'tax.prepare', 'tax.file', 'tax.generate_certificate',
    'settings.view', 'settings.edit', 'settings.firm_profile',
    'audit.view', 'audit.export',
    'backup.create', 'backup.restore', 'backup.download'
  ],

  PARTNER: [
    // Same as admin except some system settings
    'documents.view', 'documents.upload', 'documents.edit', 'documents.delete', 'documents.approve', 'documents.batch_approve',
    'gl.view', 'gl.post', 'gl.edit', 'gl.delete', 'gl.reverse', 'gl.period_close', 'gl.period_reopen',
    'clients.view', 'clients.create', 'clients.edit', 'clients.delete', 'clients.assign_staff',
    'staff.view', 'staff.create', 'staff.edit', 'staff.delete', 'staff.assign_role',
    'reports.view', 'reports.generate', 'reports.export', 'reports.publish',
    'tax.view', 'tax.prepare', 'tax.file', 'tax.generate_certificate',
    'settings.view', 'settings.edit', 'settings.firm_profile',
    'audit.view', 'audit.export',
    'backup.create', 'backup.download'
  ],

  MANAGER: [
    // Can manage team and approve work
    'documents.view', 'documents.upload', 'documents.edit', 'documents.approve', 'documents.batch_approve',
    'gl.view', 'gl.post', 'gl.edit', 'gl.reverse', 'gl.period_close',
    'clients.view', 'clients.create', 'clients.edit', 'clients.assign_staff',
    'staff.view', 'staff.edit',
    'reports.view', 'reports.generate', 'reports.export', 'reports.publish',
    'tax.view', 'tax.prepare', 'tax.file', 'tax.generate_certificate',
    'settings.view',
    'audit.view'
  ],

  SENIOR_ACCOUNTANT: [
    // Can process and approve own work
    'documents.view', 'documents.upload', 'documents.edit', 'documents.approve',
    'gl.view', 'gl.post', 'gl.edit',
    'clients.view', 'clients.edit',
    'staff.view',
    'reports.view', 'reports.generate', 'reports.export',
    'tax.view', 'tax.prepare', 'tax.file', 'tax.generate_certificate',
    'audit.view'
  ],

  JUNIOR_ACCOUNTANT: [
    // Can process, needs approval
    'documents.view', 'documents.upload', 'documents.edit',
    'gl.view', 'gl.post',
    'clients.view',
    'staff.view',
    'reports.view', 'reports.generate',
    'tax.view', 'tax.prepare'
  ],

  INTERN: [
    // View only - learning mode
    'documents.view',
    'gl.view',
    'clients.view',
    'staff.view',
    'reports.view',
    'tax.view'
  ],

  CLIENT: [
    // Can only view own data via portal
    'documents.view',
    'gl.view',
    'reports.view'
  ]
};

// Thai role names
export const ROLE_NAMES_TH: Record<UserRole, string> = {
  ADMIN: 'ผู้ดูแลระบบ',
  PARTNER: 'หุ้นส่วน/เจ้าของ',
  MANAGER: 'ผู้จัดการฝ่ายบัญชี',
  SENIOR_ACCOUNTANT: 'นักบัญชีอาวุโส',
  JUNIOR_ACCOUNTANT: 'นักบัญชี',
  INTERN: 'นักศึกษาฝึกงาน',
  CLIENT: 'ลูกค้า'
};

// Role hierarchy (for inheritance)
const ROLE_HIERARCHY: Record<UserRole, number> = {
  ADMIN: 100,
  PARTNER: 90,
  MANAGER: 70,
  SENIOR_ACCOUNTANT: 50,
  JUNIOR_ACCOUNTANT: 30,
  INTERN: 10,
  CLIENT: 0
};

// User context for permission checking
export interface UserContext {
  userId: string;
  role: UserRole;
  assignedClientIds?: string[]; // For staff - which clients they can access
  clientId?: string; // For client users - their own client ID
}

/**
 * Check if user has specific permission
 */
export const hasPermission = (user: UserContext, permission: Permission): boolean => {
  const rolePermissions = ROLE_PERMISSIONS[user.role];
  return rolePermissions.includes(permission);
};

/**
 * Check if user has any of the specified permissions
 */
export const hasAnyPermission = (user: UserContext, permissions: Permission[]): boolean => {
  return permissions.some(p => hasPermission(user, p));
};

/**
 * Check if user has all of the specified permissions
 */
export const hasAllPermissions = (user: UserContext, permissions: Permission[]): boolean => {
  return permissions.every(p => hasPermission(user, p));
};

/**
 * Check if user can access specific client's data
 */
export const canAccessClient = (user: UserContext, clientId: string): boolean => {
  // Admin, Partner, Manager can access all clients
  if (['ADMIN', 'PARTNER', 'MANAGER'].includes(user.role)) {
    return true;
  }

  // Client can only access their own data
  if (user.role === 'CLIENT') {
    return user.clientId === clientId;
  }

  // Staff can only access assigned clients
  if (user.assignedClientIds) {
    return user.assignedClientIds.includes(clientId);
  }

  return false;
};

/**
 * Check if user has higher or equal role
 */
export const hasRoleLevel = (user: UserContext, minimumRole: UserRole): boolean => {
  return ROLE_HIERARCHY[user.role] >= ROLE_HIERARCHY[minimumRole];
};

/**
 * Get all permissions for a role
 */
export const getRolePermissions = (role: UserRole): Permission[] => {
  return [...ROLE_PERMISSIONS[role]];
};

/**
 * Get permission category
 */
export const getPermissionCategory = (permission: Permission): PermissionCategory => {
  return permission.split('.')[0] as PermissionCategory;
};

/**
 * Filter data based on user context (for client isolation)
 */
export const filterByAccess = <T extends { clientId?: string }>(
  user: UserContext,
  data: T[]
): T[] => {
  if (['ADMIN', 'PARTNER', 'MANAGER'].includes(user.role)) {
    return data;
  }

  if (user.role === 'CLIENT') {
    return data.filter(item => item.clientId === user.clientId);
  }

  if (user.assignedClientIds) {
    return data.filter(item =>
      item.clientId && user.assignedClientIds!.includes(item.clientId)
    );
  }

  return [];
};

/**
 * Permission check result with Thai message
 */
export interface PermissionCheckResult {
  allowed: boolean;
  message?: string;
  messageTh?: string;
}

/**
 * Check permission with detailed result
 */
export const checkPermission = (
  user: UserContext,
  permission: Permission,
  clientId?: string
): PermissionCheckResult => {
  // Check base permission
  if (!hasPermission(user, permission)) {
    return {
      allowed: false,
      message: `Permission denied: ${permission}`,
      messageTh: `ไม่มีสิทธิ์: ${getPermissionNameTh(permission)}`
    };
  }

  // Check client access if clientId provided
  if (clientId && !canAccessClient(user, clientId)) {
    return {
      allowed: false,
      message: 'Access denied: You are not assigned to this client',
      messageTh: 'ไม่มีสิทธิ์เข้าถึงข้อมูลลูกค้ารายนี้'
    };
  }

  return { allowed: true };
};

/**
 * Get Thai name for permission
 */
const getPermissionNameTh = (permission: Permission): string => {
  const permissionNames: Record<Permission, string> = {
    'documents.view': 'ดูเอกสาร',
    'documents.upload': 'อัพโหลดเอกสาร',
    'documents.edit': 'แก้ไขเอกสาร',
    'documents.delete': 'ลบเอกสาร',
    'documents.approve': 'อนุมัติเอกสาร',
    'documents.batch_approve': 'อนุมัติเอกสารแบบกลุ่ม',
    'gl.view': 'ดูรายการบัญชี',
    'gl.post': 'ลงบัญชี',
    'gl.edit': 'แก้ไขรายการบัญชี',
    'gl.delete': 'ลบรายการบัญชี',
    'gl.reverse': 'กลับรายการบัญชี',
    'gl.period_close': 'ปิดงวดบัญชี',
    'gl.period_reopen': 'เปิดงวดบัญชีใหม่',
    'clients.view': 'ดูข้อมูลลูกค้า',
    'clients.create': 'สร้างลูกค้าใหม่',
    'clients.edit': 'แก้ไขข้อมูลลูกค้า',
    'clients.delete': 'ลบลูกค้า',
    'clients.assign_staff': 'มอบหมายพนักงาน',
    'staff.view': 'ดูข้อมูลพนักงาน',
    'staff.create': 'สร้างพนักงานใหม่',
    'staff.edit': 'แก้ไขข้อมูลพนักงาน',
    'staff.delete': 'ลบพนักงาน',
    'staff.assign_role': 'กำหนดสิทธิ์พนักงาน',
    'reports.view': 'ดูรายงาน',
    'reports.generate': 'สร้างรายงาน',
    'reports.export': 'ส่งออกรายงาน',
    'reports.publish': 'เผยแพร่รายงาน',
    'tax.view': 'ดูข้อมูลภาษี',
    'tax.prepare': 'เตรียมแบบภาษี',
    'tax.file': 'ยื่นภาษี',
    'tax.generate_certificate': 'ออกหนังสือรับรอง',
    'settings.view': 'ดูการตั้งค่า',
    'settings.edit': 'แก้ไขการตั้งค่า',
    'settings.firm_profile': 'แก้ไขข้อมูลสำนักงาน',
    'audit.view': 'ดู Audit Log',
    'audit.export': 'ส่งออก Audit Log',
    'backup.create': 'สำรองข้อมูล',
    'backup.restore': 'กู้คืนข้อมูล',
    'backup.download': 'ดาวน์โหลดข้อมูลสำรอง'
  };
  return permissionNames[permission] || permission;
};

/**
 * Hook for React components to check permissions
 * Usage: const canApprove = usePermission('documents.approve');
 */
export const createPermissionChecker = (user: UserContext) => {
  return {
    can: (permission: Permission) => hasPermission(user, permission),
    canAny: (permissions: Permission[]) => hasAnyPermission(user, permissions),
    canAll: (permissions: Permission[]) => hasAllPermissions(user, permissions),
    canAccessClient: (clientId: string) => canAccessClient(user, clientId),
    check: (permission: Permission, clientId?: string) => checkPermission(user, permission, clientId),
    role: user.role,
    roleNameTh: ROLE_NAMES_TH[user.role],
    isAtLeast: (role: UserRole) => hasRoleLevel(user, role)
  };
};

export default {
  hasPermission,
  hasAnyPermission,
  hasAllPermissions,
  canAccessClient,
  hasRoleLevel,
  getRolePermissions,
  checkPermission,
  filterByAccess,
  createPermissionChecker,
  ROLE_NAMES_TH,
  ROLE_PERMISSIONS
};
