/**
 * WHT Certificate Service (ใบรับรองการหักภาษี ณ ที่จ่าย)
 * Generates WHT certificates (50 Tawi) for Thai withholding tax compliance
 */

import { DocumentRecord, Client } from '../types';

// ============================================================================
// TYPES
// ============================================================================

export interface WHTCertificateData {
  // Certificate Info
  certificateNo: string;
  bookNo: string;
  runningNo: string;
  taxYear: string; // Buddhist Era (พ.ศ.)

  // Withholding Company (ผู้จ่ายเงิน)
  payerName: string;
  payerTaxId: string;
  payerAddress: string;
  payerBranch: string;
  payerBuildingName?: string;
  payerFloor?: string;
  payerVillage?: string;
  payerSoi?: string;
  payerStreet?: string;
  payerSubDistrict?: string;
  payerDistrict?: string;
  payerProvince?: string;
  payerPostalCode?: string;
  payerPhone?: string;

  // Payee (ผู้มีเงินได้)
  payeeName: string;
  payeeTaxId: string;
  payeeAddress: string;
  payeeType: 'individual' | 'company'; // 1=บุคคลธรรมดา, 2=นิติบุคคล

  // Income Details
  incomeItems: WHTIncomeItem[];

  // WHT Condition
  condition: 1 | 2 | 3; // 1=หักณที่จ่าย, 2=ออกให้ตลอดไป, 3=ออกให้ครั้งเดียว

  // Payment Date
  paymentDate: string;

  // Totals
  totalIncome: number;
  totalWHT: number;

  // Form Type
  formType: 'PND3' | 'PND53';
}

export interface WHTIncomeItem {
  incomeType: string; // Income type code (40(1), 40(2), etc.)
  incomeTypeName: string;
  incomeTypeNameTh: string;
  paymentDate: string;
  incomeAmount: number;
  whtRate: number;
  whtAmount: number;
  condition: 1 | 2 | 3;
}

// Thai Income Types for WHT
export const WHT_INCOME_TYPES = {
  // PND 3 (Individual)
  '40(1)': { name: 'Salary', nameTh: 'เงินเดือน ค่าจ้าง เบี้ยเลี้ยง โบนัส', defaultRate: 0 },
  '40(2)': { name: 'Fees', nameTh: 'ค่าธรรมเนียม ค่านายหน้า', defaultRate: 3 },
  '40(3)': { name: 'Goodwill', nameTh: 'ค่าแห่งกู๊ดวิลล์ ค่าแห่งลิขสิทธิ์', defaultRate: 3 },
  '40(4)a': { name: 'Interest', nameTh: 'ดอกเบี้ย', defaultRate: 15 },
  '40(4)b': { name: 'Dividends', nameTh: 'เงินปันผล', defaultRate: 10 },
  '40(5)': { name: 'Rent', nameTh: 'ค่าเช่าทรัพย์สิน', defaultRate: 5 },
  '40(6)': { name: 'Professional', nameTh: 'วิชาชีพอิสระ', defaultRate: 3 },
  '40(7)': { name: 'Contract', nameTh: 'รับเหมา', defaultRate: 3 },
  '40(8)': { name: 'Other', nameTh: 'อื่นๆ', defaultRate: 3 },

  // PND 53 (Company)
  '3': { name: 'Services', nameTh: 'ค่าจ้างทำของ ค่าบริการ', defaultRate: 3 },
  '5': { name: 'Advertising', nameTh: 'ค่าโฆษณา', defaultRate: 2 },
  '6': { name: 'Transport', nameTh: 'ค่าขนส่ง', defaultRate: 1 },
  '7': { name: 'Insurance Premium', nameTh: 'เบี้ยประกัน', defaultRate: 1 },
};

// ============================================================================
// CERTIFICATE GENERATION
// ============================================================================

/**
 * Generate WHT Certificate Number
 */
export const generateCertificateNo = (
  bookNo: string,
  runningNo: string,
  year: number
): string => {
  const thaiYear = year + 543; // Convert to Buddhist Era
  return `${bookNo}-${runningNo.padStart(5, '0')}/${thaiYear}`;
};

/**
 * Create WHT Certificate from document
 */
export const createWHTCertificate = (
  document: DocumentRecord,
  client: Client,
  bookNo: string,
  runningNo: number
): WHTCertificateData | null => {
  if (!document.ai_data || !document.ai_data.tax_compliance.wht_flag) {
    return null;
  }

  const aiData = document.ai_data;
  const now = new Date();
  const thaiYear = now.getFullYear() + 543;

  // Determine payee type
  const payeeTaxId = aiData.parties.counterparty.tax_id;
  const isIndividual = payeeTaxId.startsWith('1') ||
                       payeeTaxId.startsWith('2') ||
                       payeeTaxId.startsWith('3');

  const formType: 'PND3' | 'PND53' = isIndividual ? 'PND3' : 'PND53';

  // Calculate WHT details
  const whtRate = aiData.tax_compliance.wht_rate || 3;
  const baseAmount = aiData.financials.subtotal;
  const whtAmount = aiData.financials.wht_amount || Math.round(baseAmount * whtRate / 100);

  // Determine income type
  let incomeType = '3'; // Default: services
  const docType = aiData.header_data.doc_type.toLowerCase();
  if (docType.includes('ค่าขนส่ง') || docType.includes('transport')) {
    incomeType = '6';
  } else if (docType.includes('ค่าโฆษณา') || docType.includes('advertising')) {
    incomeType = '5';
  } else if (docType.includes('ค่าเช่า') || docType.includes('rent')) {
    incomeType = '40(5)';
  }

  const incomeTypeInfo = WHT_INCOME_TYPES[incomeType as keyof typeof WHT_INCOME_TYPES] || WHT_INCOME_TYPES['3'];

  const certificate: WHTCertificateData = {
    certificateNo: generateCertificateNo(bookNo, String(runningNo), now.getFullYear()),
    bookNo,
    runningNo: String(runningNo).padStart(5, '0'),
    taxYear: String(thaiYear),

    // Payer (Our client)
    payerName: client.name,
    payerTaxId: client.tax_id,
    payerAddress: client.address || '',
    payerBranch: '00000', // Head office
    payerProvince: 'กรุงเทพมหานคร',
    payerPostalCode: '10110',

    // Payee (Vendor)
    payeeName: aiData.parties.counterparty.name,
    payeeTaxId: payeeTaxId,
    payeeAddress: aiData.parties.counterparty.address || '',
    payeeType: isIndividual ? 'individual' : 'company',

    // Income Details
    incomeItems: [{
      incomeType,
      incomeTypeName: incomeTypeInfo.name,
      incomeTypeNameTh: incomeTypeInfo.nameTh,
      paymentDate: aiData.header_data.issue_date,
      incomeAmount: baseAmount,
      whtRate,
      whtAmount,
      condition: 1, // หักณที่จ่าย
    }],

    condition: 1, // หักณที่จ่าย
    paymentDate: aiData.header_data.issue_date,
    totalIncome: baseAmount,
    totalWHT: whtAmount,
    formType,
  };

  return certificate;
};

/**
 * Generate WHT Certificate HTML for printing
 */
export const generateWHTCertificateHTML = (cert: WHTCertificateData): string => {
  const conditionText = {
    1: 'หักภาษี ณ ที่จ่าย',
    2: 'ออกให้ตลอดไป',
    3: 'ออกให้ครั้งเดียว',
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('th-TH', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const day = date.getDate();
    const months = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
                    'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
    const month = months[date.getMonth()];
    const year = date.getFullYear() + 543;
    return `${day} ${month} ${year}`;
  };

  return `
<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8">
  <title>หนังสือรับรองการหักภาษี ณ ที่จ่าย</title>
  <style>
    @page { size: A4; margin: 10mm; }
    body {
      font-family: 'Sarabun', 'TH SarabunPSK', sans-serif;
      font-size: 14px;
      line-height: 1.4;
      padding: 20px;
    }
    .certificate {
      border: 2px solid #000;
      padding: 15px;
      max-width: 800px;
      margin: 0 auto;
    }
    .header {
      text-align: center;
      border-bottom: 1px solid #000;
      padding-bottom: 10px;
      margin-bottom: 15px;
    }
    .title { font-size: 18px; font-weight: bold; }
    .subtitle { font-size: 14px; }
    .section { margin-bottom: 15px; }
    .section-title { font-weight: bold; background: #f0f0f0; padding: 5px; }
    .row { display: flex; margin-bottom: 5px; }
    .label { width: 150px; font-weight: bold; }
    .value { flex: 1; border-bottom: 1px dotted #999; }
    table { width: 100%; border-collapse: collapse; margin: 10px 0; }
    th, td { border: 1px solid #000; padding: 5px; text-align: center; }
    th { background: #f0f0f0; }
    .amount { text-align: right; }
    .total-row { font-weight: bold; background: #f5f5f5; }
    .checkbox { display: inline-block; width: 15px; height: 15px; border: 1px solid #000; margin-right: 5px; text-align: center; }
    .checked { background: #000; color: #fff; }
    .signature-section { margin-top: 30px; display: flex; justify-content: space-between; }
    .signature-box { width: 45%; text-align: center; }
    .signature-line { border-top: 1px solid #000; margin-top: 50px; padding-top: 5px; }
    .cert-no { position: absolute; top: 20px; right: 20px; font-weight: bold; }
  </style>
</head>
<body>
  <div class="certificate">
    <div class="header">
      <div class="title">หนังสือรับรองการหักภาษี ณ ที่จ่าย</div>
      <div class="subtitle">ตามมาตรา 50 ทวิ แห่งประมวลรัษฎากร</div>
      <div class="subtitle">${cert.formType === 'PND3' ? 'แบบ ภ.ง.ด.3' : 'แบบ ภ.ง.ด.53'}</div>
    </div>

    <div style="text-align: right; margin-bottom: 10px;">
      <strong>เล่มที่:</strong> ${cert.bookNo} &nbsp;&nbsp;
      <strong>เลขที่:</strong> ${cert.runningNo}
    </div>

    <div class="section">
      <div class="section-title">ผู้มีหน้าที่หักภาษี ณ ที่จ่าย</div>
      <div class="row"><span class="label">ชื่อ:</span><span class="value">${cert.payerName}</span></div>
      <div class="row"><span class="label">เลขประจำตัวผู้เสียภาษี:</span><span class="value">${cert.payerTaxId}</span></div>
      <div class="row"><span class="label">ที่อยู่:</span><span class="value">${cert.payerAddress}</span></div>
    </div>

    <div class="section">
      <div class="section-title">ผู้ถูกหักภาษี ณ ที่จ่าย</div>
      <div class="row"><span class="label">ชื่อ:</span><span class="value">${cert.payeeName}</span></div>
      <div class="row"><span class="label">เลขประจำตัวผู้เสียภาษี:</span><span class="value">${cert.payeeTaxId}</span></div>
      <div class="row"><span class="label">ที่อยู่:</span><span class="value">${cert.payeeAddress}</span></div>
    </div>

    <div class="section">
      <div class="section-title">รายละเอียดการหักภาษี</div>
      <table>
        <thead>
          <tr>
            <th>ประเภทเงินได้พึงประเมินที่จ่าย</th>
            <th>วันเดือนปีที่จ่าย</th>
            <th>จำนวนเงินที่จ่าย</th>
            <th>อัตรา %</th>
            <th>ภาษีที่หักและนำส่งไว้</th>
          </tr>
        </thead>
        <tbody>
          ${cert.incomeItems.map(item => `
            <tr>
              <td>${item.incomeType} ${item.incomeTypeNameTh}</td>
              <td>${formatDate(item.paymentDate)}</td>
              <td class="amount">${formatCurrency(item.incomeAmount)}</td>
              <td>${item.whtRate}</td>
              <td class="amount">${formatCurrency(item.whtAmount)}</td>
            </tr>
          `).join('')}
          <tr class="total-row">
            <td colspan="2"><strong>รวมเงินที่จ่ายและภาษีที่หักนำส่ง</strong></td>
            <td class="amount"><strong>${formatCurrency(cert.totalIncome)}</strong></td>
            <td></td>
            <td class="amount"><strong>${formatCurrency(cert.totalWHT)}</strong></td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="section">
      <strong>ผู้จ่ายเงิน</strong>
      <span class="checkbox ${cert.condition === 1 ? 'checked' : ''}">${cert.condition === 1 ? '✓' : ''}</span> (1) หักภาษี ณ ที่จ่าย
      <span class="checkbox ${cert.condition === 2 ? 'checked' : ''}">${cert.condition === 2 ? '✓' : ''}</span> (2) ออกภาษีให้ตลอดไป
      <span class="checkbox ${cert.condition === 3 ? 'checked' : ''}">${cert.condition === 3 ? '✓' : ''}</span> (3) ออกภาษีให้ครั้งเดียว
    </div>

    <div class="signature-section">
      <div class="signature-box">
        <div class="signature-line">
          ลงชื่อ ................................................ ผู้จ่ายเงิน
          <br>( ................................................ )
          <br>วันที่ ${formatDate(cert.paymentDate)}
        </div>
      </div>
      <div class="signature-box">
        <div class="signature-line">
          ลงชื่อ ................................................ ผู้รับเงิน
          <br>( ................................................ )
          <br>วันที่ ......../......../..........
        </div>
      </div>
    </div>

    <div style="margin-top: 20px; font-size: 12px; text-align: center; color: #666;">
      เอกสารนี้ออกโดยระบบ WE Accounting AI - ${new Date().toISOString()}
    </div>
  </div>
</body>
</html>
  `.trim();
};

/**
 * Generate batch WHT certificates for a period
 */
export const generateBatchWHTCertificates = (
  documents: DocumentRecord[],
  client: Client,
  startBookNo: string,
  startRunningNo: number
): WHTCertificateData[] => {
  const certificates: WHTCertificateData[] = [];
  let currentRunningNo = startRunningNo;

  // Filter documents with WHT
  const whtDocuments = documents.filter(d =>
    d.ai_data?.tax_compliance.wht_flag &&
    d.ai_data?.financials.wht_amount &&
    d.ai_data.financials.wht_amount > 0
  );

  whtDocuments.forEach(doc => {
    const cert = createWHTCertificate(doc, client, startBookNo, currentRunningNo);
    if (cert) {
      certificates.push(cert);
      currentRunningNo++;
    }
  });

  return certificates;
};

/**
 * Calculate WHT Summary for period
 */
export const calculateWHTSummary = (certificates: WHTCertificateData[]) => {
  const pnd3Certs = certificates.filter(c => c.formType === 'PND3');
  const pnd53Certs = certificates.filter(c => c.formType === 'PND53');

  return {
    pnd3: {
      count: pnd3Certs.length,
      totalIncome: pnd3Certs.reduce((sum, c) => sum + c.totalIncome, 0),
      totalWHT: pnd3Certs.reduce((sum, c) => sum + c.totalWHT, 0),
    },
    pnd53: {
      count: pnd53Certs.length,
      totalIncome: pnd53Certs.reduce((sum, c) => sum + c.totalIncome, 0),
      totalWHT: pnd53Certs.reduce((sum, c) => sum + c.totalWHT, 0),
    },
    total: {
      count: certificates.length,
      totalIncome: certificates.reduce((sum, c) => sum + c.totalIncome, 0),
      totalWHT: certificates.reduce((sum, c) => sum + c.totalWHT, 0),
    },
  };
};

export const whtCertificateService = {
  generateCertificateNo,
  createWHTCertificate,
  generateWHTCertificateHTML,
  generateBatchWHTCertificates,
  calculateWHTSummary,
  WHT_INCOME_TYPES,
};

export default whtCertificateService;
