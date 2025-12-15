import { Request, Response } from "express";
import { GoogleGenerativeAI } from "@google/generative-ai";
import * as functions from "firebase-functions";

// Get API key from Firebase config (set via: firebase functions:config:set gemini.api_key="YOUR_KEY")
const getApiKey = (): string => {
  const apiKey = functions.config().gemini?.api_key || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Gemini API key not configured");
  }
  return apiKey;
};

// System prompt for Thai accounting standards
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

interface AnalyzeDocumentRequest {
  fileData: string; // Base64 encoded
  mimeType: string;
  clientId: string;
  clientName: string;
}

export const analyzeDocumentHandler = async (req: Request, res: Response) => {
  try {
    const { fileData, mimeType, clientId, clientName } = req.body as AnalyzeDocumentRequest;

    // Validate required fields
    if (!fileData || !mimeType) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields: fileData, mimeType",
      });
    }

    // Validate mime type
    const allowedMimeTypes = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
    if (!allowedMimeTypes.includes(mimeType)) {
      return res.status(400).json({
        success: false,
        error: `Invalid mime type. Allowed: ${allowedMimeTypes.join(", ")}`,
      });
    }

    // Initialize Gemini 3 Pro - Google's most advanced reasoning model
    // Launched Nov 2025 - Best reasoning, visual understanding & coding
    const genAI = new GoogleGenerativeAI(getApiKey());
    const model = genAI.getGenerativeModel({
      model: "gemini-3-pro-preview",
      systemInstruction: SYSTEM_PROMPT,
      generationConfig: {
        temperature: 0.1,
        responseMimeType: "application/json",
      },
    });

    // Analyze document
    const result = await model.generateContent([
      {
        inlineData: {
          mimeType,
          data: fileData,
        },
      },
      {
        text: `วิเคราะห์เอกสารบัญชีนี้สำหรับลูกค้า: ${clientName || "ไม่ระบุ"} (ID: ${clientId || "ไม่ระบุ"})

ดึงข้อมูลและสร้าง Journal Entry ตามมาตรฐานการบัญชีไทย (TAS)
ส่งผลลัพธ์เป็น JSON`,
      },
    ]);

    const response = result.response;
    const responseText = response.text();

    if (!responseText) {
      throw new Error("No response received from Gemini");
    }

    const data = JSON.parse(responseText);

    // Add metadata
    data.processed_at = new Date().toISOString();
    data.processed_by = "gemini-3-pro-preview";
    data.client_id = clientId;

    res.json({
      success: true,
      data,
    });
  } catch (error: any) {
    console.error("Gemini analysis error:", error);

    // Handle specific error types
    if (error.message?.includes("API key")) {
      return res.status(500).json({
        success: false,
        error: "Server configuration error",
        code: "API_KEY_ERROR",
      });
    }

    if (error.message?.includes("rate limit")) {
      return res.status(429).json({
        success: false,
        error: "Too many requests. Please try again later.",
        code: "RATE_LIMIT",
      });
    }

    res.status(500).json({
      success: false,
      error: "Failed to analyze document",
      code: "ANALYSIS_ERROR",
      details: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};
