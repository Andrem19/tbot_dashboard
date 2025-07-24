// src/hooks/useFirebaseData.js
import { useState, useEffect } from 'react';
import { ref, onValue, off } from 'firebase/database';
import { db } from '../firebase';

/**
 * Универсальный хук для подписки на путь в Realtime Database.
 * path: строка, например 'dashboard' или 'candles/BTCUSDT'
 */
export function useFirebaseData(path) {
  const [data, setData] = useState(null);
  const normalizedPath = path.startsWith('/') ? path.slice(1) : path;

  useEffect(() => {
    const dbRef = ref(db, normalizedPath);

    const callback = (snapshot) => {
      const val = snapshot.val();
      console.log('[useFirebaseData] snapshot.exists:', snapshot.exists(), 'value:', val);
      setData(val);
    };

    const errorCallback = (err) => {
      console.error('[useFirebaseData] onValue error:', err?.code, err?.message);
    };

    onValue(dbRef, callback, errorCallback);

    return () => {
      off(dbRef, 'value', callback);
    };
  }, [normalizedPath]);

  return data;
}
