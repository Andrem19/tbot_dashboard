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

  const wsRef           = useRef(null);
  const reconnectRef    = useRef(null);    // id тайм-аута авто-переподключения
  const closedManual    = useRef(false);   // размонтирование хука
  const manualReconnect = useRef(false);   // флаг «мы закрываем WS намеренно ради ручного reconnect»
  const connectingRef   = useRef(false);   // защита от параллельных connectWS()

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
  const connectWS = useCallback(async () => {
    // анти-дребезг: не даём запускать параллельные подключения
    if (connectingRef.current) return;
    connectingRef.current = true;

    // отменяем ожидающий авто-reconnect, если был
    if (reconnectRef.current) {
      clearTimeout(reconnectRef.current);
      reconnectRef.current = null;
    }

    // если есть старый WS — закрываем, помечая, что это наш «ручной» перезапуск
    manualReconnect.current = true;
    if (wsRef.current) {
      try { wsRef.current.close(); } catch {}
      wsRef.current = null;
    }

    // Обновим свечи «на сейчас», чтобы график стал актуальным ещё до открытия нового WS
    try {
      const fresh = await fetchKlines(coin, number_candles, interv);
      setCandles(fresh);
    } catch (e) {
      console.warn('Reconnect fetch klines failed (will continue with WS):', e);
    }

    // Создаём новый WS
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

    // планировщик авто-reconnect
    const scheduleReconnect = () => {
      if (closedManual.current || reconnectRef.current) return;
      reconnectRef.current = setTimeout(() => {
        reconnectRef.current = null;
        connectWS(); // пробуем снова
      }, 5_000);
    };

    ws.onopen = () => {
      setWsConnected(true);
      if (reconnectRef.current) {
        clearTimeout(reconnectRef.current);
        reconnectRef.current = null;
      }
      // ручная фаза закончена — дальше авто-reconnect должен работать как прежде
      manualReconnect.current = false;
      connectingRef.current = false;
    };

    ws.onclose = () => {
      setWsConnected(false);
      // если закрытие было инициировано нами для ручного reconnect — не планируем авто-reconnect на «старое» соединение
      if (!manualReconnect.current) {
        scheduleReconnect();
      }
      // Если manualReconnect=true, значит это закрывался старый WS; новый уже откроется выше
    };

    ws.onerror = (err) => {
      console.error('WebSocket error', err);
      try { ws.close(); } catch {}
    };

    wsRef.current = ws;
  }, [coin, interv, number_candles]);

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
    reconnect: connectWS,    // ручное мгновенное переподключение
  };
}
