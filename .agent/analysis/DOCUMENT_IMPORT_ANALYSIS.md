# 📥 WE Accounting & Tax AI
## Document Import & Classification Analysis

> **Version:** 1.0  
> **Generated:** 2025-12-15  
> **Purpose:** วิเคราะห์ระบบนำเข้าเอกสาร การจัดเก็บ และการแยกประเภทข้อมูล

---

# 📋 Executive Summary

## สถานะความพร้อมของแต่ละส่วน

| ส่วนงาน | สถานะ | ความพร้อม |
|---------|--------|-----------|
| **1. Document Upload** | ✅ พร้อม | 90% |
| **2. AI OCR (Gemini Vision)** | ✅ พร้อม | 85% |
| **3. File Storage (Firebase)** | ✅ พร้อม | 95% |
| **4. Document Type Detection** | ⚠️ บางส่วน | 60% |
| **5. Bank Statement Import** | ✅ พร้อม | 80% |
| **6. Sales Data Import** | ✅ พร้อม | 85% |
| **7. Data Validation** | ⚠️ ต้องปรับปรุง | 50% |
| **8. Auto-Classification** | ⚠️ ต้องพัฒนาเพิ่ม | 40% |

---

# 1️⃣ Document Upload Flow

## ✅ สถานะ: พร้อมใช้งาน

### Current Implementation

```
User Interface                Processing                    Storage
─────────────                ───────────                    ───────
                                                            
┌──────────────┐   ┌────────────────┐   ┌──────────────────┐
│ File Input   │──→│ processQueue   │──→│ Firebase Storage │
│ (drag/drop)  │   │ Item()         │   │ /clients/{id}/   │
└──────────────┘   └────────────────┘   └──────────────────┘
                          │                      │
                          ↓                      ↓
                   ┌────────────────┐   ┌──────────────────┐
                   │ Gemini Vision  │   │ Firestore        │
                   │ OCR Analysis   │   │ documents/       │
                   └────────────────┘   └──────────────────┘
```

### File Types Supported

| File Type | Extension | Status | Notes |
|-----------|-----------|--------|-------|
| **Images** | .jpg, .jpeg | ✅ | OCR supported |
| **Images** | .png | ✅ | OCR supported |
| **Images** | .webp | ✅ | OCR supported |
| **PDF** | .pdf | ✅ | OCR supported |
| **Excel** | .xlsx, .xls | ✅ | Parsed (not OCR) |
| **CSV** | .csv | ✅ | Bank statements |

### Upload Entry Points

| Component | File | Line | Purpose |
|-----------|------|------|---------|
| **App.tsx** | handleFileChange() | 669 | Main upload handler |
| **App.tsx** | handleUploadClick() | 686 | Quick upload button |
| **ClientPortal.tsx** | handleClientPortalUpload() | 677 | Client uploads |
| **BankImport.tsx** | handleFileSelect() | 27 | Bank statement import |
| **SalesDataImport.tsx** | handleFileSelect() | 83 | Sales data import |

---

# 2️⃣ AI OCR (Gemini Vision)

## ✅ สถานะ: พร้อมใช้งาน (ต้อง deploy Cloud Functions)

### API Endpoint

```
POST /api/analyze-document
Host: asia-southeast1-{project}.cloudfunctions.net

Body:
{
  "fileData": "<base64>",
  "mimeType": "image/jpeg" | "application/pdf" | ...,
  "clientId": "C001",
  "clientName": "บริษัท ABC จำกัด"
}
```

### AI Output Structure

```typescript
interface AccountingResponse {
  status: 'success' | 'needs_review' | 'auto_approved';
  confidence_score: number; // 0-100
  
  header_data: {
    doc_type: string;        // "ใบกำกับภาษี", "ใบเสร็จรับเงิน", etc.
    issue_date: string;      // "2024-12-15"
    inv_number: string;      // "INV-2024-001"
    currency: string;        // "THB"
    vat_period?: { month, year };
  };
  
  parties: {
    client_company: { name, tax_id, address, branch };
    counterparty: { name, tax_id, address, branch };
  };
  
  financials: {
    subtotal: number;
    discount: number;
    vat_rate: number;
    vat_amount: number;
    grand_total: number;
    wht_amount: number | null;
  };
  
  accounting_entry: {
    transaction_description: string;
    journal_lines: JournalLine[];
  };
  
  tax_compliance: {
    is_full_tax_invoice: boolean;
    vat_claimable: boolean;
    wht_flag: boolean;
    wht_code?: 'PND3' | 'PND53';
    wht_rate?: number;
  };
}
```

### ⚠️ Known Limitations

| Issue | Current State | Recommendation |
|-------|---------------|----------------|
| Thai handwriting | ❌ Limited | Wait for Gemini 2.0 |
| Multi-page PDF | ⚠️ First page only | Implement page iteration |
| Low quality scans | ⚠️ Low confidence | Add image enhancement |
| Faded receipts | ⚠️ May fail | Add contrast adjustment |

---

# 3️⃣ Document Type Detection

## ⚠️ สถานะ: ต้องพัฒนาเพิ่ม

### Current: AI-Based Detection Only

ปัจจุบันพึ่ง Gemini ในการระบุประเภท:

```typescript
// Gemini returns doc_type as:
doc_type: "ใบกำกับภาษี" | "ใบเสร็จรับเงิน" | "ใบแจ้งหนี้" | ...
```

### ⚠️ Missing: Pre-Processing Classification

**ยังไม่มี:**
1. ❌ Classification ก่อนส่งไป Gemini
2. ❌ Filename pattern detection
3. ❌ Template matching สำหรับ format ที่รู้จัก
4. ❌ Vendor-specific parsers

### 📋 Document Types to Support

| Type (TH) | Type (EN) | Status | Storage Folder |
|-----------|-----------|--------|----------------|
| ใบกำกับภาษี | Tax Invoice | ✅ | invoices/ |
| ใบเสร็จรับเงิน | Receipt | ✅ | receipts/ |
| ใบแจ้งหนี้ | Invoice | ✅ | invoices/ |
| ใบกำกับภาษีอย่างย่อ | Abbreviated Tax Invoice | ✅ | receipts/ |
| ใบสำคัญจ่าย | Payment Voucher | ⚠️ | vouchers/ |
| ใบสำคัญรับ | Receipt Voucher | ⚠️ | vouchers/ |
| Bank Statement | Bank Statement | ✅ | bank-statements/ |
| 50 ทวิ | WHT Certificate | ⚠️ | wht-certs/ |
| สัญญา | Contract | ❌ | contracts/ |
| ใบเสนอราคา | Quotation | ❌ | quotations/ |
| ใบสั่งซื้อ | Purchase Order | ❌ | purchase-orders/ |

---

# 4️⃣ Bank Statement Import

## ✅ สถานะ: พร้อมใช้งาน

### Services/Files

| File | Purpose |
|------|---------|
| `services/bankFeed.ts` | Bank statement parser |
| `components/BankImport.tsx` | UI Component |

### Supported Banks

| Bank | Format | Status | Notes |
|------|--------|--------|-------|
| **SCB** | CSV | ✅ Ready | parseSCBFormat() |
| **KBANK** | CSV | ✅ Ready | parseKBANKFormat() |
| **BBL** | CSV | ⚠️ Generic | Uses auto-detect |
| **KTB** | CSV | ⚠️ Generic | Uses auto-detect |
| **BAY** | CSV | ⚠️ Generic | Uses auto-detect |
| **TTB** | CSV | ⚠️ Generic | Uses auto-detect |

### Bank Import Flow

```
CSV File          Parser                Database
────────          ──────                ────────

┌──────────┐   ┌────────────────┐   ┌──────────────┐
│ CSV File │──→│ parseBankState │──→│ bank_transac │
│ (SCB)    │   │ ment()         │   │ tions/       │
└──────────┘   └────────────────┘   └──────────────┘
                      │
         ┌────────────┴────────────┐
         │                         │
         ↓                         ↓
┌──────────────────┐   ┌──────────────────┐
│ detectBankFormat │   │ convertToBankTx  │
│ ()               │   │ ()               │
└──────────────────┘   └──────────────────┘
```

### Parsed Data Structure

```typescript
interface ParsedBankRow {
  date: string;         // ISO format
  description: string;  // Transaction description
  withdrawal: number;   // ถอน
  deposit: number;      // ฝาก
  balance: number;      // ยอดคงเหลือ
  reference?: string;   // เลขอ้างอิง
}
```

---

# 5️⃣ Sales Data Import (POS/E-Commerce)

## ✅ สถานะ: พร้อมใช้งาน

### Services/Files

| File | Purpose |
|------|---------|
| `services/excelParser.ts` | Smart Excel parser |
| `components/SalesDataImport.tsx` | UI Component |

### Supported Platforms

| Platform | Status | Parser Class |
|----------|--------|--------------|
| **Grab Food** | ✅ Ready | GrabFoodParser |
| **LINE MAN** | ✅ Ready | LineManParser |
| **Shopee** | ⚠️ Detect only | ShopeeParser (partial) |
| **Lazada** | ⚠️ Detect only | Uses generic |
| **POS** | ⚠️ Detect only | Uses generic |
| **Bank Statement** | ✅ Ready | Bank parser |

### Auto-Detection Patterns

```typescript
const SOURCE_PATTERNS = {
  grab: {
    columns: ['Order ID', 'Order Status', 'Net Payout'],
    sheetPatterns: ['GrabFood', 'Grab']
  },
  lineman: {
    columns: ['รหัสออเดอร์', 'ชื่อร้านค้า', 'ยอดชำระ'],
    sheetPatterns: ['LINE MAN', 'Wongnai']
  },
  shopee: {
    columns: ['Order ID', 'Product Name', 'Buyer Username'],
    sheetPatterns: ['Shopee']
  }
  // ... more
};
```

### Output Structure

```typescript
interface SalesTransaction {
  id: string;
  date: Date;
  orderId: string;
  source: DataSourceType;
  branch?: string;
  grossAmount: number;
  discount: number;
  netAmount: number;
  commission?: number;
  commissionVat?: number;
  payout?: number;
  paymentMethod?: string;
  orderType?: string;
  status: 'completed' | 'cancelled' | 'refunded' | 'pending';
  customerName?: string;
  rawData: Record<string, any>;
}
```

---

# 6️⃣ Data Validation

## ⚠️ สถานะ: ต้องปรับปรุง

### Current Validation (Exists)

| Validation | Where | Status |
|------------|-------|--------|
| GL Balance (Dr = Cr) | accountingValidation.ts | ✅ |
| Account Code exists | accountingValidation.ts | ✅ |
| Period Lock check | accountingValidation.ts | ✅ |
| Tax ID format (13 digits) | ❌ Missing | |
| Amount range check | ❌ Missing | |
| Duplicate invoice check | ❌ Missing | |
| Date in valid range | ❌ Missing | |

### ❌ Missing Pre-Upload Validation

```typescript
// ต้องเพิ่ม
interface PreUploadValidation {
  // File validation
  validateFileSize(file: File, maxMB: number): boolean;
  validateFileType(file: File, allowedTypes: string[]): boolean;
  
  // Content validation (after OCR)
  validateTaxId(taxId: string): { valid: boolean; error?: string };
  validateAmount(amount: number, min?: number, max?: number): boolean;
  validateDate(date: string, minDate?: string, maxDate?: string): boolean;
  
  // Duplicate detection
  checkDuplicateInvoice(invNumber: string, vendorTaxId: string): Promise<boolean>;
}
```

---

# 7️⃣ Auto-Classification System

## ⚠️ สถานะ: ต้องพัฒนาเพิ่ม

### Current: Post-OCR Classification Only

```typescript
// ปัจจุบัน: แยกประเภทหลัง OCR เท่านั้น
const docType = aiData.header_data.doc_type;

// ใช้ใน:
// - vatReturn.ts (line 120)
// - bankReconciliation.ts (line 197)
// - automation.ts (line 156)
```

### ❌ Missing: Pre-Classification

**ต้องพัฒนา:**

```typescript
interface PreClassificationService {
  // 1. Classify by filename pattern
  classifyByFilename(filename: string): DocumentType | null;
  
  // 2. Classify by file header (PDF metadata, image EXIF)
  classifyByMetadata(file: File): Promise<DocumentType | null>;
  
  // 3. Classify by content preview (first few KB)
  classifyByPreview(file: File): Promise<DocumentType | null>;
  
  // 4. Get suggested storage folder
  getSuggestedFolder(docType: DocumentType, clientId: string): string;
}
```

### Proposed Auto-Classification Rules

```typescript
const CLASSIFICATION_RULES = {
  // Filename patterns
  filename: {
    'invoice|inv|ใบกำกับ': 'TAX_INVOICE',
    'receipt|ใบเสร็จ': 'RECEIPT',
    'statement|stt': 'BANK_STATEMENT',
    'wht|50ทวิ|หักภาษี': 'WHT_CERT',
    'contract|สัญญา': 'CONTRACT',
  },
  
  // Vendor patterns (auto-detect vendor and apply rules)
  vendor: {
    'SCB|ไทยพาณิชย์': 'BANK_STATEMENT',
    'KBANK|กสิกร': 'BANK_STATEMENT',
    'Grab|แกร็บ': 'SALES_REPORT',
    'LINE MAN': 'SALES_REPORT',
  },
  
  // Amount-based (high-value = needs review)
  amount: {
    threshold: 100000,
    action: 'REQUIRE_REVIEW'
  }
};
```

---

# 8️⃣ Storage Organization

## ✅ สถานะ: พร้อมใช้งาน (ตาม documentStorage.ts)

### Folder Structure

```
Firebase Storage
└── clients/
    └── {clientId}/
        └── documents/
            └── {year}/
                └── {month}/
                    ├── invoices/
                    │   ├── INV-001_1702xxx.pdf
                    │   └── INV-002_1702xxx.jpg
                    │
                    ├── receipts/
                    │   └── REC-001_1702xxx.pdf
                    │
                    ├── bank-statements/
                    │   └── SCB-DEC-2024_1702xxx.csv
                    │
                    ├── wht-certificates/
                    │   └── 50TAWI-001_1702xxx.pdf
                    │
                    ├── sales-reports/
                    │   ├── grab-dec-2024_1702xxx.xlsx
                    │   └── lineman-dec-2024_1702xxx.xlsx
                    │
                    └── other/
                        └── misc_1702xxx.pdf
```

---

# 9️⃣ Recommended Improvements

## 🔥 Priority 1: Pre-Upload Validation

```typescript
// services/documentValidation.ts (NEW)

export const validateBeforeUpload = async (file: File): Promise<ValidationResult> => {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // 1. File size check (max 10MB)
  if (file.size > 10 * 1024 * 1024) {
    errors.push('ไฟล์ใหญ่เกิน 10MB');
  }
  
  // 2. File type check
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
  if (!allowedTypes.includes(file.type)) {
    errors.push(`ไม่รองรับไฟล์ประเภท ${file.type}`);
  }
  
  // 3. Filename sanitization
  const sanitized = sanitizeFilename(file.name);
  if (sanitized !== file.name) {
    warnings.push('ชื่อไฟล์ถูกปรับให้ถูกต้อง');
  }
  
  return { valid: errors.length === 0, errors, warnings };
};
```

## 🔥 Priority 2: Auto-Classification Service

```typescript
// services/documentClassification.ts (NEW)

export const classifyDocument = async (file: File): Promise<ClassificationResult> => {
  // 1. Try filename classification
  let docType = classifyByFilename(file.name);
  
  // 2. If unknown, try metadata
  if (!docType) {
    docType = await classifyByMetadata(file);
  }
  
  // 3. Default to 'GENERAL' if still unknown
  docType = docType || 'GENERAL';
  
  return {
    docType,
    suggestedFolder: getStorageFolder(docType),
    confidence: calculateConfidence(docType)
  };
};
```

## 🔥 Priority 3: Duplicate Detection

```typescript
// services/duplicateDetection.ts (NEW)

export const checkDuplicate = async (
  clientId: string,
  invNumber: string,
  vendorTaxId: string,
  amount: number
): Promise<DuplicateCheckResult> => {
  const existing = await databaseService.getDocumentsByClient(clientId);
  
  const duplicates = existing.filter(doc => {
    const aiData = doc.ai_data;
    if (!aiData) return false;
    
    // Exact match
    if (aiData.header_data.inv_number === invNumber &&
        aiData.parties.counterparty.tax_id === vendorTaxId) {
      return true;
    }
    
    // Fuzzy match (same amount, same vendor, within 7 days)
    if (aiData.financials.grand_total === amount &&
        aiData.parties.counterparty.tax_id === vendorTaxId) {
      return true;
    }
    
    return false;
  });
  
  return {
    isDuplicate: duplicates.length > 0,
    matches: duplicates,
    confidence: duplicates.length > 0 ? 0.9 : 0
  };
};
```

---

# 📊 Summary: Next Steps

## Immediate Actions (This Week)

| # | Task | Impact | Effort |
|---|------|--------|--------|
| 1 | Add pre-upload validation | Data quality | 2-4 hrs |
| 2 | Add duplicate detection | Prevent errors | 4-6 hrs |
| 3 | Deploy Cloud Functions | Enable AI | 2-3 hrs |

## Short-term (This Month)

| # | Task | Impact | Effort |
|---|------|--------|--------|
| 4 | Auto-classification service | Better UX | 8-12 hrs |
| 5 | Multi-page PDF support | More docs | 4-6 hrs |
| 6 | Image enhancement pre-processing | Better OCR | 4-6 hrs |

## Long-term (Next Quarter)

| # | Task | Impact | Effort |
|---|------|--------|--------|
| 7 | Template matching for known formats | Faster processing | 16-24 hrs |
| 8 | Vendor-specific parsers | Better accuracy | 20-30 hrs |
| 9 | Machine learning classification | Automation | 40+ hrs |

---

*Document generated by Antigravity AI Assistant*  
*For the WE Accounting & Tax AI Team*
