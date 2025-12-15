/**
 * Input Sanitization Utility
 * Provides XSS protection and input validation for user inputs
 */

// HTML entities to escape for XSS prevention
const HTML_ENTITIES: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '/': '&#x2F;',
    '`': '&#x60;',
    '=': '&#x3D;',
};

/**
 * Escape HTML entities to prevent XSS attacks
 */
export const escapeHtml = (str: string): string => {
    if (typeof str !== 'string') return '';
    return str.replace(/[&<>"'`=/]/g, (char) => HTML_ENTITIES[char] || char);
};

/**
 * Remove HTML tags from string
 */
export const stripHtml = (str: string): string => {
    if (typeof str !== 'string') return '';
    return str.replace(/<[^>]*>/g, '');
};

/**
 * Sanitize string for safe display (escape HTML + trim)
 */
export const sanitizeString = (str: string, maxLength?: number): string => {
    if (typeof str !== 'string') return '';
    let sanitized = escapeHtml(str.trim());
    if (maxLength && sanitized.length > maxLength) {
        sanitized = sanitized.substring(0, maxLength);
    }
    return sanitized;
};

/**
 * Sanitize Thai Tax ID (13 digits only)
 */
export const sanitizeTaxId = (taxId: string): string => {
    if (typeof taxId !== 'string') return '';
    // Remove all non-digit characters
    const cleaned = taxId.replace(/\D/g, '');
    // Thai Tax ID is 13 digits
    return cleaned.substring(0, 13);
};

/**
 * Validate Thai Tax ID format
 */
export const isValidThaiTaxId = (taxId: string): boolean => {
    const cleaned = sanitizeTaxId(taxId);
    if (cleaned.length !== 13) return false;

    // Checksum validation (Thai Tax ID algorithm)
    let sum = 0;
    for (let i = 0; i < 12; i++) {
        sum += parseInt(cleaned[i]) * (13 - i);
    }
    const checkDigit = (11 - (sum % 11)) % 10;
    return checkDigit === parseInt(cleaned[12]);
};

/**
 * Sanitize email address
 */
export const sanitizeEmail = (email: string): string => {
    if (typeof email !== 'string') return '';
    return email.trim().toLowerCase();
};

/**
 * Validate email format
 */
export const isValidEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(sanitizeEmail(email));
};

/**
 * Sanitize phone number (Thai format)
 */
export const sanitizePhoneNumber = (phone: string): string => {
    if (typeof phone !== 'string') return '';
    // Remove all non-digit characters except leading +
    const cleaned = phone.replace(/[^\d+]/g, '');
    // Thai mobile: 10 digits starting with 0, or 12 with +66
    return cleaned.substring(0, 12);
};

/**
 * Sanitize currency amount (Thai Baht)
 */
export const sanitizeAmount = (amount: string | number): number => {
    if (typeof amount === 'number') {
        return isNaN(amount) ? 0 : Math.round(amount * 100) / 100;
    }
    if (typeof amount !== 'string') return 0;

    // Remove Thai number formatting (commas) and non-numeric chars except decimal
    const cleaned = amount.replace(/[^\d.-]/g, '');
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? 0 : Math.round(parsed * 100) / 100;
};

/**
 * Sanitize invoice/document number
 */
export const sanitizeDocNumber = (docNo: string): string => {
    if (typeof docNo !== 'string') return '';
    // Allow alphanumeric, hyphens, slashes, and dots
    return docNo.trim().replace(/[^a-zA-Z0-9\-\/\.]/g, '').substring(0, 50);
};

/**
 * Sanitize date string (YYYY-MM-DD format)
 */
export const sanitizeDate = (dateStr: string): string => {
    if (typeof dateStr !== 'string') return '';

    // Try to parse and validate date
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '';

    // Return ISO date format
    return date.toISOString().split('T')[0];
};

/**
 * Sanitize account code (5 digits)
 */
export const sanitizeAccountCode = (code: string): string => {
    if (typeof code !== 'string') return '';
    return code.replace(/\D/g, '').substring(0, 5);
};

/**
 * Sanitize search query (remove dangerous patterns)
 */
export const sanitizeSearchQuery = (query: string): string => {
    if (typeof query !== 'string') return '';
    // Remove potential regex/SQL injection patterns
    return query
        .trim()
        .replace(/[\\$^*+?.()|[\]{}]/g, '')
        .substring(0, 100);
};

/**
 * Sanitize file name for storage
 */
export const sanitizeFileName = (filename: string): string => {
    if (typeof filename !== 'string') return 'unnamed';

    // Remove path traversal attempts
    let sanitized = filename.replace(/\.\./g, '');

    // Replace dangerous characters
    sanitized = sanitized.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_');

    // Limit length
    if (sanitized.length > 200) {
        const ext = sanitized.split('.').pop() || '';
        const name = sanitized.substring(0, 190 - ext.length);
        sanitized = `${name}.${ext}`;
    }

    return sanitized || 'unnamed';
};

/**
 * Sanitize object - recursively sanitize all string values
 */
export const sanitizeObject = <T extends Record<string, any>>(obj: T): T => {
    if (obj === null || typeof obj !== 'object') return obj;

    const result: Record<string, any> = Array.isArray(obj) ? [] : {};

    for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
            const value = obj[key];
            if (typeof value === 'string') {
                result[key] = sanitizeString(value);
            } else if (typeof value === 'object' && value !== null) {
                result[key] = sanitizeObject(value);
            } else {
                result[key] = value;
            }
        }
    }

    return result as T;
};

/**
 * Validate and sanitize form data before submission
 */
export const validateFormData = <T extends Record<string, any>>(
    data: T,
    rules: {
        [K in keyof T]?: {
            required?: boolean;
            type?: 'string' | 'number' | 'email' | 'phone' | 'taxId' | 'date' | 'amount';
            maxLength?: number;
            minLength?: number;
            min?: number;
            max?: number;
        };
    }
): { isValid: boolean; errors: Record<string, string>; sanitized: T } => {
    const errors: Record<string, string> = {};
    const sanitized: Record<string, any> = { ...data };

    for (const field in rules) {
        const rule = rules[field];
        if (!rule) continue;

        const value = data[field];

        // Required check
        if (rule.required && (value === undefined || value === null || value === '')) {
            errors[field] = `${field} is required`;
            continue;
        }

        // Skip if empty and not required
        if (value === undefined || value === null || value === '') continue;

        // Type-specific validation
        switch (rule.type) {
            case 'email':
                sanitized[field] = sanitizeEmail(value as string);
                if (!isValidEmail(sanitized[field])) {
                    errors[field] = 'Invalid email format';
                }
                break;

            case 'taxId':
                sanitized[field] = sanitizeTaxId(value as string);
                if (!isValidThaiTaxId(sanitized[field])) {
                    errors[field] = 'Invalid Thai Tax ID';
                }
                break;

            case 'phone':
                sanitized[field] = sanitizePhoneNumber(value as string);
                break;

            case 'date':
                sanitized[field] = sanitizeDate(value as string);
                if (!sanitized[field]) {
                    errors[field] = 'Invalid date format';
                }
                break;

            case 'amount':
                sanitized[field] = sanitizeAmount(value);
                break;

            case 'number':
                if (typeof value !== 'number' || isNaN(value)) {
                    errors[field] = 'Must be a number';
                } else {
                    if (rule.min !== undefined && value < rule.min) {
                        errors[field] = `Must be at least ${rule.min}`;
                    }
                    if (rule.max !== undefined && value > rule.max) {
                        errors[field] = `Must be at most ${rule.max}`;
                    }
                }
                break;

            case 'string':
            default:
                sanitized[field] = sanitizeString(value as string, rule.maxLength);
                if (rule.minLength && sanitized[field].length < rule.minLength) {
                    errors[field] = `Must be at least ${rule.minLength} characters`;
                }
                break;
        }
    }

    return {
        isValid: Object.keys(errors).length === 0,
        errors,
        sanitized: sanitized as T,
    };
};

export default {
    escapeHtml,
    stripHtml,
    sanitizeString,
    sanitizeTaxId,
    isValidThaiTaxId,
    sanitizeEmail,
    isValidEmail,
    sanitizePhoneNumber,
    sanitizeAmount,
    sanitizeDocNumber,
    sanitizeDate,
    sanitizeAccountCode,
    sanitizeSearchQuery,
    sanitizeFileName,
    sanitizeObject,
    validateFormData,
};
