
import { initializeApp, FirebaseApp } from "firebase/app";
import { getFirestore, Firestore } from "firebase/firestore";

// Configuration for Google Cloud Firestore
// Vite uses import.meta.env with VITE_ prefix
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// Check if config is present and valid-ish
export const isFirebaseConfigured = !!(
  firebaseConfig.apiKey &&
  firebaseConfig.apiKey.length > 0 &&
  firebaseConfig.projectId &&
  firebaseConfig.projectId.length > 0
);

let app: FirebaseApp | undefined;
let db: Firestore | undefined;

if (isFirebaseConfigured) {
  try {
    app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    console.log("✅ Firebase initialized successfully with project:", firebaseConfig.projectId);
  } catch (error) {
    console.error("Firebase initialization error:", error);
  }
} else {
  console.warn("⚠️ Firebase Config is missing. Running in Demo Mode.");
  console.warn("Please add VITE_FIREBASE_* variables to your .env file");
}

export { app, db };
