# 📚 End-to-End Function Reference
## WE Accounting & Tax AI - Complete API Documentation

---

# 🔐 Authentication Module

## /api/auth

### POST /api/auth/login
**Purpose:** User authentication

```
Request:
{
  "email": "user@example.com",
  "password": "password123"
}

Response:
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "uid": "uuid",
    "email": "user@example.com",
    "displayName": "User Name",
    "role": "accountant",
    "assignedClients": ["client-uuid-1", "client-uuid-2"]
  }
}
```

### POST /api/auth/register
**Purpose:** Create new user account

### GET /api/auth/me
**Purpose:** Get current authenticated user

### POST /api/auth/change-password
**Purpose:** Change user password

---

# 👥 Clients Module

## /api/clients

### GET /api/clients
**Purpose:** List all clients (filtered by user access)

```
Query Params:
- status: "Active" | "Inactive"
- search: string (name search)

Response:
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "บริษัท ABC จำกัด",
      "tax_id": "0105555000001",
      "status": "Active",
      "vat_registered": true,
      "_count": {
        "documents": 25
      }
    }
  ]
}
```

### POST /api/clients
**Purpose:** Create new client
**Access:** Admin, Manager only

### PUT /api/clients/:id
**Purpose:** Update client

### DELETE /api/clients/:id
**Purpose:** Soft delete client

---

# 📄 Documents Module

## /api/documents

### GET /api/documents
**Purpose:** List documents with filters

```
Query Params:
- clientId: string
- status: "pending_review" | "approved" | "rejected" | "posted"
- period: "YYYY-MM"
- limit: number
- offset: number

Response:
{
  "success": true,
  "data": [...documents],
  "pagination": {
    "total": 100,
    "limit": 20,
    "offset": 0
  }
}
```

### POST /api/documents
**Purpose:** Create document record

```
Request:
{
  "client_id": "uuid",
  "filename": "invoice_001.jpg",
  "original_filename": "IMG_001.jpg",
  "file_path": "/storage/clients/uuid/2024/12/file.jpg",
  "mime_type": "image/jpeg",
  "ai_data": { ...extracted data... },
  "confidence_score": 0.95,
  "amount": 10700,
  "vat_amount": 700,
  "vendor_name": "ABC Company"
}
```

### PUT /api/documents/:id
**Purpose:** Update document

### DELETE /api/documents/:id
**Purpose:** Delete document

### POST /api/documents/:id/approve
**Purpose:** Approve document for posting

### POST /api/documents/:id/reject
**Purpose:** Reject document with reason

---

# 🤖 AI Analysis Module

## /api/analyze

### POST /api/analyze/document
**Purpose:** AI OCR document analysis

```
Request:
{
  "fileData": "base64-encoded-file-content",
  "mimeType": "image/jpeg",
  "clientId": "uuid",
  "clientName": "บริษัท ABC จำกัด"
}

Response:
{
  "success": true,
  "data": {
    "doc_type": "invoice",
    "vendor_name": "บริษัท ซัพพลายเออร์ จำกัด",
    "vendor_tax_id": "0105555000002",
    "document_number": "INV-2024-0001",
    "document_date": "2024-12-15",
    "subtotal": 10000,
    "vat_rate": 7,
    "vat_amount": 700,
    "total_amount": 10700,
    "wht_applicable": true,
    "wht_rate": 3,
    "wht_amount": 300,
    "net_payment": 10400,
    "confidence_score": 0.95,
    "journal_lines": [
      {
        "account_code": "51200",
        "account_name_th": "ต้นทุนสินค้า",
        "account_side": "DEBIT",
        "amount": 10000
      },
      {
        "account_code": "14100",
        "account_name_th": "ภาษีซื้อ",
        "account_side": "DEBIT",
        "amount": 700
      },
      {
        "account_code": "21100",
        "account_name_th": "เจ้าหนี้การค้า",
        "account_side": "CREDIT",
        "amount": 10700
      }
    ],
    "_metadata": {
      "processed_at": "2024-12-15T12:00:00Z",
      "model_used": "gemini-2.0-flash-exp",
      "processing_time_ms": 2500
    }
  }
}
```

### GET /api/analyze/health
**Purpose:** Check AI service status

---

# 🧾 GL Entries Module

## /api/gl

### GET /api/gl
**Purpose:** List GL entries

```
Query Params:
- clientId: string
- period: "YYYY-MM"
- account_code: string (prefix match)
- limit: number
- offset: number
```

### GET /api/gl/trial-balance
**Purpose:** Generate trial balance

```
Query Params:
- clientId: string (required)
- period: "YYYY-MM" (required)

Response:
{
  "success": true,
  "data": {
    "entries": [
      {
        "account_code": "11100",
        "account_name": "เงินสด",
        "debit": 50000,
        "credit": 0,
        "balance": 50000
      }
    ],
    "totals": {
      "debit": 100000,
      "credit": 100000,
      "balanced": true
    }
  }
}
```

### POST /api/gl
**Purpose:** Create journal entries

```
Request:
{
  "client_id": "uuid",
  "date": "2024-12-15",
  "entries": [
    {
      "account_code": "51200",
      "account_name": "ต้นทุนสินค้า",
      "debit": 10000,
      "credit": 0,
      "description": "ซื้อสินค้า INV-001"
    },
    {
      "account_code": "21100",
      "account_name": "เจ้าหนี้การค้า",
      "debit": 0,
      "credit": 10000
    }
  ],
  "source_doc_id": "document-uuid",
  "journal_ref": "JV-2024-0001"
}

Validation:
- Total Debit MUST equal Total Credit
- Returns error if unbalanced
```

### DELETE /api/gl/:id
**Purpose:** Delete GL entry

---

# 📁 Files Module

## /api/files

### POST /api/files/upload
**Purpose:** Upload file to storage

```
Request: FormData
- file: File (image/pdf)
- clientId: string
- docType: string

Response:
{
  "success": true,
  "data": {
    "filename": "1702648800000_abc123.jpg",
    "path": "/storage/clients/uuid/2024/12/file.jpg",
    "url": "http://localhost:3001/api/files/serve/clients/uuid/..."
  }
}
```

### POST /api/files/upload-base64
**Purpose:** Upload base64-encoded file

### GET /api/files/serve/*
**Purpose:** Serve file (with security check)

### DELETE /api/files
**Purpose:** Delete file from storage

---

# 👨‍💼 Staff Module

## /api/staff (Admin/Manager only)

### GET /api/staff
**Purpose:** List all staff

### GET /api/staff/:id
**Purpose:** Get staff details

### POST /api/staff
**Purpose:** Create new staff member

```
Request:
{
  "email": "new@example.com",
  "password": "password123",
  "name": "New Staff",
  "role": "accountant",
  "assigned_clients": ["uuid-1", "uuid-2"]
}
```

### PUT /api/staff/:id
**Purpose:** Update staff

### POST /api/staff/:id/reset-password
**Purpose:** Admin reset password

### DELETE /api/staff/:id
**Purpose:** Deactivate staff (soft delete)

---

# 🏢 Fixed Assets Module

## /api/assets

### GET /api/assets
**Purpose:** List assets

### POST /api/assets
**Purpose:** Create asset

```
Request:
{
  "client_id": "uuid",
  "name": "คอมพิวเตอร์",
  "asset_code": "AST-001",
  "category": "equipment",
  "purchase_date": "2024-01-01",
  "purchase_value": 50000,
  "useful_life": 60,
  "salvage_value": 5000,
  "depreciation_method": "straight_line"
}
```

### POST /api/assets/:id/depreciate
**Purpose:** Calculate monthly depreciation

```
Request:
{
  "period": "2024-12"
}

Response:
{
  "success": true,
  "data": {
    "depreciation": {
      "amount": 750,
      "period": "2024-12",
      "method": "straight_line"
    }
  }
}
```

---

# 🏦 Bank Transactions Module

## /api/bank

### GET /api/bank
**Purpose:** List bank transactions

### POST /api/bank/import
**Purpose:** Bulk import transactions

```
Request:
{
  "client_id": "uuid",
  "transactions": [
    {
      "date": "2024-12-15",
      "description": "Transfer from ABC",
      "amount": 10000,
      "balance": 50000,
      "bank_account": "123-456-789",
      "transaction_type": "deposit"
    }
  ]
}
```

### POST /api/bank/:id/match
**Purpose:** Match transaction to document

### POST /api/bank/:id/reconcile
**Purpose:** Mark as reconciled

### GET /api/bank/summary
**Purpose:** Reconciliation status summary

---

# 📝 Vendor Rules Module

## /api/rules

### GET /api/rules
**Purpose:** List auto-categorization rules

### POST /api/rules
**Purpose:** Create new rule

```
Request:
{
  "client_id": null,  // null = global rule
  "vendor_pattern": "เช่า|RENT",
  "default_account": "52400",
  "default_doc_type": "expense",
  "wht_rate": 5,
  "description": "ค่าเช่า (หัก ณ ที่จ่าย 5%)"
}
```

### POST /api/rules/match
**Purpose:** Find matching rule for vendor

---

# ✅ Tasks Module

## /api/tasks

### GET /api/tasks
**Purpose:** List tasks (filtered)

### GET /api/tasks/my
**Purpose:** Get current user's tasks

### POST /api/tasks
**Purpose:** Create task

```
Request:
{
  "client_id": "uuid",
  "assignee_id": "staff-uuid",
  "title": "Review December invoices",
  "description": "Check and approve all pending invoices",
  "task_type": "review_document",
  "priority": "high",
  "due_date": "2024-12-20"
}
```

### POST /api/tasks/:id/complete
**Purpose:** Mark task as completed

---

# 📊 Activity Logs Module

## /api/activity-logs

### GET /api/activity-logs
**Purpose:** List activity logs (audit trail)

```
Query Params:
- entity_type: "document" | "client" | "gl_entry"
- entity_id: string
- user_id: string
- action: "CREATE" | "UPDATE" | "DELETE" | "LOGIN"
- limit: number
- offset: number
```

### GET /api/activity-logs/entity/:type/:id
**Purpose:** Get logs for specific entity

### GET /api/activity-logs/user/:id
**Purpose:** Get logs for specific user (Admin only)

---

# 🔄 Flow Integration

## Complete Document Processing Flow

```
1. Frontend: Upload file
   → POST /api/files/upload
   ← { path, url }

2. Frontend: Send for AI analysis
   → POST /api/analyze/document
   ← { ai_data, journal_lines, confidence }

3. Frontend: Apply vendor rules
   → POST /api/rules/match
   ← { matched rule or null }

4. Staff: Review and approve
   → POST /api/documents (save record)
   → POST /api/documents/:id/approve

5. Staff: Post to accounting
   → POST /api/gl (create journal entries)

6. Reports: Generate trial balance
   → GET /api/gl/trial-balance
```

---

*End-to-End Function Reference - v1.0*
