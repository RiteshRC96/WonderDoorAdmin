// src/lib/firebase/firebase.ts
import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, getDoc, addDoc, type Firestore } from 'firebase/firestore';
// Import getAnalytics if needed, based on config
// import { getAnalytics } from "firebase/analytics";
import { firebaseConfig, isFirebaseConfigValid } from './config';

let app: FirebaseApp | null = null;
let db: Firestore | null = null;
// let analytics; // Uncomment if you need analytics

// Initialize Firebase only if config is valid
if (isFirebaseConfigValid) {
    if (!getApps().length) {
        try {
            app = initializeApp(firebaseConfig);
             console.log("Firebase initialized successfully.");
        } catch (error) {
            console.error("Firebase initialization error:", error);
            // Handle initialization error appropriately
        }
    } else {
        app = getApp();
         console.log("Firebase app already initialized.");
    }

    // Initialize Firestore only if app was initialized successfully
    if (app) {
        try {
            db = getFirestore(app);
            console.log("Firestore initialized successfully.");
            // Initialize Analytics if measurementId is present and needed
            // if (firebaseConfig.measurementId) {
            //   analytics = getAnalytics(app);
            //   console.log("Firebase Analytics initialized.");
            // }
        } catch (error) {
            console.error("Firestore initialization error:", error);
            db = null; // Ensure db is null if initialization fails
        }
    }
} else {
    console.warn('Firebase config is invalid. Firebase and Firestore initialization skipped.');
}


// Export app and db. Check if db is null before using it elsewhere.
export { app, db };
// Export commonly used Firestore functions for convenience
export { collection, getDocs, doc, getDoc, addDoc };
