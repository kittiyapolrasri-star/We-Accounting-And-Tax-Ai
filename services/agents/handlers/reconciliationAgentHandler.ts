/**
 * Reconciliation Agent Handler
 * AI-powered bank reconciliation and transaction matching
 */

import { AgentHandler, AgentContext } from '../agentOrchestrator';
import { AgentInput, AgentOutput } from '../../../types/agents';

// Local type definitions for reconciliation
interface ReconciliationMatch {
  bankTransactionId: string;
  matchedRecordId: string;
  matchType: 'gl_entry' | 'document';
  confidence: number;
  matchReason: string;
}

interface ReconciliationResult {
  matches: ReconciliationMatch[];
  unmatchedBankTransactions: string[];
  unmatchedGLEntries: string[];
  suggestedAdjustments: Array<{
    type: string;
    description: string;
    priority: string;
  }>;
  confidenceScore: number;
}

export class ReconciliationAgentHandler implements AgentHandler {
  async execute(input: AgentInput, context: AgentContext): Promise<AgentOutput> {
    context.addLog('start', 'เริ่มจับคู่รายการธนาคาร', 'pending');

    const { bankTransactions, glEntries, documents } = input.context || {};

    if (!bankTransactions || !Array.isArray(bankTransactions)) {
      return {
        success: false,
        result: {
          error: 'ไม่พบรายการธนาคาร',
          confidenceScore: 0,
        },
      };
    }

    try {
      const matches: ReconciliationMatch[] = [];
      const unmatchedBank: any[] = [];
      const unmatchedGL: any[] = [];
      let totalMatched = 0;
      let totalConfidence = 0;

      // Match bank transactions to GL entries or documents
      for (const bankTxn of bankTransactions) {
        let bestMatch: ReconciliationMatch | null = null;
        let highestScore = 0;

        // Try to match with GL entries
        if (glEntries && Array.isArray(glEntries)) {
          for (const glEntry of glEntries) {
            const score = this.calculateMatchScore(bankTxn, glEntry);
            if (score > highestScore && score >= 70) {
              highestScore = score;
              bestMatch = {
                bankTransactionId: bankTxn.id,
                matchedRecordId: glEntry.id,
                matchType: 'gl_entry',
                confidence: score,
                matchReason: this.getMatchReason(bankTxn, glEntry, score),
              };
            }
          }
        }

        // Try to match with documents
        if (documents && Array.isArray(documents)) {
          for (const doc of documents) {
            const score = this.calculateDocMatchScore(bankTxn, doc);
            if (score > highestScore && score >= 70) {
              highestScore = score;
              bestMatch = {
                bankTransactionId: bankTxn.id,
                matchedRecordId: doc.id,
                matchType: 'document',
                confidence: score,
                matchReason: this.getDocMatchReason(bankTxn, doc, score),
              };
            }
          }
        }

        if (bestMatch) {
          matches.push(bestMatch);
          totalMatched++;
          totalConfidence += bestMatch.confidence;
          context.addLog('match', `จับคู่รายการ: ${bankTxn.description} (${bestMatch.confidence}%)`, 'success');
        } else {
          unmatchedBank.push(bankTxn);
        }
      }

      // Find unmatched GL entries
      if (glEntries) {
        const matchedGLIds = new Set(matches.filter(m => m.matchType === 'gl_entry').map(m => m.matchedRecordId));
        unmatchedGL.push(...glEntries.filter((gl: any) => !matchedGLIds.has(gl.id)));
      }

      const avgConfidence = totalMatched > 0 ? Math.round(totalConfidence / totalMatched) : 0;

      const result: ReconciliationResult = {
        matches,
        unmatchedBankTransactions: unmatchedBank.map(t => t.id),
        unmatchedGLEntries: unmatchedGL.map(g => g.id),
        suggestedAdjustments: [],
        confidenceScore: avgConfidence,
      };

      // Generate suggested adjustments for unmatched items
      if (unmatchedBank.length > 0) {
        result.suggestedAdjustments.push({
          type: 'review_unmatched',
          description: `มี ${unmatchedBank.length} รายการธนาคารที่ยังไม่จับคู่`,
          priority: 'high',
        });
      }

      context.addLog('complete', `จับคู่สำเร็จ ${totalMatched}/${bankTransactions.length} รายการ (${avgConfidence}%)`, 'success');

      return {
        success: true,
        result,
        actions: [
          {
            type: 'apply_matches',
            label: `ยืนยันการจับคู่ ${totalMatched} รายการ`,
            data: { matches },
          },
          ...(unmatchedBank.length > 0 ? [{
            type: 'review_unmatched',
            label: `ตรวจสอบรายการที่ยังไม่จับคู่ (${unmatchedBank.length})`,
            data: { unmatchedBank },
          }] : []),
        ],
      };
    } catch (error) {
      context.addLog('error', `เกิดข้อผิดพลาด: ${error}`, 'failure');
      return {
        success: false,
        result: {
          error: String(error),
          confidenceScore: 0,
        },
      };
    }
  }

  private calculateMatchScore(bankTxn: any, glEntry: any): number {
    let score = 0;

    // Amount match (most important)
    const amountDiff = Math.abs(bankTxn.amount - glEntry.amount);
    const amountTolerance = Math.abs(bankTxn.amount) * 0.01; // 1% tolerance
    if (amountDiff === 0) {
      score += 50;
    } else if (amountDiff <= amountTolerance) {
      score += 40;
    } else if (amountDiff <= amountTolerance * 5) {
      score += 20;
    }

    // Date match
    const bankDate = new Date(bankTxn.date).getTime();
    const glDate = new Date(glEntry.date).getTime();
    const daysDiff = Math.abs(bankDate - glDate) / (1000 * 60 * 60 * 24);
    if (daysDiff === 0) {
      score += 30;
    } else if (daysDiff <= 3) {
      score += 20;
    } else if (daysDiff <= 7) {
      score += 10;
    }

    // Description similarity
    const descScore = this.calculateTextSimilarity(
      bankTxn.description || '',
      glEntry.description || ''
    );
    score += Math.round(descScore * 20);

    return Math.min(score, 100);
  }

  private calculateDocMatchScore(bankTxn: any, doc: any): number {
    let score = 0;

    // Amount match
    const docAmount = doc.amount || doc.ai_data?.financials?.grand_total || 0;
    const amountDiff = Math.abs(bankTxn.amount - docAmount);
    const amountTolerance = Math.abs(bankTxn.amount) * 0.01;
    if (amountDiff === 0) {
      score += 50;
    } else if (amountDiff <= amountTolerance) {
      score += 40;
    } else if (amountDiff <= amountTolerance * 5) {
      score += 20;
    }

    // Date proximity
    const bankDate = new Date(bankTxn.date).getTime();
    const docDate = new Date(doc.uploaded_at || doc.date).getTime();
    const daysDiff = Math.abs(bankDate - docDate) / (1000 * 60 * 60 * 24);
    if (daysDiff <= 3) {
      score += 25;
    } else if (daysDiff <= 7) {
      score += 15;
    } else if (daysDiff <= 14) {
      score += 5;
    }

    // Vendor name match
    const vendorScore = this.calculateTextSimilarity(
      bankTxn.description || '',
      doc.ai_data?.parties?.counterparty?.name || doc.client_name || ''
    );
    score += Math.round(vendorScore * 25);

    return Math.min(score, 100);
  }

  private calculateTextSimilarity(str1: string, str2: string): number {
    if (!str1 || !str2) return 0;

    const s1 = str1.toLowerCase().trim();
    const s2 = str2.toLowerCase().trim();

    if (s1 === s2) return 1;
    if (s1.includes(s2) || s2.includes(s1)) return 0.8;

    // Simple word overlap
    const words1 = new Set(s1.split(/\s+/));
    const words2 = new Set(s2.split(/\s+/));
    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);

    return intersection.size / union.size;
  }

  private getMatchReason(bankTxn: any, glEntry: any, score: number): string {
    const reasons: string[] = [];

    if (bankTxn.amount === glEntry.amount) {
      reasons.push('จำนวนเงินตรงกัน');
    }

    const bankDate = new Date(bankTxn.date);
    const glDate = new Date(glEntry.date);
    if (bankDate.toDateString() === glDate.toDateString()) {
      reasons.push('วันที่ตรงกัน');
    }

    return reasons.length > 0 ? reasons.join(', ') : `ความคล้ายคลึง ${score}%`;
  }

  private getDocMatchReason(bankTxn: any, doc: any, score: number): string {
    const reasons: string[] = [];
    const docAmount = doc.amount || doc.ai_data?.financials?.grand_total || 0;

    if (Math.abs(bankTxn.amount - docAmount) < 1) {
      reasons.push('จำนวนเงินตรงกัน');
    }

    const vendorName = doc.ai_data?.parties?.counterparty?.name;
    if (vendorName && bankTxn.description?.toLowerCase().includes(vendorName.toLowerCase())) {
      reasons.push('ชื่อผู้ขายตรงกัน');
    }

    return reasons.length > 0 ? reasons.join(', ') : `ความคล้ายคลึง ${score}%`;
  }

  canHandle(input: AgentInput): boolean {
    return input.type === 'reconciliation' || input.type === 'transaction_matching';
  }

  getRequiredPermissions(): string[] {
    return ['view_bank_transactions', 'view_gl_entries', 'reconcile'];
  }
}

export const reconciliationAgentHandler = new ReconciliationAgentHandler();
