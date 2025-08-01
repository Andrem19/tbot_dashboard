import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchKlines, createKlineWebSocket } from '../services/binance';

/**
 * Загружает initial-свечи и поддерживает живое WebSocket-подключение
 * с автоматическим и ручным (reconnect) переподключением.
 *
 * Возвращает:
 *   • candles      – массив свечей;
 *   • loading      – флаг начальной загрузки;
 *   • wsConnected  – состояние WS;
 *   • reconnect()  – функция для мгновенного переподключения.
 */
export function useBinanceKlines(settings) {
  const { coin, number_candles, interv } = settings;

  const [candles,      setCandles]     = useState([]);
  const [loading,      setLoading]     = useState(false);
  const [wsConnected,  setWsConnected] = useState(false);

  const wsRef        = useRef(null);
  const reconnectRef = useRef(null);   // id тайм-аута на авто-reconnect
  const closedManual = useRef(false);  // true → размонтирование компонента

  /* ---------- начальная загрузка свечей ---------- */
  const loadInitial = useCallback(async (signal) => {
    setLoading(true);
    try {
      const data = await fetchKlines(coin, number_candles, interv);
      if (signal?.aborted) return;
      setCandles(data);
    } catch (e) {
      if (!signal?.aborted) {
        console.error('Failed to fetch klines:', e);
        setCandles([]);
      }
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [coin, number_candles, interv]);

  /* ---------- функция подключения к WS (может вызываться повторно) ---------- */
  const connectWS = useCallback(() => {
    // закрываем предыдущий сокет (если был)
    if (wsRef.current) {
      try { wsRef.current.close(); } catch {}
      wsRef.current = null;
    }

    const ws = createKlineWebSocket(coin, interv, (candle) => {
      setCandles(prev => {
        if (prev.length === 0) return [candle];
        const last = prev[prev.length - 1];
        if (candle.time === last.time) {
          const updated = [...prev];
          updated[updated.length - 1] = candle;
          return updated;
        }
        return candle.time > last.time ? [...prev, candle] : prev;
      });
    });

    /* ---- обработка состояний ---- */
    ws.onopen = () => {
      setWsConnected(true);
      if (reconnectRef.current) {
        clearTimeout(reconnectRef.current);
        reconnectRef.current = null;
      }
    };

    const scheduleReconnect = () => {
      if (closedManual.current) return;        // размонтирование
      if (reconnectRef.current) return;        // уже запланирован
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
  useEffect(() => {
    const ac = new AbortController();
    loadInitial(ac.signal);
    return () => ac.abort();
  }, [loadInitial]);

  useEffect(() => {
    closedManual.current = false;
    if (!loading) connectWS();
    return () => {
      // сигналим, что компонент размонтирован
      closedManual.current = true;
      try { wsRef.current?.close(); } catch {}
      if (reconnectRef.current) {
        clearTimeout(reconnectRef.current);
        reconnectRef.current = null;
      }
    };
  }, [loading, connectWS]);

  /* ---------- публичный интерфейс хука ---------- */
  return {
    candles,
    loading,
    wsConnected,
    reconnect: connectWS,    // ручное переподключение
  };
}
