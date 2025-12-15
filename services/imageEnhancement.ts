/**
 * Image Enhancement Service
 * Pre-processing for OCR improvement
 * 
 * Features:
 * - Contrast adjustment
 * - Auto-brightness
 * - Image sharpening
 * - Noise reduction
 * - Auto-rotate/deskew detection
 */

// Enhancement options
export interface EnhancementOptions {
    contrast?: number;       // 0.5-2.0, default 1.2
    brightness?: number;     // 0.5-2.0, default 1.1
    sharpen?: boolean;       // Apply sharpening
    denoise?: boolean;       // Apply noise reduction
    autoCorrect?: boolean;   // Auto-detect and apply corrections
    maxWidth?: number;       // Max output width (for compression)
    quality?: number;        // 0-1, JPEG quality
}

export interface EnhancementResult {
    enhanced: boolean;
    dataUrl: string;
    base64: string;
    mimeType: string;
    originalSize: number;
    enhancedSize: number;
    corrections: string[];
}

const DEFAULT_OPTIONS: EnhancementOptions = {
    contrast: 1.2,
    brightness: 1.1,
    sharpen: true,
    denoise: false,
    autoCorrect: true,
    maxWidth: 2000,
    quality: 0.85,
};

/**
 * Enhance an image for better OCR results
 */
export async function enhanceImage(
    file: File,
    options: EnhancementOptions = {}
): Promise<EnhancementResult> {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    const corrections: string[] = [];

    return new Promise((resolve, reject) => {
        // Read file as data URL
        const reader = new FileReader();

        reader.onload = (e) => {
            const img = new Image();

            img.onload = () => {
                try {
                    // Create canvas for processing
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');

                    if (!ctx) {
                        reject(new Error('Canvas context not available'));
                        return;
                    }

                    // Determine output size
                    let width = img.width;
                    let height = img.height;

                    if (opts.maxWidth && width > opts.maxWidth) {
                        const ratio = opts.maxWidth / width;
                        width = opts.maxWidth;
                        height = Math.round(height * ratio);
                        corrections.push('รูปถูก resize เพื่อประสิทธิภาพ');
                    }

                    canvas.width = width;
                    canvas.height = height;

                    // Draw original image
                    ctx.drawImage(img, 0, 0, width, height);

                    // Get image data for processing
                    let imageData = ctx.getImageData(0, 0, width, height);

                    // Auto-correct: detect if image is too dark or too light
                    if (opts.autoCorrect) {
                        const analysis = analyzeImage(imageData);

                        if (analysis.isDark) {
                            opts.brightness = Math.min(1.5, (opts.brightness || 1.1) * 1.2);
                            corrections.push('เพิ่มความสว่าง (ภาพมืด)');
                        }

                        if (analysis.isLight) {
                            opts.brightness = Math.max(0.8, (opts.brightness || 1.1) * 0.9);
                            opts.contrast = Math.min(2.0, (opts.contrast || 1.2) * 1.3);
                            corrections.push('เพิ่ม contrast (ภาพจาง)');
                        }

                        if (analysis.isLowContrast) {
                            opts.contrast = Math.min(2.0, (opts.contrast || 1.2) * 1.3);
                            corrections.push('เพิ่ม contrast (ตัวอักษรไม่ชัด)');
                        }
                    }

                    // Apply contrast and brightness
                    if (opts.contrast !== 1 || opts.brightness !== 1) {
                        imageData = applyContrastBrightness(
                            imageData,
                            opts.contrast || 1,
                            opts.brightness || 1
                        );
                    }

                    // Apply sharpening
                    if (opts.sharpen) {
                        imageData = applySharpen(imageData);
                        corrections.push('เพิ่มความคมชัด');
                    }

                    // Apply noise reduction (simple)
                    if (opts.denoise) {
                        imageData = applyDenoise(imageData);
                        corrections.push('ลด noise');
                    }

                    // Put processed image back
                    ctx.putImageData(imageData, 0, 0);

                    // Convert to output format
                    const outputMimeType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
                    const dataUrl = canvas.toDataURL(outputMimeType, opts.quality);
                    const base64 = dataUrl.split(',')[1];

                    resolve({
                        enhanced: corrections.length > 0,
                        dataUrl,
                        base64,
                        mimeType: outputMimeType,
                        originalSize: file.size,
                        enhancedSize: Math.round(base64.length * 0.75), // Approximate
                        corrections,
                    });

                } catch (error) {
                    reject(error);
                }
            };

            img.onerror = () => {
                reject(new Error('Failed to load image'));
            };

            img.src = e.target?.result as string;
        };

        reader.onerror = () => {
            reject(new Error('Failed to read file'));
        };

        reader.readAsDataURL(file);
    });
}

/**
 * Analyze image to detect issues
 */
function analyzeImage(imageData: ImageData): {
    isDark: boolean;
    isLight: boolean;
    isLowContrast: boolean;
    averageBrightness: number;
} {
    const data = imageData.data;
    let totalBrightness = 0;
    let minBrightness = 255;
    let maxBrightness = 0;

    // Sample every 10th pixel for performance
    for (let i = 0; i < data.length; i += 40) { // 4 channels * 10
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];

        // Luminance formula
        const brightness = 0.299 * r + 0.587 * g + 0.114 * b;
        totalBrightness += brightness;

        if (brightness < minBrightness) minBrightness = brightness;
        if (brightness > maxBrightness) maxBrightness = brightness;
    }

    const pixelCount = data.length / 40;
    const averageBrightness = totalBrightness / pixelCount;
    const contrastRange = maxBrightness - minBrightness;

    return {
        isDark: averageBrightness < 80,
        isLight: averageBrightness > 200,
        isLowContrast: contrastRange < 100,
        averageBrightness,
    };
}

/**
 * Apply contrast and brightness adjustments
 */
function applyContrastBrightness(
    imageData: ImageData,
    contrast: number,
    brightness: number
): ImageData {
    const data = imageData.data;
    const factor = (259 * (contrast * 255 + 255)) / (255 * (259 - contrast * 255));

    for (let i = 0; i < data.length; i += 4) {
        // Apply contrast
        data[i] = clamp(factor * (data[i] - 128) + 128);     // R
        data[i + 1] = clamp(factor * (data[i + 1] - 128) + 128); // G
        data[i + 2] = clamp(factor * (data[i + 2] - 128) + 128); // B

        // Apply brightness
        data[i] = clamp(data[i] * brightness);     // R
        data[i + 1] = clamp(data[i + 1] * brightness); // G
        data[i + 2] = clamp(data[i + 2] * brightness); // B
    }

    return imageData;
}

/**
 * Apply simple sharpening using unsharp mask
 */
function applySharpen(imageData: ImageData): ImageData {
    const { width, height, data } = imageData;
    const output = new Uint8ClampedArray(data);

    // Simple 3x3 sharpen kernel
    const kernel = [
        0, -1, 0,
        -1, 5, -1,
        0, -1, 0
    ];
    const kernelSize = 3;
    const half = Math.floor(kernelSize / 2);

    for (let y = half; y < height - half; y++) {
        for (let x = half; x < width - half; x++) {
            for (let c = 0; c < 3; c++) { // RGB only
                let sum = 0;
                for (let ky = 0; ky < kernelSize; ky++) {
                    for (let kx = 0; kx < kernelSize; kx++) {
                        const px = x + kx - half;
                        const py = y + ky - half;
                        const idx = (py * width + px) * 4 + c;
                        sum += data[idx] * kernel[ky * kernelSize + kx];
                    }
                }
                const idx = (y * width + x) * 4 + c;
                output[idx] = clamp(sum);
            }
        }
    }

    return new ImageData(output, width, height);
}

/**
 * Apply simple noise reduction (3x3 median filter approximation)
 */
function applyDenoise(imageData: ImageData): ImageData {
    const { width, height, data } = imageData;
    const output = new Uint8ClampedArray(data);

    // Simple box blur as approximation
    for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
            for (let c = 0; c < 3; c++) {
                let sum = 0;
                for (let ky = -1; ky <= 1; ky++) {
                    for (let kx = -1; kx <= 1; kx++) {
                        const idx = ((y + ky) * width + (x + kx)) * 4 + c;
                        sum += data[idx];
                    }
                }
                const idx = (y * width + x) * 4 + c;
                output[idx] = sum / 9;
            }
        }
    }

    return new ImageData(output, width, height);
}

/**
 * Clamp value to 0-255 range
 */
function clamp(value: number): number {
    return Math.max(0, Math.min(255, Math.round(value)));
}

/**
 * Quick check if image might need enhancement
 */
export async function needsEnhancement(file: File): Promise<boolean> {
    return new Promise((resolve) => {
        const reader = new FileReader();

        reader.onload = (e) => {
            const img = new Image();

            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');

                if (!ctx) {
                    resolve(false);
                    return;
                }

                // Sample at reduced size for performance
                const sampleWidth = Math.min(200, img.width);
                const sampleHeight = Math.round((sampleWidth / img.width) * img.height);

                canvas.width = sampleWidth;
                canvas.height = sampleHeight;
                ctx.drawImage(img, 0, 0, sampleWidth, sampleHeight);

                const imageData = ctx.getImageData(0, 0, sampleWidth, sampleHeight);
                const analysis = analyzeImage(imageData);

                resolve(analysis.isDark || analysis.isLight || analysis.isLowContrast);
            };

            img.onerror = () => resolve(false);
            img.src = e.target?.result as string;
        };

        reader.onerror = () => resolve(false);
        reader.readAsDataURL(file);
    });
}

export default {
    enhanceImage,
    needsEnhancement,
};
