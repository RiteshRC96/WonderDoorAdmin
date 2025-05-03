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
    query, // Import query
    orderBy, // Import orderBy
    serverTimestamp, // Import serverTimestamp for actions
    updateDoc, // Import updateDoc for actions
    arrayUnion, // Import arrayUnion for actions
    where, // Import where for actions
    type Firestore
} from 'firebase/firestore';
// Import getAnalytics if needed, based on config
// import { getAnalytics } from "firebase/analytics";
import { firebaseConfig, isFirebaseConfigValid } from './config';

let app: FirebaseApp | null = null;
let db: Firestore | null = null;
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
    console.log("Firebase app already exists. Getting existing app.");
    return getApp(); // Return existing app
  }
}

// Initialize Firebase App
app = initializeFirebaseApp();

// Initialize Firestore only if app was initialized successfully
if (app) {
  try {
    console.log("Attempting to initialize Firestore...");
    db = getFirestore(app);
    console.log("Firestore initialized successfully.");
    // Initialize Analytics if measurementId is present and needed
    // if (firebaseConfig.measurementId) {
    //   analytics = getAnalytics(app);
    //   console.log("Firebase Analytics initialized.");
    // }
  } catch (error) {
    console.error("Firestore initialization error:", error);
    db = null; // Ensure db is null if Firestore initialization fails
  }
} else {
    console.warn('Firebase app initialization failed or skipped. Firestore initialization skipped.');
}


// Export app and db. Check if db is null before using it elsewhere.
export { app, db };
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
    query, // Export query
    orderBy, // Export orderBy
    serverTimestamp, // Export serverTimestamp
    updateDoc, // Export updateDoc
    arrayUnion, // Export arrayUnion
    where, // Export where
};
