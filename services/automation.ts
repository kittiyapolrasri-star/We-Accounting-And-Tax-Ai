/**
 * Smart Automation Engine
 * Automates repetitive accounting tasks to minimize manual work
 */

import { DocumentRecord, PostedGLEntry, VendorRule, Client, AccountingResponse } from '../types';

// Automation Rule Types
export interface AutomationRule {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  priority: number; // Higher = runs first
  conditions: AutomationCondition[];
  actions: AutomationAction[];
  createdAt: string;
  lastTriggered?: string;
  triggerCount: number;
}

export interface AutomationCondition {
  field: string;
  operator: 'equals' | 'contains' | 'greater_than' | 'less_than' | 'between' | 'in_list';
  value: string | number | string[];
  value2?: number; // For 'between' operator
}

export interface AutomationAction {
  type: 'auto_approve' | 'auto_post' | 'assign_staff' | 'send_notification' | 'apply_account' | 'flag_review';
  params: Record<string, any>;
}

// Auto-Approval Configuration
export interface AutoApprovalConfig {
  enabled: boolean;
  maxAmount: number;
  minConfidenceScore: number;
  requireFullTaxInvoice: boolean;
  allowedDocTypes: string[];
  excludedVendors: string[];
  requireNoAuditFlags: boolean;
}

// Batch Processing Result
export interface BatchProcessResult {
  totalProcessed: number;
  autoApproved: number;
  autoPosted: number;
  flaggedForReview: number;
  errors: { docId: string; error: string }[];
  glEntriesGenerated: PostedGLEntry[];
  processingTime: number;
}

// Smart Suggestion
export interface SmartSuggestion {
  type: 'account' | 'vendor' | 'amount' | 'tax';
  field: string;
  suggestedValue: string;
  confidence: number;
  reason: string;
}

// Default Auto-Approval Configuration
export const DEFAULT_AUTO_APPROVAL_CONFIG: AutoApprovalConfig = {
  enabled: true,
  maxAmount: 50000, // Auto-approve up to 50,000 THB
  minConfidenceScore: 95,
  requireFullTaxInvoice: true,
  allowedDocTypes: ['Tax Invoice', 'Receipt', 'Invoice'],
  excludedVendors: [],
  requireNoAuditFlags: true,
};

// Default Automation Rules
export const DEFAULT_AUTOMATION_RULES: AutomationRule[] = [
  {
    id: 'RULE-001',
    name: 'Auto-approve small purchases',
    description: 'อนุมัติอัตโนมัติสำหรับค่าใช้จ่ายเล็กน้อยที่ AI มั่นใจสูง',
    enabled: true,
    priority: 100,
    conditions: [
      { field: 'amount', operator: 'less_than', value: 10000 },
      { field: 'confidence_score', operator: 'greater_than', value: 95 },
      { field: 'audit_flags', operator: 'equals', value: 0 },
    ],
    actions: [
      { type: 'auto_approve', params: {} },
      { type: 'auto_post', params: {} },
    ],
    createdAt: new Date().toISOString(),
    triggerCount: 0,
  },
  {
    id: 'RULE-002',
    name: 'Auto-classify utilities',
    description: 'จำแนกบัญชีอัตโนมัติสำหรับค่าสาธารณูปโภค',
    enabled: true,
    priority: 90,
    conditions: [
      { field: 'vendor_name', operator: 'in_list', value: ['การไฟฟ้า', 'การประปา', 'TOT', 'TRUE', 'AIS', 'DTAC'] },
    ],
    actions: [
      { type: 'apply_account', params: { accountCode: '53100', accountName: 'ค่าสาธารณูปโภค' } },
    ],
    createdAt: new Date().toISOString(),
    triggerCount: 0,
  },
  {
    id: 'RULE-003',
    name: 'Flag high-value transactions',
    description: 'ส่งตรวจสอบสำหรับรายการมูลค่าสูง',
    enabled: true,
    priority: 80,
    conditions: [
      { field: 'amount', operator: 'greater_than', value: 100000 },
    ],
    actions: [
      { type: 'flag_review', params: { reason: 'มูลค่าสูงกว่า 100,000 บาท' } },
      { type: 'send_notification', params: { to: 'manager', template: 'high_value_alert' } },
    ],
    createdAt: new Date().toISOString(),
    triggerCount: 0,
  },
];

/**
 * Check if document matches automation conditions
 */
export const matchesConditions = (
  doc: DocumentRecord,
  conditions: AutomationCondition[]
): boolean => {
  if (!doc.ai_data) return false;

  for (const condition of conditions) {
    let fieldValue: any;

    // Extract field value from document
    switch (condition.field) {
      case 'amount':
        fieldValue = doc.ai_data.financials.grand_total;
        break;
      case 'confidence_score':
        fieldValue = doc.ai_data.confidence_score;
        break;
      case 'audit_flags':
        fieldValue = doc.ai_data.audit_flags?.length || 0;
        break;
      case 'vendor_name':
        fieldValue = doc.ai_data.parties.counterparty.name;
        break;
      case 'doc_type':
        fieldValue = doc.ai_data.header_data.doc_type;
        break;
      case 'vat_claimable':
        fieldValue = doc.ai_data.tax_compliance.vat_claimable;
        break;
      case 'wht_flag':
        fieldValue = doc.ai_data.tax_compliance.wht_flag;
        break;
      default:
        continue;
    }

    // Evaluate condition
    let matches = false;
    switch (condition.operator) {
      case 'equals':
        matches = fieldValue === condition.value;
        break;
      case 'contains':
        matches = String(fieldValue).toLowerCase().includes(String(condition.value).toLowerCase());
        break;
      case 'greater_than':
        matches = Number(fieldValue) > Number(condition.value);
        break;
      case 'less_than':
        matches = Number(fieldValue) < Number(condition.value);
        break;
      case 'between':
        matches = Number(fieldValue) >= Number(condition.value) &&
          Number(fieldValue) <= Number(condition.value2 || condition.value);
        break;
      case 'in_list':
        const valueList = Array.isArray(condition.value) ? condition.value : [condition.value];
        matches = valueList.some(v =>
          String(fieldValue).toLowerCase().includes(String(v).toLowerCase())
        );
        break;
    }

    if (!matches) return false;
  }

  return true;
};

/**
 * Check if document can be auto-approved
 */
export const canAutoApprove = (
  doc: DocumentRecord,
  config: AutoApprovalConfig
): { approved: boolean; reason: string } => {
  if (!config.enabled) {
    return { approved: false, reason: 'Auto-approval is disabled' };
  }

  if (!doc.ai_data) {
    return { approved: false, reason: 'No AI data available' };
  }

  const aiData = doc.ai_data;

  // Check confidence score
  if (aiData.confidence_score < config.minConfidenceScore) {
    return {
      approved: false,
      reason: `Confidence score (${aiData.confidence_score}%) below threshold (${config.minConfidenceScore}%)`,
    };
  }

  // Check amount
  if (aiData.financials.grand_total > config.maxAmount) {
    return {
      approved: false,
      reason: `Amount (${aiData.financials.grand_total}) exceeds limit (${config.maxAmount})`,
    };
  }

  // Check audit flags
  if (config.requireNoAuditFlags && aiData.audit_flags && aiData.audit_flags.length > 0) {
    return {
      approved: false,
      reason: `Has ${aiData.audit_flags.length} audit flag(s)`,
    };
  }

  // Check tax invoice requirement
  if (config.requireFullTaxInvoice && !aiData.tax_compliance.is_full_tax_invoice) {
    return {
      approved: false,
      reason: 'Not a full tax invoice',
    };
  }

  // Check document type
  if (config.allowedDocTypes.length > 0) {
    const docType = aiData.header_data.doc_type;
    if (!config.allowedDocTypes.some(t => docType.toLowerCase().includes(t.toLowerCase()))) {
      return {
        approved: false,
        reason: `Document type "${docType}" not in allowed list`,
      };
    }
  }

  // Check excluded vendors
  const vendorName = aiData.parties.counterparty.name;
  if (config.excludedVendors.some(v => vendorName.toLowerCase().includes(v.toLowerCase()))) {
    return {
      approved: false,
      reason: `Vendor "${vendorName}" is in excluded list`,
    };
  }

  return {
    approved: true,
    reason: 'All auto-approval criteria met',
  };
};

/**
 * Generate GL entries from approved document
 */
export const generateGLFromDocument = (
  doc: DocumentRecord,
  clientId: string
): PostedGLEntry[] => {
  if (!doc.ai_data) return [];

  const entries: PostedGLEntry[] = [];
  const aiData = doc.ai_data;
  const timestamp = Date.now();

  aiData.accounting_entry.journal_lines.forEach((line, index) => {
    entries.push({
      id: `GL-AUTO-${doc.id}-${index}-${timestamp}`,
      clientId,
      date: aiData.header_data.issue_date,
      doc_no: aiData.header_data.inv_number,
      description: aiData.accounting_entry.transaction_description,
      account_code: line.account_code,
      account_name: line.account_name_th,
      department_code: line.department_code,
      debit: line.account_side === 'DEBIT' ? line.amount : 0,
      credit: line.account_side === 'CREDIT' ? line.amount : 0,
      system_generated: true,
    });
  });

  return entries;
};

/**
 * Process documents in batch with automation
 */
export const batchProcessDocuments = async (
  documents: DocumentRecord[],
  clientId: string,
  config: AutoApprovalConfig,
  rules: AutomationRule[],
  vendorRules: VendorRule[]
): Promise<BatchProcessResult> => {
  const startTime = Date.now();
  const result: BatchProcessResult = {
    totalProcessed: 0,
    autoApproved: 0,
    autoPosted: 0,
    flaggedForReview: 0,
    errors: [],
    glEntriesGenerated: [],
    processingTime: 0,
  };

  // Sort rules by priority
  const sortedRules = [...rules].sort((a, b) => b.priority - a.priority);

  for (const doc of documents) {
    if (doc.status !== 'pending_review') continue;

    result.totalProcessed++;

    try {
      // Apply vendor rules first
      if (doc.ai_data) {
        const vendorName = doc.ai_data.parties.counterparty.name.toLowerCase();
        const matchingRule = vendorRules.find(r =>
          vendorName.includes(r.vendorNameKeyword.toLowerCase())
        );

        if (matchingRule) {
          // Update journal lines with learned account
          doc.ai_data.accounting_entry.journal_lines = doc.ai_data.accounting_entry.journal_lines.map(line => {
            if (line.account_side === 'DEBIT') {
              return {
                ...line,
                account_code: matchingRule.accountCode,
                account_name_th: matchingRule.accountName,
                auto_mapped: true,
              };
            }
            return line;
          });
        }
      }

      // Apply automation rules
      for (const rule of sortedRules) {
        if (!rule.enabled) continue;
        if (!matchesConditions(doc, rule.conditions)) continue;

        // Execute actions
        for (const action of rule.actions) {
          switch (action.type) {
            case 'auto_approve':
              const approvalResult = canAutoApprove(doc, config);
              if (approvalResult.approved) {
                doc.status = 'approved';
                result.autoApproved++;
              }
              break;

            case 'auto_post':
              if (doc.status === 'approved') {
                const glEntries = generateGLFromDocument(doc, clientId);
                result.glEntriesGenerated.push(...glEntries);
                result.autoPosted++;
              }
              break;

            case 'flag_review':
              if (doc.ai_data) {
                doc.ai_data.audit_flags = doc.ai_data.audit_flags || [];
                doc.ai_data.audit_flags.push({
                  severity: 'medium',
                  code: 'AUTO_FLAG',
                  message: action.params.reason || 'Flagged by automation rule',
                });
              }
              result.flaggedForReview++;
              break;

            case 'apply_account':
              if (doc.ai_data) {
                doc.ai_data.accounting_entry.journal_lines = doc.ai_data.accounting_entry.journal_lines.map(line => {
                  if (line.account_side === 'DEBIT') {
                    return {
                      ...line,
                      account_code: action.params.accountCode,
                      account_name_th: action.params.accountName,
                      auto_mapped: true,
                    };
                  }
                  return line;
                });
              }
              break;
          }
        }

        // Update rule trigger count
        rule.triggerCount++;
        rule.lastTriggered = new Date().toISOString();
      }

      // Final auto-approval check if not yet approved
      if (doc.status === 'pending_review') {
        const approvalResult = canAutoApprove(doc, config);
        if (approvalResult.approved) {
          doc.status = 'approved';
          result.autoApproved++;

          const glEntries = generateGLFromDocument(doc, clientId);
          result.glEntriesGenerated.push(...glEntries);
          result.autoPosted++;
        }
      }

    } catch (error) {
      result.errors.push({
        docId: doc.id,
        error: String(error),
      });
    }
  }

  result.processingTime = Date.now() - startTime;
  return result;
};

/**
 * Generate smart suggestions based on historical data
 */
export const generateSmartSuggestions = (
  doc: DocumentRecord,
  historicalDocs: DocumentRecord[],
  vendorRules: VendorRule[]
): SmartSuggestion[] => {
  const suggestions: SmartSuggestion[] = [];

  if (!doc.ai_data) return suggestions;

  const vendorName = doc.ai_data.parties.counterparty.name.toLowerCase();

  // Check vendor rules
  const matchingRule = vendorRules.find(r =>
    vendorName.includes(r.vendorNameKeyword.toLowerCase())
  );

  if (matchingRule) {
    suggestions.push({
      type: 'account',
      field: 'account_code',
      suggestedValue: `${matchingRule.accountCode} - ${matchingRule.accountName}`,
      confidence: 95,
      reason: `Based on vendor rule: "${matchingRule.vendorNameKeyword}"`,
    });
  }

  // Check historical documents from same vendor
  const sameVendorDocs = historicalDocs.filter(d =>
    d.status === 'approved' &&
    d.ai_data?.parties.counterparty.name.toLowerCase().includes(vendorName)
  );

  if (sameVendorDocs.length > 0 && !matchingRule) {
    // Find most common account used
    const accountCounts: Record<string, { count: number; name: string }> = {};

    sameVendorDocs.forEach(d => {
      d.ai_data?.accounting_entry.journal_lines.forEach(line => {
        if (line.account_side === 'DEBIT') {
          const key = line.account_code;
          if (!accountCounts[key]) {
            accountCounts[key] = { count: 0, name: line.account_name_th };
          }
          accountCounts[key].count++;
        }
      });
    });

    const mostCommon = Object.entries(accountCounts).sort((a, b) => b[1].count - a[1].count)[0];
    if (mostCommon) {
      const confidence = Math.min(90, 50 + mostCommon[1].count * 10);
      suggestions.push({
        type: 'account',
        field: 'account_code',
        suggestedValue: `${mostCommon[0]} - ${mostCommon[1].name}`,
        confidence,
        reason: `Used ${mostCommon[1].count} times for this vendor`,
      });
    }
  }

  // Tax suggestions
  if (doc.ai_data.tax_compliance.wht_flag && !doc.ai_data.tax_compliance.wht_rate) {
    suggestions.push({
      type: 'tax',
      field: 'wht_rate',
      suggestedValue: '3',
      confidence: 80,
      reason: 'Default WHT rate for services',
    });
  }

  return suggestions;
};

/**
 * Calculate automation statistics
 */
export const calculateAutomationStats = (
  documents: DocumentRecord[],
  period: { startDate: string; endDate: string }
): {
  totalDocuments: number;
  autoApproved: number;
  autoApprovedAmount: number;
  manuallyProcessed: number;
  automationRate: number;
  timeSaved: number; // in minutes
  costSaved: number; // in THB
} => {
  const periodDocs = documents.filter(d => {
    const docDate = d.ai_data?.header_data.issue_date || d.uploaded_at;
    return docDate >= period.startDate && docDate <= period.endDate;
  });

  const autoApprovedDocs = periodDocs.filter(d =>
    d.status === 'approved' && d.ai_data?.status === 'auto_approved'
  );

  const totalDocuments = periodDocs.length;
  const autoApproved = autoApprovedDocs.length;
  const autoApprovedAmount = autoApprovedDocs.reduce((sum, d) =>
    sum + (d.ai_data?.financials.grand_total || 0), 0
  );
  const manuallyProcessed = totalDocuments - autoApproved;
  const automationRate = totalDocuments > 0 ? (autoApproved / totalDocuments) * 100 : 0;

  // Assume 5 minutes saved per auto-approved document
  const timeSaved = autoApproved * 5;
  // Assume 50 THB per minute of accountant time
  const costSaved = timeSaved * 50;

  return {
    totalDocuments,
    autoApproved,
    autoApprovedAmount,
    manuallyProcessed,
    automationRate,
    timeSaved,
    costSaved,
  };
};

/**
 * Get pending tasks that require attention
 */
export const getPendingTasks = (
  documents: DocumentRecord[],
  clients: Client[]
): {
  urgent: { type: string; description: string; deadline?: string; clientName?: string }[];
  normal: { type: string; description: string; clientName?: string }[];
} => {
  const urgent: { type: string; description: string; deadline?: string; clientName?: string }[] = [];
  const normal: { type: string; description: string; clientName?: string }[] = [];

  // Check pending documents
  const pendingDocs = documents.filter(d => d.status === 'pending_review');
  if (pendingDocs.length > 10) {
    urgent.push({
      type: 'documents',
      description: `มี ${pendingDocs.length} เอกสารรอตรวจสอบ`,
    });
  } else if (pendingDocs.length > 0) {
    normal.push({
      type: 'documents',
      description: `มี ${pendingDocs.length} เอกสารรอตรวจสอบ`,
    });
  }

  // Check flagged documents
  const flaggedDocs = documents.filter(d =>
    d.ai_data?.audit_flags && d.ai_data.audit_flags.some(f => f.severity === 'high')
  );
  if (flaggedDocs.length > 0) {
    urgent.push({
      type: 'audit',
      description: `มี ${flaggedDocs.length} เอกสารที่มี Audit Flag ความสำคัญสูง`,
    });
  }

  // Check client issues
  clients.forEach(client => {
    if ((client.current_workflow?.issues?.length ?? 0) > 0) {
      const highIssues = (client.current_workflow?.issues ?? []).filter(i => i.severity === 'High');
      if (highIssues.length > 0) {
        urgent.push({
          type: 'client_issue',
          description: `${client.name}: มี ${highIssues.length} ปัญหาเร่งด่วน`,
          clientName: client.name,
        });
      }
    }

    // Check tax deadlines (7th of next month for WHT, 15th for VAT)
    const today = new Date();
    const dayOfMonth = today.getDate();
    if (dayOfMonth >= 1 && dayOfMonth <= 7) {
      if (client.current_workflow?.wht_status !== 'Filed/Closed') {
        urgent.push({
          type: 'tax_deadline',
          description: `${client.name}: ใกล้ครบกำหนดยื่น ภ.ง.ด.`,
          deadline: `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-07`,
          clientName: client.name,
        });
      }
    }
    if (dayOfMonth >= 8 && dayOfMonth <= 15) {
      if (client.current_workflow?.vat_status !== 'Filed/Closed') {
        urgent.push({
          type: 'tax_deadline',
          description: `${client.name}: ใกล้ครบกำหนดยื่น ภ.พ.30`,
          deadline: `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-15`,
          clientName: client.name,
        });
      }
    }
  });

  return { urgent, normal };
};

export default {
  canAutoApprove,
  batchProcessDocuments,
  generateSmartSuggestions,
  generateGLFromDocument,
  matchesConditions,
  calculateAutomationStats,
  getPendingTasks,
  DEFAULT_AUTO_APPROVAL_CONFIG,
  DEFAULT_AUTOMATION_RULES,
};
