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

  const wsRef          = useRef(null);
  const reconnectRef   = useRef(null);   // id тайм‑аутов
  const closedManual   = useRef(false);  // чтобы не переподключаться при размонтировании

  /* ---------- начальная загрузка ---------- */
  const loadInitial = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchKlines(coin, number_candles, interv);
      setCandles(data);
    } catch (e) {
      console.error('Failed to fetch klines:', e);
    } finally {
      setLoading(false);
    }
  }, [coin, number_candles, interv]);

  /* ---------- WebSocket & авто‑reconnect ---------- */
  const connectWS = useCallback(() => {
    if (wsRef.current) wsRef.current.close();

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
      ws.close();
    };

    wsRef.current = ws;
  }, [coin, interv]);

  /* ---------- эффекты ---------- */
  useEffect(loadInitial, [loadInitial]);

  useEffect(() => {
    closedManual.current = false;

    if (!loading) connectWS();
    return () => {
      closedManual.current = true;
      if (wsRef.current) wsRef.current.close();
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
    };
  }, [loading, connectWS]);

  return { candles, loading, wsConnected };
}
