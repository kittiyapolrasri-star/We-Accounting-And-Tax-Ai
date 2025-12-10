import { GoogleGenerativeAI } from "@google/generative-ai";
import { SYSTEM_PROMPT } from "../constants";
import { AccountingResponse } from "../types";

// Initialize Gemini Client
// The API key must be obtained exclusively from the environment variable process.env.API_KEY.
const genAI = new GoogleGenerativeAI(process.env.API_KEY || "");

/**
 * Converts a File object to a Base64 string.
 */
const fileToGenerativePart = async (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      // Remove the data URL prefix (e.g., "data:image/jpeg;base64,")
      const base64Data = base64String.split(",")[1];
      resolve(base64Data);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

export const analyzeDocument = async (file: File): Promise<AccountingResponse> => {
  try {
    const base64Data = await fileToGenerativePart(file);

    // Use Gemini 1.5 Pro for multimodal analysis
    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-pro",
      systemInstruction: SYSTEM_PROMPT,
      generationConfig: {
        temperature: 0.1, // Low temperature for high precision
        responseMimeType: "application/json",
      }
    });

    const result = await model.generateContent([
      {
        inlineData: {
          mimeType: file.type,
          data: base64Data,
        },
      },
      {
        text: "Analyze this accounting document adhering to Thai Accounting Standards (TAS). Extract data precisely into JSON.",
      },
    ]);

    const response = result.response;
    const responseText = response.text();

    if (!responseText) {
      throw new Error("No response received from Gemini.");
    }

    const data: AccountingResponse = JSON.parse(responseText);
    return data;
  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    throw error;
  }
};
