
export interface JournalLine {
  id?: string; // For UI handling
  account_code: string; // Added GL Code
  account_side: 'DEBIT' | 'CREDIT';
  account_name_th: string;
  department_code?: string; // NEW: Cost Center / Project
  amount: number;
  auto_mapped?: boolean; // NEW: Flag for Rule-based automation
}

export interface AccountingEntry {
  transaction_description: string;
  account_class: string;
  journal_lines: JournalLine[];
}

export interface Financials {
  subtotal: number;
  discount: number;
  vat_rate: number;
  vat_amount: number;
  grand_total: number;
  wht_amount: number | null;
}

export interface CompanyInfo {
  name: string;
  tax_id: string;
  address?: string; // Added for WHT
  branch?: string;
}

export interface Parties {
  client_company: CompanyInfo;
  counterparty: CompanyInfo;
}

export interface TaxPeriod {
  month: string; // "02"
  year: string; // "2024"
}

export interface HeaderData {
  doc_type: string;
  issue_date: string;
  inv_number: string;
  currency: string;
  vat_period?: TaxPeriod; // NEW: For VAT reporting period
}

export interface FileMetadata {
  suggested_filename: string;
  suggested_folder_path: string;
}

export interface WHTDetails {
  book_number: string;
  doc_number: string;
  payment_date: string;
  condition: number; // 1=Withheld at source, 2=Paid for, 3=Other
}

export interface TaxCompliance {
  is_full_tax_invoice: boolean;
  vat_claimable: boolean;
  wht_flag: boolean;
  wht_code?: 'PND3' | 'PND53'; // Added tax form type
  wht_rate?: number;
  wht_details?: WHTDetails; // NEW: For 50 Tawi specific fields
}

// --- NEW AUDIT TYPES ---

export interface AuditFlag {
  severity: 'low' | 'medium' | 'high';
  code: string;
  message: string; // e.g., "Duplicate Invoice Number detected", "WHT rate mismatch"
}

export interface AccountingResponse {
  status: 'success' | 'needs_review' | 'auto_approved'; // Added auto_approved
  confidence_score: number; // 0-100
  audit_flags: AuditFlag[]; // New field for AI Auditor
  review_reason: string | null;
  file_metadata: FileMetadata;
  header_data: HeaderData;
  parties: Parties;
  financials: Financials;
  accounting_entry: AccountingEntry;
  tax_compliance: TaxCompliance;
}

export interface AnalysisState {
  isLoading: boolean;
  data: AccountingResponse | null;
  error: string | null;
}

// --- MANAGEMENT TYPES ---

export type StaffRole = 'Manager' | 'Senior Accountant' | 'Junior Accountant' | 'Admin';

export interface Staff {
  id: string;
  name: string;
  first_name?: string;
  last_name?: string;
  role: StaffRole;
  avatar_url?: string;
  active_tasks: number;
  email: string;
  status?: 'active' | 'inactive' | 'on_leave';
  phone?: string;
  department?: string;
  assigned_clients?: string[];
  skills?: string[];
  workload_capacity?: number; // Max tasks they can handle
  hourly_rate?: number; // For payroll
}

export type DocumentStatus = 'uploading' | 'processing' | 'pending_review' | 'in_progress' | 'approved' | 'rejected' | 'reconciled';

export interface DocumentRecord {
  id: string;
  uploaded_at: string; // ISO Date
  filename: string;
  ai_data: AccountingResponse | null; // Null if processing
  status: DocumentStatus;
  assigned_to: string | null; // Staff ID
  client_name: string;
  clientId?: string; // Client ID reference for multi-tenancy
  amount: number;
  selected?: boolean; // For Batch Operations

  // File Storage References
  file_url?: string; // Firebase Storage download URL
  storage_path?: string; // Firebase Storage path for deletion/management
  mime_type?: string; // File MIME type

  // Period-based Indexing (for efficient queries)
  year?: number; // 2024
  month?: string; // "01"-"12"
  period?: string; // "2024-01" format for filtering
}

// --- NEW RECONCILIATION TYPES ---

export interface BankTransaction {
  id: string;
  clientId: string; // NEW: Multi-tenancy support
  date: string;
  description: string;
  amount: number; // Negative for withdrawal, Positive for deposit
  matched_doc_id?: string;
  status: 'unmatched' | 'matched';
}

// --- NEW CLIENT & REPORTING TYPES ---

export type WorkflowStatus = 'Not Started' | 'In Progress' | 'Reviewing' | 'Ready to File' | 'Filed/Closed';

export interface IssueTicket {
  id: string;
  severity: 'High' | 'Medium' | 'Low';
  title: string;
  description: string;
  created_at: string;
  related_doc_id?: string; // Link to specific document
  action_type: 'review_doc' | 'bank_recon' | 'general'; // Action to take
}

// NEW: Client-Facing Requests (What we need from them)
export interface ClientRequest {
  id: string;
  title: string;
  description: string;
  due_date: string;
  status: 'Pending' | 'Uploaded' | 'Completed';
  request_type: 'BankStatement' | 'TaxForm' | 'Clarification';
}

// NEW: Published Reports (What we send to them)
export interface PublishedReport {
  id: string;
  title: string; // e.g., "งบการเงินปี 2566", "ภ.พ.30 ก.พ. 67"
  type: 'Financial Statement' | 'Tax Return' | 'Management Report';
  generated_date: string;
  download_url: string;
}

export interface MonthlyWorkflow {
  month: string; // "2024-02"
  vat_status: WorkflowStatus;
  wht_status: WorkflowStatus;
  closing_status: WorkflowStatus;
  is_locked: boolean; // NEW: Prevent editing after closing
  doc_count: number;
  pending_count: number;
  issues: IssueTicket[]; // List of specific problems requiring human intervention
}

export interface Client {
  id: string;
  name: string;
  company_name?: string; // Alias for name
  tax_id: string;
  address?: string;
  industry: string;
  contact_person: string;
  contact_email?: string;
  contact_phone?: string;
  status: 'Active' | 'Suspended';
  assigned_staff_id: string;
  last_closing_date: string;
  current_workflow?: MonthlyWorkflow; // Made optional to prevent errors
  client_requests?: ClientRequest[];
  published_reports?: PublishedReport[];
  branches?: string[]; // For multi-branch clients
  ecommerce_platforms?: string[]; // Linked platforms
}

export interface TaxReportSummary {
  month: string;
  year: number;
  total_vat_buy: number;
  total_vat_sell: number;
  total_wht_remit: number;
  doc_count: number;
}

export interface GLAccount {
  code: string;
  name: string;
}

// NEW: Posted GL Entry for History
export interface PostedGLEntry {
  id: string;
  clientId: string; // Multi-tenancy support - Needed for filtering by client
  date: string;
  doc_no: string;
  description: string;
  account_code: string;
  account_name: string;
  department_code?: string; // Cost Center / Project Support
  debit: number;
  credit: number;
  system_generated?: boolean; // To identify auto-closing entries

  // Period-based Indexing (for efficient queries)
  year?: number; // 2024
  month?: string; // "01"-"12"
  period?: string; // "2024-01" format for filtering
  source_doc_id?: string; // Link to original document
}

// NEW: Fixed Asset for Register
export interface FixedAsset {
  id: string;
  clientId: string; // NEW: Relation to Client
  asset_code: string; // 12400-001
  name: string;
  category: 'Equipment' | 'Vehicle' | 'Building' | 'Land' | 'Software';
  acquisition_date: string;
  cost: number;
  residual_value: number;
  useful_life_years: number;
  accumulated_depreciation_bf: number; // Brought forward
  current_month_depreciation: number;
}

// NEW: Automation Rules
export interface VendorRule {
  id: string;
  clientId?: string; // NEW: Per-client rules (null = global/template)
  vendorNameKeyword: string;
  accountCode: string;
  accountName: string;
  vatType: 'CLAIMABLE' | 'NON_CLAIMABLE' | 'EXEMPT';
  whtRate?: number; // NEW: WHT rate for this vendor
  description?: string; // NEW: Description/notes
  isActive?: boolean; // NEW: Enable/disable rule
  createdAt?: string; // NEW: Audit trail
  createdBy?: string; // NEW: Who created
}

// SYSTEMATIC: Audit Trail & Activity Log
export interface ActivityLog {
  id: string;
  timestamp: string; // ISO String
  user_id: string;
  user_name: string;
  action: 'UPLOAD' | 'APPROVE' | 'POST_GL' | 'CLOSE_PERIOD' | 'LOGIN' | 'RECONCILE' | 'ADD_ASSET' | 'CREATE_TASK' | 'UPDATE_TASK' | 'DELETE_TASK' | 'IMPORT';
  details: string;
  entity_id?: string; // Link to specific object
  status?: 'success' | 'warning' | 'error';
}

// Authentication User Type (Single Source of Truth)
// Used across auth service, contexts, and components
export interface AuthUser {
  uid: string;
  staffId: string;
  email: string | null;
  displayName: string | null;
  avatar?: string;
  role: StaffRole | string; // StaffRole for typed use, string for Firebase flexibility
  assignedClients: string[];
  createdAt?: string;
  lastLogin?: string;
}

