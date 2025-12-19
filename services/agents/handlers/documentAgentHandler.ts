/**
 * Document Agent Handler
 * 
 * AI Agent สำหรับประมวลผลเอกสารอัตโนมัติ
 * - รับเอกสาร → วิเคราะห์ → จับคู่รหัสบัญชี → เตรียม Journal Entry
 */

import { AgentHandler, AgentContext } from '../agentOrchestrator';
import { AgentInput, AgentOutput } from '../../../types/agents';
import { DocumentRecord, AccountingResponse, PostedGLEntry } from '../../../types';
import { analyzeDocument } from '../../geminiService';
import { validateGLPosting, GLPostingRequest } from '../../accountingValidation';
import { databaseService } from '../../database';

// ============================================================================
// DOCUMENT AGENT TYPES
// ============================================================================

export interface DocumentAgentInput extends AgentInput {
    documentId?: string;
    file?: File;
    clientId: string;
    autoPost?: boolean;
    validateOnly?: boolean;
}

export interface DocumentAgentOutput extends AgentOutput {
    documentId: string;
    aiAnalysis?: AccountingResponse;
    journalEntries?: Omit<PostedGLEntry, 'id'>[];
    validationResult?: {
        isValid: boolean;
        errors: string[];
        warnings: string[];
    };
    postedEntryIds?: string[];
    processingTime: number;
    message?: string;
    messageTh?: string;
    escalationRequired?: boolean;
    escalationReason?: string;
    suggestions?: Array<{
        action: string;
        description: string;
        priority: string;
    }>;
    confidence?: number;
}

// ============================================================================
// DOCUMENT AGENT HANDLER
// ============================================================================

const executeDocumentAgent = async (
    input: DocumentAgentInput,
    context: AgentContext
): Promise<DocumentAgentOutput> => {
    const startTime = Date.now();
    const output: DocumentAgentOutput = {
        success: false,
        documentId: input.documentId || `DOC-${Date.now()}`,
        processingTime: 0
    };

    try {
        // Step 1: Get or analyze document
        let aiAnalysis: AccountingResponse | null = null;

        if (input.documentId) {
            // Existing document - retrieve from database
            const docs = await databaseService.getDocuments();
            const doc = docs.find((d: DocumentRecord) => d.id === input.documentId);

            if (!doc) {
                output.message = `Document ${input.documentId} not found`;
                output.messageTh = `ไม่พบเอกสาร ${input.documentId}`;
                output.escalationRequired = true;
                output.escalationReason = 'Document not found';
                return output;
            }

            if (doc.ai_data) {
                aiAnalysis = doc.ai_data;
            }
        } else if (input.file) {
            // New file - analyze with AI
            aiAnalysis = await analyzeDocument(input.file, input.clientId);
        } else {
            output.message = 'No document or file provided';
            output.messageTh = 'ไม่มีเอกสารหรือไฟล์ที่ให้มา';
            output.escalationRequired = true;
            return output;
        }

        if (!aiAnalysis) {
            output.message = 'Failed to analyze document';
            output.messageTh = 'ไม่สามารถวิเคราะห์เอกสารได้';
            output.escalationRequired = true;
            return output;
        }

        output.aiAnalysis = aiAnalysis;

        // Step 2: Convert to Journal Entries
        const journalEntries: Omit<PostedGLEntry, 'id'>[] = aiAnalysis.accounting_entry.journal_lines.map(
            (line) => ({
                clientId: input.clientId,
                date: aiAnalysis!.header_data.issue_date,
                doc_no: aiAnalysis!.header_data.inv_number,
                description: aiAnalysis!.accounting_entry.transaction_description,
                account_code: line.account_code,
                account_name: line.account_name_th,
                department_code: line.department_code,
                debit: line.account_side === 'DEBIT' ? line.amount : 0,
                credit: line.account_side === 'CREDIT' ? line.amount : 0,
                source_doc_id: output.documentId
            })
        );

        output.journalEntries = journalEntries;

        // Step 3: Validate
        const validationRequest: GLPostingRequest = {
            entries: journalEntries as any,
            clientId: input.clientId,
            periodMonth: aiAnalysis.header_data.issue_date.slice(0, 7),
            sourceDocId: output.documentId,
            userId: context.userId || 'ai-agent'
        };

        const validation = await validateGLPosting(validationRequest);

        output.validationResult = {
            isValid: validation.isValid,
            errors: validation.errors.map((e: { message: string }) => e.message),
            warnings: validation.warnings.map((w: { message: string }) => w.message)
        };

        // Check if escalation needed
        if (aiAnalysis.confidence_score < 70) {
            output.escalationRequired = true;
            output.escalationReason = `Low confidence score: ${aiAnalysis.confidence_score}%`;
            output.message = 'Document requires human review due to low confidence';
            output.messageTh = 'เอกสารต้องการการตรวจสอบ เนื่องจากความมั่นใจต่ำ';
        }

        if (!validation.isValid) {
            output.escalationRequired = true;
            output.escalationReason = `Validation failed: ${validation.errors.map((e: { message: string }) => e.message).join(', ')}`;
            output.message = 'Journal entries failed validation';
            output.messageTh = 'รายการบันทึกบัญชีไม่ผ่านการตรวจสอบ';
        }

        // Step 4: Auto-post if enabled and valid
        if (input.autoPost && validation.isValid && aiAnalysis.confidence_score >= 85) {
            if (!input.validateOnly) {
                const entryIds = await databaseService.addGLEntries(journalEntries as any);
                output.postedEntryIds = entryIds;

                // Update document status
                if (input.documentId) {
                    const docs = await databaseService.getDocuments();
                    const doc = docs.find((d: DocumentRecord) => d.id === input.documentId);
                    if (doc) {
                        await databaseService.updateDocument({
                            ...doc,
                            status: 'approved',
                            ai_data: aiAnalysis
                        });
                    }
                }
            }

            output.success = true;
            output.message = `Successfully processed and posted ${journalEntries.length} journal lines`;
            output.messageTh = `ประมวลผลและบันทึกบัญชีสำเร็จ ${journalEntries.length} รายการ`;
        } else {
            output.success = true;
            output.message = 'Document analyzed successfully, ready for review';
            output.messageTh = 'วิเคราะห์เอกสารสำเร็จ พร้อมสำหรับการตรวจสอบ';
        }

        // Add suggestions for improvement
        output.suggestions = [];

        if (aiAnalysis.audit_flags && aiAnalysis.audit_flags.length > 0) {
            aiAnalysis.audit_flags.forEach((flag) => {
                output.suggestions!.push({
                    action: 'review_audit_flag',
                    description: flag.message,
                    priority: flag.severity === 'high' ? 'high' : 'medium'
                });
            });
        }

        if (!aiAnalysis.tax_compliance.is_full_tax_invoice) {
            output.suggestions!.push({
                action: 'request_full_tax_invoice',
                description: 'ขอใบกำกับภาษีเต็มรูปแบบเพื่อให้นำภาษีซื้อมาใช้ได้',
                priority: 'medium'
            });
        }

        // Calculate confidence
        output.confidence = aiAnalysis.confidence_score;

    } catch (error) {
        output.success = false;
        output.message = error instanceof Error ? error.message : 'Unknown error';
        output.messageTh = `เกิดข้อผิดพลาด: ${output.message}`;
        output.escalationRequired = true;
        output.escalationReason = output.message;
    }

    output.processingTime = Date.now() - startTime;
    return output;
};

// ============================================================================
// EXPORT AS PROPER AGENT HANDLER
// ============================================================================

export const documentAgentHandler: AgentHandler = {
    async execute(input: AgentInput, context: AgentContext): Promise<AgentOutput> {
        return executeDocumentAgent(input as DocumentAgentInput, context);
    },

    canHandle(input: AgentInput): boolean {
        return input.type === 'document_analysis' || input.type === 'document';
    },

    getRequiredPermissions(): string[] {
        return ['document:read', 'document:analyze', 'gl:write'];
    }
};

// ============================================================================
// SPECIALIZED HANDLERS
// ============================================================================

/**
 * Batch process multiple documents
 */
export const batchDocumentHandler = async (
    documents: DocumentAgentInput[],
    context: AgentContext
): Promise<{
    total: number;
    succeeded: number;
    failed: number;
    escalated: number;
    results: DocumentAgentOutput[];
}> => {
    const results: DocumentAgentOutput[] = [];

    for (const doc of documents) {
        const result = await executeDocumentAgent(doc, context);
        results.push(result);
    }

    return {
        total: results.length,
        succeeded: results.filter(r => r.success && !r.escalationRequired).length,
        failed: results.filter(r => !r.success).length,
        escalated: results.filter(r => r.escalationRequired).length,
        results
    };
};

/**
 * Re-analyze document with updated context
 */
export const reanalyzeDocumentHandler = async (
    documentId: string,
    newContext: Partial<AgentContext>,
    context: AgentContext
): Promise<DocumentAgentOutput> => {
    // Get existing document
    const docs = await databaseService.getDocumentsByClient(context.clientId || '');
    const doc = docs.find((d: DocumentRecord) => d.id === documentId);

    if (!doc) {
        return {
            success: false,
            documentId,
            processingTime: 0,
            message: 'Document not found for re-analysis',
            messageTh: 'ไม่พบเอกสารสำหรับวิเคราะห์ใหม่',
            escalationRequired: true
        };
    }

    // Re-run analysis with merged context
    const mergedContext: AgentContext = { ...context, ...newContext };

    return executeDocumentAgent(
        {
            type: 'document_analysis',
            data: {},
            documentId,
            clientId: mergedContext.clientId || doc.clientId || '',
            autoPost: false
        },
        mergedContext
    );
};

export default documentAgentHandler;
