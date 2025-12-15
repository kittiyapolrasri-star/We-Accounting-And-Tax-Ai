/**
 * Analyze Routes
 * Document analysis with Gemini API
 */

import { Router, Response } from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { AuthRequest } from '../middleware/auth';

const router = Router();

// Gemini API Configuration
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// System prompt for Thai accounting
const SYSTEM_PROMPT = `คุณคือ AI Chief Accountant & Automation Engine สำหรับสำนักงานบัญชีไทย

กฎการวิเคราะห์เอกสาร:

1. ภาษีหัก ณ ที่จ่าย (WHT):
   - ขนส่ง: 1%
   - โฆษณา: 2%
   - บริการทั่วไป/จ้างทำ/ซ่อม: 3%
   - ค่าเช่า: 5%
   - วิชาชีพ: 3%
   - ใช้ ภ.ง.ด.3 สำหรับบุคคลธรรมดา
   - ใช้ ภ.ง.ด.53 สำหรับนิติบุคคล

2. VAT:
   - ตรวจสอบว่าเป็นใบกำกับภาษีเต็มรูปแบบหรือไม่
   - ถ้าเป็นใบกำกับภาษีอย่างย่อ → VAT ไม่สามารถขอคืนได้
   - ค่ารับรอง → VAT ไม่สามารถขอคืนได้

3. รหัสบัญชีมาตรฐาน:
   - 11100: เงินสด
   - 11120: เงินฝากธนาคาร
   - 11300: ลูกหนี้การค้า
   - 11540: ภาษีซื้อ
   - 12400: อุปกรณ์สำนักงาน
   - 21200: เจ้าหนี้การค้า
   - 21400: ภาษีหัก ณ ที่จ่ายค้างจ่าย
   - 21540: ภาษีขาย
   - 41100: รายได้จากการขาย
   - 41200: รายได้จากการบริการ
   - 52000-52900: ค่าใช้จ่ายดำเนินงาน
   - 53000: ภาษีซื้อไม่ขอคืน

ส่งผลลัพธ์เป็น JSON เท่านั้น ตามโครงสร้างที่กำหนด`;

/**
 * POST /api/analyze/document
 * Analyze document with Gemini API
 */
router.post('/document', async (req: AuthRequest, res: Response) => {
    try {
        const { fileData, mimeType, clientId, clientName } = req.body;

        // Validate required fields
        if (!fileData || !mimeType) {
            return res.status(400).json({
                success: false,
                error: 'กรุณาส่ง fileData และ mimeType',
            });
        }

        // Validate mime type
        const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
        if (!allowedMimeTypes.includes(mimeType)) {
            return res.status(400).json({
                success: false,
                error: `ไม่รองรับไฟล์ประเภท ${mimeType}`,
            });
        }

        // Check for API key
        if (!GEMINI_API_KEY) {
            console.error('Gemini API key not configured');
            return res.status(500).json({
                success: false,
                error: 'ระบบ AI ยังไม่ได้ตั้งค่า กรุณาติดต่อผู้ดูแลระบบ',
                code: 'API_KEY_MISSING',
            });
        }

        // Initialize Gemini
        const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({
            model: 'gemini-2.0-flash-exp',
            systemInstruction: SYSTEM_PROMPT,
            generationConfig: {
                temperature: 0.1,
                responseMimeType: 'application/json',
            },
        });

        // Check for multi-page PDF and extract text
        let additionalContext = '';
        let pageInfo = { totalPages: 1, isMultiPage: false };

        if (mimeType === 'application/pdf') {
            try {
                const pdfParse = require('pdf-parse');
                const pdfBuffer = Buffer.from(fileData, 'base64');
                const pdfData = await pdfParse(pdfBuffer);

                pageInfo = {
                    totalPages: pdfData.numpages,
                    isMultiPage: pdfData.numpages > 1,
                };

                if (pdfData.numpages > 1) {
                    console.log(`Processing multi-page PDF: ${pdfData.numpages} pages`);
                    additionalContext = `
เอกสารนี้มี ${pdfData.numpages} หน้า
ข้อความที่ดึงได้จากทุกหน้า:
---
${pdfData.text.substring(0, 8000)}
---
กรุณาวิเคราะห์ข้อมูลจากทุกหน้ารวมกัน รวมยอดเงินจากทุกหน้าถ้าจำเป็น`;
                }
            } catch (pdfError) {
                console.warn('PDF text extraction failed:', pdfError);
            }
        }

        // Build prompt
        const prompt = `วิเคราะห์เอกสารบัญชีนี้สำหรับลูกค้า: ${clientName || 'ไม่ระบุ'} (ID: ${clientId || 'ไม่ระบุ'})
${additionalContext}
ดึงข้อมูลและสร้าง Journal Entry ตามมาตรฐานการบัญชีไทย (TAS)
ส่งผลลัพธ์เป็น JSON`;

        // Analyze document
        const result = await model.generateContent([
            {
                inlineData: {
                    mimeType,
                    data: fileData,
                },
            },
            { text: prompt },
        ]);

        const response = result.response;
        const responseText = response.text();

        if (!responseText) {
            throw new Error('No response from Gemini');
        }

        const data = JSON.parse(responseText);

        // Add metadata
        data.processed_at = new Date().toISOString();
        data.processed_by = 'gemini-2.0-flash-exp';
        data.client_id = clientId;
        data._pageInfo = pageInfo;

        res.json({
            success: true,
            data,
        });
    } catch (error: any) {
        console.error('Analyze document error:', error);

        // Handle specific errors
        if (error.message?.includes('API key')) {
            return res.status(500).json({
                success: false,
                error: 'ระบบ AI ยังไม่ได้ตั้งค่า',
                code: 'API_KEY_ERROR',
            });
        }

        if (error.message?.includes('rate limit')) {
            return res.status(429).json({
                success: false,
                error: 'คำขอมากเกินไป กรุณารอสักครู่',
                code: 'RATE_LIMIT',
            });
        }

        res.status(500).json({
            success: false,
            error: 'วิเคราะห์เอกสารไม่สำเร็จ',
            code: 'ANALYSIS_ERROR',
            ...(process.env.NODE_ENV === 'development' && { details: error.message }),
        });
    }
});

/**
 * GET /api/analyze/health
 * Check if Gemini API is configured
 */
router.get('/health', (req, res) => {
    res.json({
        success: true,
        configured: !!GEMINI_API_KEY,
        model: 'gemini-2.0-flash-exp',
    });
});

export { router as analyzeRouter };
