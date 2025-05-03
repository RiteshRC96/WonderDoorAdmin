// src/lib/firebase/config.ts

// Note: Ensure these environment variables are set in your .env.local file
// NEXT_PUBLIC_FIREBASE_API_KEY=...
// NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
// NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
// NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
// NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
// NEXT_PUBLIC_FIREBASE_APP_ID=...

export const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Basic validation to ensure config is loaded
export const isFirebaseConfigValid =
  firebaseConfig.apiKey &&
  firebaseConfig.authDomain &&
  firebaseConfig.projectId &&
  firebaseConfig.storageBucket &&
  firebaseConfig.messagingSenderId &&
  firebaseConfig.appId;

if (typeof window === 'undefined' && !isFirebaseConfigValid) {
  console.warn(`
    *****************************************************************
    * Firebase configuration is missing or incomplete.              *
    * Please ensure all NEXT_PUBLIC_FIREBASE_* environment          *
    * variables are set in your .env.local file.                    *
    * App functionality related to Firebase will not work correctly. *
    *****************************************************************
  `);
} else if (typeof window !== 'undefined' && !isFirebaseConfigValid) {
    // Don't log detailed warnings on the client-side for security.
    console.warn("Firebase configuration is incomplete. Features requiring Firebase may not work.");
}
