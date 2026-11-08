import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyA5b9ysP5p7ZFNkrihIK4rKkD1QnL78VNo',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'antigravity-init-512109.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'antigravity-init-512109',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'antigravity-init-512109.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '650842563404',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:650842563404:web:b5a077c40ef49ac53365e9',
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || 'G-4G0NR4C7MK',
};

// Initialize Firebase App safely (singleton)
export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
