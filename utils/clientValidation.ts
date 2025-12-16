/**
 * Client Form Validation
 * Validation rules และ utilities สำหรับข้อมูลลูกค้า
 */

export interface ValidationError {
    field: string;
    message: string;
}

export interface ValidationResult {
    isValid: boolean;
    errors: ValidationError[];
}

// ============================================================================
// TAX ID VALIDATION (Thailand)
// ============================================================================

/**
 * Validate Thai Tax ID (เลขประจำตัวผู้เสียภาษี)
 * - Corporate: 13 digits starting with 0
 * - Individual: 13 digits (national ID)
 */
export function validateTaxId(taxId: string): { isValid: boolean; error?: string } {
    if (!taxId) {
        return { isValid: false, error: 'กรุณากรอกเลขประจำตัวผู้เสียภาษี' };
    }

    // Remove any spaces or dashes
    const cleanTaxId = taxId.replace(/[\s-]/g, '');

    // Check length
    if (cleanTaxId.length !== 13) {
        return { isValid: false, error: 'เลขประจำตัวผู้เสียภาษีต้องมี 13 หลัก' };
    }

    // Check if all digits
    if (!/^\d{13}$/.test(cleanTaxId)) {
        return { isValid: false, error: 'เลขประจำตัวผู้เสียภาษีต้องเป็นตัวเลขเท่านั้น' };
    }

    // Validate checksum (Thai Tax ID checksum algorithm)
    const digits = cleanTaxId.split('').map(Number);
    const weights = [13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1];

    let sum = 0;
    for (let i = 0; i < 12; i++) {
        sum += digits[i] * weights[i];
    }

    const checkDigit = (11 - (sum % 11)) % 10;

    if (digits[12] !== checkDigit) {
        return { isValid: false, error: 'เลขประจำตัวผู้เสียภาษีไม่ถูกต้อง (checksum ไม่ตรง)' };
    }

    return { isValid: true };
}

/**
 * Format Tax ID with dashes for display
 */
export function formatTaxId(taxId: string): string {
    const clean = taxId.replace(/[\s-]/g, '');
    if (clean.length !== 13) return taxId;

    // Format: X-XXXX-XXXXX-XX-X
    return `${clean[0]}-${clean.slice(1, 5)}-${clean.slice(5, 10)}-${clean.slice(10, 12)}-${clean[12]}`;
}

// ============================================================================
// PHONE VALIDATION
// ============================================================================

/**
 * Validate Thai phone number
 */
export function validatePhone(phone: string): { isValid: boolean; error?: string } {
    if (!phone) {
        return { isValid: true }; // Phone is optional
    }

    const cleanPhone = phone.replace(/[\s-]/g, '');

    // Check for valid Thai phone formats
    const mobilePattern = /^0[689]\d{8}$/;
    const landlinePattern = /^0[2-7]\d{7,8}$/;

    if (!mobilePattern.test(cleanPhone) && !landlinePattern.test(cleanPhone)) {
        return { isValid: false, error: 'รูปแบบเบอร์โทรศัพท์ไม่ถูกต้อง' };
    }

    return { isValid: true };
}

/**
 * Format phone number for display
 */
export function formatPhone(phone: string): string {
    const clean = phone.replace(/[\s-]/g, '');

    if (clean.length === 10 && /^0[689]/.test(clean)) {
        return `${clean.slice(0, 3)}-${clean.slice(3, 6)}-${clean.slice(6)}`;
    }

    if (clean.length === 9) {
        return `${clean.slice(0, 2)}-${clean.slice(2, 5)}-${clean.slice(5)}`;
    }

    return phone;
}

// ============================================================================
// EMAIL VALIDATION
// ============================================================================

/**
 * Validate email address
 */
export function validateEmail(email: string): { isValid: boolean; error?: string } {
    if (!email) {
        return { isValid: true }; // Email is optional
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailPattern.test(email)) {
        return { isValid: false, error: 'รูปแบบอีเมลไม่ถูกต้อง' };
    }

    return { isValid: true };
}

// ============================================================================
// CLIENT DATA VALIDATION
// ============================================================================

export interface ClientFormData {
    name: string;
    tax_id: string;
    industry?: string;
    contact_person?: string;
    phone?: string;
    email?: string;
    address?: string;
    branch?: string;
}

/**
 * Validate client form data
 */
export function validateClientForm(data: ClientFormData): ValidationResult {
    const errors: ValidationError[] = [];

    // Required: Name
    if (!data.name || data.name.trim().length < 2) {
        errors.push({ field: 'name', message: 'ชื่อบริษัทต้องมีอย่างน้อย 2 ตัวอักษร' });
    }

    if (data.name && data.name.length > 200) {
        errors.push({ field: 'name', message: 'ชื่อบริษัทยาวเกินไป (สูงสุด 200 ตัวอักษร)' });
    }

    // Required: Tax ID
    const taxIdResult = validateTaxId(data.tax_id);
    if (!taxIdResult.isValid) {
        errors.push({ field: 'tax_id', message: taxIdResult.error || 'เลขประจำตัวผู้เสียภาษีไม่ถูกต้อง' });
    }

    // Optional: Phone
    if (data.phone) {
        const phoneResult = validatePhone(data.phone);
        if (!phoneResult.isValid) {
            errors.push({ field: 'phone', message: phoneResult.error || 'เบอร์โทรศัพท์ไม่ถูกต้อง' });
        }
    }

    // Optional: Email
    if (data.email) {
        const emailResult = validateEmail(data.email);
        if (!emailResult.isValid) {
            errors.push({ field: 'email', message: emailResult.error || 'อีเมลไม่ถูกต้อง' });
        }
    }

    // Optional: Contact person
    if (data.contact_person && data.contact_person.length > 100) {
        errors.push({ field: 'contact_person', message: 'ชื่อผู้ติดต่อยาวเกินไป (สูงสุด 100 ตัวอักษร)' });
    }

    // Optional: Address
    if (data.address && data.address.length > 500) {
        errors.push({ field: 'address', message: 'ที่อยู่ยาวเกินไป (สูงสุด 500 ตัวอักษร)' });
    }

    return {
        isValid: errors.length === 0,
        errors
    };
}

export default {
    validateTaxId,
    formatTaxId,
    validatePhone,
    formatPhone,
    validateEmail,
    validateClientForm
};
