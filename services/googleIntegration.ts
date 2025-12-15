/**
 * Google Integration Service
 * 
 * เชื่อมต่อกับ Google Drive และ Google Sheets
 * สำหรับสำนักงานบัญชี
 */

// Google API Scopes
const SCOPES = {
    DRIVE: 'https://www.googleapis.com/auth/drive',
    DRIVE_FILE: 'https://www.googleapis.com/auth/drive.file',
    SHEETS: 'https://www.googleapis.com/auth/spreadsheets',
    SHEETS_READONLY: 'https://www.googleapis.com/auth/spreadsheets.readonly'
};

// ============================================================================
// TYPES
// ============================================================================

export interface GoogleAuthConfig {
    clientId: string;
    apiKey: string;
    discoveryDocs: string[];
    scopes: string[];
}

export interface DriveFile {
    id: string;
    name: string;
    mimeType: string;
    webViewLink?: string;
    webContentLink?: string;
    iconLink?: string;
    thumbnailLink?: string;
    size?: string;
    modifiedTime?: string;
    createdTime?: string;
    parents?: string[];
    shared?: boolean;
}

export interface DriveFolder {
    id: string;
    name: string;
    path: string;
    files: DriveFile[];
    subfolders: DriveFolder[];
}

export interface SheetData {
    spreadsheetId: string;
    sheetName: string;
    headers: string[];
    rows: any[][];
    lastUpdated: string;
}

export interface LinkedResource {
    id: string;
    type: 'drive_file' | 'drive_folder' | 'sheet';
    googleId: string;
    name: string;
    url: string;
    linkedAt: string;
    linkedBy: string;
    syncEnabled: boolean;
    lastSyncAt?: string;
}

// ============================================================================
// GOOGLE AUTH SERVICE
// ============================================================================

class GoogleAuthService {
    private isInitialized = false;
    private isSignedIn = false;
    private accessToken: string | null = null;

    /**
     * Initialize Google API client
     */
    async initialize(config: GoogleAuthConfig): Promise<boolean> {
        try {
            // In production, load Google API script dynamically
            // For now, we'll use a mock implementation
            console.log('Initializing Google API with config:', config);
            this.isInitialized = true;
            return true;
        } catch (error) {
            console.error('Failed to initialize Google API:', error);
            return false;
        }
    }

    /**
     * Sign in with Google
     */
    async signIn(): Promise<{ success: boolean; email?: string; error?: string }> {
        if (!this.isInitialized) {
            return { success: false, error: 'Google API not initialized' };
        }

        try {
            // Mock OAuth flow - in production, use gapi.auth2
            this.isSignedIn = true;
            this.accessToken = 'mock_access_token';

            return { success: true, email: 'user@example.com' };
        } catch (error) {
            return { success: false, error: String(error) };
        }
    }

    /**
     * Sign out from Google
     */
    async signOut(): Promise<void> {
        this.isSignedIn = false;
        this.accessToken = null;
    }

    /**
     * Check if user is signed in
     */
    isUserSignedIn(): boolean {
        return this.isSignedIn;
    }

    /**
     * Get access token
     */
    getAccessToken(): string | null {
        return this.accessToken;
    }
}

export const googleAuth = new GoogleAuthService();

// ============================================================================
// GOOGLE DRIVE SERVICE
// ============================================================================

class GoogleDriveService {
    private baseUrl = 'https://www.googleapis.com/drive/v3';

    /**
     * List files in a folder
     */
    async listFiles(
        folderId: string = 'root',
        options: {
            pageSize?: number;
            orderBy?: string;
            query?: string;
        } = {}
    ): Promise<DriveFile[]> {
        const token = googleAuth.getAccessToken();
        if (!token) {
            throw new Error('Not authenticated with Google');
        }

        // Mock implementation - in production, use fetch with token
        const mockFiles: DriveFile[] = [
            {
                id: 'file1',
                name: 'Invoice_Jan2024.pdf',
                mimeType: 'application/pdf',
                webViewLink: 'https://drive.google.com/file/d/file1/view',
                size: '1024000',
                modifiedTime: new Date().toISOString()
            },
            {
                id: 'file2',
                name: 'Bank_Statement_Jan.xlsx',
                mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                webViewLink: 'https://drive.google.com/file/d/file2/view',
                size: '512000',
                modifiedTime: new Date().toISOString()
            }
        ];

        return mockFiles;
    }

    /**
     * Create a folder
     */
    async createFolder(
        name: string,
        parentId: string = 'root'
    ): Promise<DriveFolder> {
        const token = googleAuth.getAccessToken();
        if (!token) {
            throw new Error('Not authenticated with Google');
        }

        // Mock implementation
        return {
            id: `folder_${Date.now()}`,
            name,
            path: `/${name}`,
            files: [],
            subfolders: []
        };
    }

    /**
     * Upload a file to Google Drive
     */
    async uploadFile(
        file: File,
        folderId: string = 'root',
        options: { description?: string } = {}
    ): Promise<DriveFile> {
        const token = googleAuth.getAccessToken();
        if (!token) {
            throw new Error('Not authenticated with Google');
        }

        // Mock implementation
        return {
            id: `file_${Date.now()}`,
            name: file.name,
            mimeType: file.type,
            webViewLink: `https://drive.google.com/file/d/file_${Date.now()}/view`,
            size: String(file.size),
            modifiedTime: new Date().toISOString()
        };
    }

    /**
     * Download a file from Google Drive
     */
    async downloadFile(fileId: string): Promise<Blob> {
        const token = googleAuth.getAccessToken();
        if (!token) {
            throw new Error('Not authenticated with Google');
        }

        // Mock implementation
        return new Blob(['mock file content'], { type: 'application/octet-stream' });
    }

    /**
     * Share a file or folder
     */
    async shareFile(
        fileId: string,
        email: string,
        role: 'reader' | 'writer' | 'commenter'
    ): Promise<boolean> {
        const token = googleAuth.getAccessToken();
        if (!token) {
            throw new Error('Not authenticated with Google');
        }

        // Mock implementation
        console.log(`Sharing file ${fileId} with ${email} as ${role}`);
        return true;
    }

    /**
     * Search files
     */
    async searchFiles(query: string): Promise<DriveFile[]> {
        const token = googleAuth.getAccessToken();
        if (!token) {
            throw new Error('Not authenticated with Google');
        }

        // Mock implementation
        return this.listFiles('root', { query });
    }

    /**
     * Create client folder structure for accounting firm
     */
    async createClientFolderStructure(
        clientName: string,
        year: number = new Date().getFullYear()
    ): Promise<DriveFolder> {
        const rootFolder = await this.createFolder(clientName);

        // Create standard accounting folder structure
        const standardFolders = [
            'เอกสารรับ',
            'เอกสารจ่าย',
            'ใบแจ้งหนี้',
            'Bank Statement',
            'ภาษี',
            'รายงานการเงิน',
            'สัญญา',
            'อื่นๆ'
        ];

        for (const folder of standardFolders) {
            await this.createFolder(folder, rootFolder.id);
        }

        return rootFolder;
    }
}

export const googleDrive = new GoogleDriveService();

// ============================================================================
// GOOGLE SHEETS SERVICE
// ============================================================================

class GoogleSheetsService {
    private baseUrl = 'https://sheets.googleapis.com/v4/spreadsheets';

    /**
     * Read data from a sheet
     */
    async readSheet(
        spreadsheetId: string,
        range: string = 'A1:ZZ1000'
    ): Promise<SheetData> {
        const token = googleAuth.getAccessToken();
        if (!token) {
            throw new Error('Not authenticated with Google');
        }

        // Mock implementation
        return {
            spreadsheetId,
            sheetName: 'Sheet1',
            headers: ['Date', 'Description', 'Amount', 'Category'],
            rows: [
                ['2024-01-15', 'Office Supplies', 1500, 'Expense'],
                ['2024-01-16', 'Client Payment', 50000, 'Income'],
                ['2024-01-17', 'Utilities', 3000, 'Expense']
            ],
            lastUpdated: new Date().toISOString()
        };
    }

    /**
     * Write data to a sheet
     */
    async writeSheet(
        spreadsheetId: string,
        range: string,
        values: any[][]
    ): Promise<boolean> {
        const token = googleAuth.getAccessToken();
        if (!token) {
            throw new Error('Not authenticated with Google');
        }

        // Mock implementation
        console.log(`Writing to sheet ${spreadsheetId} at ${range}:`, values);
        return true;
    }

    /**
     * Append rows to a sheet
     */
    async appendRows(
        spreadsheetId: string,
        sheetName: string,
        rows: any[][]
    ): Promise<{ updatedRange: string; updatedRows: number }> {
        const token = googleAuth.getAccessToken();
        if (!token) {
            throw new Error('Not authenticated with Google');
        }

        // Mock implementation
        return {
            updatedRange: `${sheetName}!A${100 + rows.length}:Z${100 + rows.length}`,
            updatedRows: rows.length
        };
    }

    /**
     * Create a new spreadsheet
     */
    async createSpreadsheet(
        title: string,
        sheets: string[] = ['Sheet1']
    ): Promise<{ spreadsheetId: string; spreadsheetUrl: string }> {
        const token = googleAuth.getAccessToken();
        if (!token) {
            throw new Error('Not authenticated with Google');
        }

        // Mock implementation
        const id = `sheet_${Date.now()}`;
        return {
            spreadsheetId: id,
            spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${id}/edit`
        };
    }

    /**
     * Create accounting template spreadsheet for client
     */
    async createAccountingTemplate(
        clientName: string,
        year: number = new Date().getFullYear()
    ): Promise<{ spreadsheetId: string; spreadsheetUrl: string }> {
        const result = await this.createSpreadsheet(`${clientName}_${year}`, [
            'รายรับ-รายจ่าย',
            'ภาษีซื้อ',
            'ภาษีขาย',
            'Bank Reconciliation',
            'Asset Register',
            'Summary'
        ]);

        // Add headers to each sheet
        const headers = {
            'รายรับ-รายจ่าย': ['วันที่', 'เลขที่เอกสาร', 'รายละเอียด', 'รหัสบัญชี', 'เดบิต', 'เครดิต', 'หมายเหตุ'],
            'ภาษีซื้อ': ['วันที่', 'เลขที่ใบกำกับ', 'ผู้ขาย', 'เลขประจำตัวผู้เสียภาษี', 'ยอดก่อนภาษี', 'ภาษีมูลค่าเพิ่ม', 'รวม'],
            'ภาษีขาย': ['วันที่', 'เลขที่ใบกำกับ', 'ผู้ซื้อ', 'เลขประจำตัวผู้เสียภาษี', 'ยอดก่อนภาษี', 'ภาษีมูลค่าเพิ่ม', 'รวม'],
            'Bank Reconciliation': ['วันที่', 'รายละเอียด', 'เข้า', 'ออก', 'ยอดคงเหลือ', 'Ref', 'สถานะ']
        };

        for (const [sheet, headerRow] of Object.entries(headers)) {
            await this.writeSheet(result.spreadsheetId, `${sheet}!A1:G1`, [headerRow]);
        }

        return result;
    }

    /**
     * Import bank statement from Google Sheets
     */
    async importBankStatement(
        spreadsheetId: string,
        sheetName: string = 'Sheet1'
    ): Promise<{
        transactions: Array<{
            date: string;
            description: string;
            amount: number;
            type: 'deposit' | 'withdrawal';
        }>;
    }> {
        const data = await this.readSheet(spreadsheetId, `${sheetName}!A:E`);

        // Transform sheet data to transactions
        const transactions = data.rows.map(row => ({
            date: String(row[0]),
            description: String(row[1]),
            amount: Math.abs(Number(row[2]) || 0),
            type: (Number(row[2]) >= 0 ? 'deposit' : 'withdrawal') as 'deposit' | 'withdrawal'
        }));

        return { transactions };
    }

    /**
     * Export GL entries to Google Sheets
     */
    async exportGLEntries(
        entries: Array<{
            date: string;
            docNo: string;
            description: string;
            accountCode: string;
            accountName: string;
            debit: number;
            credit: number;
        }>,
        spreadsheetId?: string
    ): Promise<{ spreadsheetId: string; spreadsheetUrl: string }> {
        let targetId = spreadsheetId;

        if (!targetId) {
            const result = await this.createSpreadsheet('GL_Export_' + new Date().toISOString().slice(0, 10));
            targetId = result.spreadsheetId;
        }

        const headers = ['Date', 'Doc No', 'Description', 'Account Code', 'Account Name', 'Debit', 'Credit'];
        const rows = entries.map(e => [
            e.date,
            e.docNo,
            e.description,
            e.accountCode,
            e.accountName,
            e.debit || '',
            e.credit || ''
        ]);

        await this.writeSheet(targetId, 'Sheet1!A1:G1', [headers]);
        await this.appendRows(targetId, 'Sheet1', rows);

        return {
            spreadsheetId: targetId,
            spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${targetId}/edit`
        };
    }
}

export const googleSheets = new GoogleSheetsService();

// ============================================================================
// LINKED RESOURCES SERVICE
// ============================================================================

class LinkedResourcesService {
    private linkedResources: Map<string, LinkedResource[]> = new Map();

    /**
     * Link a Google resource to an entity (task, client, document)
     */
    linkResource(
        entityType: 'task' | 'client' | 'document',
        entityId: string,
        resource: Omit<LinkedResource, 'id' | 'linkedAt'>
    ): LinkedResource {
        const linked: LinkedResource = {
            ...resource,
            id: `link_${Date.now()}`,
            linkedAt: new Date().toISOString()
        };

        const key = `${entityType}_${entityId}`;
        const existing = this.linkedResources.get(key) || [];
        existing.push(linked);
        this.linkedResources.set(key, existing);

        return linked;
    }

    /**
     * Get linked resources for an entity
     */
    getLinkedResources(
        entityType: 'task' | 'client' | 'document',
        entityId: string
    ): LinkedResource[] {
        const key = `${entityType}_${entityId}`;
        return this.linkedResources.get(key) || [];
    }

    /**
     * Unlink a resource
     */
    unlinkResource(
        entityType: 'task' | 'client' | 'document',
        entityId: string,
        resourceId: string
    ): boolean {
        const key = `${entityType}_${entityId}`;
        const existing = this.linkedResources.get(key) || [];
        const filtered = existing.filter(r => r.id !== resourceId);
        this.linkedResources.set(key, filtered);
        return filtered.length < existing.length;
    }

    /**
     * Sync all linked resources
     */
    async syncAllResources(
        entityType: 'task' | 'client' | 'document',
        entityId: string
    ): Promise<{ synced: number; failed: number }> {
        const resources = this.getLinkedResources(entityType, entityId);
        let synced = 0;
        let failed = 0;

        for (const resource of resources) {
            if (resource.syncEnabled) {
                try {
                    // Sync logic would go here
                    synced++;
                } catch (e) {
                    failed++;
                }
            }
        }

        return { synced, failed };
    }
}

export const linkedResources = new LinkedResourcesService();

// ============================================================================
// EXPORT ALL
// ============================================================================

export default {
    auth: googleAuth,
    drive: googleDrive,
    sheets: googleSheets,
    linkedResources
};
