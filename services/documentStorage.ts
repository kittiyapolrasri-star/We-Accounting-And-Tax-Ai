/**
 * Document Storage Service
 * Handles file uploads to Firebase Storage with proper folder structure per client
 */

import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject, listAll } from 'firebase/storage';
import { app, isFirebaseConfigured } from './firebase';

// Initialize Storage
const storage = isFirebaseConfigured && app ? getStorage(app) : null;

/**
 * Storage path structure:
 * /clients/{clientId}/documents/{year}/{month}/{filename}
 * 
 * Examples:
 * /clients/C001/documents/2024/12/INV-2024-001.pdf
 * /clients/C001/documents/2024/12/receipt-123.jpg
 */

export interface UploadResult {
    success: boolean;
    fileUrl?: string;
    storagePath?: string;
    error?: string;
}

export interface FileMetadata {
    clientId: string;
    docType: string;
    originalFilename: string;
    uploadedAt: string;
    uploadedBy: string;
    size: number;
    mimeType: string;
}

/**
 * Generate storage path for a document
 */
export const generateStoragePath = (
    clientId: string,
    filename: string,
    docType: string = 'general'
): string => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');

    // Sanitize filename
    const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');

    // Add timestamp to prevent overwrites
    const timestamp = Date.now();
    const [name, ext] = safeFilename.split(/\.(?=[^.]+$)/);
    const uniqueFilename = `${name}_${timestamp}${ext ? '.' + ext : ''}`;

    return `clients/${clientId}/documents/${year}/${month}/${docType}/${uniqueFilename}`;
};

/**
 * Upload a file to Firebase Storage
 */
export const uploadDocument = async (
    file: File,
    clientId: string,
    docType: string = 'invoice',
    uploadedBy: string = 'system'
): Promise<UploadResult> => {
    // Demo mode - return mock result
    if (!storage) {
        console.warn('Firebase Storage not configured. Running in demo mode.');
        return {
            success: true,
            fileUrl: `https://demo-storage.local/clients/${clientId}/documents/${file.name}`,
            storagePath: `clients/${clientId}/documents/demo/${file.name}`,
        };
    }

    try {
        // Generate storage path
        const storagePath = generateStoragePath(clientId, file.name, docType);

        // Create storage reference
        const storageRef = ref(storage, storagePath);

        // Upload file with metadata
        const metadata = {
            contentType: file.type,
            customMetadata: {
                clientId,
                docType,
                originalFilename: file.name,
                uploadedAt: new Date().toISOString(),
                uploadedBy,
                size: String(file.size),
            },
        };

        // Upload the file
        const snapshot = await uploadBytes(storageRef, file, metadata);

        // Get download URL
        const fileUrl = await getDownloadURL(snapshot.ref);

        console.log(`✅ File uploaded: ${storagePath}`);

        return {
            success: true,
            fileUrl,
            storagePath,
        };
    } catch (error: any) {
        console.error('File upload error:', error);
        return {
            success: false,
            error: error.message || 'Failed to upload file',
        };
    }
};

/**
 * Upload file and get Base64 for AI processing (combined flow)
 */
export const uploadAndProcessDocument = async (
    file: File,
    clientId: string,
    docType: string = 'invoice',
    uploadedBy: string = 'system'
): Promise<{ uploadResult: UploadResult; base64Data: string }> => {
    // Upload to storage first
    const uploadResult = await uploadDocument(file, clientId, docType, uploadedBy);

    // Convert to base64 for Gemini
    const base64Data = await fileToBase64(file);

    return { uploadResult, base64Data };
};

/**
 * Convert file to Base64 string
 */
const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            const base64String = reader.result as string;
            const base64Data = base64String.split(',')[1];
            resolve(base64Data);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
};

/**
 * Delete a file from storage
 */
export const deleteDocument = async (storagePath: string): Promise<boolean> => {
    if (!storage) {
        console.warn('Firebase Storage not configured.');
        return false;
    }

    try {
        const storageRef = ref(storage, storagePath);
        await deleteObject(storageRef);
        console.log(`✅ File deleted: ${storagePath}`);
        return true;
    } catch (error: any) {
        console.error('File delete error:', error);
        return false;
    }
};

/**
 * List all documents for a client
 */
export const listClientDocuments = async (
    clientId: string,
    year?: number,
    month?: string
): Promise<{ path: string; url: string }[]> => {
    if (!storage) {
        console.warn('Firebase Storage not configured.');
        return [];
    }

    try {
        let path = `clients/${clientId}/documents`;
        if (year) path += `/${year}`;
        if (month) path += `/${month}`;

        const listRef = ref(storage, path);
        const result = await listAll(listRef);

        const files: { path: string; url: string }[] = [];

        for (const itemRef of result.items) {
            const url = await getDownloadURL(itemRef);
            files.push({
                path: itemRef.fullPath,
                url,
            });
        }

        // Recursively list subdirectories
        for (const prefixRef of result.prefixes) {
            const subResult = await listAll(prefixRef);
            for (const itemRef of subResult.items) {
                const url = await getDownloadURL(itemRef);
                files.push({
                    path: itemRef.fullPath,
                    url,
                });
            }
        }

        return files;
    } catch (error: any) {
        console.error('List documents error:', error);
        return [];
    }
};

/**
 * Get the folder structure for organizing documents
 */
export const getDocumentFolderStructure = (clientId: string) => {
    const now = new Date();
    return {
        invoices: `clients/${clientId}/documents/${now.getFullYear()}/invoices`,
        receipts: `clients/${clientId}/documents/${now.getFullYear()}/receipts`,
        bankStatements: `clients/${clientId}/documents/${now.getFullYear()}/bank-statements`,
        contracts: `clients/${clientId}/documents/${now.getFullYear()}/contracts`,
        taxForms: `clients/${clientId}/documents/${now.getFullYear()}/tax-forms`,
        whtCertificates: `clients/${clientId}/documents/${now.getFullYear()}/wht-certificates`,
        payslips: `clients/${clientId}/documents/${now.getFullYear()}/payslips`,
        other: `clients/${clientId}/documents/${now.getFullYear()}/other`,
    };
};

export default {
    uploadDocument,
    uploadAndProcessDocument,
    deleteDocument,
    listClientDocuments,
    generateStoragePath,
    getDocumentFolderStructure,
};
