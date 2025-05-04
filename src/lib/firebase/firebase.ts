// src/lib/firebase/firebase.ts
import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import {
    getFirestore,
    collection,
    getDocs,
    doc,
    getDoc,
    addDoc,
    deleteDoc,
    Timestamp,
    query,
    orderBy,
    serverTimestamp,
    updateDoc,
    arrayUnion,
    where,
    limit,
    getCountFromServer,
    writeBatch,
    type Firestore
} from 'firebase/firestore';
// Import Firebase Storage modules
import {
    getStorage,
    ref as storageRef, // Rename ref to avoid conflict with Firestore ref
    uploadString,
    getDownloadURL,
    deleteObject, // Add deleteObject for potential updates/deletes
    type FirebaseStorage
} from "firebase/storage";
// Import getAnalytics if needed, based on config
// import { getAnalytics } from "firebase/analytics";
import { firebaseConfig, isFirebaseConfigValid } from './config';

let app: FirebaseApp | null = null;
let db: Firestore | null = null;
let storage: FirebaseStorage | null = null; // Add storage variable
// let analytics; // Uncomment if you need analytics

function initializeFirebaseApp() {
  if (!isFirebaseConfigValid) {
    console.error('Firebase config is invalid. Firebase initialization skipped.');
    return null;
  }

  if (getApps().length === 0) {
    try {
      console.log("Attempting to initialize Firebase app...");
      const initializedApp = initializeApp(firebaseConfig);
      console.log("Firebase app initialized successfully.");
      return initializedApp;
    } catch (error) {
      console.error("Firebase initialization error:", error);
      return null; // Return null on initialization error
    }
  } else {
    // console.log("Firebase app already exists. Getting existing app."); // Reduce console noise
    return getApp(); // Return existing app
  }
}

// Initialize Firebase App
app = initializeFirebaseApp();

// Initialize Firestore and Storage only if app was initialized successfully
if (app) {
  try {
    // console.log("Attempting to initialize Firestore..."); // Reduce console noise
    db = getFirestore(app);
    // console.log("Firestore initialized successfully."); // Reduce console noise
  } catch (error) {
    console.error("Firestore initialization error:", error);
    db = null; // Ensure db is null if Firestore initialization fails
  }
   try {
       // console.log("Attempting to initialize Firebase Storage..."); // Reduce console noise
       storage = getStorage(app);
       // console.log("Firebase Storage initialized successfully."); // Reduce console noise
   } catch (error) {
       console.error("Firebase Storage initialization error:", error);
       storage = null; // Ensure storage is null if initialization fails
   }

    // Initialize Analytics if measurementId is present and needed
    // if (firebaseConfig.measurementId) {
    //   analytics = getAnalytics(app);
    //   console.log("Firebase Analytics initialized.");
    // }
} else {
    console.warn('Firebase app initialization failed or skipped. Firestore/Storage initialization skipped.');
}


// Export app, db, and storage. Check if null before using them elsewhere.
export { app, db, storage }; // Export storage
// Export commonly used Firestore functions for convenience
// Also export Timestamp type for checking instance type
export {
    collection,
    getDocs,
    doc,
    getDoc,
    addDoc,
    deleteDoc,
    Timestamp,
    query,
    orderBy,
    serverTimestamp,
    updateDoc,
    arrayUnion,
    where,
    limit,
    getCountFromServer,
    writeBatch,
};
// Export commonly used Storage functions
export {
    storageRef,
    uploadString,
    getDownloadURL,
    deleteObject,
};