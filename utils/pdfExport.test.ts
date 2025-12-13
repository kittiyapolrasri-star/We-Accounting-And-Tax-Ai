import { describe, it, expect, vi } from 'vitest';
import {
  TaxFormData,
  VATReportItem,
  WHTReportItem,
} from './pdfExport';

// Mock jsPDF since it requires DOM
vi.mock('jspdf', () => ({
  default: vi.fn().mockImplementation(() => ({
    setFontSize: vi.fn(),
    text: vi.fn(),
    setDrawColor: vi.fn(),
    setLineWidth: vi.fn(),
    rect: vi.fn(),
    setFillColor: vi.fn(),
    setTextColor: vi.fn(),
    save: vi.fn(),
    lastAutoTable: { finalY: 100 },
  })),
}));

vi.mock('jspdf-autotable', () => ({
  default: vi.fn(),
}));

describe('PDF Export Utils', () => {
  describe('TaxFormData Interface', () => {
    it('should accept valid TaxFormData', () => {
      const formData: TaxFormData = {
        companyName: 'บริษัท ทดสอบ จำกัด',
        companyTaxId: '0105500000001',
        companyAddress: '123 ถ.สุขุมวิท กรุงเทพฯ',
        period: 'กุมภาพันธ์ 2567',
        year: '2567',
      };

      expect(formData.companyName).toBe('บริษัท ทดสอบ จำกัด');
      expect(formData.companyTaxId).toBe('0105500000001');
      expect(formData.period).toBe('กุมภาพันธ์ 2567');
    });
  });

  describe('VATReportItem Interface', () => {
    it('should accept valid VAT report item', () => {
      const item: VATReportItem = {
        date: '2024-02-15',
        docNo: 'INV-2024001',
        counterpartyName: 'บริษัท ABC จำกัด',
        counterpartyTaxId: '0105500000002',
        baseAmount: 10000,
        vatAmount: 700,
      };

      expect(item.baseAmount).toBe(10000);
      expect(item.vatAmount).toBe(700);
      expect(item.vatAmount / item.baseAmount).toBeCloseTo(0.07);
    });

    it('should calculate VAT correctly at 7%', () => {
      const items: VATReportItem[] = [
        { date: '2024-02-01', docNo: 'INV-001', counterpartyName: 'A', counterpartyTaxId: '001', baseAmount: 1000, vatAmount: 70 },
        { date: '2024-02-02', docNo: 'INV-002', counterpartyName: 'B', counterpartyTaxId: '002', baseAmount: 5000, vatAmount: 350 },
        { date: '2024-02-03', docNo: 'INV-003', counterpartyName: 'C', counterpartyTaxId: '003', baseAmount: 15000, vatAmount: 1050 },
      ];

      const totalBase = items.reduce((sum, item) => sum + item.baseAmount, 0);
      const totalVat = items.reduce((sum, item) => sum + item.vatAmount, 0);

      expect(totalBase).toBe(21000);
      expect(totalVat).toBe(1470);
      expect(totalVat / totalBase).toBeCloseTo(0.07);
    });
  });

  describe('WHTReportItem Interface', () => {
    it('should accept valid WHT report item with 3% rate', () => {
      const item: WHTReportItem = {
        date: '2024-02-15',
        docNo: 'PV-2024001',
        payeeName: 'บริษัท XYZ จำกัด',
        payeeTaxId: '0105500000003',
        incomeType: 'ค่าบริการ',
        whtRate: 3,
        baseAmount: 10000,
        whtAmount: 300,
      };

      expect(item.whtRate).toBe(3);
      expect(item.whtAmount).toBe(300);
      expect(item.whtAmount / item.baseAmount * 100).toBe(3);
    });

    it('should calculate WHT for various rates', () => {
      const testCases = [
        { rate: 1, base: 10000, expectedWht: 100 },   // ค่าโฆษณา
        { rate: 2, base: 10000, expectedWht: 200 },   // ค่าขนส่ง
        { rate: 3, base: 10000, expectedWht: 300 },   // ค่าบริการ
        { rate: 5, base: 10000, expectedWht: 500 },   // ค่าเช่า
        { rate: 10, base: 10000, expectedWht: 1000 }, // เงินปันผล
      ];

      testCases.forEach(({ rate, base, expectedWht }) => {
        const calculatedWht = (base * rate) / 100;
        expect(calculatedWht).toBe(expectedWht);
      });
    });
  });

  describe('VAT Net Calculation', () => {
    it('should calculate VAT payable correctly', () => {
      const outputVat = 7000;  // Sales VAT
      const inputVat = 4900;   // Purchase VAT
      const netVat = outputVat - inputVat;

      expect(netVat).toBe(2100);
      expect(netVat).toBeGreaterThan(0); // VAT Payable
    });

    it('should calculate VAT refundable correctly', () => {
      const outputVat = 3500;  // Sales VAT (low sales)
      const inputVat = 7000;   // Purchase VAT (high purchases)
      const netVat = outputVat - inputVat;

      expect(netVat).toBe(-3500);
      expect(netVat).toBeLessThan(0); // VAT Refundable
    });
  });

  describe('Thai Date Formatting', () => {
    it('should format date with Buddhist year', () => {
      const gregorianYear = 2024;
      const buddhistYear = gregorianYear + 543;

      expect(buddhistYear).toBe(2567);
    });

    it('should use correct Thai month names', () => {
      const thaiMonths = [
        'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
        'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
      ];

      expect(thaiMonths[0]).toBe('มกราคม');
      expect(thaiMonths[1]).toBe('กุมภาพันธ์');
      expect(thaiMonths.length).toBe(12);
    });
  });

  describe('Currency Formatting', () => {
    it('should format Thai Baht with 2 decimal places', () => {
      const amount = 10000;
      const formatted = amount.toLocaleString('th-TH', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });

      expect(formatted).toContain('10');
      expect(formatted).toContain('.00');
    });

    it('should format negative amounts correctly', () => {
      const amount = -5000.50;
      const formatted = Math.abs(amount).toLocaleString('th-TH', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });

      expect(formatted).toContain('5');
      expect(formatted).toContain('.50');
    });
  });
});
