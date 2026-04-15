import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

// Sign in anonymously on load if not already signed in
onAuthStateChanged(auth, (user) => {
  if (!user) {
    signInAnonymously(auth).catch((error) => {
      console.error("Error signing in anonymously:", error);
      if (error.code === 'auth/network-request-failed') {
        console.warn("Network request failed. This often happens if third-party cookies are blocked in the iframe. Try opening the app in a new tab.");
      }
    });
  }
});
