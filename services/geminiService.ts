import { getAuthToken } from './auth';
import { AccountingResponse } from '../types';
import { isFirebaseConfigured } from './firebase';

// API base URL - use Cloud Functions in production (API key is stored securely on server)
const API_BASE_URL = import.meta.env.VITE_API_URL ||
  (import.meta.env.VITE_FIREBASE_PROJECT_ID
    ? `https://asia-southeast1-${import.meta.env.VITE_FIREBASE_PROJECT_ID}.cloudfunctions.net/api`
    : '');

/**
 * Converts a File object to a Base64 string.
 */
const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      // Remove the data URL prefix (e.g., "data:image/jpeg;base64,")
      const base64Data = base64String.split(",")[1];
      resolve(base64Data);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

/**
 * Generate mock response for demo mode
 */
const generateDemoResponse = (filename: string): AccountingResponse => {
  const now = new Date();
  const invoiceNo = `INV-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
  const dateStr = now.toISOString().split('T')[0];

  return {
    status: "needs_review",
    confidence_score: 85,
    review_reason: "Demo Mode - กรุณาตั้งค่า Firebase เพื่อใช้งานจริง",
    audit_flags: [
      {
        severity: "low",
        code: "DEMO_MODE",
        message: "นี่คือข้อมูลตัวอย่างจาก Demo Mode - กรุณาตั้งค่า Firebase เพื่อใช้งานจริง"
      }
    ],
    file_metadata: {
      suggested_filename: `${invoiceNo}_${filename}`,
      suggested_folder_path: `/clients/demo/invoices/${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}`
    },
    header_data: {
      doc_type: "ใบกำกับภาษี",
      issue_date: dateStr,
      inv_number: invoiceNo,
      currency: "THB",
      vat_period: {
        month: String(now.getMonth() + 1).padStart(2, '0'),
        year: String(now.getFullYear())
      }
    },
    parties: {
      client_company: {
        name: "Demo Client",
        tax_id: "0105500000002",
        address: "456 ถ.รัชดา กรุงเทพฯ 10400",
        branch: "สำนักงานใหญ่"
      },
      counterparty: {
        name: "บริษัท ตัวอย่าง จำกัด",
        tax_id: "0105500000001",
        address: "123 ถ.สุขุมวิท กรุงเทพฯ 10110",
        branch: "สำนักงานใหญ่"
      }
    },
    financials: {
      subtotal: 10000,
      discount: 0,
      vat_rate: 7,
      vat_amount: 700,
      grand_total: 10700,
      wht_amount: null
    },
    accounting_entry: {
      transaction_description: `ซื้อสินค้า/บริการจาก บริษัท ตัวอย่าง จำกัด - ${filename}`,
      account_class: "ค่าใช้จ่าย",
      journal_lines: [
        { account_code: "52100", account_side: "DEBIT", account_name_th: "ค่าใช้จ่ายดำเนินงาน", amount: 10000 },
        { account_code: "11540", account_side: "DEBIT", account_name_th: "ภาษีซื้อ", amount: 700 },
        { account_code: "21200", account_side: "CREDIT", account_name_th: "เจ้าหนี้การค้า", amount: 10700 }
      ]
    },
    tax_compliance: {
      is_full_tax_invoice: true,
      vat_claimable: true,
      wht_flag: false,
      wht_rate: 0
    }
  };
};

/**
 * Analyze document using Cloud Functions backend (secure - API key on server)
 * Falls back to demo mode if Firebase is not configured
 */
export const analyzeDocument = async (
  file: File,
  clientId?: string,
  clientName?: string
): Promise<AccountingResponse> => {
  // Demo mode - return mock data when Firebase is not configured
  if (!isFirebaseConfigured || !API_BASE_URL) {
    console.log("Running in Demo Mode - returning simulated analysis");
    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 1500));
    return generateDemoResponse(file.name);
  }

  try {
    // Get auth token
    const token = await getAuthToken();

    if (!token) {
      throw new Error('กรุณาเข้าสู่ระบบก่อนใช้งาน');
    }

    // Convert file to base64
    const base64Data = await fileToBase64(file);

    // Call Cloud Functions API (API key is stored securely on server)
    const response = await fetch(`${API_BASE_URL}/api/analyze-document`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        fileData: base64Data,
        mimeType: file.type,
        clientId: clientId || 'unknown',
        clientName: clientName || 'Unknown Client',
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));

      if (response.status === 401) {
        throw new Error('Session หมดอายุ กรุณาเข้าสู่ระบบใหม่');
      }

      if (response.status === 429) {
        throw new Error('คำขอมากเกินไป กรุณารอสักครู่แล้วลองใหม่');
      }

      throw new Error(errorData.error || 'การวิเคราะห์เอกสารล้มเหลว');
    }

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.error || 'การวิเคราะห์เอกสารล้มเหลว');
    }

    return result.data as AccountingResponse;
  } catch (error: any) {
    console.error("Document Analysis Error:", error);

    // Re-throw with user-friendly message
    if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
      throw new Error('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้ กรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ต');
    }

    throw error;
  }
};

/**
 * Check if the analysis service is available
 */
export const checkServiceHealth = async (): Promise<boolean> => {
  if (!isFirebaseConfigured || !API_BASE_URL) {
    return true; // Demo mode is always "available"
  }

  try {
    const response = await fetch(`${API_BASE_URL}/health`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });
    return response.ok;
  } catch {
    return false;
  }
};

export { API_BASE_URL };
