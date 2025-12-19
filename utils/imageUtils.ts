/**
 * Image Processing Utilities
 * การ compress และ optimize รูปภาพก่อนอัปโหลด
 */

export interface ImageCompressionOptions {
    maxWidth?: number;
    maxHeight?: number;
    quality?: number; // 0-1
    mimeType?: 'image/jpeg' | 'image/png' | 'image/webp';
    maxSizeKB?: number; // Maximum file size in KB
}

export interface CompressionResult {
    blob: Blob;
    dataUrl: string;
    originalSize: number;
    compressedSize: number;
    compressionRatio: number;
    width: number;
    height: number;
}

const DEFAULT_OPTIONS: ImageCompressionOptions = {
    maxWidth: 1920,
    maxHeight: 1080,
    quality: 0.8,
    mimeType: 'image/jpeg',
    maxSizeKB: 500
};

/**
 * Compress และ resize รูปภาพ
 */
export async function compressImage(
    file: File,
    options: ImageCompressionOptions = {}
): Promise<CompressionResult> {
    const opts = { ...DEFAULT_OPTIONS, ...options };

    return new Promise((resolve, reject) => {
        // Check if file is an image
        if (!file.type.startsWith('image/')) {
            reject(new Error('ไฟล์ที่เลือกไม่ใช่รูปภาพ'));
            return;
        }

        const reader = new FileReader();
        reader.readAsDataURL(file);

        reader.onload = (e) => {
            const img = new Image();
            img.src = e.target?.result as string;

            img.onload = () => {
                // Calculate new dimensions
                let { width, height } = img;
                const maxWidth = opts.maxWidth || 1920;
                const maxHeight = opts.maxHeight || 1080;

                if (width > maxWidth) {
                    height = (height * maxWidth) / width;
                    width = maxWidth;
                }
                if (height > maxHeight) {
                    width = (width * maxHeight) / height;
                    height = maxHeight;
                }

                // Create canvas
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;

                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    reject(new Error('ไม่สามารถสร้าง canvas context ได้'));
                    return;
                }

                // Draw image
                ctx.drawImage(img, 0, 0, width, height);

                // Compress with different quality levels if needed
                let quality = opts.quality || 0.8;
                let dataUrl = canvas.toDataURL(opts.mimeType, quality);
                let blob = dataURLtoBlob(dataUrl);

                // If maxSizeKB is set, try to reduce quality until size is under limit
                const maxSizeBytes = (opts.maxSizeKB || 500) * 1024;
                while (blob.size > maxSizeBytes && quality > 0.1) {
                    quality -= 0.1;
                    dataUrl = canvas.toDataURL(opts.mimeType, quality);
                    blob = dataURLtoBlob(dataUrl);
                }

                const compressionRatio = ((file.size - blob.size) / file.size) * 100;

                resolve({
                    blob,
                    dataUrl,
                    originalSize: file.size,
                    compressedSize: blob.size,
                    compressionRatio,
                    width,
                    height
                });
            };

            img.onerror = () => {
                reject(new Error('ไม่สามารถโหลดรูปภาพได้'));
            };
        };

        reader.onerror = () => {
            reject(new Error('ไม่สามารถอ่านไฟล์ได้'));
        };
    });
}

/**
 * Compress หลายรูปพร้อมกัน
 */
export async function compressImages(
    files: File[],
    options: ImageCompressionOptions = {},
    onProgress?: (completed: number, total: number) => void
): Promise<CompressionResult[]> {
    const results: CompressionResult[] = [];
    const total = files.length;

    for (let i = 0; i < files.length; i++) {
        const result = await compressImage(files[i], options);
        results.push(result);
        onProgress?.(i + 1, total);
    }

    return results;
}

/**
 * แปลง data URL เป็น Blob
 */
function dataURLtoBlob(dataUrl: string): Blob {
    const arr = dataUrl.split(',');
    const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], { type: mime });
}

/**
 * แปลง File เป็น Base64
 */
export async function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error('ไม่สามารถอ่านไฟล์ได้'));
    });
}

/**
 * ตรวจสอบขนาดและประเภทไฟล์
 */
export interface FileValidationOptions {
    maxSizeMB?: number;
    allowedTypes?: string[];
}

export interface FileValidationResult {
    isValid: boolean;
    errors: string[];
}

export function validateFile(
    file: File,
    options: FileValidationOptions = {}
): FileValidationResult {
    const errors: string[] = [];
    const maxSizeMB = options.maxSizeMB || 10; // Default 10MB
    const allowedTypes = options.allowedTypes || [
        'image/jpeg',
        'image/png',
        'image/gif',
        'image/webp',
        'application/pdf'
    ];

    // Check file size
    const sizeMB = file.size / (1024 * 1024);
    if (sizeMB > maxSizeMB) {
        errors.push(`ไฟล์ใหญ่เกิน ${maxSizeMB}MB (ขนาดปัจจุบัน: ${sizeMB.toFixed(2)}MB)`);
    }

    // Check file type
    if (!allowedTypes.includes(file.type)) {
        const allowed = allowedTypes.map(t => t.split('/')[1]).join(', ');
        errors.push(`ประเภทไฟล์ไม่รองรับ (รองรับ: ${allowed})`);
    }

    return {
        isValid: errors.length === 0,
        errors
    };
}

/**
 * Validate และ Compress รูปภาพก่อนอัปโหลด
 */
export async function prepareImageForUpload(
    file: File,
    options: ImageCompressionOptions & FileValidationOptions = {}
): Promise<{
    success: boolean;
    result?: CompressionResult;
    errors?: string[];
}> {
    // Validate first
    const validation = validateFile(file, {
        maxSizeMB: options.maxSizeMB || 10,
        allowedTypes: options.allowedTypes || ['image/jpeg', 'image/png', 'image/webp']
    });

    if (!validation.isValid) {
        return { success: false, errors: validation.errors };
    }

    try {
        const result = await compressImage(file, options);
        return { success: true, result };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'เกิดข้อผิดพลาดในการ compress รูปภาพ';
        return { success: false, errors: [errorMessage] };
    }
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

export default {
    compressImage,
    compressImages,
    fileToBase64,
    validateFile,
    prepareImageForUpload,
    formatFileSize
};
