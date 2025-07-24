import { initializeApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Логи для продакшна (можешь удалить позже):
if (import.meta.env.PROD) {
  console.log('[firebaseConfig PROD]', firebaseConfig);
}

if (
  !firebaseConfig.databaseURL ||
  !firebaseConfig.databaseURL.startsWith('https://')
) {
  throw new Error(
    `Wrong or missing VITE_FIREBASE_DATABASE_URL: "${firebaseConfig.databaseURL}".`
  );
}

const app = initializeApp(firebaseConfig);

// ВАЖНО: передаём URL явно, чтобы SDK не пытался «догадаться»:
export const db = getDatabase(app, firebaseConfig.databaseURL);
