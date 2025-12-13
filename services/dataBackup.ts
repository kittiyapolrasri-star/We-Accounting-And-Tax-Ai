/**
 * dataBackup.ts
 *
 * Data Backup & Export Service
 * Provides data backup, restore, and export functionality
 * Critical for data safety and compliance with Thai data retention requirements
 */

import { DocumentRecord, Client, Staff, PostedGLEntry, VendorRule, FixedAsset, ActivityLog } from '../types';

// Backup metadata
export interface BackupMetadata {
  id: string;
  version: string;
  createdAt: string;
  createdBy: string;
  description: string;
  clientId?: string; // If backup is for specific client
  clientName?: string;
  dataTypes: string[];
  recordCounts: Record<string, number>;
  checksum: string;
  sizeBytes: number;
  isEncrypted: boolean;
}

// Full backup data structure
export interface BackupData {
  metadata: BackupMetadata;
  clients?: Client[];
  staff?: Staff[];
  documents?: DocumentRecord[];
  glEntries?: PostedGLEntry[];
  vendorRules?: VendorRule[];
  fixedAssets?: FixedAsset[];
  activityLogs?: ActivityLog[];
}

// Export format options
export type ExportFormat = 'json' | 'csv' | 'excel';

// Export options
export interface ExportOptions {
  format: ExportFormat;
  includeHeaders: boolean;
  dateFormat: 'ISO' | 'Thai' | 'Short';
  encoding: 'utf-8' | 'tis-620';
}

// Default export options
const DEFAULT_EXPORT_OPTIONS: ExportOptions = {
  format: 'csv',
  includeHeaders: true,
  dateFormat: 'Thai',
  encoding: 'utf-8'
};

/**
 * Generate simple checksum for data integrity
 */
const generateChecksum = (data: string): string => {
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
};

/**
 * Format date based on options
 */
const formatDate = (dateStr: string, format: 'ISO' | 'Thai' | 'Short'): string => {
  const date = new Date(dateStr);

  switch (format) {
    case 'ISO':
      return date.toISOString();
    case 'Thai':
      const thaiYear = date.getFullYear() + 543;
      const thaiMonths = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
                          'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
      return `${date.getDate()} ${thaiMonths[date.getMonth()]} ${thaiYear}`;
    case 'Short':
      return `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;
    default:
      return dateStr;
  }
};

/**
 * Create a full system backup
 */
export const createFullBackup = (
  data: {
    clients: Client[];
    staff: Staff[];
    documents: DocumentRecord[];
    glEntries: PostedGLEntry[];
    vendorRules: VendorRule[];
    fixedAssets: FixedAsset[];
    activityLogs: ActivityLog[];
  },
  userId: string,
  description: string = 'Full system backup'
): BackupData => {
  const backupData: BackupData = {
    metadata: {
      id: `BACKUP-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      version: '1.0.0',
      createdAt: new Date().toISOString(),
      createdBy: userId,
      description,
      dataTypes: ['clients', 'staff', 'documents', 'glEntries', 'vendorRules', 'fixedAssets', 'activityLogs'],
      recordCounts: {
        clients: data.clients.length,
        staff: data.staff.length,
        documents: data.documents.length,
        glEntries: data.glEntries.length,
        vendorRules: data.vendorRules.length,
        fixedAssets: data.fixedAssets.length,
        activityLogs: data.activityLogs.length
      },
      checksum: '',
      sizeBytes: 0,
      isEncrypted: false
    },
    ...data
  };

  // Calculate checksum and size
  const jsonString = JSON.stringify(backupData);
  backupData.metadata.checksum = generateChecksum(jsonString);
  backupData.metadata.sizeBytes = new Blob([jsonString]).size;

  return backupData;
};

/**
 * Create a client-specific backup
 */
export const createClientBackup = (
  clientId: string,
  clientName: string,
  data: {
    documents: DocumentRecord[];
    glEntries: PostedGLEntry[];
    vendorRules: VendorRule[];
    fixedAssets: FixedAsset[];
  },
  userId: string,
  description?: string
): BackupData => {
  // Filter data for specific client
  const filteredData = {
    documents: data.documents.filter(d => d.client_name === clientName || d.clientId === clientId),
    glEntries: data.glEntries.filter(g => g.clientId === clientId),
    vendorRules: data.vendorRules.filter(v => v.clientId === clientId || !v.clientId),
    fixedAssets: data.fixedAssets.filter(a => a.clientId === clientId)
  };

  const backupData: BackupData = {
    metadata: {
      id: `BACKUP-${clientId}-${Date.now()}`,
      version: '1.0.0',
      createdAt: new Date().toISOString(),
      createdBy: userId,
      description: description || `Backup for client: ${clientName}`,
      clientId,
      clientName,
      dataTypes: ['documents', 'glEntries', 'vendorRules', 'fixedAssets'],
      recordCounts: {
        documents: filteredData.documents.length,
        glEntries: filteredData.glEntries.length,
        vendorRules: filteredData.vendorRules.length,
        fixedAssets: filteredData.fixedAssets.length
      },
      checksum: '',
      sizeBytes: 0,
      isEncrypted: false
    },
    ...filteredData
  };

  const jsonString = JSON.stringify(backupData);
  backupData.metadata.checksum = generateChecksum(jsonString);
  backupData.metadata.sizeBytes = new Blob([jsonString]).size;

  return backupData;
};

/**
 * Validate backup data integrity
 */
export const validateBackup = (backup: BackupData): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];

  // Check metadata
  if (!backup.metadata) {
    errors.push('Missing backup metadata');
    return { isValid: false, errors };
  }

  if (!backup.metadata.version) {
    errors.push('Missing version information');
  }

  if (!backup.metadata.createdAt) {
    errors.push('Missing creation timestamp');
  }

  // Verify checksum
  const originalChecksum = backup.metadata.checksum;
  backup.metadata.checksum = '';
  const jsonString = JSON.stringify(backup);
  const calculatedChecksum = generateChecksum(jsonString);
  backup.metadata.checksum = originalChecksum;

  if (originalChecksum && originalChecksum !== calculatedChecksum) {
    errors.push('Checksum mismatch - data may be corrupted');
  }

  // Verify record counts
  const counts = backup.metadata.recordCounts;
  if (backup.clients && counts.clients !== backup.clients.length) {
    errors.push(`Client count mismatch: expected ${counts.clients}, got ${backup.clients.length}`);
  }
  if (backup.documents && counts.documents !== backup.documents.length) {
    errors.push(`Document count mismatch: expected ${counts.documents}, got ${backup.documents.length}`);
  }
  if (backup.glEntries && counts.glEntries !== backup.glEntries.length) {
    errors.push(`GL entry count mismatch: expected ${counts.glEntries}, got ${backup.glEntries.length}`);
  }

  return { isValid: errors.length === 0, errors };
};

/**
 * Download backup as JSON file
 */
export const downloadBackupAsJSON = (backup: BackupData): void => {
  const jsonString = JSON.stringify(backup, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = `backup_${backup.metadata.id}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

/**
 * Export GL entries to CSV
 */
export const exportGLToCSV = (
  glEntries: PostedGLEntry[],
  options: Partial<ExportOptions> = {}
): string => {
  const opts = { ...DEFAULT_EXPORT_OPTIONS, ...options };

  const headers = [
    'วันที่',
    'เลขที่เอกสาร',
    'รหัสบัญชี',
    'ชื่อบัญชี',
    'คำอธิบาย',
    'เดบิต',
    'เครดิต',
    'แผนก',
    'รหัสลูกค้า'
  ];

  const rows = glEntries.map(entry => [
    formatDate(entry.date, opts.dateFormat),
    entry.doc_no,
    entry.account_code,
    entry.account_name,
    entry.description,
    entry.debit?.toFixed(2) || '0.00',
    entry.credit?.toFixed(2) || '0.00',
    entry.department_code || '',
    entry.clientId || ''
  ]);

  const csvContent = [
    opts.includeHeaders ? headers.join(',') : '',
    ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
  ].filter(Boolean).join('\n');

  // Add BOM for Excel Thai support
  return '\uFEFF' + csvContent;
};

/**
 * Export documents to CSV
 */
export const exportDocumentsToCSV = (
  documents: DocumentRecord[],
  options: Partial<ExportOptions> = {}
): string => {
  const opts = { ...DEFAULT_EXPORT_OPTIONS, ...options };

  const headers = [
    'รหัสเอกสาร',
    'ชื่อไฟล์',
    'ลูกค้า',
    'ประเภทเอกสาร',
    'วันที่เอกสาร',
    'เลขที่ใบกำกับ',
    'ยอดเงินรวม',
    'ภาษีมูลค่าเพิ่ม',
    'สถานะ',
    'พนักงานรับผิดชอบ',
    'วันที่อัพโหลด'
  ];

  const rows = documents.map(doc => [
    doc.id,
    doc.filename,
    doc.client_name,
    doc.ai_data?.header_data?.doc_type || '',
    doc.ai_data?.header_data?.issue_date ? formatDate(doc.ai_data.header_data.issue_date, opts.dateFormat) : '',
    doc.ai_data?.header_data?.inv_number || '',
    doc.ai_data?.financials?.grand_total?.toFixed(2) || '0.00',
    doc.ai_data?.financials?.vat_amount?.toFixed(2) || '0.00',
    doc.status === 'approved' ? 'อนุมัติแล้ว' : doc.status === 'pending_review' ? 'รออนุมัติ' : doc.status,
    doc.assigned_to || '',
    doc.uploaded_at ? formatDate(doc.uploaded_at, opts.dateFormat) : ''
  ]);

  const csvContent = [
    opts.includeHeaders ? headers.join(',') : '',
    ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
  ].filter(Boolean).join('\n');

  return '\uFEFF' + csvContent;
};

/**
 * Export clients to CSV
 */
export const exportClientsToCSV = (
  clients: Client[],
  options: Partial<ExportOptions> = {}
): string => {
  const opts = { ...DEFAULT_EXPORT_OPTIONS, ...options };

  const headers = [
    'รหัสลูกค้า',
    'ชื่อบริษัท',
    'เลขประจำตัวผู้เสียภาษี',
    'ที่อยู่',
    'ผู้ติดต่อ',
    'อุตสาหกรรม',
    'สถานะ',
    'พนักงานรับผิดชอบ'
  ];

  const rows = clients.map(client => [
    client.id,
    client.name,
    client.tax_id,
    client.address || '',
    client.contact_person || '',
    client.industry || '',
    client.status === 'Active' ? 'ใช้งาน' : 'ไม่ใช้งาน',
    client.assigned_staff_id || ''
  ]);

  const csvContent = [
    opts.includeHeaders ? headers.join(',') : '',
    ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
  ].filter(Boolean).join('\n');

  return '\uFEFF' + csvContent;
};

/**
 * Download CSV file
 */
export const downloadCSV = (csvContent: string, filename: string): void => {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

/**
 * Parse backup file from JSON
 */
export const parseBackupFile = async (file: File): Promise<{ backup: BackupData | null; error: string | null }> => {
  try {
    const text = await file.text();
    const backup = JSON.parse(text) as BackupData;

    // Validate structure
    const validation = validateBackup(backup);
    if (!validation.isValid) {
      return { backup: null, error: `Invalid backup: ${validation.errors.join(', ')}` };
    }

    return { backup, error: null };
  } catch (error) {
    return { backup: null, error: `Failed to parse backup file: ${error}` };
  }
};

/**
 * Restore data from backup (returns data to be merged)
 */
export const prepareRestore = (
  backup: BackupData,
  options: {
    restoreClients?: boolean;
    restoreDocuments?: boolean;
    restoreGLEntries?: boolean;
    restoreVendorRules?: boolean;
    restoreFixedAssets?: boolean;
    overwriteExisting?: boolean;
  }
): {
  toRestore: Partial<BackupData>;
  warnings: string[];
} => {
  const toRestore: Partial<BackupData> = {};
  const warnings: string[] = [];

  if (options.restoreClients && backup.clients) {
    toRestore.clients = backup.clients;
    warnings.push(`จะกู้คืนลูกค้า ${backup.clients.length} ราย`);
  }

  if (options.restoreDocuments && backup.documents) {
    toRestore.documents = backup.documents;
    warnings.push(`จะกู้คืนเอกสาร ${backup.documents.length} รายการ`);
  }

  if (options.restoreGLEntries && backup.glEntries) {
    toRestore.glEntries = backup.glEntries;
    warnings.push(`จะกู้คืนรายการบัญชี ${backup.glEntries.length} รายการ`);
  }

  if (options.restoreVendorRules && backup.vendorRules) {
    toRestore.vendorRules = backup.vendorRules;
    warnings.push(`จะกู้คืนกฎ Vendor ${backup.vendorRules.length} รายการ`);
  }

  if (options.restoreFixedAssets && backup.fixedAssets) {
    toRestore.fixedAssets = backup.fixedAssets;
    warnings.push(`จะกู้คืนทรัพย์สิน ${backup.fixedAssets.length} รายการ`);
  }

  if (options.overwriteExisting) {
    warnings.push('⚠️ ข้อมูลที่มีอยู่จะถูกแทนที่');
  }

  return { toRestore, warnings };
};

/**
 * Format file size for display
 */
export const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
};

export default {
  createFullBackup,
  createClientBackup,
  validateBackup,
  downloadBackupAsJSON,
  exportGLToCSV,
  exportDocumentsToCSV,
  exportClientsToCSV,
  downloadCSV,
  parseBackupFile,
  prepareRestore,
  formatFileSize
};
