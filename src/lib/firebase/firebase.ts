// src/lib/firebase/firebase.ts
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, getDoc, addDoc } from 'firebase/firestore';
import { firebaseConfig, isFirebaseConfigValid } from './config';

// Initialize Firebase
let app;
if (!getApps().length) {
  if (!isFirebaseConfigValid) {
    console.error('Firebase config is invalid. Initialization skipped.');
    // You might want to throw an error or handle this case differently
    // depending on whether Firebase is critical for your app's core functionality.
    app = null; // Or some placeholder if needed
  } else {
    app = initializeApp(firebaseConfig);
  }
} else {
  app = getApp();
}

// Get Firestore instance only if app was initialized successfully
const db = app ? getFirestore(app) : null;

// Export app and db. Check if db is null before using it elsewhere.
export { app, db, collection, getDocs, doc, getDoc, addDoc };
