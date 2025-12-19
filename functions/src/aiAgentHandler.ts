/**
 * AI Agent Handler - Cloud Functions
 * เชื่อมต่อ AI Agents กับ Gemini API จริง
 */

import { Request, Response } from "express";
import { GoogleGenerativeAI } from "@google/generative-ai";
import * as functions from "firebase-functions";

// Get API key from Firebase config
const getApiKey = (): string => {
    const apiKey = functions.config().gemini?.api_key || process.env.GEMINI_API_KEY;
    if (!apiKey) {
        throw new Error("Gemini API key not configured");
    }
    return apiKey;
};

// Agent Types
type AgentType = 'tax' | 'reconciliation' | 'task_assignment' | 'notification' | 'document';

// System Prompts for each Agent
const AGENT_PROMPTS: Record<AgentType, string> = {
    tax: `คุณคือ AI Tax Agent สำหรับสำนักงานบัญชีไทย
คุณมีความเชี่ยวชาญในการ:
1. คำนวณภาษีมูลค่าเพิ่ม (VAT) - ภ.พ.30
2. คำนวณภาษีหัก ณ ที่จ่าย (WHT) - ภ.ง.ด.3, ภ.ง.ด.53
3. วิเคราะห์เอกสารภาษีและให้คำแนะนำ
4. ตรวจสอบความถูกต้องของการคำนวณภาษี

กฎสำคัญ:
- WHT ขนส่ง: 1%, โฆษณา: 2%, บริการทั่วไป: 3%, ค่าเช่า: 5%
- VAT 7% (ยกเว้นสินค้าบางประเภท)
- ตอบเป็น JSON เท่านั้น`,

    reconciliation: `คุณคือ AI Bank Reconciliation Agent
คุณมีความสามารถในการ:
1. จับคู่รายการธนาคารกับรายการบัญชี (GL Entries)
2. ระบุความแตกต่างและสาเหตุที่เป็นไปได้
3. แนะนำการปรับปรุงรายการ
4. ตรวจจับรายการผิดปกติ

วิธีการจับคู่:
- ตรงกัน 100%: จำนวนเงินและวันที่ตรงกัน
- น่าจะตรง: จำนวนเงินตรง วันที่ต่างกันไม่เกิน 3 วัน
- อาจตรง: จำนวนเงินต่างกันเล็กน้อย (ค่าธรรมเนียม)

ตอบเป็น JSON`,

    task_assignment: `คุณคือ AI Task Assignment Agent สำหรับสำนักงานบัญชี
คุณมีความสามารถในการ:
1. วิเคราะห์งานที่ต้องมอบหมาย
2. ประเมินความสามารถของพนักงานแต่ละคน
3. กระจายงานอย่างเหมาะสมตาม Workload
4. พิจารณา Priority และ Deadline

หลักการมอบหมายงาน:
- งาน Urgent: มอบให้คนที่ว่างและมีความสามารถสูง
- งานทั่วไป: กระจายงานให้สม่ำเสมอ
- งานที่ต้องใช้ความเชี่ยวชาญ: มอบให้ผู้เชี่ยวชาญ

ตอบเป็น JSON`,

    notification: `คุณคือ AI Notification Agent สำหรับตรวจสอบ Deadlines
คุณมีความสามารถในการ:
1. ตรวจสอบงานที่ใกล้ถึงกำหนด
2. แจ้งเตือนกำหนดยื่นภาษี
3. ติดตามเอกสารที่รอดำเนินการ
4. สร้าง Reminder อัตโนมัติ

กำหนดยื่นภาษีสำคัญ:
- ภ.พ.30: วันที่ 15 ของเดือนถัดไป
- ภ.ง.ด.3, ภ.ง.ด.53: วันที่ 7 ของเดือนถัดไป
- ประกันสังคม: วันที่ 15 ของเดือนถัดไป

ตอบเป็น JSON`,

    document: `คุณคือ AI Document Agent สำหรับวิเคราะห์เอกสารบัญชี
ดูรายละเอียดใน gemini.ts`,
};

// Request body interface
interface AgentRequest {
    agentType: AgentType;
    input: {
        type: string;
        data: any;
        context: any;
    };
    priority?: 'low' | 'medium' | 'high';
}

/**
 * AI Agent Handler - ประมวลผล Agent Request ผ่าน Gemini API
 */
export const aiAgentHandler = async (req: Request, res: Response) => {
    try {
        const { agentType, input, priority } = req.body as AgentRequest;

        // Validate required fields
        if (!agentType || !input) {
            return res.status(400).json({
                success: false,
                error: "Missing required fields: agentType, input",
            });
        }

        // Validate agent type
        if (!AGENT_PROMPTS[agentType]) {
            return res.status(400).json({
                success: false,
                error: `Invalid agent type: ${agentType}. Valid types: ${Object.keys(AGENT_PROMPTS).join(", ")}`,
            });
        }

        console.log(`AI Agent Request: ${agentType}`, { inputType: input.type, priority });

        // Initialize Gemini
        const genAI = new GoogleGenerativeAI(getApiKey());
        const model = genAI.getGenerativeModel({
            model: "gemini-2.0-flash",
            systemInstruction: AGENT_PROMPTS[agentType],
            generationConfig: {
                temperature: 0.2,
                responseMimeType: "application/json",
            },
        });

        // Build the prompt based on agent type
        let agentPrompt = "";

        switch (agentType) {
            case 'tax':
                agentPrompt = `วิเคราะห์ข้อมูลภาษีต่อไปนี้และคำนวณภาษี:

ประเภทงาน: ${input.type}
Period: ${input.context?.period || 'ไม่ระบุ'}
Client ID: ${input.context?.clientId || 'ไม่ระบุ'}

เอกสารที่ต้องวิเคราะห์:
${JSON.stringify(input.context?.documents?.slice(0, 20) || [], null, 2)}

กรุณาคำนวณ:
1. ภาษีขาย (Output VAT)
2. ภาษีซื้อ (Input VAT)
3. ภาษีมูลค่าเพิ่มสุทธิ (Net VAT)
4. ภาษีหัก ณ ที่จ่าย (WHT)
5. แบบภาษีที่ต้องยื่น

ตอบเป็น JSON format:
{
  "taxType": "VAT_WHT",
  "period": "YYYY-MM",
  "calculations": {
    "outputVat": number,
    "inputVat": number,
    "netVat": number,
    "whtPND3": number,
    "whtPND53": number,
    "totalWht": number
  },
  "suggestedForms": ["PP30", "PND3", ...],
  "warnings": ["..."],
  "confidenceScore": 0-100,
  "aiInsights": "คำอธิบายจาก AI"
}`;
                break;

            case 'reconciliation':
                agentPrompt = `จับคู่รายการธนาคารกับรายการบัญชี:

รายการธนาคาร:
${JSON.stringify(input.context?.bankTransactions?.slice(0, 30) || [], null, 2)}

รายการบัญชี (GL Entries):
${JSON.stringify(input.context?.glEntries?.slice(0, 30) || [], null, 2)}

กรุณาวิเคราะห์และจับคู่รายการ:
1. รายการที่ตรงกัน 100%
2. รายการที่น่าจะตรงกัน
3. รายการที่ยังไม่จับคู่

ตอบเป็น JSON format:
{
  "matched": [{"bankTxId": "...", "glEntryId": "...", "confidence": 0-100, "matchType": "exact|likely|possible"}],
  "unmatchedBank": ["id1", "id2", ...],
  "unmatchedGL": ["id1", "id2", ...],
  "discrepancies": [{"type": "...", "description": "...", "amount": number}],
  "totalMatched": number,
  "matchRate": 0-100,
  "aiInsights": "คำอธิบายจาก AI"
}`;
                break;

            case 'task_assignment':
                agentPrompt = `วิเคราะห์และมอบหมายงาน:

งานที่รอมอบหมาย:
${JSON.stringify(input.context?.unassignedTasks?.slice(0, 20) || [], null, 2)}

พนักงานทั้งหมด:
${JSON.stringify(input.context?.staff?.map((s: any) => ({
                    id: s.id,
                    name: `${s.first_name} ${s.last_name}`,
                    role: s.role,
                    specializations: s.specializations,
                    currentTasks: input.context?.tasks?.filter((t: any) => t.assignedTo === s.id && t.status !== 'completed').length || 0
                })) || [], null, 2)}

กรุณาวิเคราะห์และแนะนำการมอบหมายงาน:
1. พิจารณา Workload ปัจจุบัน
2. พิจารณาความเชี่ยวชาญ
3. พิจารณา Priority และ Deadline

ตอบเป็น JSON format:
{
  "assignments": [{"taskId": "...", "assignToStaffId": "...", "reason": "...", "priority": "high|medium|low"}],
  "workloadAnalysis": [{"staffId": "...", "currentLoad": number, "recommendedLoad": number}],
  "warnings": ["..."],
  "aiInsights": "คำอธิบายจาก AI"
}`;
                break;

            case 'notification':
                agentPrompt = `ตรวจสอบ Deadlines และสร้าง Notifications:

วันที่ปัจจุบัน: ${input.context?.currentDate || new Date().toISOString()}

งานทั้งหมด:
${JSON.stringify(input.context?.tasks?.slice(0, 30) || [], null, 2)}

ลูกค้าทั้งหมด:
${JSON.stringify(input.context?.clients?.map((c: any) => ({ id: c.id, name: c.name, taxDueDate: c.taxDueDate })) || [], null, 2)}

กรุณาวิเคราะห์และสร้างการแจ้งเตือน:
1. งานที่ใกล้ถึงกำหนด (ภายใน 7 วัน)
2. กำหนดยื่นภาษีที่ใกล้ถึง
3. รายการที่ต้องติดตามด่วน

ตอบเป็น JSON format:
{
  "urgentTasks": [{"taskId": "...", "dueIn": "X days", "priority": "high"}],
  "upcomingDeadlines": [{"type": "tax|task|document", "deadline": "YYYY-MM-DD", "description": "..."}],
  "notifications": [{"type": "warning|info|urgent", "title": "...", "message": "...", "targetId": "..."}],
  "summary": {"urgent": number, "warning": number, "info": number},
  "aiInsights": "คำอธิบายจาก AI"
}`;
                break;

            default:
                agentPrompt = `วิเคราะห์ข้อมูลต่อไปนี้: ${JSON.stringify(input)}`;
        }

        // Call Gemini API
        const result = await model.generateContent(agentPrompt);
        const response = result.response;
        const responseText = response.text();

        if (!responseText) {
            throw new Error("No response received from Gemini");
        }

        // Parse JSON response
        let parsedResult;
        try {
            parsedResult = JSON.parse(responseText);
        } catch (parseError) {
            console.error("Failed to parse Gemini response:", responseText);
            parsedResult = { rawResponse: responseText, parseError: true };
        }

        // Add metadata
        const agentResponse = {
            success: true,
            agentType,
            priority: priority || 'medium',
            result: parsedResult,
            processedAt: new Date().toISOString(),
            processedBy: "gemini-2.0-flash",
        };

        console.log(`AI Agent Response: ${agentType}`, { success: true });

        res.json(agentResponse);

    } catch (error: any) {
        console.error("AI Agent error:", error);

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
                error: "AI rate limit exceeded. Please try again later.",
                code: "RATE_LIMIT",
            });
        }

        res.status(500).json({
            success: false,
            error: "Failed to process AI agent request",
            code: "AGENT_ERROR",
            details: process.env.NODE_ENV === "development" ? error.message : undefined,
        });
    }
};
