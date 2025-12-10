import { Request, Response, NextFunction } from "express";
import * as admin from "firebase-admin";

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      user?: admin.auth.DecodedIdToken & { role?: string };
    }
  }
}

/**
 * Middleware to verify Firebase ID token
 */
export const verifyAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      success: false,
      error: "No authorization token provided",
      code: "AUTH_REQUIRED",
    });
  }

  const idToken = authHeader.split("Bearer ")[1];

  try {
    // Verify the ID token
    const decodedToken = await admin.auth().verifyIdToken(idToken);

    // Get user role from Firestore
    const userDoc = await admin.firestore()
      .collection("staff")
      .where("email", "==", decodedToken.email)
      .limit(1)
      .get();

    if (!userDoc.empty) {
      const userData = userDoc.docs[0].data();
      req.user = {
        ...decodedToken,
        role: userData.role || "accountant",
      };
    } else {
      req.user = {
        ...decodedToken,
        role: "accountant", // Default role
      };
    }

    next();
  } catch (error: any) {
    console.error("Token verification error:", error);

    if (error.code === "auth/id-token-expired") {
      return res.status(401).json({
        success: false,
        error: "Token expired. Please login again.",
        code: "TOKEN_EXPIRED",
      });
    }

    if (error.code === "auth/id-token-revoked") {
      return res.status(401).json({
        success: false,
        error: "Token has been revoked. Please login again.",
        code: "TOKEN_REVOKED",
      });
    }

    return res.status(401).json({
      success: false,
      error: "Invalid authorization token",
      code: "INVALID_TOKEN",
    });
  }
};

/**
 * Middleware to check user role
 */
export const checkRole = (allowedRoles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: "Authentication required",
        code: "AUTH_REQUIRED",
      });
    }

    const userRole = req.user.role || "accountant";

    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({
        success: false,
        error: "Insufficient permissions",
        code: "FORBIDDEN",
        required_roles: allowedRoles,
        current_role: userRole,
      });
    }

    next();
  };
};

/**
 * Middleware to check client access
 * Ensures user can only access data for their assigned clients
 */
export const checkClientAccess = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: "Authentication required",
      code: "AUTH_REQUIRED",
    });
  }

  const clientId = req.params.clientId || req.body.clientId || req.query.clientId;

  if (!clientId) {
    return next(); // No client specified, let the route handler decide
  }

  // Admins and managers can access all clients
  if (["admin", "manager"].includes(req.user.role || "")) {
    return next();
  }

  // Check if user is assigned to this client
  const staffDoc = await admin.firestore()
    .collection("staff")
    .where("email", "==", req.user.email)
    .limit(1)
    .get();

  if (staffDoc.empty) {
    return res.status(403).json({
      success: false,
      error: "User not found in staff database",
      code: "USER_NOT_FOUND",
    });
  }

  const staffData = staffDoc.docs[0].data();
  const assignedClients = staffData.assigned_clients || [];

  if (!assignedClients.includes(clientId)) {
    return res.status(403).json({
      success: false,
      error: "You do not have access to this client",
      code: "CLIENT_ACCESS_DENIED",
    });
  }

  next();
};

/**
 * Rate limiting middleware (simple in-memory implementation)
 * For production, use Redis or Firestore
 */
const requestCounts = new Map<string, { count: number; resetTime: number }>();

export const rateLimit = (maxRequests: number, windowMs: number) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const key = req.user?.uid || req.ip || "anonymous";
    const now = Date.now();

    const record = requestCounts.get(key);

    if (!record || now > record.resetTime) {
      requestCounts.set(key, { count: 1, resetTime: now + windowMs });
      return next();
    }

    if (record.count >= maxRequests) {
      return res.status(429).json({
        success: false,
        error: "Too many requests. Please try again later.",
        code: "RATE_LIMIT",
        retry_after: Math.ceil((record.resetTime - now) / 1000),
      });
    }

    record.count++;
    next();
  };
};
