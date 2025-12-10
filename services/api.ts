import { getAuthToken } from './auth';
import { AccountingResponse } from '../types';

// API base URL - use Cloud Functions in production
const API_BASE_URL = import.meta.env.VITE_API_URL ||
  'https://asia-southeast1-YOUR_PROJECT_ID.cloudfunctions.net/api';

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
}

/**
 * Make authenticated API request
 */
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  try {
    const token = await getAuthToken();

    if (!token) {
      return { success: false, error: 'กรุณาเข้าสู่ระบบ', code: 'AUTH_REQUIRED' };
    }

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        ...options.headers,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data.error || 'เกิดข้อผิดพลาด',
        code: data.code,
      };
    }

    return data;
  } catch (error: any) {
    console.error('API request error:', error);

    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      return { success: false, error: 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้', code: 'NETWORK_ERROR' };
    }

    return { success: false, error: 'เกิดข้อผิดพลาด กรุณาลองใหม่', code: 'UNKNOWN_ERROR' };
  }
}

/**
 * Analyze document using backend API (hides Gemini API key)
 */
export const analyzeDocument = async (
  file: File,
  clientId: string,
  clientName: string
): Promise<AccountingResponse> => {
  // Convert file to base64
  const base64Data = await fileToBase64(file);

  const response = await apiRequest<AccountingResponse>('/api/analyze-document', {
    method: 'POST',
    body: JSON.stringify({
      fileData: base64Data,
      mimeType: file.type,
      clientId,
      clientName,
    }),
  });

  if (!response.success) {
    throw new Error(response.error || 'การวิเคราะห์เอกสารล้มเหลว');
  }

  return response.data!;
};

/**
 * Convert file to base64
 */
const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      // Remove data URL prefix
      const base64Data = base64String.split(',')[1];
      resolve(base64Data);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

/**
 * Get all staff members (admin only)
 */
export const getStaff = async () => {
  return apiRequest<any[]>('/api/admin/users');
};

/**
 * Create new client
 */
export const createClient = async (clientData: any) => {
  return apiRequest<{ id: string }>('/api/clients', {
    method: 'POST',
    body: JSON.stringify(clientData),
  });
};

/**
 * Health check
 */
export const healthCheck = async (): Promise<boolean> => {
  try {
    const response = await fetch(`${API_BASE_URL}/health`);
    return response.ok;
  } catch {
    return false;
  }
};

export { API_BASE_URL };
