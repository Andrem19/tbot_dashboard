import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchKlines, createKlineWebSocket } from '../services/binance';

export function useBinanceKlines(settings) {
  const { coin, number_candles, interv } = settings;

  const [candles, setCandles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);

  const wsRef = useRef(null);

  const loadInitial = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchKlines(coin, number_candles, interv);
      console.log('Fetched candles length:', data.length);
      setCandles(data);
    } catch (e) {
      console.error('Failed to fetch klines:', e);
    } finally {
      setLoading(false);
    }
  }, [coin, number_candles, interv]);

  const setupWS = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
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
        if (candle.time > last.time) {
          return [...prev, candle];
        }
        return prev;
      });
    });
    ws.onopen = () => setWsConnected(true);
    ws.onclose = () => setWsConnected(false);
    wsRef.current = ws;
  }, [coin, interv]);

  useEffect(() => {
    loadInitial();
  }, [loadInitial]);

  useEffect(() => {
    if (!loading && candles.length > 0) {
      setupWS();
    }
    return () => {
      wsRef.current?.close();
    };
  }, [loading, candles.length, setupWS]);

  return { candles, loading, wsConnected };
}
