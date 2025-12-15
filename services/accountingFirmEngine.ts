/**
 * accountingFirmEngine.ts
 * 
 * Complete Accounting Firm Automation Engine
 * ระบบอัตโนมัติสำหรับสำนักงานบัญชีครบวงจร
 * 
 * This engine handles the COMPLETE workflow of an accounting firm:
 * 1. Document Processing (รับเอกสาร → วิเคราะห์ → บันทึกบัญชี)
 * 2. Monthly Closing (ปิดบัญชีประจำเดือน)
 * 3. Tax Filing (ยื่นภาษี VAT, WHT)
 * 4. Financial Reporting (งบการเงิน)
 * 5. Client Management (จัดการลูกค้า)
 */

import { Client, DocumentRecord, PostedGLEntry, FixedAsset, Staff, BankTransaction, AccountingResponse } from '../types';
import { databaseService } from './database';
import { analyzeDocument } from './geminiService';
import { validateGLPosting, GLPostingRequest, ValidationResult } from './accountingValidation';
import financialStatements from './financialStatements';
import periodClosing from './periodClosing';
import vatService from './vatReturn';
import whtService from './whtCertificate';
import bankReconciliation from './bankReconciliation';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export type ProcessingStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'requires_review';
export type WorkPhase = 'receive' | 'analyze' | 'validate' | 'post' | 'reconcile' | 'close' | 'report' | 'file';

export interface ProcessingResult {
    success: boolean;
    status: ProcessingStatus;
    message: string;
    messageTh: string;
    data?: any;
    errors?: string[];
    warnings?: string[];
    nextAction?: string;
}

export interface MonthlyClosingProgress {
    clientId: string;
    clientName: string;
    period: string; // YYYY-MM
    phases: {
        documentsProcessed: { total: number; completed: number; pending: number };
        bankReconciled: { total: number; matched: number; unmatched: number };
        glPosted: { totalEntries: number; totalDebit: number; totalCredit: number };
        adjustmentsCompleted: boolean;
        depreciationCalculated: boolean;
        accrualsRecorded: boolean;
        closingEntriesPosted: boolean;
        financialStatementsPrepared: boolean;
        vatFilingReady: boolean;
        whtFilingReady: boolean;
    };
    overallProgress: number; // 0-100%
    status: 'not_started' | 'in_progress' | 'ready_for_review' | 'completed' | 'locked';
    issues: { severity: 'warning' | 'error'; message: string; action?: string }[];
}

export interface AutomatedTaskResult {
    taskId: string;
    taskType: string;
    clientId: string;
    startedAt: string;
    completedAt: string;
    duration: number; // ms
    success: boolean;
    entriesCreated: number;
    amountProcessed: number;
    errors: string[];
}

// ============================================================================
// CORE ENGINE CLASS
// ============================================================================

export class AccountingFirmEngine {
    private static instance: AccountingFirmEngine;
    private processingQueue: Map<string, ProcessingStatus> = new Map();

    private constructor() { }

    public static getInstance(): AccountingFirmEngine {
        if (!AccountingFirmEngine.instance) {
            AccountingFirmEngine.instance = new AccountingFirmEngine();
        }
        return AccountingFirmEngine.instance;
    }

    // ==========================================================================
    // PHASE 1: DOCUMENT PROCESSING (รับเอกสาร → วิเคราะห์ → บันทึกบัญชี)
    // ==========================================================================

    /**
     * Process a single document end-to-end
     * ประมวลผลเอกสารตั้งแต่รับจนถึงบันทึกบัญชี
     */
    async processDocument(
        file: File,
        clientId: string,
        options: {
            autoPost?: boolean;
            autoReconcile?: boolean;
            staffId?: string;
        } = {}
    ): Promise<ProcessingResult> {
        const startTime = Date.now();
        const docId = `DOC-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        try {
            // Step 1: Initial Document Record
            const initialDoc: Omit<DocumentRecord, 'id'> = {
                uploaded_at: new Date().toISOString(),
                filename: file.name,
                status: 'processing',
                assigned_to: options.staffId || null,
                client_name: '',
                amount: 0,
                ai_data: null
            };

            await databaseService.addDocument({ ...initialDoc, id: docId } as any);
            this.processingQueue.set(docId, 'processing');

            // Step 2: AI Analysis
            const aiResult = await analyzeDocument(file, clientId);

            // Step 3: Validate AI Result
            const validation = await this.validateAIResult(aiResult, clientId);

            if (!validation.isValid && aiResult.confidence_score < 70) {
                // Needs human review
                await this.updateDocumentStatus(docId, 'pending_review', aiResult);
                return {
                    success: true,
                    status: 'requires_review',
                    message: 'Document requires manual review due to low confidence',
                    messageTh: 'เอกสารต้องการการตรวจสอบ เนื่องจากความมั่นใจต่ำ',
                    data: { docId, aiResult, validation },
                    warnings: validation.warnings.map(w => w.message)
                };
            }

            // Step 4: Auto-post if enabled and valid
            if (options.autoPost && validation.isValid) {
                const postResult = await this.postGLEntries(
                    aiResult,
                    clientId,
                    docId,
                    options.staffId || 'system'
                );

                if (postResult.success) {
                    await this.updateDocumentStatus(docId, 'approved', aiResult);

                    return {
                        success: true,
                        status: 'completed',
                        message: `Document processed and posted in ${Date.now() - startTime}ms`,
                        messageTh: `ประมวลผลและบันทึกบัญชีสำเร็จใน ${Date.now() - startTime}ms`,
                        data: { docId, entriesPosted: postResult.entryIds?.length || 0 }
                    };
                }
            }

            // Step 5: Ready for manual posting
            await this.updateDocumentStatus(docId, 'pending_review', aiResult);

            return {
                success: true,
                status: 'requires_review',
                message: 'Document analyzed successfully, ready for review',
                messageTh: 'วิเคราะห์เอกสารสำเร็จ พร้อมสำหรับการตรวจสอบ',
                data: { docId, aiResult }
            };

        } catch (error) {
            this.processingQueue.set(docId, 'failed');
            const errorMessage = error instanceof Error ? error.message : String(error);

            return {
                success: false,
                status: 'failed',
                message: `Processing failed: ${errorMessage}`,
                messageTh: `การประมวลผลล้มเหลว: ${errorMessage}`,
                errors: [errorMessage]
            };
        }
    }

    /**
     * Batch process multiple documents
     * ประมวลผลหลายเอกสารพร้อมกัน
     */
    async batchProcessDocuments(
        files: File[],
        clientId: string,
        options: { autoPost?: boolean; staffId?: string } = {}
    ): Promise<{
        totalFiles: number;
        processed: number;
        failed: number;
        requiresReview: number;
        results: ProcessingResult[];
    }> {
        const results: ProcessingResult[] = [];

        for (const file of files) {
            const result = await this.processDocument(file, clientId, options);
            results.push(result);
        }

        return {
            totalFiles: files.length,
            processed: results.filter(r => r.status === 'completed').length,
            failed: results.filter(r => r.status === 'failed').length,
            requiresReview: results.filter(r => r.status === 'requires_review').length,
            results
        };
    }

    // ==========================================================================
    // PHASE 2: JOURNAL ENTRY POSTING (บันทึกบัญชี)
    // ==========================================================================

    /**
     * Post GL entries from AI analysis result
     */
    private async postGLEntries(
        aiResult: AccountingResponse,
        clientId: string,
        docId: string,
        userId: string
    ): Promise<{ success: boolean; entryIds?: string[]; errors?: string[] }> {

        // Convert AI result to GL entries
        const glEntries: Omit<PostedGLEntry, 'id'>[] = aiResult.accounting_entry.journal_lines.map(
            (line, index) => ({
                clientId,
                date: aiResult.header_data.issue_date,
                doc_no: aiResult.header_data.inv_number,
                description: aiResult.accounting_entry.transaction_description,
                account_code: line.account_code,
                account_name: line.account_name_th,
                department_code: line.department_code,
                debit: line.account_side === 'DEBIT' ? line.amount : 0,
                credit: line.account_side === 'CREDIT' ? line.amount : 0,
                source_doc_id: docId,
                created_by: userId,
                created_at: new Date().toISOString()
            })
        );

        // Validate before posting
        const periodMonth = aiResult.header_data.issue_date.slice(0, 7);
        const validationRequest: GLPostingRequest = {
            entries: glEntries as any,
            clientId,
            periodMonth,
            sourceDocId: docId,
            userId
        };

        const validation = await validateGLPosting(validationRequest);

        if (!validation.isValid) {
            return {
                success: false,
                errors: validation.errors.map(e => e.message)
            };
        }

        // Post entries
        try {
            const entryIds = await databaseService.addGLEntries(glEntries as any);
            return { success: true, entryIds };
        } catch (error) {
            return {
                success: false,
                errors: [error instanceof Error ? error.message : 'Failed to post entries']
            };
        }
    }

    /**
     * Create manual journal entry
     * สร้างรายการบันทึกบัญชีด้วยตนเอง
     */
    async createManualJournalEntry(
        entries: Array<{
            accountCode: string;
            accountName: string;
            debit: number;
            credit: number;
            description?: string;
        }>,
        clientId: string,
        entryDate: string,
        docNo: string,
        description: string,
        userId: string
    ): Promise<ProcessingResult> {

        // Validate balance
        const totalDebit = entries.reduce((sum, e) => sum + e.debit, 0);
        const totalCredit = entries.reduce((sum, e) => sum + e.credit, 0);

        if (Math.abs(totalDebit - totalCredit) > 0.01) {
            return {
                success: false,
                status: 'failed',
                message: 'Debit and Credit must be equal',
                messageTh: 'ยอดเดบิตและเครดิตต้องเท่ากัน',
                errors: [`Debit: ${totalDebit}, Credit: ${totalCredit}`]
            };
        }

        // Create GL entries
        const glEntries: Omit<PostedGLEntry, 'id'>[] = entries.map(entry => ({
            clientId,
            date: entryDate,
            doc_no: docNo,
            description: entry.description || description,
            account_code: entry.accountCode,
            account_name: entry.accountName,
            debit: entry.debit,
            credit: entry.credit,
            created_by: userId,
            created_at: new Date().toISOString()
        }));

        try {
            const entryIds = await databaseService.addGLEntries(glEntries as any);

            return {
                success: true,
                status: 'completed',
                message: `Posted ${entryIds.length} journal entries`,
                messageTh: `บันทึกบัญชี ${entryIds.length} รายการสำเร็จ`,
                data: { entryIds, totalAmount: totalDebit }
            };
        } catch (error) {
            return {
                success: false,
                status: 'failed',
                message: 'Failed to post journal entries',
                messageTh: 'ไม่สามารถบันทึกบัญชีได้',
                errors: [error instanceof Error ? error.message : String(error)]
            };
        }
    }

    // ==========================================================================
    // PHASE 3: BANK RECONCILIATION (กระทบยอดธนาคาร)
    // ==========================================================================

    /**
     * Auto-reconcile bank transactions
     * กระทบยอดธนาคารอัตโนมัติ
     */
    async autoReconcileBank(
        clientId: string,
        period: string // YYYY-MM
    ): Promise<ProcessingResult> {
        try {
            // Get bank transactions and documents
            const [bankTxns, documents, glEntries] = await Promise.all([
                databaseService.getBankTransactionsByClient(clientId),
                databaseService.getDocumentsByClient(clientId),
                databaseService.getGLEntriesByClient(clientId)
            ]);

            // Filter by period
            const periodTxns = bankTxns.filter(t => t.date.startsWith(period));
            const periodDocs = documents.filter(d =>
                d.ai_data?.header_data?.issue_date?.startsWith(period)
            );

            // Run auto-matching
            const matchResult = bankReconciliation.autoMatchTransactions(
                periodTxns,
                periodDocs
            );

            // Generate summary
            const summary = bankReconciliation.generateReconciliationSummary(
                periodTxns,
                periodDocs,
                matchResult.matches
            );

            return {
                success: true,
                status: 'completed',
                message: `Reconciled ${matchResult.autoMatchedCount} of ${periodTxns.length} transactions`,
                messageTh: `กระทบยอดสำเร็จ ${matchResult.autoMatchedCount} จาก ${periodTxns.length} รายการ`,
                data: {
                    matchRate: summary.matchRate,
                    totalMatched: summary.totalMatched,
                    totalUnmatched: summary.totalUnmatched,
                    difference: summary.difference,
                    matches: matchResult.matches
                }
            };
        } catch (error) {
            return {
                success: false,
                status: 'failed',
                message: 'Bank reconciliation failed',
                messageTh: 'การกระทบยอดล้มเหลว',
                errors: [error instanceof Error ? error.message : String(error)]
            };
        }
    }

    // ==========================================================================
    // PHASE 4: MONTHLY CLOSING (ปิดบัญชีประจำเดือน)
    // ==========================================================================

    /**
     * Get monthly closing progress for a client
     * ดูความคืบหน้าการปิดบัญชีประจำเดือน
     */
    async getMonthlyClosingProgress(
        clientId: string,
        period: string
    ): Promise<MonthlyClosingProgress> {
        const [client, documents, glEntries, bankTxns, assets] = await Promise.all([
            databaseService.getClientById(clientId),
            databaseService.getDocumentsByClient(clientId),
            databaseService.getGLEntriesByClient(clientId),
            databaseService.getBankTransactionsByClient(clientId),
            databaseService.getAssetsByClient(clientId)
        ]);

        // Filter by period
        const periodDocs = documents.filter(d =>
            d.ai_data?.header_data?.issue_date?.startsWith(period)
        );
        const periodGL = glEntries.filter(e => e.date.startsWith(period));
        const periodBank = bankTxns.filter(t => t.date.startsWith(period));

        // Calculate progress
        const docsCompleted = periodDocs.filter(d => d.status === 'approved').length;
        const docsPending = periodDocs.filter(d => d.status !== 'approved').length;

        const bankMatched = periodBank.filter(t => t.matched_doc_id).length;
        const bankUnmatched = periodBank.length - bankMatched;

        const totalDebit = periodGL.reduce((sum, e) => sum + (e.debit || 0), 0);
        const totalCredit = periodGL.reduce((sum, e) => sum + (e.credit || 0), 0);

        // Check closing status
        const hasDepreciation = periodGL.some(e => e.description?.includes('ค่าเสื่อมราคา'));
        const hasAccruals = periodGL.some(e => e.description?.includes('ค้างจ่าย') || e.description?.includes('ค้างรับ'));
        const hasClosingEntries = periodGL.some(e => e.description?.includes('ปิดบัญชี'));

        // Calculate overall progress
        let progressPoints = 0;
        const totalPoints = 8;

        if (docsCompleted > 0) progressPoints += 1;
        if (docsPending === 0 && periodDocs.length > 0) progressPoints += 1;
        if (bankMatched > 0) progressPoints += 1;
        if (bankUnmatched === 0 && periodBank.length > 0) progressPoints += 1;
        if (hasDepreciation) progressPoints += 1;
        if (hasAccruals) progressPoints += 1;
        if (hasClosingEntries) progressPoints += 1;
        if (Math.abs(totalDebit - totalCredit) < 0.01) progressPoints += 1;

        const overallProgress = Math.round((progressPoints / totalPoints) * 100);

        // Collect issues
        const issues: { severity: 'warning' | 'error'; message: string; action?: string }[] = [];

        if (docsPending > 0) {
            issues.push({
                severity: 'warning',
                message: `มีเอกสารรอดำเนินการ ${docsPending} รายการ`,
                action: 'review_documents'
            });
        }

        if (bankUnmatched > 0) {
            issues.push({
                severity: 'warning',
                message: `มีรายการธนาคารยังไม่ match ${bankUnmatched} รายการ`,
                action: 'reconcile_bank'
            });
        }

        if (Math.abs(totalDebit - totalCredit) > 0.01) {
            issues.push({
                severity: 'error',
                message: `งบทดลองไม่สมดุล (Debit: ${totalDebit}, Credit: ${totalCredit})`,
                action: 'check_gl'
            });
        }

        return {
            clientId,
            clientName: client?.name || 'Unknown',
            period,
            phases: {
                documentsProcessed: {
                    total: periodDocs.length,
                    completed: docsCompleted,
                    pending: docsPending
                },
                bankReconciled: {
                    total: periodBank.length,
                    matched: bankMatched,
                    unmatched: bankUnmatched
                },
                glPosted: {
                    totalEntries: periodGL.length,
                    totalDebit,
                    totalCredit
                },
                adjustmentsCompleted: hasAccruals,
                depreciationCalculated: hasDepreciation,
                accrualsRecorded: hasAccruals,
                closingEntriesPosted: hasClosingEntries,
                financialStatementsPrepared: overallProgress >= 80,
                vatFilingReady: overallProgress >= 90,
                whtFilingReady: overallProgress >= 90
            },
            overallProgress,
            status: overallProgress === 100 ? 'completed' :
                overallProgress >= 80 ? 'ready_for_review' :
                    overallProgress > 0 ? 'in_progress' : 'not_started',
            issues
        };
    }

    /**
     * Run monthly closing process
     * รันกระบวนการปิดบัญชีประจำเดือน
     */
    async runMonthlyClosing(
        clientId: string,
        period: string,
        options: {
            calculateDepreciation?: boolean;
            calculateAccruals?: boolean;
            generateClosingEntries?: boolean;
            userId?: string;
        } = {}
    ): Promise<ProcessingResult> {
        const results: string[] = [];
        const errors: string[] = [];

        try {
            const [client, glEntries, assets] = await Promise.all([
                databaseService.getClientById(clientId),
                databaseService.getGLEntriesByClient(clientId),
                databaseService.getAssetsByClient(clientId)
            ]);

            if (!client) {
                return {
                    success: false,
                    status: 'failed',
                    message: 'Client not found',
                    messageTh: 'ไม่พบข้อมูลลูกค้า',
                    errors: ['Client not found']
                };
            }

            const periodGL = glEntries.filter(e => e.date.startsWith(period));

            // Step 1: Calculate Depreciation
            if (options.calculateDepreciation !== false && assets.length > 0) {
                const depreResult = periodClosing.calculateDepreciation(assets, clientId, period);

                if (depreResult.entries.length > 0) {
                    await databaseService.addGLEntries(depreResult.entries);
                    results.push(`คำนวณค่าเสื่อมราคา ${depreResult.entries.length} รายการ (${depreResult.totalDepreciation.toLocaleString()} บาท)`);
                }
            }

            // Step 2: Generate Closing Entries (P&L → Retained Earnings)
            if (options.generateClosingEntries !== false) {
                const closingResult = periodClosing.generateClosingEntries(periodGL, clientId, period);

                if (closingResult.closingEntries.length > 0) {
                    await databaseService.addGLEntries(closingResult.closingEntries);
                    results.push(`บันทึกรายการปิดบัญชี (กำไรสุทธิ: ${closingResult.netProfit.toLocaleString()} บาท)`);
                }
            }

            return {
                success: true,
                status: 'completed',
                message: 'Monthly closing completed',
                messageTh: 'ปิดบัญชีประจำเดือนสำเร็จ',
                data: { results, period, clientId }
            };

        } catch (error) {
            return {
                success: false,
                status: 'failed',
                message: 'Monthly closing failed',
                messageTh: 'การปิดบัญชีล้มเหลว',
                errors: [error instanceof Error ? error.message : String(error)]
            };
        }
    }

    // ==========================================================================
    // PHASE 5: FINANCIAL REPORTING (รายงานการเงิน)
    // ==========================================================================

    /**
     * Generate complete financial statements
     * สร้างงบการเงินครบชุด
     */
    async generateFinancialStatements(
        clientId: string,
        periodStart: string,
        periodEnd: string
    ): Promise<{
        trialBalance: any;
        incomeStatement: any;
        balanceSheet: any;
        html: {
            trialBalance: string;
            incomeStatement: string;
            balanceSheet: string;
        };
    }> {
        const [client, glEntries] = await Promise.all([
            databaseService.getClientById(clientId),
            databaseService.getGLEntriesByClient(clientId)
        ]);

        if (!client) {
            throw new Error('Client not found');
        }

        // Generate all statements
        const trialBalance = financialStatements.generateTrialBalance(
            glEntries, client, periodEnd, periodStart
        );

        const incomeStatement = financialStatements.generateIncomeStatement(
            glEntries, client, periodStart, periodEnd
        );

        const balanceSheet = financialStatements.generateBalanceSheet(
            glEntries, client, periodEnd
        );

        // Generate HTML for printing
        return {
            trialBalance,
            incomeStatement,
            balanceSheet,
            html: {
                trialBalance: financialStatements.generateTrialBalanceHTML(trialBalance),
                incomeStatement: financialStatements.generateIncomeStatementHTML(incomeStatement),
                balanceSheet: financialStatements.generateBalanceSheetHTML(balanceSheet)
            }
        };
    }

    // ==========================================================================
    // PHASE 6: TAX FILING (ยื่นภาษี)
    // ==========================================================================

    /**
     * Generate VAT Return (ภ.พ.30)
     */
    async generateVATReturn(
        clientId: string,
        period: string, // YYYY-MM
        carryForwardCredit: number = 0
    ): Promise<ProcessingResult> {
        try {
            const [client, documents] = await Promise.all([
                databaseService.getClientById(clientId),
                databaseService.getDocumentsByClient(clientId)
            ]);

            if (!client) {
                return {
                    success: false,
                    status: 'failed',
                    message: 'Client not found',
                    messageTh: 'ไม่พบข้อมูลลูกค้า',
                    errors: ['Client not found']
                };
            }

            const periodDocs = documents.filter(d =>
                d.ai_data?.header_data?.issue_date?.startsWith(period)
            );

            const pp30 = await vatService.generatePP30(
                client, periodDocs, period, carryForwardCredit
            );

            return {
                success: true,
                status: 'completed',
                message: 'VAT Return (PP30) generated successfully',
                messageTh: 'สร้างแบบ ภ.พ.30 สำเร็จ',
                data: {
                    pp30,
                    html: vatService.generatePP30HTML(pp30),
                    xml: vatService.generatePP30XML(pp30)
                }
            };
        } catch (error) {
            return {
                success: false,
                status: 'failed',
                message: 'Failed to generate VAT Return',
                messageTh: 'ไม่สามารถสร้างแบบ ภ.พ.30 ได้',
                errors: [error instanceof Error ? error.message : String(error)]
            };
        }
    }

    /**
     * Generate WHT Certificates (หนังสือรับรองหัก ณ ที่จ่าย)
     */
    async generateWHTCertificates(
        clientId: string,
        period: string
    ): Promise<ProcessingResult> {
        try {
            const [client, documents] = await Promise.all([
                databaseService.getClientById(clientId),
                databaseService.getDocumentsByClient(clientId)
            ]);

            if (!client) {
                return {
                    success: false,
                    status: 'failed',
                    message: 'Client not found',
                    messageTh: 'ไม่พบข้อมูลลูกค้า',
                    errors: ['Client not found']
                };
            }

            const periodDocs = documents.filter(d =>
                d.ai_data?.header_data?.issue_date?.startsWith(period) &&
                d.ai_data?.tax_compliance?.wht_flag
            );

            const certificates = whtService.generateWHTCertificates(client, periodDocs, period);

            return {
                success: true,
                status: 'completed',
                message: `Generated ${certificates.length} WHT certificates`,
                messageTh: `สร้างหนังสือรับรองหัก ณ ที่จ่าย ${certificates.length} ฉบับ`,
                data: { certificates }
            };
        } catch (error) {
            return {
                success: false,
                status: 'failed',
                message: 'Failed to generate WHT certificates',
                messageTh: 'ไม่สามารถสร้างหนังสือรับรองได้',
                errors: [error instanceof Error ? error.message : String(error)]
            };
        }
    }

    // ==========================================================================
    // PHASE 7: FULL AUTOMATION - ONE-CLICK MONTHLY PROCESSING
    // ==========================================================================

    /**
     * Run complete monthly processing for a client
     * รันกระบวนการทั้งหมดประจำเดือนในคลิกเดียว
     */
    async runFullMonthlyProcessing(
        clientId: string,
        period: string,
        options: {
            autoPost?: boolean;
            autoReconcile?: boolean;
            generateReports?: boolean;
            generateTaxForms?: boolean;
            userId?: string;
        } = {
                autoPost: true,
                autoReconcile: true,
                generateReports: true,
                generateTaxForms: true
            }
    ): Promise<{
        success: boolean;
        summary: MonthlyClosingProgress;
        results: {
            documents: ProcessingResult;
            reconciliation: ProcessingResult;
            closing: ProcessingResult;
            reports?: any;
            vat?: ProcessingResult;
            wht?: ProcessingResult;
        };
        totalDuration: number;
    }> {
        const startTime = Date.now();
        const results: any = {};

        try {
            // Step 1: Process pending documents
            const pendingDocs = await this.getPendingDocuments(clientId, period);
            if (pendingDocs.length > 0) {
                // Auto-approve high-confidence documents
                results.documents = await this.autoApprovePendingDocuments(clientId, period);
            } else {
                results.documents = { success: true, status: 'completed', message: 'No pending documents', messageTh: 'ไม่มีเอกสารรอดำเนินการ' };
            }

            // Step 2: Bank Reconciliation
            if (options.autoReconcile) {
                results.reconciliation = await this.autoReconcileBank(clientId, period);
            }

            // Step 3: Monthly Closing
            results.closing = await this.runMonthlyClosing(clientId, period, {
                calculateDepreciation: true,
                calculateAccruals: true,
                generateClosingEntries: true,
                userId: options.userId
            });

            // Step 4: Financial Reports
            if (options.generateReports) {
                const periodStart = `${period}-01`;
                const periodEnd = this.getLastDayOfMonth(period);
                results.reports = await this.generateFinancialStatements(clientId, periodStart, periodEnd);
            }

            // Step 5: Tax Forms
            if (options.generateTaxForms) {
                results.vat = await this.generateVATReturn(clientId, period);
                results.wht = await this.generateWHTCertificates(clientId, period);
            }

            // Get final progress
            const summary = await this.getMonthlyClosingProgress(clientId, period);

            return {
                success: true,
                summary,
                results,
                totalDuration: Date.now() - startTime
            };

        } catch (error) {
            const summary = await this.getMonthlyClosingProgress(clientId, period);

            return {
                success: false,
                summary,
                results,
                totalDuration: Date.now() - startTime
            };
        }
    }

    // ==========================================================================
    // HELPER METHODS
    // ==========================================================================

    private async validateAIResult(
        aiResult: AccountingResponse,
        clientId: string
    ): Promise<ValidationResult> {
        const entries = aiResult.accounting_entry.journal_lines.map(line => ({
            clientId,
            date: aiResult.header_data.issue_date,
            doc_no: aiResult.header_data.inv_number,
            description: aiResult.accounting_entry.transaction_description,
            account_code: line.account_code,
            account_name: line.account_name_th,
            debit: line.account_side === 'DEBIT' ? line.amount : 0,
            credit: line.account_side === 'CREDIT' ? line.amount : 0
        }));

        return validateGLPosting({
            entries: entries as any,
            clientId,
            periodMonth: aiResult.header_data.issue_date.slice(0, 7),
            sourceDocId: aiResult.header_data.inv_number,
            userId: 'system'
        });
    }

    private async updateDocumentStatus(
        docId: string,
        status: DocumentRecord['status'],
        aiData?: AccountingResponse
    ): Promise<void> {
        const doc = await this.getDocumentById(docId);
        if (doc) {
            await databaseService.updateDocument({
                ...doc,
                status,
                ai_data: aiData || doc.ai_data,
                client_name: aiData?.parties?.client_company?.name || doc.client_name,
                amount: aiData?.financials?.grand_total || doc.amount
            });
        }
        this.processingQueue.set(docId, status === 'approved' ? 'completed' : 'requires_review');
    }

    private async getDocumentById(docId: string): Promise<DocumentRecord | null> {
        const docs = await databaseService.getDocuments();
        return docs.find(d => d.id === docId) || null;
    }

    private async getPendingDocuments(clientId: string, period: string): Promise<DocumentRecord[]> {
        const docs = await databaseService.getDocumentsByClient(clientId);
        return docs.filter(d =>
            d.status === 'pending_review' &&
            d.ai_data?.header_data?.issue_date?.startsWith(period)
        );
    }

    private async autoApprovePendingDocuments(
        clientId: string,
        period: string
    ): Promise<ProcessingResult> {
        const pendingDocs = await this.getPendingDocuments(clientId, period);
        let approved = 0;
        let skipped = 0;

        for (const doc of pendingDocs) {
            if (doc.ai_data && doc.ai_data.confidence_score >= 85) {
                const postResult = await this.postGLEntries(
                    doc.ai_data,
                    clientId,
                    doc.id,
                    'auto-system'
                );

                if (postResult.success) {
                    await this.updateDocumentStatus(doc.id, 'approved', doc.ai_data);
                    approved++;
                } else {
                    skipped++;
                }
            } else {
                skipped++;
            }
        }

        return {
            success: true,
            status: 'completed',
            message: `Auto-approved ${approved} documents, ${skipped} require manual review`,
            messageTh: `อนุมัติอัตโนมัติ ${approved} เอกสาร, ${skipped} ต้องตรวจสอบ`,
            data: { approved, skipped }
        };
    }

    private getLastDayOfMonth(period: string): string {
        const [year, month] = period.split('-').map(Number);
        const lastDay = new Date(year, month, 0).getDate();
        return `${period}-${lastDay.toString().padStart(2, '0')}`;
    }
}

// Export singleton instance
export const accountingEngine = AccountingFirmEngine.getInstance();

export default AccountingFirmEngine;
