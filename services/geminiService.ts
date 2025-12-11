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

  return {
    document_type: "ใบกำกับภาษี",
    document_date: now.toISOString().split('T')[0],
    invoice_number: invoiceNo,
    seller: {
      name: "บริษัท ตัวอย่าง จำกัด",
      tax_id: "0105500000001",
      address: "123 ถ.สุขุมวิท กรุงเทพฯ 10110",
      branch: "สำนักงานใหญ่"
    },
    buyer: {
      name: "Demo Client",
      tax_id: "0105500000002",
      address: "456 ถ.รัชดา กรุงเทพฯ 10400",
      branch: "สำนักงานใหญ่"
    },
    financial_details: {
      subtotal: 10000,
      discount: 0,
      amount_before_vat: 10000,
      vat_rate: 7,
      vat_amount: 700,
      grand_total: 10700
    },
    line_items: [
      {
        description: `Demo item from ${filename}`,
        quantity: 1,
        unit_price: 10000,
        amount: 10000
      }
    ],
    accounting_entry: {
      debit_entries: [
        { account_code: "52100", account_name: "ค่าใช้จ่ายดำเนินงาน", amount: 10000 },
        { account_code: "11540", account_name: "ภาษีซื้อ", amount: 700 }
      ],
      credit_entries: [
        { account_code: "21200", account_name: "เจ้าหนี้การค้า", amount: 10700 }
      ]
    },
    tax_compliance: {
      requires_wht: false,
      wht_rate: 0,
      wht_amount: 0,
      wht_form: null,
      vat_claimable: true
    },
    confidence: 0.85,
    status: "needs_review",
    audit_flags: [
      {
        severity: "low",
        code: "DEMO_MODE",
        message: "นี่คือข้อมูลตัวอย่างจาก Demo Mode - กรุณาตั้งค่า Firebase เพื่อใช้งานจริง"
      }
    ]
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
