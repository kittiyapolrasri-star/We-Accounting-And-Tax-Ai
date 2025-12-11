import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { analyzeDocumentHandler } from "./gemini";
import { verifyAuth, checkRole, checkClientAccess } from "./middleware";

// Initialize Firebase Admin
admin.initializeApp();

const app = express();

// ======================
// SECURITY HEADERS (helmet)
// ======================
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://*.googleapis.com", "https://*.firebaseio.com"],
    },
  },
  crossOriginEmbedderPolicy: false, // Required for some Firebase features
  crossOriginResourcePolicy: { policy: "cross-origin" },
}));

// ======================
// CORS configuration
// ======================
const corsOptions = {
  origin: [
    "http://localhost:3000",
    "http://localhost:5173", // Vite dev server
    "https://we-accounting-ai.web.app",
    "https://we-accounting-ai.firebaseapp.com",
    /\.run\.app$/, // Cloud Run URLs
  ],
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  credentials: true,
  maxAge: 86400, // 24 hours preflight cache
};

app.use(cors(corsOptions));

// ======================
// RATE LIMITING
// ======================
// Global rate limit: 100 requests per minute per IP
const globalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: "Too many requests. Please try again later.",
    code: "RATE_LIMIT",
  },
  keyGenerator: (req) => {
    // Use user ID if authenticated, otherwise IP
    return (req as any).user?.uid || req.ip || "anonymous";
  },
});

// Strict rate limit for document analysis: 20 per minute
const analysisLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: "Too many document analysis requests. Please wait before uploading more documents.",
    code: "ANALYSIS_RATE_LIMIT",
  },
  keyGenerator: (req) => {
    return (req as any).user?.uid || req.ip || "anonymous";
  },
});

// Apply global rate limiter
app.use(globalLimiter);

// ======================
// BODY PARSER
// ======================
app.use(express.json({ limit: "15mb" })); // Increased for base64 images
app.use(express.urlencoded({ extended: true, limit: "15mb" }));

// ======================
// REQUEST LOGGING (for monitoring)
// ======================
app.use((req, res, next) => {
  const start = Date.now();

  res.on("finish", () => {
    const duration = Date.now() - start;
    const logData = {
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration: `${duration}ms`,
      userAgent: req.get("User-Agent")?.substring(0, 100),
      ip: req.ip,
    };

    // Log slow requests (>5s) as warnings
    if (duration > 5000) {
      console.warn("Slow request:", logData);
    } else if (res.statusCode >= 400) {
      console.error("Error request:", logData);
    } else {
      console.log("Request:", logData);
    }
  });

  next();
});

// ======================
// HEALTH CHECK ENDPOINT
// ======================
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
    region: "asia-southeast1",
  });
});

// ======================
// API ROUTES
// ======================

// Document Analysis (protected + extra rate limit)
app.post("/api/analyze-document",
  verifyAuth,
  analysisLimiter,
  analyzeDocumentHandler
);

// Admin routes (requires admin role)
app.get("/api/admin/users",
  verifyAuth,
  checkRole(["admin", "manager"]),
  async (req, res) => {
    try {
      const usersSnapshot = await admin.firestore().collection("staff").get();
      const users = usersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        // Remove sensitive fields
        password: undefined,
      }));
      res.json({ success: true, data: users });
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ success: false, error: "Failed to fetch users" });
    }
  }
);

// Create new client (requires manager role)
app.post("/api/clients",
  verifyAuth,
  checkRole(["admin", "manager"]),
  async (req, res) => {
    try {
      const clientData = req.body;

      // Validate required fields
      if (!clientData.name || !clientData.tax_id) {
        return res.status(400).json({
          success: false,
          error: "Missing required fields: name, tax_id",
        });
      }

      // Check for duplicate tax_id
      const existingClient = await admin.firestore()
        .collection("clients")
        .where("tax_id", "==", clientData.tax_id)
        .limit(1)
        .get();

      if (!existingClient.empty) {
        return res.status(409).json({
          success: false,
          error: "Client with this tax ID already exists",
          code: "DUPLICATE_TAX_ID",
        });
      }

      const docRef = await admin.firestore().collection("clients").add({
        ...clientData,
        status: clientData.status || "Active",
        created_at: admin.firestore.FieldValue.serverTimestamp(),
        created_by: (req as any).user.uid,
      });

      res.json({ success: true, id: docRef.id });
    } catch (error) {
      console.error("Error creating client:", error);
      res.status(500).json({ success: false, error: "Failed to create client" });
    }
  }
);

// Get client by ID (with access control)
app.get("/api/clients/:clientId",
  verifyAuth,
  checkClientAccess,
  async (req, res) => {
    try {
      const { clientId } = req.params;
      const clientDoc = await admin.firestore().collection("clients").doc(clientId).get();

      if (!clientDoc.exists) {
        return res.status(404).json({
          success: false,
          error: "Client not found",
          code: "NOT_FOUND",
        });
      }

      res.json({
        success: true,
        data: { id: clientDoc.id, ...clientDoc.data() },
      });
    } catch (error) {
      console.error("Error fetching client:", error);
      res.status(500).json({ success: false, error: "Failed to fetch client" });
    }
  }
);

// Get documents for a client
app.get("/api/clients/:clientId/documents",
  verifyAuth,
  checkClientAccess,
  async (req, res) => {
    try {
      const { clientId } = req.params;
      const limit = parseInt(req.query.limit as string) || 50;

      const docsSnapshot = await admin.firestore()
        .collection("documents")
        .where("client_id", "==", clientId)
        .orderBy("uploaded_at", "desc")
        .limit(limit)
        .get();

      const documents = docsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));

      res.json({ success: true, data: documents });
    } catch (error) {
      console.error("Error fetching documents:", error);
      res.status(500).json({ success: false, error: "Failed to fetch documents" });
    }
  }
);

// ======================
// 404 Handler
// ======================
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: "Endpoint not found",
    code: "NOT_FOUND",
  });
});

// ======================
// ERROR HANDLER
// ======================
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error("Unhandled error:", err);

  res.status(500).json({
    success: false,
    error: "Internal server error",
    code: "INTERNAL_ERROR",
    // Only show details in development
    details: process.env.NODE_ENV === "development" ? err.message : undefined,
  });
});

// ======================
// EXPORT CLOUD FUNCTION
// ======================
export const api = functions
  .region("asia-southeast1")
  .runWith({
    timeoutSeconds: 300,
    memory: "1GB",
    minInstances: 0, // Scale to zero when idle
    maxInstances: 100,
  })
  .https.onRequest(app);

// ======================
// FIRESTORE TRIGGERS (Audit Logging)
// ======================
export const onDocumentCreated = functions
  .region("asia-southeast1")
  .firestore.document("{collection}/{docId}")
  .onCreate(async (snap, context) => {
    const { collection, docId } = context.params;

    // Skip logging for activity_logs collection to prevent infinite loop
    if (collection === "activity_logs") return;

    try {
      await admin.firestore().collection("activity_logs").add({
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        action: "CREATE",
        collection,
        document_id: docId,
        data_preview: JSON.stringify(snap.data()).substring(0, 500), // Limit size
      });
    } catch (error) {
      console.error("Failed to log document creation:", error);
    }
  });

export const onDocumentUpdated = functions
  .region("asia-southeast1")
  .firestore.document("{collection}/{docId}")
  .onUpdate(async (change, context) => {
    const { collection, docId } = context.params;

    if (collection === "activity_logs") return;

    try {
      await admin.firestore().collection("activity_logs").add({
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        action: "UPDATE",
        collection,
        document_id: docId,
        changes: {
          before: JSON.stringify(change.before.data()).substring(0, 250),
          after: JSON.stringify(change.after.data()).substring(0, 250),
        },
      });
    } catch (error) {
      console.error("Failed to log document update:", error);
    }
  });

export const onDocumentDeleted = functions
  .region("asia-southeast1")
  .firestore.document("{collection}/{docId}")
  .onDelete(async (snap, context) => {
    const { collection, docId } = context.params;

    if (collection === "activity_logs") return;

    try {
      await admin.firestore().collection("activity_logs").add({
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        action: "DELETE",
        collection,
        document_id: docId,
      });
    } catch (error) {
      console.error("Failed to log document deletion:", error);
    }
  });

// ======================
// SCHEDULED FUNCTIONS
// ======================

// Daily report generation at 6 AM Bangkok time
export const dailyReportGeneration = functions
  .region("asia-southeast1")
  .pubsub.schedule("0 6 * * *")
  .timeZone("Asia/Bangkok")
  .onRun(async () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split("T")[0];

    try {
      // Count documents processed yesterday
      const docsSnapshot = await admin.firestore()
        .collection("documents")
        .where("uploaded_at", ">=", yesterdayStr)
        .where("uploaded_at", "<", new Date().toISOString().split("T")[0])
        .get();

      // Count approved vs pending
      let approved = 0;
      let pending = 0;
      docsSnapshot.docs.forEach(doc => {
        const status = doc.data().status;
        if (status === "approved") approved++;
        else if (status === "pending_review") pending++;
      });

      console.log(`Daily Report (${yesterdayStr}):`, {
        total_documents: docsSnapshot.size,
        approved,
        pending,
      });

      // Store report in Firestore
      await admin.firestore().collection("daily_reports").add({
        date: yesterdayStr,
        total_documents: docsSnapshot.size,
        approved,
        pending,
        generated_at: admin.firestore.FieldValue.serverTimestamp(),
      });

    } catch (error) {
      console.error("Daily report generation failed:", error);
    }

    return null;
  });

// Weekly cleanup: Archive old activity logs (older than 90 days)
export const weeklyLogCleanup = functions
  .region("asia-southeast1")
  .pubsub.schedule("0 2 * * 0") // Sunday 2 AM
  .timeZone("Asia/Bangkok")
  .onRun(async () => {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 90);

    try {
      const oldLogs = await admin.firestore()
        .collection("activity_logs")
        .where("timestamp", "<", cutoffDate)
        .limit(500) // Process in batches
        .get();

      if (oldLogs.empty) {
        console.log("No old logs to archive");
        return null;
      }

      // Archive to a separate collection before deletion
      const batch = admin.firestore().batch();

      oldLogs.docs.forEach(doc => {
        // Move to archive
        const archiveRef = admin.firestore().collection("activity_logs_archive").doc(doc.id);
        batch.set(archiveRef, doc.data());
        // Delete original
        batch.delete(doc.ref);
      });

      await batch.commit();
      console.log(`Archived ${oldLogs.size} old activity logs`);

    } catch (error) {
      console.error("Log cleanup failed:", error);
    }

    return null;
  });
