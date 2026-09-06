import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = !getApps().length
  ? initializeApp({
      projectId: firebaseConfig.projectId,
    })
  : getApps()[0];

export const adminAuth = getAuth(app);

// Initialize Firestore Admin instance with specific databaseId if available
let firestoreInstance: any = null;
try {
  firestoreInstance = getFirestore(app, firebaseConfig.firestoreDatabaseId || '(default)');
} catch (err) {
  try {
    firestoreInstance = getFirestore(app);
  } catch (err2) {
    console.warn('Firebase Admin Firestore fallback notice:', err2);
  }
}

export const adminDb = firestoreInstance;
