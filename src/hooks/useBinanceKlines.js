// ./src/hooks/useBinanceKlines.js
import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchKlines, createKlineWebSocket } from '../services/binance';

/**
 * Загружает initial свечи и поддерживает живое WebSocket‑подключение
 * с автоматическим переподключением.
 */
export function useBinanceKlines(settings) {
  const { coin, number_candles, interv } = settings;

  const [candles, setCandles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);

  const wsRef        = useRef(null);
  const reconnectRef = useRef(null);   // id тайм‑аута на переподключение
  const closedManual = useRef(false);  // чтобы не переподключаться при размонтировании

  /* ---------- начальная загрузка ---------- */
  const loadInitial = useCallback(async (signal) => {
    // signal — AbortSignal; если signal.aborted === true, отменяем побочные эффекты
    setLoading(true);
    try {
      const data = await fetchKlines(coin, number_candles, interv);
      if (signal?.aborted) return;
      setCandles(data);
    } catch (e) {
      if (!signal?.aborted) {
        console.error('Failed to fetch klines:', e);
        // при ошибке очищаем свечи, чтобы график корректно перерисовался
        setCandles([]);
      }
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [coin, number_candles, interv]);

  /* ---------- WebSocket & авто‑reconnect ---------- */
  const connectWS = useCallback(() => {
    // закрываем предыдущий сокет
    if (wsRef.current) {
      try { wsRef.current.close(); } catch {}
      wsRef.current = null;
    }

    const ws = createKlineWebSocket(coin, interv, (candle) => {
      setCandles((prev) => {
        if (prev.length === 0) return [candle];
        const last = prev[prev.length - 1];
        if (candle.time === last.time) {
          const updated = [...prev];
          updated[updated.length - 1] = candle;
          return updated;
        }
        if (candle.time > last.time) return [...prev, candle];
        return prev;
      });
    });

    ws.onopen = () => {
      setWsConnected(true);
      if (reconnectRef.current) {
        clearTimeout(reconnectRef.current);
        reconnectRef.current = null;
      }
    };

    const scheduleReconnect = () => {
      if (closedManual.current) return;
      if (reconnectRef.current) return; // уже запланирован
      reconnectRef.current = setTimeout(() => {
        reconnectRef.current = null;
        connectWS();
      }, 5_000);
    };

    ws.onclose = () => {
      setWsConnected(false);
      scheduleReconnect();
    };

    ws.onerror = (err) => {
      console.error('WebSocket error', err);
      try { ws.close(); } catch {}
    };

    wsRef.current = ws;
  }, [coin, interv]);

  /* ---------- эффекты ---------- */

  // ВАЖНО: не передавать async‑функцию напрямую в useEffect.
  // Запускаем загрузку внутри синхронного эффекта и используем AbortController.
  useEffect(() => {
    const ac = new AbortController();
    loadInitial(ac.signal);
    return () => ac.abort();
  }, [loadInitial]);

  // Подключение WS после загрузки initial (или при смене параметров)
  useEffect(() => {
    closedManual.current = false;

    // пересоздаём сокет только когда initial уже не грузится
    if (!loading) connectWS();

    return () => {
      closedManual.current = true;
      try { wsRef.current?.close(); } catch {}
      if (reconnectRef.current) {
        clearTimeout(reconnectRef.current);
        reconnectRef.current = null;
      }
    };
  }, [loading, connectWS]);

  return { candles, loading, wsConnected };
}
