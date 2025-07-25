import { useState, useEffect } from 'react';
import { ref, onValue, off } from 'firebase/database';
import { db } from '../firebase';

/**
 * Подписка на Realtime Database + статус подключения.
 * Возвращает { data, connected }.
 */
export function useFirebaseData(path) {
  const normalizedPath = path.startsWith('/') ? path.slice(1) : path;

  const [state, setState] = useState({
    data: null,
    connected: false,
  });

  /* ---------- статус подключения к Firebase ---------- */
  useEffect(() => {
    const infoRef = ref(db, '.info/connected');
    const handler = (snap) =>
      setState((prev) => ({ ...prev, connected: snap.val() === true }));
    onValue(infoRef, handler);
    return () => off(infoRef, 'value', handler);
  }, []);

  /* ---------- подписка на сам путь ---------- */
  useEffect(() => {
    const dbRef = ref(db, normalizedPath);
    const handler = (snap) =>
      setState((prev) => ({ ...prev, data: snap.val() }));
    const errorHandler = (err) =>
      console.error('[useFirebaseData] onValue error:', err?.code, err?.message);

    onValue(dbRef, handler, errorHandler);
    return () => off(dbRef, 'value', handler);
  }, [normalizedPath]);

  return state;
}
