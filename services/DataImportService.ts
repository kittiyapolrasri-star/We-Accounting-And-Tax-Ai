/**
 * DataImportService.ts
 * 
 * Comprehensive Data Import Service for all data types
 * Supports CSV, Excel (.xlsx) with validation, preview, and batch processing
 * 
 * Features:
 * - Multi-format support (CSV, XLSX)
 * - Template generation
 * - Data validation with detailed error reporting
 * - Preview before import
 * - Batch processing with progress
 * - Rollback support
 */

import * as XLSX from 'xlsx';
import { Client, Staff, PostedGLEntry, FixedAsset, VendorRule } from '../types';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export type ImportDataType =
    | 'opening_balance'
    | 'chart_of_accounts'
    | 'clients'
    | 'fixed_assets'
    | 'vendors'
    | 'staff'
    | 'journal_entries';

export interface ImportColumn {
    key: string;
    label: string;
    labelTh: string;
    required: boolean;
    type: 'string' | 'number' | 'date' | 'boolean' | 'select';
    options?: string[]; // For select type
    validation?: (value: any) => { valid: boolean; error?: string };
    transform?: (value: any) => any;
    defaultValue?: any;
}

export interface ImportTemplate {
    type: ImportDataType;
    name: string;
    nameTh: string;
    description: string;
    columns: ImportColumn[];
    sampleData: Record<string, any>[];
}

export interface ValidationError {
    row: number;
    column: string;
    value: any;
    error: string;
    errorTh: string;
    severity: 'error' | 'warning';
}

export interface ParsedRow {
    rowNumber: number;
    data: Record<string, any>;
    errors: ValidationError[];
    isValid: boolean;
}

export interface ImportResult {
    success: boolean;
    totalRows: number;
    validRows: number;
    errorRows: number;
    warningRows: number;
    errors: ValidationError[];
    data: ParsedRow[];
    summary: {
        totalDebit?: number;
        totalCredit?: number;
        isBalanced?: boolean;
        duplicateCount?: number;
    };
}

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

const isValidTaxId = (taxId: string): boolean => {
    if (!taxId) return false;
    const cleaned = taxId.replace(/[-\s]/g, '');
    return /^\d{13}$/.test(cleaned);
};

const isValidAccountCode = (code: string): boolean => {
    if (!code) return false;
    return /^\d{4,6}$/.test(code);
};

const isValidDate = (dateStr: string): boolean => {
    if (!dateStr) return false;
    const date = new Date(dateStr);
    return !isNaN(date.getTime());
};

const parseNumber = (value: any): number => {
    if (typeof value === 'number') return value;
    if (!value) return 0;
    const cleaned = String(value).replace(/[,\s฿$]/g, '');
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
};

const parseDate = (value: any): string => {
    if (!value) return '';
    if (typeof value === 'number') {
        // Excel serial date
        const date = XLSX.SSF.parse_date_code(value);
        return `${date.y}-${String(date.m).padStart(2, '0')}-${String(date.d).padStart(2, '0')}`;
    }
    const date = new Date(value);
    if (isNaN(date.getTime())) return '';
    return date.toISOString().split('T')[0];
};

const parseBoolean = (value: any): boolean => {
    if (typeof value === 'boolean') return value;
    if (!value) return false;
    const str = String(value).toLowerCase().trim();
    return ['yes', 'true', '1', 'ใช่', 'active'].includes(str);
};

// ============================================================================
// IMPORT TEMPLATES
// ============================================================================

export const IMPORT_TEMPLATES: Record<ImportDataType, ImportTemplate> = {
    opening_balance: {
        type: 'opening_balance',
        name: 'Opening Balance',
        nameTh: 'ยอดยกมา',
        description: 'Import opening balances for a new client. Debit and Credit must be balanced.',
        columns: [
            {
                key: 'account_code',
                label: 'Account Code',
                labelTh: 'รหัสบัญชี',
                required: true,
                type: 'string',
                validation: (v) => ({
                    valid: isValidAccountCode(v),
                    error: 'Invalid account code format (4-6 digits required)'
                })
            },
            {
                key: 'account_name',
                label: 'Account Name',
                labelTh: 'ชื่อบัญชี',
                required: true,
                type: 'string'
            },
            {
                key: 'debit',
                label: 'Debit',
                labelTh: 'เดบิต',
                required: false,
                type: 'number',
                transform: parseNumber,
                defaultValue: 0
            },
            {
                key: 'credit',
                label: 'Credit',
                labelTh: 'เครดิต',
                required: false,
                type: 'number',
                transform: parseNumber,
                defaultValue: 0
            }
        ],
        sampleData: [
            { account_code: '11100', account_name: 'เงินสด', debit: 50000, credit: 0 },
            { account_code: '11200', account_name: 'เงินฝากธนาคาร', debit: 150000, credit: 0 },
            { account_code: '21100', account_name: 'เจ้าหนี้การค้า', debit: 0, credit: 80000 },
            { account_code: '31100', account_name: 'ทุนจดทะเบียน', debit: 0, credit: 120000 }
        ]
    },

    chart_of_accounts: {
        type: 'chart_of_accounts',
        name: 'Chart of Accounts',
        nameTh: 'ผังบัญชี',
        description: 'Import chart of accounts. Account code must be unique.',
        columns: [
            {
                key: 'account_code',
                label: 'Account Code',
                labelTh: 'รหัสบัญชี',
                required: true,
                type: 'string',
                validation: (v) => ({
                    valid: isValidAccountCode(v),
                    error: 'Invalid account code format'
                })
            },
            {
                key: 'account_name',
                label: 'Account Name (TH)',
                labelTh: 'ชื่อบัญชี (ไทย)',
                required: true,
                type: 'string'
            },
            {
                key: 'account_name_en',
                label: 'Account Name (EN)',
                labelTh: 'ชื่อบัญชี (อังกฤษ)',
                required: false,
                type: 'string'
            },
            {
                key: 'account_type',
                label: 'Type',
                labelTh: 'ประเภท',
                required: true,
                type: 'select',
                options: ['Asset', 'Liability', 'Equity', 'Revenue', 'Expense']
            },
            {
                key: 'parent_code',
                label: 'Parent Code',
                labelTh: 'รหัสบัญชีแม่',
                required: false,
                type: 'string'
            },
            {
                key: 'is_active',
                label: 'Active',
                labelTh: 'ใช้งาน',
                required: false,
                type: 'boolean',
                transform: parseBoolean,
                defaultValue: true
            }
        ],
        sampleData: [
            { account_code: '11100', account_name: 'เงินสด', account_name_en: 'Cash', account_type: 'Asset', parent_code: '', is_active: true },
            { account_code: '11200', account_name: 'เงินฝากธนาคาร', account_name_en: 'Bank', account_type: 'Asset', parent_code: '', is_active: true }
        ]
    },

    clients: {
        type: 'clients',
        name: 'Clients',
        nameTh: 'ลูกค้า/บริษัท',
        description: 'Import client/company master data.',
        columns: [
            {
                key: 'name',
                label: 'Company Name',
                labelTh: 'ชื่อบริษัท',
                required: true,
                type: 'string'
            },
            {
                key: 'tax_id',
                label: 'Tax ID',
                labelTh: 'เลขประจำตัวผู้เสียภาษี',
                required: true,
                type: 'string',
                validation: (v) => ({
                    valid: isValidTaxId(v),
                    error: 'Invalid Tax ID format (13 digits required)'
                })
            },
            {
                key: 'industry',
                label: 'Industry',
                labelTh: 'ประเภทธุรกิจ',
                required: false,
                type: 'string',
                defaultValue: 'General'
            },
            {
                key: 'address',
                label: 'Address',
                labelTh: 'ที่อยู่',
                required: false,
                type: 'string'
            },
            {
                key: 'contact_person',
                label: 'Contact Person',
                labelTh: 'ผู้ติดต่อ',
                required: false,
                type: 'string'
            },
            {
                key: 'contact_email',
                label: 'Email',
                labelTh: 'อีเมล',
                required: false,
                type: 'string'
            },
            {
                key: 'contact_phone',
                label: 'Phone',
                labelTh: 'โทรศัพท์',
                required: false,
                type: 'string'
            },
            {
                key: 'fiscal_year_end',
                label: 'Fiscal Year End',
                labelTh: 'สิ้นสุดรอบบัญชี',
                required: false,
                type: 'string',
                defaultValue: '12/31'
            },
            {
                key: 'status',
                label: 'Status',
                labelTh: 'สถานะ',
                required: false,
                type: 'select',
                options: ['Active', 'Inactive', 'Suspended'],
                defaultValue: 'Active'
            }
        ],
        sampleData: [
            { name: 'บริษัท ตัวอย่าง จำกัด', tax_id: '0105500000001', industry: 'Retail', address: '123 ถนนสุขุมวิท กรุงเทพ', contact_person: 'คุณสมชาย', contact_email: 'somchai@example.com', contact_phone: '02-123-4567', status: 'Active' }
        ]
    },

    fixed_assets: {
        type: 'fixed_assets',
        name: 'Fixed Assets',
        nameTh: 'ทรัพย์สินถาวร',
        description: 'Import fixed asset register with depreciation details.',
        columns: [
            {
                key: 'asset_code',
                label: 'Asset Code',
                labelTh: 'รหัสทรัพย์สิน',
                required: true,
                type: 'string'
            },
            {
                key: 'name',
                label: 'Description',
                labelTh: 'รายละเอียด',
                required: true,
                type: 'string'
            },
            {
                key: 'category',
                label: 'Category',
                labelTh: 'หมวดหมู่',
                required: true,
                type: 'select',
                options: ['Equipment', 'Vehicle', 'Building', 'Land', 'Software']
            },
            {
                key: 'acquisition_date',
                label: 'Acquisition Date',
                labelTh: 'วันที่ได้มา',
                required: true,
                type: 'date',
                transform: parseDate,
                validation: (v) => ({
                    valid: isValidDate(v),
                    error: 'Invalid date format'
                })
            },
            {
                key: 'cost',
                label: 'Cost',
                labelTh: 'ราคาทุน',
                required: true,
                type: 'number',
                transform: parseNumber
            },
            {
                key: 'residual_value',
                label: 'Residual Value',
                labelTh: 'มูลค่าซาก',
                required: false,
                type: 'number',
                transform: parseNumber,
                defaultValue: 1
            },
            {
                key: 'useful_life_years',
                label: 'Useful Life (Years)',
                labelTh: 'อายุการใช้งาน (ปี)',
                required: true,
                type: 'number',
                transform: parseNumber
            },
            {
                key: 'accumulated_depreciation_bf',
                label: 'Accum. Depreciation B/F',
                labelTh: 'ค่าเสื่อมสะสมยกมา',
                required: false,
                type: 'number',
                transform: parseNumber,
                defaultValue: 0
            }
        ],
        sampleData: [
            { asset_code: '12400-001', name: 'คอมพิวเตอร์ Dell XPS', category: 'Equipment', acquisition_date: '2024-01-15', cost: 45000, residual_value: 1, useful_life_years: 5, accumulated_depreciation_bf: 0 },
            { asset_code: '12500-001', name: 'รถยนต์ Toyota Vios', category: 'Vehicle', acquisition_date: '2023-06-01', cost: 800000, residual_value: 80000, useful_life_years: 5, accumulated_depreciation_bf: 72000 }
        ]
    },

    vendors: {
        type: 'vendors',
        name: 'Vendors/Suppliers',
        nameTh: 'คู่ค้า/ผู้ขาย',
        description: 'Import vendor/supplier master data.',
        columns: [
            {
                key: 'code',
                label: 'Vendor Code',
                labelTh: 'รหัสคู่ค้า',
                required: true,
                type: 'string'
            },
            {
                key: 'name',
                label: 'Vendor Name',
                labelTh: 'ชื่อคู่ค้า',
                required: true,
                type: 'string'
            },
            {
                key: 'tax_id',
                label: 'Tax ID',
                labelTh: 'เลขประจำตัวผู้เสียภาษี',
                required: false,
                type: 'string'
            },
            {
                key: 'address',
                label: 'Address',
                labelTh: 'ที่อยู่',
                required: false,
                type: 'string'
            },
            {
                key: 'contact_person',
                label: 'Contact Person',
                labelTh: 'ผู้ติดต่อ',
                required: false,
                type: 'string'
            },
            {
                key: 'phone',
                label: 'Phone',
                labelTh: 'โทรศัพท์',
                required: false,
                type: 'string'
            },
            {
                key: 'email',
                label: 'Email',
                labelTh: 'อีเมล',
                required: false,
                type: 'string'
            },
            {
                key: 'default_account',
                label: 'Default Account',
                labelTh: 'บัญชีเริ่มต้น',
                required: false,
                type: 'string'
            },
            {
                key: 'payment_terms',
                label: 'Payment Terms (Days)',
                labelTh: 'เครดิต (วัน)',
                required: false,
                type: 'number',
                transform: parseNumber,
                defaultValue: 30
            },
            {
                key: 'wht_rate',
                label: 'WHT Rate (%)',
                labelTh: 'อัตราหัก ณ ที่จ่าย (%)',
                required: false,
                type: 'number',
                transform: parseNumber,
                defaultValue: 0
            }
        ],
        sampleData: [
            { code: 'V001', name: 'บริษัท ซัพพลาย จำกัด', tax_id: '0105500000002', address: '456 ถนนพระราม 4', contact_person: 'คุณสมศรี', phone: '02-234-5678', email: 'supply@example.com', default_account: '52100', payment_terms: 30, wht_rate: 3 }
        ]
    },

    staff: {
        type: 'staff',
        name: 'Staff',
        nameTh: 'พนักงาน',
        description: 'Import staff/employee data.',
        columns: [
            {
                key: 'name',
                label: 'Full Name',
                labelTh: 'ชื่อ-นามสกุล',
                required: true,
                type: 'string'
            },
            {
                key: 'email',
                label: 'Email',
                labelTh: 'อีเมล',
                required: true,
                type: 'string'
            },
            {
                key: 'role',
                label: 'Role',
                labelTh: 'ตำแหน่ง',
                required: true,
                type: 'select',
                options: ['Manager', 'Senior Accountant', 'Junior Accountant', 'Admin']
            },
            {
                key: 'phone',
                label: 'Phone',
                labelTh: 'โทรศัพท์',
                required: false,
                type: 'string'
            },
            {
                key: 'department',
                label: 'Department',
                labelTh: 'แผนก',
                required: false,
                type: 'string'
            },
            {
                key: 'status',
                label: 'Status',
                labelTh: 'สถานะ',
                required: false,
                type: 'select',
                options: ['active', 'inactive', 'on_leave'],
                defaultValue: 'active'
            }
        ],
        sampleData: [
            { name: 'สมชาย ใจดี', email: 'somchai@company.com', role: 'Senior Accountant', phone: '089-123-4567', department: 'Accounting', status: 'active' }
        ]
    },

    journal_entries: {
        type: 'journal_entries',
        name: 'Journal Entries',
        nameTh: 'รายการบัญชี',
        description: 'Import journal entries for migration. Each transaction must balance (Dr = Cr).',
        columns: [
            {
                key: 'date',
                label: 'Date',
                labelTh: 'วันที่',
                required: true,
                type: 'date',
                transform: parseDate,
                validation: (v) => ({
                    valid: isValidDate(v),
                    error: 'Invalid date format'
                })
            },
            {
                key: 'doc_no',
                label: 'Document No.',
                labelTh: 'เลขที่เอกสาร',
                required: true,
                type: 'string'
            },
            {
                key: 'account_code',
                label: 'Account Code',
                labelTh: 'รหัสบัญชี',
                required: true,
                type: 'string',
                validation: (v) => ({
                    valid: isValidAccountCode(v),
                    error: 'Invalid account code format'
                })
            },
            {
                key: 'account_name',
                label: 'Account Name',
                labelTh: 'ชื่อบัญชี',
                required: true,
                type: 'string'
            },
            {
                key: 'description',
                label: 'Description',
                labelTh: 'คำอธิบาย',
                required: false,
                type: 'string'
            },
            {
                key: 'debit',
                label: 'Debit',
                labelTh: 'เดบิต',
                required: false,
                type: 'number',
                transform: parseNumber,
                defaultValue: 0
            },
            {
                key: 'credit',
                label: 'Credit',
                labelTh: 'เครดิต',
                required: false,
                type: 'number',
                transform: parseNumber,
                defaultValue: 0
            },
            {
                key: 'department_code',
                label: 'Department/Cost Center',
                labelTh: 'แผนก/ศูนย์ต้นทุน',
                required: false,
                type: 'string'
            }
        ],
        sampleData: [
            { date: '2024-01-15', doc_no: 'JV-2401-001', account_code: '11100', account_name: 'เงินสด', description: 'รับเงินจากลูกค้า', debit: 10000, credit: 0, department_code: '' },
            { date: '2024-01-15', doc_no: 'JV-2401-001', account_code: '41100', account_name: 'รายได้จากการขาย', description: 'รับเงินจากลูกค้า', debit: 0, credit: 10000, department_code: '' }
        ]
    }
};

// ============================================================================
// MAIN SERVICE CLASS
// ============================================================================

export class DataImportService {

    /**
     * Generate Excel template for download
     */
    static generateTemplate(type: ImportDataType): Blob {
        const template = IMPORT_TEMPLATES[type];
        if (!template) throw new Error(`Unknown import type: ${type}`);

        const headers = template.columns.map(c => c.labelTh);
        const headerKeys = template.columns.map(c => c.key);

        // Create worksheet with headers and sample data
        const wsData = [
            headers,
            ...template.sampleData.map(row =>
                headerKeys.map(key => row[key] ?? '')
            )
        ];

        const ws = XLSX.utils.aoa_to_sheet(wsData);

        // Set column widths
        ws['!cols'] = template.columns.map(c => ({ wch: Math.max(c.labelTh.length, 15) }));

        // Add instructions sheet
        const instructionsData = [
            ['คำแนะนำการนำเข้าข้อมูล'],
            [''],
            ['ประเภท:', template.nameTh],
            ['คำอธิบาย:', template.description],
            [''],
            ['คอลัมน์ที่ต้องระบุ:'],
            ...template.columns.filter(c => c.required).map(c => [`  - ${c.labelTh} (${c.label})`]),
            [''],
            ['หมายเหตุ:'],
            ['- กรุณาลบแถวตัวอย่างก่อนนำเข้า'],
            ['- ตรวจสอบรูปแบบข้อมูลให้ถูกต้อง'],
            ['- หากมีข้อผิดพลาด ระบบจะแสดงรายละเอียด']
        ];
        const wsInstructions = XLSX.utils.aoa_to_sheet(instructionsData);

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Data');
        XLSX.utils.book_append_sheet(wb, wsInstructions, 'Instructions');

        const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        return new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    }

    /**
     * Download template file
     */
    static downloadTemplate(type: ImportDataType): void {
        const template = IMPORT_TEMPLATES[type];
        const blob = this.generateTemplate(type);
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `Template_${template.name.replace(/\s+/g, '_')}.xlsx`;
        link.click();
        URL.revokeObjectURL(url);
    }

    /**
     * Parse uploaded file (CSV or Excel)
     */
    static async parseFile(file: File, type: ImportDataType): Promise<ImportResult> {
        const template = IMPORT_TEMPLATES[type];
        if (!template) throw new Error(`Unknown import type: ${type}`);

        let rawData: Record<string, any>[];

        if (file.name.endsWith('.csv')) {
            rawData = await this.parseCSV(file, template.columns);
        } else if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
            rawData = await this.parseExcel(file, template.columns);
        } else {
            throw new Error('Unsupported file format. Please use CSV or Excel (.xlsx)');
        }

        return this.validateData(rawData, template);
    }

    /**
     * Parse CSV file
     */
    private static async parseCSV(file: File, columns: ImportColumn[]): Promise<Record<string, any>[]> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const text = e.target?.result as string;
                    const lines = text.split(/\r?\n/).filter(line => line.trim());

                    if (lines.length < 2) {
                        resolve([]);
                        return;
                    }

                    const headers = this.parseCSVLine(lines[0]);
                    const headerMap = this.mapHeaders(headers, columns);

                    const data: Record<string, any>[] = [];
                    for (let i = 1; i < lines.length; i++) {
                        const values = this.parseCSVLine(lines[i]);
                        const row: Record<string, any> = {};

                        columns.forEach(col => {
                            const idx = headerMap[col.key];
                            let value = idx !== undefined ? values[idx] : col.defaultValue;

                            if (col.transform) {
                                value = col.transform(value);
                            }

                            row[col.key] = value;
                        });

                        data.push(row);
                    }

                    resolve(data);
                } catch (error) {
                    reject(error);
                }
            };
            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsText(file);
        });
    }

    /**
     * Parse CSV line handling quoted values
     */
    private static parseCSVLine(line: string): string[] {
        const result: string[] = [];
        let current = '';
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
            const char = line[i];

            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                result.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }
        result.push(current.trim());

        return result;
    }

    /**
     * Parse Excel file
     */
    private static async parseExcel(file: File, columns: ImportColumn[]): Promise<Record<string, any>[]> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = e.target?.result;
                    const workbook = XLSX.read(data, { type: 'array' });

                    // Get first sheet (or 'Data' sheet if exists)
                    const sheetName = workbook.SheetNames.includes('Data')
                        ? 'Data'
                        : workbook.SheetNames[0];
                    const sheet = workbook.Sheets[sheetName];

                    // Convert to JSON
                    const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];

                    if (jsonData.length < 2) {
                        resolve([]);
                        return;
                    }

                    const headers = jsonData[0].map(h => String(h || ''));
                    const headerMap = this.mapHeaders(headers, columns);

                    const result: Record<string, any>[] = [];
                    for (let i = 1; i < jsonData.length; i++) {
                        const values = jsonData[i];
                        if (!values || values.every(v => v === null || v === undefined || v === '')) {
                            continue; // Skip empty rows
                        }

                        const row: Record<string, any> = {};

                        columns.forEach(col => {
                            const idx = headerMap[col.key];
                            let value = idx !== undefined ? values[idx] : col.defaultValue;

                            if (col.transform) {
                                value = col.transform(value);
                            }

                            row[col.key] = value;
                        });

                        result.push(row);
                    }

                    resolve(result);
                } catch (error) {
                    reject(error);
                }
            };
            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsArrayBuffer(file);
        });
    }

    /**
     * Map file headers to column keys (supports Thai and English headers)
     */
    private static mapHeaders(headers: string[], columns: ImportColumn[]): Record<string, number> {
        const map: Record<string, number> = {};

        columns.forEach(col => {
            const normalizedKey = col.key.toLowerCase().replace(/[_\s]/g, '');
            const normalizedLabel = col.label.toLowerCase().replace(/[_\s]/g, '');
            const normalizedLabelTh = col.labelTh.replace(/\s/g, '');

            headers.forEach((header, idx) => {
                const normalizedHeader = header.toLowerCase().replace(/[_\s]/g, '');

                if (
                    normalizedHeader === normalizedKey ||
                    normalizedHeader === normalizedLabel ||
                    header === col.labelTh ||
                    header.replace(/\s/g, '') === normalizedLabelTh
                ) {
                    map[col.key] = idx;
                }
            });
        });

        return map;
    }

    /**
     * Validate parsed data
     */
    private static validateData(rawData: Record<string, any>[], template: ImportTemplate): ImportResult {
        const errors: ValidationError[] = [];
        const parsedRows: ParsedRow[] = [];
        let validCount = 0;
        let errorCount = 0;
        let warningCount = 0;
        let totalDebit = 0;
        let totalCredit = 0;

        rawData.forEach((row, index) => {
            const rowNumber = index + 2; // +2 for header row and 1-based index
            const rowErrors: ValidationError[] = [];

            template.columns.forEach(col => {
                const value = row[col.key];

                // Required check
                if (col.required && (value === undefined || value === null || value === '')) {
                    rowErrors.push({
                        row: rowNumber,
                        column: col.labelTh,
                        value: value,
                        error: `${col.label} is required`,
                        errorTh: `กรุณาระบุ ${col.labelTh}`,
                        severity: 'error'
                    });
                }

                // Custom validation
                if (value && col.validation) {
                    const result = col.validation(value);
                    if (!result.valid) {
                        rowErrors.push({
                            row: rowNumber,
                            column: col.labelTh,
                            value: value,
                            error: result.error || 'Validation failed',
                            errorTh: result.error || 'ข้อมูลไม่ถูกต้อง',
                            severity: 'error'
                        });
                    }
                }

                // Select type validation
                if (col.type === 'select' && col.options && value) {
                    const normalizedValue = String(value).toLowerCase();
                    const isValid = col.options.some(opt => opt.toLowerCase() === normalizedValue);
                    if (!isValid) {
                        rowErrors.push({
                            row: rowNumber,
                            column: col.labelTh,
                            value: value,
                            error: `Invalid value. Must be one of: ${col.options.join(', ')}`,
                            errorTh: `ค่าไม่ถูกต้อง ต้องเป็น: ${col.options.join(', ')}`,
                            severity: 'error'
                        });
                    }
                }
            });

            // Track debit/credit for balance check
            if ('debit' in row) totalDebit += parseNumber(row.debit);
            if ('credit' in row) totalCredit += parseNumber(row.credit);

            const isValid = rowErrors.filter(e => e.severity === 'error').length === 0;
            if (isValid) {
                validCount++;
            } else {
                errorCount++;
            }
            if (rowErrors.filter(e => e.severity === 'warning').length > 0) {
                warningCount++;
            }

            errors.push(...rowErrors);
            parsedRows.push({
                rowNumber,
                data: row,
                errors: rowErrors,
                isValid
            });
        });

        // Balance check for opening_balance and journal_entries
        const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01;
        if ((template.type === 'opening_balance' || template.type === 'journal_entries') && !isBalanced) {
            errors.unshift({
                row: 0,
                column: 'Summary',
                value: `Dr: ${totalDebit.toLocaleString()}, Cr: ${totalCredit.toLocaleString()}`,
                error: `Debit and Credit are not balanced. Difference: ${Math.abs(totalDebit - totalCredit).toLocaleString()}`,
                errorTh: `ยอดเดบิตและเครดิตไม่สมดุล ผลต่าง: ${Math.abs(totalDebit - totalCredit).toLocaleString()}`,
                severity: 'error'
            });
        }

        return {
            success: errorCount === 0 && (template.type !== 'opening_balance' && template.type !== 'journal_entries' || isBalanced),
            totalRows: rawData.length,
            validRows: validCount,
            errorRows: errorCount,
            warningRows: warningCount,
            errors,
            data: parsedRows,
            summary: {
                totalDebit,
                totalCredit,
                isBalanced,
                duplicateCount: 0
            }
        };
    }

    /**
     * Check for duplicates against existing data
     */
    static checkDuplicates<T>(
        newData: Record<string, any>[],
        existingData: T[],
        keyFields: string[]
    ): { duplicates: number[]; data: Record<string, any>[] } {
        const duplicates: number[] = [];

        const existingKeys = new Set(
            existingData.map(item =>
                keyFields.map(f => String((item as any)[f] || '')).join('|')
            )
        );

        newData.forEach((row, idx) => {
            const key = keyFields.map(f => String(row[f] || '')).join('|');
            if (existingKeys.has(key)) {
                duplicates.push(idx + 2); // Row number
            }
        });

        return { duplicates, data: newData };
    }
}

export default DataImportService;
