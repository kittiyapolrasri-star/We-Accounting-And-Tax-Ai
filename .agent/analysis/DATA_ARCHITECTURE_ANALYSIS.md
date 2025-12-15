# 🗄️ WE Accounting & Tax AI
## Data Architecture & Multi-Tenant Storage Analysis

> **Version:** 1.0  
> **Generated:** 2025-12-15  
> **Purpose:** วิเคราะห์โครงสร้างการจัดเก็บข้อมูลสำหรับหลายร้อยบริษัท หลายปี หลายเดือน

---

# 📋 Summary

## ⚠️ สถานะปัจจุบัน: มีปัญหาการ Scale!

| ด้าน | สถานะ | ปัญหา |
|------|--------|-------|
| **Multi-Tenancy** | ⚠️ บางส่วน | ไม่ได้แบ่ง Collection ตาม Client |
| **Year/Month Partition** | ❌ ไม่มี | ข้อมูลทุกปีอยู่รวมกัน |
| **Query Efficiency** | ⚠️ ไม่ดี | ต้อง scan ข้อมูลทั้งหมด |
| **Cost Optimization** | ❌ สิ้นเปลือง | อ่านข้อมูลเก่าที่ไม่ต้องการ |

---

# 1️⃣ Current Database Structure (Flat Model)

## 🔴 ปัญหา: Flat Collections

ปัจจุบันใช้ **Flat Collections** ทุกอย่างอยู่รวมกัน:

```
Firestore
├── clients/          ← 200 docs (ทุกบริษัทรวมกัน)
├── documents/        ← 50,000+ docs (ทุกบริษัท ทุกปี รวมกัน!)
├── gl_entries/       ← 500,000+ docs (ทุกบริษัท ทุกปี รวมกัน!)
├── assets/           ← 5,000 docs
├── vendor_rules/     ← 2,000 docs
├── bank_transactions/← 100,000+ docs
├── activity_logs/    ← 100,000+ docs
└── staff/            ← 50 docs
```

### ปัญหาที่เกิด:

1. **Query ช้ามาก** - ต้อง filter จาก 500,000 records
2. **ค่า Firebase สูง** - อ่านข้อมูลเก่าที่ไม่ต้องการ
3. **Index Limit** - Firestore limit 200 composite indexes
4. **ไม่ Scale** - เมื่อมี 1000+ บริษัท จะมีปัญหา

---

# 2️⃣ Current Query Functions

## Functions ที่มี clientId Filter:

| Function | Has clientId Filter | Performance |
|----------|---------------------|-------------|
| `getClients()` | ✅ Gets all | N/A |
| `getDocuments()` | ❌ No filter | 🔴 Bad |
| `getDocumentsByClient(clientId)` | ✅ Yes | 🟡 OK |
| `getGLEntries()` | ❌ No filter | 🔴 Bad |
| `getGLEntriesByClient(clientId)` | ✅ Yes | 🟡 OK |
| `getAssets()` | ❌ No filter | 🔴 Bad |
| `getAssetsByClient(clientId)` | ✅ Yes | 🟡 OK |
| `getBankTransactions()` | ❌ No filter | 🔴 Bad |
| `getBankTransactionsByClient(clientId)` | ✅ Yes | 🟡 OK |
| `getRules()` | ❌ No filter | 🔴 Bad |
| `getRulesByClient(clientId)` | ✅ Yes | 🟡 OK |
| `getLogs()` | ❌ No filter | 🔴 Bad |

## ❌ Missing Functions:

| ต้องการ | สถานะ |
|---------|--------|
| `getDocumentsByPeriod(clientId, year, month)` | ❌ ไม่มี |
| `getGLEntriesByPeriod(clientId, year, month)` | ❌ ไม่มี |
| `getLogsByClient(clientId)` | ❌ ไม่มี |
| `archiveOldData(clientId, year)` | ❌ ไม่มี |

---

# 3️⃣ Recommended Architecture (Hierarchical Model)

## ✅ แนะนำ: Subcollection Model

```
Firestore (Hierarchical)
├── clients/
│   └── {clientId}/                    ← Document per client
│       ├── profile                    ← Client info
│       ├── documents/                 ← Subcollection
│       │   └── {year}/               ← Year subcollection
│       │       └── {month}/          ← Month subcollection
│       │           └── {docId}       ← Actual document
│       │
│       ├── gl_entries/               ← Subcollection
│       │   └── {year}/               ← Year subcollection
│       │       └── {month}/          ← Month subcollection
│       │           └── {entryId}     ← GL Entry
│       │
│       ├── assets/                   ← Subcollection
│       │   └── {assetId}
│       │
│       ├── bank_statements/          ← Subcollection
│       │   └── {year}/
│       │       └── {month}/
│       │           └── {txId}
│       │
│       ├── rules/                    ← Per-client rules
│       │   └── {ruleId}
│       │
│       └── activity_logs/           ← Per-client logs
│           └── {year}/
│               └── {month}/
│                   └── {logId}
│
├── global_rules/                     ← สำหรับ template rules
└── staff/                            ← Staff ไม่ขึ้นกับ client
```

## ✅ Firebase Storage Structure (File Storage)

```
Firebase Storage
├── clients/
│   └── {clientId}/
│       ├── documents/
│       │   └── {year}/
│       │       └── {month}/
│       │           ├── invoices/
│       │           │   ├── INV-001.pdf
│       │           │   └── INV-002.jpg
│       │           ├── receipts/
│       │           ├── bank-statements/
│       │           └── other/
│       │
│       ├── reports/                  ← Generated reports
│       │   └── {year}/
│       │       ├── งบการเงิน-2024.pdf
│       │       ├── ภพ30-12-2024.pdf
│       │       └── ภงด3-12-2024.pdf
│       │
│       └── contracts/               ← สัญญาถาวร
│           └── contract-001.pdf
│
└── temp/                            ← Temporary uploads
    └── {uploadId}/
        └── file.pdf
```

---

# 4️⃣ Query Pattern Comparison

## Before (Current - Slow)

```typescript
// ❌ Bad: Fetches ALL documents, then filters
const getAllDocuments = async () => {
  const docs = await fetchCollection<DocumentRecord>('documents');
  return docs; // Returns 50,000+ records!
};

// Usage: Filter in memory (SLOW)
const clientDocs = allDocs.filter(d => d.clientId === 'C001');
const marchDocs = clientDocs.filter(d => d.uploaded_at.startsWith('2024-03'));
```

## After (Recommended - Fast)

```typescript
// ✅ Good: Query directly with path
const getDocumentsByPeriod = async (
  clientId: string, 
  year: number, 
  month: string
) => {
  const path = `clients/${clientId}/documents/${year}/${month}`;
  const docs = await getDocs(collection(db, path));
  return docs; // Returns only 50-200 records for that month
};

// Usage: Direct query (FAST)
const marchDocs = await getDocumentsByPeriod('C001', 2024, '03');
```

## Performance Comparison

| Scenario | Current (Flat) | Recommended (Hierarchical) |
|----------|----------------|---------------------------|
| Get client's March docs | 5-10 seconds | 0.1-0.3 seconds |
| Get client's GL for year | 10-30 seconds | 1-2 seconds |
| Count reads (200 clients, 12 months) | 500,000 docs | 2,400 docs |
| Monthly Firebase cost | ~$200-500 | ~$20-50 |

---

# 5️⃣ Migration Strategy

## Phase 1: Add Period Fields (Quick Win)

เพิ่ม field ให้ documents เดิม:

```typescript
interface DocumentRecord {
  // Existing fields...
  
  // NEW: For efficient querying
  period: string;          // "2024-03" format
  year: number;            // 2024
  month: string;           // "03"
}
```

เพิ่ม composite index:
```
Collection: documents
Fields: 
  - clientId (Ascending)
  - period (Ascending)
  - uploaded_at (Descending)
```

## Phase 2: Create Period-based Query Functions

```typescript
// New functions to add
export const getDocumentsByPeriod = async (
  clientId: string,
  year: number,
  month?: string
): Promise<DocumentRecord[]> => {
  const constraints: QueryConstraint[] = [
    where('clientId', '==', clientId),
    where('year', '==', year)
  ];
  
  if (month) {
    constraints.push(where('month', '==', month));
  }
  
  constraints.push(orderBy('uploaded_at', 'desc'));
  
  return fetchCollection<DocumentRecord>(
    COLLECTIONS.DOCUMENTS,
    constraints
  );
};

export const getGLEntriesByPeriod = async (
  clientId: string,
  year: number,
  month?: string
): Promise<PostedGLEntry[]> => {
  // Similar implementation
};
```

## Phase 3: Subcollection Migration (Long-term)

For 200+ clients, migrate to subcollection model:

```typescript
// New structure
clients/{clientId}/documents/{year}/{month}/{docId}
clients/{clientId}/gl_entries/{year}/{month}/{entryId}
```

---

# 6️⃣ Indexing Strategy

## Required Composite Indexes

### For documents collection:
```yaml
- collection: documents
  fields:
    - field: clientId
    - field: year
    - field: month
    - field: uploaded_at
      order: DESCENDING

- collection: documents
  fields:
    - field: clientId
    - field: status
    - field: uploaded_at
      order: DESCENDING
```

### For gl_entries collection:
```yaml
- collection: gl_entries
  fields:
    - field: clientId
    - field: year
    - field: month
    - field: date
      order: DESCENDING

- collection: gl_entries
  fields:
    - field: clientId
    - field: account_code
    - field: date
      order: DESCENDING
```

---

# 7️⃣ Data Archival Strategy

## Archive Old Years

สำหรับข้อมูลเก่ากว่า 2 ปี:

```typescript
// Archive to separate collection or export
const archiveOldData = async (clientId: string, year: number) => {
  // 1. Export to Cloud Storage as JSON backup
  const backupPath = `archive/${clientId}/${year}/data.json`;
  
  // 2. Move to archive collection (cheaper storage)
  // 3. Delete from main collection
  
  // Keep summary/totals in main collection for reports
};
```

## Storage Lifecycle Rules

```json
{
  "lifecycle": {
    "rule": [
      {
        "action": { "type": "SetStorageClass", "storageClass": "NEARLINE" },
        "condition": { "age": 365 }
      },
      {
        "action": { "type": "SetStorageClass", "storageClass": "COLDLINE" },
        "condition": { "age": 730 }
      }
    ]
  }
}
```

---

# 8️⃣ Recommended Actions

## 🔥 Immediate (This Week)

| Priority | Task | Impact |
|----------|------|--------|
| 1 | Add `year`, `month`, `period` fields to DocumentRecord | Query optimization |
| 2 | Add `year`, `month` fields to PostedGLEntry | Query optimization |
| 3 | Create `getDocumentsByPeriod()` function | Faster queries |
| 4 | Create `getGLEntriesByPeriod()` function | Faster queries |
| 5 | Add Firestore composite indexes | Required for queries |

## 📊 Short-term (This Month)

| Priority | Task | Impact |
|----------|------|--------|
| 1 | Migrate existing data to add period fields | Better performance |
| 2 | Update all UI components to use period filters | User experience |
| 3 | Add client selector to all views | Multi-tenant aware |
| 4 | Implement pagination (50 docs per page) | Memory efficiency |

## 🚀 Long-term (Next Quarter)

| Priority | Task | Impact |
|----------|------|--------|
| 1 | Migrate to subcollection model | 10x faster queries |
| 2 | Implement data archival | Cost reduction |
| 3 | Add real-time sync for active clients | Better collaboration |
| 4 | Implement offline support | Better UX |

---

# 9️⃣ Cost Estimation

## Current Model (200 clients, 3 years data)

| Resource | Usage | Cost/Month |
|----------|-------|------------|
| Reads | ~500,000/day | ~$150 |
| Writes | ~10,000/day | ~$20 |
| Storage | 10GB | ~$2 |
| Bandwidth | 50GB | ~$5 |
| **Total** | | **~$177** |

## Optimized Model (Same data)

| Resource | Usage | Cost/Month |
|----------|-------|------------|
| Reads | ~50,000/day | ~$15 |
| Writes | ~10,000/day | ~$20 |
| Storage | 10GB | ~$2 |
| Bandwidth | 10GB | ~$1 |
| **Total** | | **~$38** |

**Savings: ~80% reduction in costs!**

---

# 📌 Conclusion

ระบบปัจจุบันสามารถทำงานได้กับ:
- ✅ 10-20 บริษัท
- ⚠️ 50-100 บริษัท (เริ่มช้า)
- ❌ 200+ บริษัท (จะมีปัญหา)

**ต้องดำเนินการ:**
1. เพิ่ม period fields ให้ทุก collection
2. สร้าง query functions ที่ filter by period
3. พิจารณา subcollection model สำหรับอนาคต

---

*Document generated by Antigravity AI Assistant*  
*For the WE Accounting & Tax AI Team*
