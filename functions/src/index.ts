import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import express from "express";
import cors from "cors";
import { analyzeDocumentHandler } from "./gemini";
import { verifyAuth, checkRole } from "./middleware";

// Initialize Firebase Admin
admin.initializeApp();

const app = express();

// CORS configuration for production
const corsOptions = {
  origin: [
    "http://localhost:3000",
    "https://we-accounting-ai.web.app",
    "https://we-accounting-ai.firebaseapp.com",
    // Add your Cloud Run URL here
  ],
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
};

app.use(cors(corsOptions));
app.use(express.json({ limit: "10mb" }));

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({ status: "healthy", timestamp: new Date().toISOString() });
});

// Protected API routes
app.post("/api/analyze-document", verifyAuth, analyzeDocumentHandler);

// Admin routes (requires admin role)
app.get("/api/admin/users", verifyAuth, checkRole(["admin", "manager"]), async (req, res) => {
  try {
    const usersSnapshot = await admin.firestore().collection("staff").get();
    const users = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json({ success: true, data: users });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to fetch users" });
  }
});

// Create new client (requires manager role)
app.post("/api/clients", verifyAuth, checkRole(["admin", "manager"]), async (req, res) => {
  try {
    const clientData = req.body;
    const docRef = await admin.firestore().collection("clients").add({
      ...clientData,
      created_at: admin.firestore.FieldValue.serverTimestamp(),
      created_by: (req as any).user.uid,
    });
    res.json({ success: true, id: docRef.id });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to create client" });
  }
});

// Export the Express app as a Cloud Function
export const api = functions
  .region("asia-southeast1")
  .runWith({
    timeoutSeconds: 300,
    memory: "1GB",
  })
  .https.onRequest(app);

// Firestore triggers for audit logging
export const onDocumentCreated = functions
  .region("asia-southeast1")
  .firestore.document("{collection}/{docId}")
  .onCreate(async (snap, context) => {
    const { collection, docId } = context.params;

    // Skip logging for activity_logs collection to prevent infinite loop
    if (collection === "activity_logs") return;

    await admin.firestore().collection("activity_logs").add({
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      action: "CREATE",
      collection,
      document_id: docId,
      data_snapshot: snap.data(),
    });
  });

export const onDocumentUpdated = functions
  .region("asia-southeast1")
  .firestore.document("{collection}/{docId}")
  .onUpdate(async (change, context) => {
    const { collection, docId } = context.params;

    if (collection === "activity_logs") return;

    await admin.firestore().collection("activity_logs").add({
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      action: "UPDATE",
      collection,
      document_id: docId,
      before: change.before.data(),
      after: change.after.data(),
    });
  });

// Scheduled function for daily reports
export const dailyReportGeneration = functions
  .region("asia-southeast1")
  .pubsub.schedule("0 6 * * *") // Run at 6 AM daily
  .timeZone("Asia/Bangkok")
  .onRun(async () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    // Generate daily summary
    const docsSnapshot = await admin.firestore()
      .collection("documents")
      .where("uploaded_at", ">=", yesterday.toISOString().split("T")[0])
      .get();

    console.log(`Daily report: ${docsSnapshot.size} documents processed yesterday`);
    return null;
  });
