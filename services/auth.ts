import {
  getAuth,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User,
  sendPasswordResetEmail,
  updatePassword,
  EmailAuthProvider,
  reauthenticateWithCredential,
} from "firebase/auth";
import { doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { app, db, isFirebaseConfigured } from "./firebase";

// Initialize Firebase Auth
const auth = isFirebaseConfigured ? getAuth(app) : null;

export interface AuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  role: string;
  staffId: string;
  assignedClients: string[];
}

export interface LoginResult {
  success: boolean;
  user?: AuthUser;
  error?: string;
}

/**
 * Sign in with email and password
 */
export const signIn = async (email: string, password: string): Promise<LoginResult> => {
  if (!auth || !db) {
    return { success: false, error: "Firebase not configured" };
  }

  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // Get staff details from Firestore
    const staffQuery = await getDoc(doc(db, "staff", user.uid));

    if (!staffQuery.exists()) {
      // Create staff record if doesn't exist (first login)
      await updateDoc(doc(db, "staff", user.uid), {
        email: user.email,
        last_login: serverTimestamp(),
      });
    }

    const staffData = staffQuery.data() || {};

    const authUser: AuthUser = {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName || staffData.name || email.split("@")[0],
      role: staffData.role || "accountant",
      staffId: user.uid,
      assignedClients: staffData.assigned_clients || [],
    };

    // Update last login
    await updateDoc(doc(db, "staff", user.uid), {
      last_login: serverTimestamp(),
    });

    return { success: true, user: authUser };
  } catch (error: any) {
    console.error("Login error:", error);

    let errorMessage = "เข้าสู่ระบบไม่สำเร็จ";

    switch (error.code) {
      case "auth/user-not-found":
        errorMessage = "ไม่พบบัญชีผู้ใช้นี้";
        break;
      case "auth/wrong-password":
        errorMessage = "รหัสผ่านไม่ถูกต้อง";
        break;
      case "auth/invalid-email":
        errorMessage = "รูปแบบอีเมลไม่ถูกต้อง";
        break;
      case "auth/user-disabled":
        errorMessage = "บัญชีนี้ถูกระงับ";
        break;
      case "auth/too-many-requests":
        errorMessage = "พยายามเข้าสู่ระบบมากเกินไป กรุณารอสักครู่";
        break;
      default:
        errorMessage = error.message || "เกิดข้อผิดพลาด กรุณาลองใหม่";
    }

    return { success: false, error: errorMessage };
  }
};

/**
 * Sign out
 */
export const signOut = async (): Promise<void> => {
  if (auth) {
    await firebaseSignOut(auth);
  }
};

/**
 * Get current user
 */
export const getCurrentUser = (): User | null => {
  return auth?.currentUser || null;
};

/**
 * Subscribe to auth state changes
 */
export const onAuthChange = (callback: (user: User | null) => void): (() => void) => {
  if (!auth) {
    callback(null);
    return () => {};
  }

  return onAuthStateChanged(auth, callback);
};

/**
 * Get auth token for API calls
 */
export const getAuthToken = async (): Promise<string | null> => {
  const user = auth?.currentUser;
  if (!user) return null;

  try {
    return await user.getIdToken();
  } catch (error) {
    console.error("Error getting auth token:", error);
    return null;
  }
};

/**
 * Send password reset email
 */
export const resetPassword = async (email: string): Promise<{ success: boolean; error?: string }> => {
  if (!auth) {
    return { success: false, error: "Firebase not configured" };
  }

  try {
    await sendPasswordResetEmail(auth, email);
    return { success: true };
  } catch (error: any) {
    let errorMessage = "ไม่สามารถส่งอีเมลรีเซ็ตรหัสผ่านได้";

    if (error.code === "auth/user-not-found") {
      errorMessage = "ไม่พบบัญชีผู้ใช้นี้";
    }

    return { success: false, error: errorMessage };
  }
};

/**
 * Change password
 */
export const changePassword = async (
  currentPassword: string,
  newPassword: string
): Promise<{ success: boolean; error?: string }> => {
  if (!auth?.currentUser) {
    return { success: false, error: "ไม่ได้เข้าสู่ระบบ" };
  }

  try {
    // Re-authenticate first
    const credential = EmailAuthProvider.credential(
      auth.currentUser.email!,
      currentPassword
    );
    await reauthenticateWithCredential(auth.currentUser, credential);

    // Update password
    await updatePassword(auth.currentUser, newPassword);

    return { success: true };
  } catch (error: any) {
    let errorMessage = "ไม่สามารถเปลี่ยนรหัสผ่านได้";

    if (error.code === "auth/wrong-password") {
      errorMessage = "รหัสผ่านปัจจุบันไม่ถูกต้อง";
    } else if (error.code === "auth/weak-password") {
      errorMessage = "รหัสผ่านใหม่ไม่ปลอดภัยเพียงพอ (ต้องมีอย่างน้อย 6 ตัวอักษร)";
    }

    return { success: false, error: errorMessage };
  }
};

/**
 * Check if user has specific role
 */
export const hasRole = (user: AuthUser | null, roles: string[]): boolean => {
  if (!user) return false;
  return roles.includes(user.role);
};

/**
 * Check if user can access client
 */
export const canAccessClient = (user: AuthUser | null, clientId: string): boolean => {
  if (!user) return false;
  if (["admin", "manager"].includes(user.role)) return true;
  return user.assignedClients.includes(clientId);
};

export { auth };
