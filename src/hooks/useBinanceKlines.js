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

    // закрываем старый сокет (если есть)
    const prev = wsRef.current;
    if (prev) {
      try { prev.close(); } catch {}
      wsRef.current = null;
    }

    // Обновим свечи «на сейчас», чтобы график стал актуальным ещё до WS
    try {
      const fresh = await fetchKlines(coin, number_candles, interv);
      setCandles(fresh);
    } catch (e) {
      console.warn('Reconnect fetch klines failed (will continue with WS):', e);
    }

    // Создаём новый WS
    const ws = createKlineWebSocket(coin, interv, (candle) => {
      setCandles(prevArr => {
        if (prevArr.length === 0) return [candle];
        const last = prevArr[prevArr.length - 1];
        if (candle.time === last.time) {
          const updated = [...prevArr];
          updated[updated.length - 1] = candle;
          return updated;
        }
        return candle.time > last.time ? [...prevArr, candle] : prevArr;
      });
    });

    // Запоминаем как «текущий» экземпляр
    wsRef.current = ws;

    // Планировщик авто-reconnect только для актуального экземпляра
    const scheduleReconnect = () => {
      // если уже размонтированы или уже запланировано — выходим
      if (closedManual.current || reconnectRef.current) return;
      // переподключаем только если закрывается «наш» текущий сокет
      if (wsRef.current !== ws) return;
      reconnectRef.current = setTimeout(() => {
        reconnectRef.current = null;
        connectWS();
      }, 5_000);
    };

    ws.onopen = () => {
      setWsConnected(true);
      // на всякий случай отменяем старые таймеры
      if (reconnectRef.current) {
        clearTimeout(reconnectRef.current);
        reconnectRef.current = null;
      }
      connectingRef.current = false; // <— КРИТИЧЕСКОЕ: снимаем блокировку
    };

    ws.onclose = () => {
      setWsConnected(false);
      connectingRef.current = false; // <— КРИТИЧЕСКОЕ: снимаем блокировку даже если onopen не случился
      scheduleReconnect();
    };

    ws.onerror = (err) => {
      console.error('WebSocket error', err);
      connectingRef.current = false; // <— КРИТИЧЕСКОЕ: иначе «залипнет»
      try { ws.close(); } catch {}
    };
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
