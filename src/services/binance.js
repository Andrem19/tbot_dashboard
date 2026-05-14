import { minutesToBinanceInterval } from '../utils/intervals';

const FUTURES_BASE_URL = 'https://fapi.binance.com';
const WS_BASE_URL = 'wss://fstream.binance.com/ws';

export async function fetchKlines(coin, number_candles, intervMinutes) {
  const intervalString = minutesToBinanceInterval(Number(intervMinutes));
  const limit = Math.min(1500, Math.max(1, Math.floor(Number(number_candles))));
  const symbol = (coin || '').toUpperCase();

  const endpoint = `/fapi/v1/klines?symbol=${symbol}&interval=${intervalString}&limit=${limit}`;
  const url = FUTURES_BASE_URL + endpoint;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);

  const data = await res.json();
  return data.map((x) => ({
    time: Math.floor(x[0] / 1000),
    open: parseFloat(x[1]),
    high: parseFloat(x[2]),
    low: parseFloat(x[3]),
    close: parseFloat(x[4]),
    volume: parseFloat(x[5]),
  }));
}

export function createKlineWebSocket(coin, intervMinutes, onKline) {
  const intervalString = minutesToBinanceInterval(Number(intervMinutes));
  const stream = `${(coin || '').toLowerCase()}@kline_${intervalString}`;
  const ws = new WebSocket(`${WS_BASE_URL}/${stream}`);

  ws.onmessage = (e) => {
    try {
      const json = JSON.parse(e.data);
      if (!json.k) return;
      const k = json.k;
      const candle = {
        time: Math.floor(k.t / 1000),
        open: parseFloat(k.o),
        high: parseFloat(k.h),
        low: parseFloat(k.l),
        close: parseFloat(k.c),
        volume: parseFloat(k.v),
      };
      onKline(candle, k.x === true);
    } catch (err) {
      console.error('WS parse error', err);
    }
  };

  ws.onerror = (err) => {
    console.error('WebSocket error', err);
  };

  return ws;
}
