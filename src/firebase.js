// src/firebase.js

// 1) Импортируем функции из Firebase JS SDK
import { initializeApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';

// 2) Конфигурацию берем из переменных окружения
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// 3) Инициализируем приложение и экспортируем референс на базу
const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
