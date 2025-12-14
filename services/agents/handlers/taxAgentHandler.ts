/**
 * Tax Agent Handler
 * AI-powered tax calculation and form preparation
 */

import { AgentHandler, AgentContext } from '../agentOrchestrator';
import { AgentInput, AgentOutput } from '../../../types/agents';

// Tax calculation result structure
interface TaxCalculationResult {
  taxType: string;
  period: string;
  calculations: {
    outputVat: number;
    inputVat: number;
    netVat: number;
    whtPND3: number;
    whtPND53: number;
    totalWht: number;
  };
  suggestedForms: string[];
  warnings: string[];
  confidenceScore: number;
}

export class TaxAgentHandler implements AgentHandler {
  async execute(input: AgentInput, context: AgentContext): Promise<AgentOutput> {
    context.addLog('analyze', 'เริ่มวิเคราะห์ข้อมูลภาษี', 'pending');

    const { documents, period, clientId } = input.context || {};

    if (!documents || !Array.isArray(documents)) {
      return {
        success: false,
        result: {
          error: 'ไม่พบเอกสารสำหรับคำนวณภาษี',
          confidenceScore: 0,
        },
      };
    }

    try {
      // Calculate VAT (PP30)
      context.addLog('calculate_vat', 'คำนวณภาษีมูลค่าเพิ่ม (ภ.พ.30)', 'pending');

      const vatDocs = documents.filter(
        (d: any) => d.status === 'approved' && d.ai_data?.financials?.vat_amount > 0
      );

      const outputVat = vatDocs
        .filter((d: any) => {
          const docType = d.ai_data?.header_data?.doc_type?.toLowerCase() || '';
          return docType.includes('ขาย') || docType.includes('sales') || docType.includes('invoice');
        })
        .reduce((sum: number, d: any) => sum + (d.ai_data?.financials?.vat_amount || 0), 0);

      const inputVat = vatDocs
        .filter((d: any) => d.ai_data?.tax_compliance?.vat_claimable)
        .reduce((sum: number, d: any) => sum + (d.ai_data?.financials?.vat_amount || 0), 0);

      // Calculate WHT
      context.addLog('calculate_wht', 'คำนวณภาษีหัก ณ ที่จ่าย', 'pending');

      const whtDocs = documents.filter(
        (d: any) => d.status === 'approved' && d.ai_data?.financials?.wht_amount > 0
      );

      const whtPND3 = whtDocs
        .filter((d: any) => d.ai_data?.tax_compliance?.wht_code === 'PND3')
        .reduce((sum: number, d: any) => sum + (d.ai_data?.financials?.wht_amount || 0), 0);

      const whtPND53 = whtDocs
        .filter((d: any) => d.ai_data?.tax_compliance?.wht_code === 'PND53')
        .reduce((sum: number, d: any) => sum + (d.ai_data?.financials?.wht_amount || 0), 0);

      // Generate suggested forms
      const suggestedForms: string[] = [];
      if (outputVat > 0 || inputVat > 0) {
        suggestedForms.push('PP30');
      }
      if (whtPND3 > 0) {
        suggestedForms.push('PND3');
      }
      if (whtPND53 > 0) {
        suggestedForms.push('PND53');
      }

      // Calculate confidence based on data quality
      const totalDocs = documents.length;
      const approvedDocs = documents.filter((d: any) => d.status === 'approved').length;
      const confidenceScore = totalDocs > 0
        ? Math.round((approvedDocs / totalDocs) * 100)
        : 0;

      const taxResult: TaxCalculationResult = {
        taxType: 'VAT_WHT',
        period: period || new Date().toISOString().slice(0, 7),
        calculations: {
          outputVat,
          inputVat,
          netVat: outputVat - inputVat,
          whtPND3,
          whtPND53,
          totalWht: whtPND3 + whtPND53,
        },
        suggestedForms,
        warnings: [],
        confidenceScore,
      };

      // Add warnings
      if (outputVat - inputVat > 100000) {
        taxResult.warnings.push('ภาษีมูลค่าเพิ่มที่ต้องชำระเกิน 100,000 บาท');
      }
      if (confidenceScore < 80) {
        taxResult.warnings.push(`มีเอกสารที่ยังไม่อนุมัติ ${totalDocs - approvedDocs} รายการ`);
      }

      context.addLog('complete', `คำนวณภาษีเสร็จ: VAT=${taxResult.calculations.netVat}, WHT=${taxResult.calculations.totalWht}`, 'success');

      return {
        success: true,
        result: taxResult,
        actions: suggestedForms.map(form => ({
          type: 'generate_form',
          label: `สร้างแบบ ${form}`,
          data: { formType: form, period, clientId },
        })),
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

  canHandle(input: AgentInput): boolean {
    return input.type === 'tax_calculation' || input.type === 'form_generation';
  }

  getRequiredPermissions(): string[] {
    return ['view_documents', 'calculate_tax', 'generate_forms'];
  }
}

export const taxAgentHandler = new TaxAgentHandler();
