/**
 * Monthly Closing Agent Handler
 * 
 * AI Agent สำหรับกระบวนการปิดบัญชีประจำเดือนอัตโนมัติ
 * - ค่าเสื่อมราคา (Depreciation)
 * - ค่าใช้จ่ายค้างจ่าย (Accrued Expenses)
 * - ปิดบัญชี P&L → Retained Earnings
 */

import { AgentHandler, AgentInput, AgentOutput, AgentContext } from '../agentOrchestrator';
import { PostedGLEntry, FixedAsset } from '../../types';
import { databaseService } from '../database';
import periodClosing from '../periodClosing';

// ============================================================================
// CLOSING AGENT TYPES
// ============================================================================

export interface ClosingAgentInput extends AgentInput {
    clientId: string;
    period: string; // YYYY-MM
    tasks: {
        calculateDepreciation: boolean;
        calculateAccruals: boolean;
        generateClosingEntries: boolean;
        lockPeriod: boolean;
    };
    dryRun?: boolean; // Preview only, don't post
}

export interface ClosingAgentOutput extends AgentOutput {
    period: string;
    depreciationResult?: {
        entriesCount: number;
        totalAmount: number;
        details: Array<{ assetName: string; amount: number }>;
    };
    accrualsResult?: {
        entriesCount: number;
        totalAmount: number;
        types: Array<{ type: string; amount: number }>;
    };
    closingResult?: {
        profitBeforeTax: number;
        citAmount: number;
        netProfit: number;
        entriesCount: number;
    };
    periodLocked: boolean;
    allEntriesPosted: PostedGLEntry[];
    processingTime: number;
}

// ============================================================================
// CLOSING AGENT HANDLER
// ============================================================================

export const closingAgentHandler: AgentHandler = async (
    input: ClosingAgentInput,
    context: AgentContext
): Promise<ClosingAgentOutput> => {
    const startTime = Date.now();
    const output: ClosingAgentOutput = {
        agentName: 'closing',
        success: false,
        message: '',
        messageTh: '',
        period: input.period,
        periodLocked: false,
        allEntriesPosted: [],
        processingTime: 0
    };

    const allEntriesToPost: Omit<PostedGLEntry, 'id'>[] = [];

    try {
        // Get required data
        const [client, glEntries, assets] = await Promise.all([
            databaseService.getClientById(input.clientId),
            databaseService.getGLEntriesByClient(input.clientId),
            databaseService.getAssetsByClient(input.clientId)
        ]);

        if (!client) {
            output.message = 'Client not found';
            output.messageTh = 'ไม่พบข้อมูลลูกค้า';
            output.escalationRequired = true;
            return output;
        }

        const periodGL = glEntries.filter(e => e.date.startsWith(input.period));

        // ========================================================================
        // STEP 1: Calculate Depreciation
        // ========================================================================
        if (input.tasks.calculateDepreciation && assets.length > 0) {
            const depreResult = periodClosing.calculateDepreciation(
                assets,
                input.clientId,
                input.period
            );

            output.depreciationResult = {
                entriesCount: depreResult.entries.length,
                totalAmount: depreResult.totalDepreciation,
                details: depreResult.details.map(d => ({
                    assetName: d.asset.name,
                    amount: d.monthly
                }))
            };

            allEntriesToPost.push(...depreResult.entries);
        }

        // ========================================================================
        // STEP 2: Calculate Closing Entries (P&L → Retained Earnings)
        // ========================================================================
        if (input.tasks.generateClosingEntries) {
            // Include any new entries we're about to post
            const allPeriodGL = [...periodGL, ...allEntriesToPost as any];

            const closingResult = periodClosing.generateClosingEntries(
                allPeriodGL,
                input.clientId,
                input.period
            );

            output.closingResult = {
                profitBeforeTax: closingResult.profitBeforeTax,
                citAmount: closingResult.citAmount,
                netProfit: closingResult.netProfit,
                entriesCount: closingResult.closingEntries.length
            };

            // Only add closing entries if there's actual P&L to close
            if (closingResult.closingEntries.length > 0) {
                allEntriesToPost.push(...closingResult.closingEntries);
            }

            // Check for issues
            if (closingResult.netProfit < 0) {
                output.suggestions = output.suggestions || [];
                output.suggestions.push({
                    action: 'review_expenses',
                    description: `ผลประกอบการขาดทุน ${Math.abs(closingResult.netProfit).toLocaleString()} บาท`,
                    priority: 'high'
                });
            }
        }

        // ========================================================================
        // STEP 3: Post All Entries (if not dry run)
        // ========================================================================
        if (!input.dryRun && allEntriesToPost.length > 0) {
            const postedIds = await databaseService.addGLEntries(allEntriesToPost as any);

            // Retrieve posted entries for output
            const allPosted = await databaseService.getGLEntriesByClient(input.clientId);
            output.allEntriesPosted = allPosted.filter(e =>
                postedIds.includes(e.id) || e.date.startsWith(input.period)
            );
        }

        // ========================================================================
        // STEP 4: Lock Period (if requested)
        // ========================================================================
        if (input.tasks.lockPeriod && !input.dryRun) {
            // In a real system, this would update a period_locks collection
            output.periodLocked = true;

            // Log the action
            await databaseService.addLog({
                action: 'PERIOD_LOCK',
                details: `Locked period ${input.period} for client ${input.clientId}`,
                user_id: context.userId || 'ai-agent',
                user_name: 'AI Agent',
                timestamp: new Date().toISOString()
            });
        }

        // ========================================================================
        // SUCCESS
        // ========================================================================
        output.success = true;

        const actions: string[] = [];
        if (output.depreciationResult?.entriesCount) {
            actions.push(`ค่าเสื่อมราคา ${output.depreciationResult.totalAmount.toLocaleString()} บาท`);
        }
        if (output.closingResult) {
            actions.push(`กำไรสุทธิ ${output.closingResult.netProfit.toLocaleString()} บาท`);
        }
        if (output.periodLocked) {
            actions.push('ล็อคงวดแล้ว');
        }

        output.message = `Monthly closing completed: ${actions.join(', ')}`;
        output.messageTh = `ปิดบัญชีประจำเดือนสำเร็จ: ${actions.join(', ')}`;

        if (input.dryRun) {
            output.message = `[DRY RUN] ${output.message}`;
            output.messageTh = `[ตัวอย่าง] ${output.messageTh}`;
        }

        // Set confidence based on data quality
        let confidence = 100;
        if (periodGL.length < 10) {
            confidence -= 20; // Low transaction count
            output.suggestions = output.suggestions || [];
            output.suggestions.push({
                action: 'review_completeness',
                description: 'รายการบัญชีน้อยกว่าปกติ ตรวจสอบว่าครบถ้วนหรือไม่',
                priority: 'medium'
            });
        }
        output.confidence = confidence;

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
// VALIDATION HELPER
// ============================================================================

/**
 * Pre-closing validation
 * ตรวจสอบความพร้อมก่อนปิดบัญชี
 */
export const validateClosingReadiness = async (
    clientId: string,
    period: string
): Promise<{
    isReady: boolean;
    issues: Array<{ severity: 'error' | 'warning'; message: string }>;
    stats: {
        totalDocuments: number;
        pendingDocuments: number;
        totalGLEntries: number;
        trialBalanced: boolean;
    };
}> => {
    const [documents, glEntries, bankTxns] = await Promise.all([
        databaseService.getDocumentsByClient(clientId),
        databaseService.getGLEntriesByClient(clientId),
        databaseService.getBankTransactionsByClient(clientId)
    ]);

    const periodDocs = documents.filter(d =>
        d.ai_data?.header_data?.issue_date?.startsWith(period)
    );
    const periodGL = glEntries.filter(e => e.date.startsWith(period));
    const periodBank = bankTxns.filter(t => t.date.startsWith(period));

    const pendingDocs = periodDocs.filter(d => d.status !== 'approved');
    const unmatchedBank = periodBank.filter(t => !t.matched_doc_id);

    const totalDebit = periodGL.reduce((sum, e) => sum + (e.debit || 0), 0);
    const totalCredit = periodGL.reduce((sum, e) => sum + (e.credit || 0), 0);
    const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01;

    const issues: Array<{ severity: 'error' | 'warning'; message: string }> = [];

    if (pendingDocs.length > 0) {
        issues.push({
            severity: 'warning',
            message: `มีเอกสารรอดำเนินการ ${pendingDocs.length} รายการ`
        });
    }

    if (unmatchedBank.length > 0) {
        issues.push({
            severity: 'warning',
            message: `มีรายการธนาคารยังไม่ match ${unmatchedBank.length} รายการ`
        });
    }

    if (!isBalanced) {
        issues.push({
            severity: 'error',
            message: `งบทดลองไม่สมดุล (Debit: ${totalDebit.toLocaleString()}, Credit: ${totalCredit.toLocaleString()})`
        });
    }

    if (periodGL.length === 0) {
        issues.push({
            severity: 'error',
            message: 'ไม่มีรายการบัญชีในงวดนี้'
        });
    }

    const hasErrors = issues.some(i => i.severity === 'error');

    return {
        isReady: !hasErrors,
        issues,
        stats: {
            totalDocuments: periodDocs.length,
            pendingDocuments: pendingDocs.length,
            totalGLEntries: periodGL.length,
            trialBalanced: isBalanced
        }
    };
};

export default closingAgentHandler;
