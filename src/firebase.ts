import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore, getFirestore, setLogLevel } from 'firebase/firestore';
import { getDatabase, ref, set } from 'firebase/database';
import rawConfig from '../firebase-applet-config.json';

const firebaseConfig = {
  apiKey: rawConfig.apiKey || import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: rawConfig.authDomain || import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'pewa-1.firebaseapp.com',
  projectId: rawConfig.projectId || import.meta.env.VITE_FIREBASE_PROJECT_ID || 'pewa-1',
  storageBucket: rawConfig.storageBucket || import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'pewa-1.firebasestorage.app',
  messagingSenderId: rawConfig.messagingSenderId || import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '729820494186',
  appId: rawConfig.appId || import.meta.env.VITE_FIREBASE_APP_ID || '1:729820494186:web:e0af51083c103b9d99cd13',
  measurementId: rawConfig.measurementId || import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || 'G-66NCD7XCL3',
  databaseURL: (rawConfig as any).databaseURL || import.meta.env.VITE_FIREBASE_DATABASE_URL || 'https://pewa-1-default-rtdb.firebaseio.com',
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

try {
  setLogLevel('silent');
} catch (e) {
  // Ignore log level errors if any
}

let firestoreInstance;
try {
  firestoreInstance = initializeFirestore(app, {
    experimentalForceLongPolling: true,
  });
} catch (e) {
  try {
    firestoreInstance = getFirestore(app);
  } catch (err) {
    firestoreInstance = null;
  }
}

export const db = firestoreInstance;
export const auth = getAuth(app);
export const rtdb = getDatabase(app);

// Verify Connection / System Status Write
try {
  set(ref(rtdb, 'system/status'), {
    connected: true,
    database: "pewa-1-default-rtdb",
    time: Date.now()
  }).then(() => {
    console.log('[RTDB] system/status written successfully');
  }).catch((err) => {
    console.warn('[RTDB] Error writing system status:', err);
  });
} catch (err) {
  console.warn('[RTDB] System status exception:', err);
}


