/**
 * Thai Tax e-Filing Service
 * Generate XML files for Revenue Department submission
 * Supports PND3, PND53, PP30 (VAT) formats
 */

import { DocumentRecord, TaxCompliance, Parties } from '../types';

// Tax Form Types
export type TaxFormType = 'PND1' | 'PND3' | 'PND53' | 'PP30' | 'PP36';

// e-Filing XML Schema structures based on Revenue Department specifications
export interface EFilingHeader {
  taxId: string;
  branchNo: string;
  companyName: string;
  companyNameEn?: string;
  address: string;
  phone?: string;
  email?: string;
  taxMonth: string; // MM
  taxYear: string; // YYYY (Buddhist Era)
  formType: TaxFormType;
  totalRecords: number;
  totalAmount: number;
  totalTax: number;
}

export interface WHTDetail {
  sequence: number;
  payeeType: '1' | '2'; // 1=Individual, 2=Juristic
  payeeTaxId: string;
  payeeBranchNo: string;
  payeeName: string;
  payeeAddress?: string;
  incomeType: string; // 40(1), 40(2), etc.
  incomeDescription: string;
  paymentDate: string;
  incomeAmount: number;
  whtRate: number;
  whtAmount: number;
  condition: '1' | '2' | '3'; // 1=หัก ณ ที่จ่าย, 2=ออกให้ตลอดไป, 3=ออกให้ครั้งเดียว
}

export interface VATDetail {
  sequence: number;
  taxInvoiceNo: string;
  taxInvoiceDate: string;
  sellerTaxId: string;
  sellerBranchNo: string;
  sellerName: string;
  baseAmount: number;
  vatAmount: number;
  totalAmount: number;
  vatType: 'INPUT' | 'OUTPUT';
}

export interface EFilingResult {
  success: boolean;
  formType: TaxFormType;
  xmlContent: string;
  filename: string;
  validationErrors: string[];
  summary: {
    totalRecords: number;
    totalAmount: number;
    totalTax: number;
  };
}

// Thai Income Types for WHT
export const INCOME_TYPES = {
  '40(1)': 'เงินเดือน ค่าจ้าง',
  '40(2)': 'ค่าลิขสิทธิ์',
  '40(3)': 'ค่าแห่งกู๊ดวิลล์',
  '40(4)ก': 'ดอกเบี้ย',
  '40(4)ข': 'เงินปันผล',
  '40(5)': 'ค่าเช่า',
  '40(6)': 'วิชาชีพอิสระ',
  '40(7)': 'รับเหมา',
  '40(8)': 'รายได้อื่นๆ',
  '3': 'ค่าบริการ',
  '5': 'ค่าโฆษณา',
  '6': 'ค่าขนส่ง',
};

// WHT Rates mapping
export const WHT_RATES: Record<string, number> = {
  'ค่าบริการ': 3,
  'ค่าเช่า': 5,
  'ค่าโฆษณา': 2,
  'ค่าขนส่ง': 1,
  'ค่าวิชาชีพอิสระ': 3,
  'ค่าจ้างทำของ': 3,
  'รับเหมา': 3,
};

/**
 * Format date to Thai Buddhist Era format
 */
export const formatThaiDate = (dateStr: string): string => {
  const date = new Date(dateStr);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const yearBE = date.getFullYear() + 543;
  return `${day}/${month}/${yearBE}`;
};

/**
 * Get Buddhist Era year
 */
export const getBuddhistYear = (year: number): string => {
  return String(year + 543);
};

/**
 * Validate Tax ID (13 digits for company, 10 or 13 for individual)
 */
export const validateTaxId = (taxId: string): boolean => {
  const cleaned = taxId.replace(/[^0-9]/g, '');
  return cleaned.length === 13 || cleaned.length === 10;
};

/**
 * Generate XML for PND3 (WHT for individuals)
 */
export const generatePND3XML = (
  header: EFilingHeader,
  details: WHTDetail[]
): string => {
  const detailsXml = details.map(d => `
    <WHTDetail>
      <Sequence>${d.sequence}</Sequence>
      <PayeeType>${d.payeeType}</PayeeType>
      <PayeeTaxID>${d.payeeTaxId.replace(/[^0-9]/g, '')}</PayeeTaxID>
      <PayeeBranchNo>${d.payeeBranchNo || '00000'}</PayeeBranchNo>
      <PayeeName><![CDATA[${d.payeeName}]]></PayeeName>
      <PayeeAddress><![CDATA[${d.payeeAddress || ''}]]></PayeeAddress>
      <IncomeType>${d.incomeType}</IncomeType>
      <IncomeDescription><![CDATA[${d.incomeDescription}]]></IncomeDescription>
      <PaymentDate>${formatThaiDate(d.paymentDate)}</PaymentDate>
      <IncomeAmount>${d.incomeAmount.toFixed(2)}</IncomeAmount>
      <WHTRate>${d.whtRate.toFixed(2)}</WHTRate>
      <WHTAmount>${d.whtAmount.toFixed(2)}</WHTAmount>
      <Condition>${d.condition}</Condition>
    </WHTDetail>`).join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<PND3 xmlns="http://www.rd.go.th/efiling">
  <Header>
    <FormType>ภ.ง.ด.3</FormType>
    <TaxPayerTaxID>${header.taxId.replace(/[^0-9]/g, '')}</TaxPayerTaxID>
    <TaxPayerBranchNo>${header.branchNo || '00000'}</TaxPayerBranchNo>
    <TaxPayerName><![CDATA[${header.companyName}]]></TaxPayerName>
    <TaxPayerAddress><![CDATA[${header.address}]]></TaxPayerAddress>
    <TaxMonth>${header.taxMonth}</TaxMonth>
    <TaxYear>${header.taxYear}</TaxYear>
    <TotalRecords>${header.totalRecords}</TotalRecords>
    <TotalIncomeAmount>${header.totalAmount.toFixed(2)}</TotalIncomeAmount>
    <TotalWHTAmount>${header.totalTax.toFixed(2)}</TotalWHTAmount>
    <SubmissionDate>${formatThaiDate(new Date().toISOString())}</SubmissionDate>
  </Header>
  <Details>${detailsXml}
  </Details>
</PND3>`;
};

/**
 * Generate XML for PND53 (WHT for companies)
 */
export const generatePND53XML = (
  header: EFilingHeader,
  details: WHTDetail[]
): string => {
  const detailsXml = details.map(d => `
    <WHTDetail>
      <Sequence>${d.sequence}</Sequence>
      <PayeeTaxID>${d.payeeTaxId.replace(/[^0-9]/g, '')}</PayeeTaxID>
      <PayeeBranchNo>${d.payeeBranchNo || '00000'}</PayeeBranchNo>
      <PayeeName><![CDATA[${d.payeeName}]]></PayeeName>
      <IncomeType>${d.incomeType}</IncomeType>
      <IncomeDescription><![CDATA[${d.incomeDescription}]]></IncomeDescription>
      <PaymentDate>${formatThaiDate(d.paymentDate)}</PaymentDate>
      <IncomeAmount>${d.incomeAmount.toFixed(2)}</IncomeAmount>
      <WHTRate>${d.whtRate.toFixed(2)}</WHTRate>
      <WHTAmount>${d.whtAmount.toFixed(2)}</WHTAmount>
      <Condition>${d.condition}</Condition>
    </WHTDetail>`).join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<PND53 xmlns="http://www.rd.go.th/efiling">
  <Header>
    <FormType>ภ.ง.ด.53</FormType>
    <TaxPayerTaxID>${header.taxId.replace(/[^0-9]/g, '')}</TaxPayerTaxID>
    <TaxPayerBranchNo>${header.branchNo || '00000'}</TaxPayerBranchNo>
    <TaxPayerName><![CDATA[${header.companyName}]]></TaxPayerName>
    <TaxPayerAddress><![CDATA[${header.address}]]></TaxPayerAddress>
    <TaxMonth>${header.taxMonth}</TaxMonth>
    <TaxYear>${header.taxYear}</TaxYear>
    <TotalRecords>${header.totalRecords}</TotalRecords>
    <TotalIncomeAmount>${header.totalAmount.toFixed(2)}</TotalIncomeAmount>
    <TotalWHTAmount>${header.totalTax.toFixed(2)}</TotalWHTAmount>
    <SubmissionDate>${formatThaiDate(new Date().toISOString())}</SubmissionDate>
  </Header>
  <Details>${detailsXml}
  </Details>
</PND53>`;
};

/**
 * Generate XML for PP30 (VAT Return)
 */
export const generatePP30XML = (
  header: EFilingHeader,
  inputVat: VATDetail[],
  outputVat: VATDetail[]
): string => {
  const totalOutputBase = outputVat.reduce((sum, v) => sum + v.baseAmount, 0);
  const totalOutputVat = outputVat.reduce((sum, v) => sum + v.vatAmount, 0);
  const totalInputBase = inputVat.reduce((sum, v) => sum + v.baseAmount, 0);
  const totalInputVat = inputVat.reduce((sum, v) => sum + v.vatAmount, 0);
  const netVat = totalOutputVat - totalInputVat;

  const outputXml = outputVat.map((v, i) => `
    <OutputVATDetail>
      <Sequence>${i + 1}</Sequence>
      <TaxInvoiceNo>${v.taxInvoiceNo}</TaxInvoiceNo>
      <TaxInvoiceDate>${formatThaiDate(v.taxInvoiceDate)}</TaxInvoiceDate>
      <BuyerTaxID>${v.sellerTaxId.replace(/[^0-9]/g, '')}</BuyerTaxID>
      <BuyerName><![CDATA[${v.sellerName}]]></BuyerName>
      <BaseAmount>${v.baseAmount.toFixed(2)}</BaseAmount>
      <VATAmount>${v.vatAmount.toFixed(2)}</VATAmount>
    </OutputVATDetail>`).join('');

  const inputXml = inputVat.map((v, i) => `
    <InputVATDetail>
      <Sequence>${i + 1}</Sequence>
      <TaxInvoiceNo>${v.taxInvoiceNo}</TaxInvoiceNo>
      <TaxInvoiceDate>${formatThaiDate(v.taxInvoiceDate)}</TaxInvoiceDate>
      <SellerTaxID>${v.sellerTaxId.replace(/[^0-9]/g, '')}</SellerTaxID>
      <SellerName><![CDATA[${v.sellerName}]]></SellerName>
      <BaseAmount>${v.baseAmount.toFixed(2)}</BaseAmount>
      <VATAmount>${v.vatAmount.toFixed(2)}</VATAmount>
    </InputVATDetail>`).join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<PP30 xmlns="http://www.rd.go.th/efiling">
  <Header>
    <FormType>ภ.พ.30</FormType>
    <TaxPayerTaxID>${header.taxId.replace(/[^0-9]/g, '')}</TaxPayerTaxID>
    <TaxPayerBranchNo>${header.branchNo || '00000'}</TaxPayerBranchNo>
    <TaxPayerName><![CDATA[${header.companyName}]]></TaxPayerName>
    <TaxPayerAddress><![CDATA[${header.address}]]></TaxPayerAddress>
    <TaxMonth>${header.taxMonth}</TaxMonth>
    <TaxYear>${header.taxYear}</TaxYear>
    <SubmissionDate>${formatThaiDate(new Date().toISOString())}</SubmissionDate>
  </Header>
  <Summary>
    <OutputVAT>
      <TotalRecords>${outputVat.length}</TotalRecords>
      <TotalBaseAmount>${totalOutputBase.toFixed(2)}</TotalBaseAmount>
      <TotalVATAmount>${totalOutputVat.toFixed(2)}</TotalVATAmount>
    </OutputVAT>
    <InputVAT>
      <TotalRecords>${inputVat.length}</TotalRecords>
      <TotalBaseAmount>${totalInputBase.toFixed(2)}</TotalBaseAmount>
      <TotalVATAmount>${totalInputVat.toFixed(2)}</TotalVATAmount>
    </InputVAT>
    <NetVAT>${netVat.toFixed(2)}</NetVAT>
    <VATPayable>${netVat > 0 ? netVat.toFixed(2) : '0.00'}</VATPayable>
    <VATCredit>${netVat < 0 ? Math.abs(netVat).toFixed(2) : '0.00'}</VATCredit>
  </Summary>
  <OutputVATDetails>${outputXml}
  </OutputVATDetails>
  <InputVATDetails>${inputXml}
  </InputVATDetails>
</PP30>`;
};

/**
 * Convert documents to WHT details for e-filing
 */
export const documentsToWHTDetails = (
  documents: DocumentRecord[],
  formType: 'PND3' | 'PND53'
): WHTDetail[] => {
  return documents
    .filter(doc => {
      if (!doc.ai_data) return false;
      const whtCode = doc.ai_data.tax_compliance.wht_code;
      return whtCode === formType;
    })
    .map((doc, index) => {
      const aiData = doc.ai_data!;
      const whtRate = aiData.tax_compliance.wht_rate || 3;
      const baseAmount = aiData.financials.subtotal;
      const whtAmount = aiData.financials.wht_amount || 0;

      // Determine income type based on WHT rate
      let incomeType = '3'; // Default: ค่าบริการ
      if (whtRate === 1) incomeType = '6'; // ค่าขนส่ง
      else if (whtRate === 2) incomeType = '5'; // ค่าโฆษณา
      else if (whtRate === 5) incomeType = '40(5)'; // ค่าเช่า

      return {
        sequence: index + 1,
        payeeType: formType === 'PND3' ? '1' : '2',
        payeeTaxId: aiData.parties.counterparty.tax_id || '',
        payeeBranchNo: aiData.parties.counterparty.branch || '00000',
        payeeName: aiData.parties.counterparty.name,
        payeeAddress: aiData.parties.counterparty.address,
        incomeType,
        incomeDescription: aiData.accounting_entry.transaction_description,
        paymentDate: aiData.header_data.issue_date,
        incomeAmount: baseAmount,
        whtRate,
        whtAmount: Math.abs(whtAmount),
        condition: '1', // หัก ณ ที่จ่าย
      };
    });
};

/**
 * Convert documents to VAT details for e-filing
 */
export const documentsToVATDetails = (
  documents: DocumentRecord[],
  vatType: 'INPUT' | 'OUTPUT'
): VATDetail[] => {
  return documents
    .filter(doc => {
      if (!doc.ai_data) return false;
      const isVatDoc = doc.ai_data.tax_compliance.is_full_tax_invoice;
      if (!isVatDoc) return false;

      // INPUT = purchases (expenses), OUTPUT = sales (revenue)
      if (vatType === 'INPUT') {
        return doc.ai_data.accounting_entry.account_class.includes('ค่าใช้จ่าย') ||
               doc.ai_data.accounting_entry.account_class.includes('ซื้อ');
      } else {
        return doc.ai_data.accounting_entry.account_class.includes('รายได้') ||
               doc.ai_data.accounting_entry.account_class.includes('ขาย');
      }
    })
    .map((doc, index) => {
      const aiData = doc.ai_data!;

      return {
        sequence: index + 1,
        taxInvoiceNo: aiData.header_data.inv_number,
        taxInvoiceDate: aiData.header_data.issue_date,
        sellerTaxId: vatType === 'INPUT'
          ? aiData.parties.counterparty.tax_id
          : aiData.parties.client_company.tax_id,
        sellerBranchNo: vatType === 'INPUT'
          ? (aiData.parties.counterparty.branch || '00000')
          : '00000',
        sellerName: vatType === 'INPUT'
          ? aiData.parties.counterparty.name
          : aiData.parties.client_company.name,
        baseAmount: aiData.financials.subtotal,
        vatAmount: aiData.financials.vat_amount,
        totalAmount: aiData.financials.grand_total,
        vatType,
      };
    });
};

/**
 * Validate e-filing data before submission
 */
export const validateEFilingData = (
  header: EFilingHeader,
  details: WHTDetail[] | VATDetail[]
): string[] => {
  const errors: string[] = [];

  // Validate header
  if (!validateTaxId(header.taxId)) {
    errors.push('เลขประจำตัวผู้เสียภาษีไม่ถูกต้อง');
  }

  if (!header.companyName) {
    errors.push('กรุณาระบุชื่อบริษัท');
  }

  if (!header.taxMonth || !header.taxYear) {
    errors.push('กรุณาระบุเดือน/ปีภาษี');
  }

  // Validate details
  if (details.length === 0) {
    errors.push('ไม่มีรายการสำหรับยื่นแบบ');
  }

  details.forEach((detail, index) => {
    if ('payeeTaxId' in detail) {
      // WHT validation
      const whtDetail = detail as WHTDetail;
      if (!validateTaxId(whtDetail.payeeTaxId)) {
        errors.push(`รายการที่ ${index + 1}: เลขประจำตัวผู้เสียภาษีของผู้รับเงินไม่ถูกต้อง`);
      }
      if (whtDetail.incomeAmount <= 0) {
        errors.push(`รายการที่ ${index + 1}: จำนวนเงินต้องมากกว่า 0`);
      }
    } else {
      // VAT validation
      const vatDetail = detail as VATDetail;
      if (!vatDetail.taxInvoiceNo) {
        errors.push(`รายการที่ ${index + 1}: กรุณาระบุเลขที่ใบกำกับภาษี`);
      }
    }
  });

  return errors;
};

/**
 * Generate e-filing package (main function)
 */
export const generateEFilingPackage = (
  formType: TaxFormType,
  header: EFilingHeader,
  documents: DocumentRecord[]
): EFilingResult => {
  let xmlContent = '';
  let validationErrors: string[] = [];
  let totalRecords = 0;
  let totalAmount = 0;
  let totalTax = 0;

  try {
    if (formType === 'PND3' || formType === 'PND53') {
      const details = documentsToWHTDetails(documents, formType);
      validationErrors = validateEFilingData(header, details);

      totalRecords = details.length;
      totalAmount = details.reduce((sum, d) => sum + d.incomeAmount, 0);
      totalTax = details.reduce((sum, d) => sum + d.whtAmount, 0);

      const updatedHeader = { ...header, totalRecords, totalAmount, totalTax };

      if (validationErrors.length === 0) {
        xmlContent = formType === 'PND3'
          ? generatePND3XML(updatedHeader, details)
          : generatePND53XML(updatedHeader, details);
      }
    } else if (formType === 'PP30') {
      const inputVat = documentsToVATDetails(documents, 'INPUT');
      const outputVat = documentsToVATDetails(documents, 'OUTPUT');

      totalRecords = inputVat.length + outputVat.length;
      const totalInputVat = inputVat.reduce((sum, v) => sum + v.vatAmount, 0);
      const totalOutputVat = outputVat.reduce((sum, v) => sum + v.vatAmount, 0);
      totalAmount = outputVat.reduce((sum, v) => sum + v.baseAmount, 0);
      totalTax = totalOutputVat - totalInputVat;

      const updatedHeader = { ...header, totalRecords, totalAmount, totalTax };
      validationErrors = validateEFilingData(updatedHeader, [...inputVat, ...outputVat]);

      if (validationErrors.length === 0) {
        xmlContent = generatePP30XML(updatedHeader, inputVat, outputVat);
      }
    }

    const filename = `${formType}_${header.taxYear}${header.taxMonth}_${header.taxId}.xml`;

    return {
      success: validationErrors.length === 0,
      formType,
      xmlContent,
      filename,
      validationErrors,
      summary: {
        totalRecords,
        totalAmount,
        totalTax,
      },
    };
  } catch (error) {
    return {
      success: false,
      formType,
      xmlContent: '',
      filename: '',
      validationErrors: [`เกิดข้อผิดพลาด: ${error}`],
      summary: { totalRecords: 0, totalAmount: 0, totalTax: 0 },
    };
  }
};

export default {
  generatePND3XML,
  generatePND53XML,
  generatePP30XML,
  generateEFilingPackage,
  documentsToWHTDetails,
  documentsToVATDetails,
  validateEFilingData,
  validateTaxId,
  formatThaiDate,
  getBuddhistYear,
  INCOME_TYPES,
  WHT_RATES,
};
