// src/components/ChartTabs.jsx
import { useEffect, useRef, useState } from 'react';
import Chart from './Chart.jsx';
import { useBinanceKlines } from '../hooks';

/* ── График + WebSocket ───────────────────────────────────── */
function ChartWithData({ symbol, number_candles, interv, positions, reportStatus }) {
  const {
    candles,
    loading,
    wsConnected,
    reconnect,
  } = useBinanceKlines({ coin: symbol, number_candles, interv });

  /* передаём состояние наверх (для строки статуса) */
  useEffect(() => {
    reportStatus({
      coin: symbol,
      wsConnected,
      reconnect,
      candleCount: candles.length,
    });
  }, [symbol, wsConnected, reconnect, candles.length, reportStatus]);

  return (
    <div className="chart-wrapper">
      {loading && <div style={{ padding: 8 }}>Loading…</div>}
      {!loading && candles.length === 0 && <div style={{ padding: 8 }}>No data.</div>}
      {candles.length > 0 && <Chart candles={candles} positions={positions} />}
    </div>
  );
}

/* ── Вкладки ──────────────────────────────────────────────── */
export default function ChartTabs({
  coins = [],
  number_candles,
  interv,
  positionsByCoin = {},
  onStatusChange,
}) {
  /* активную вкладку храним отдельно и СИНХРОНИЗИРУЕМ с coins  */
  const [active, setActive] = useState(coins[0] || '');
  const lastStatuses = useRef({});

  /* если набор coins изменился, а текущий active там не найден —
     выбираем первую доступную монету */
  useEffect(() => {
    if (!coins.includes(active)) {
      setActive(coins[0] || '');
    }
  }, [coins, active]);

  /* принимаем отчёты от дочерних графиков */
  const handleReport = (st) => {
    lastStatuses.current[st.coin] = st;
    if (st.coin === active) {
      onStatusChange(st);
    }
  };

  /* смена active → обновляем строку статуса */
  useEffect(() => {
    const st = lastStatuses.current[active];
    if (st) onStatusChange(st);
  }, [active, onStatusChange]);

  return (
    <div className="chart-tabs-root">
      {/* заголовок вкладок (если монет > 1) */}
      {coins.length > 1 && (
        <div className="chart-tabs-header">
          {coins.map((c) => (
            <button
              key={c}
              className={`tab${c === active ? ' active' : ''}`}
              onClick={() => setActive(c)}
            >
              {c.replace('USDT', '')}
            </button>
          ))}
        </div>
      )}

      {/* контейнер с графиками */}
      <div
        style={{
          flex: '1 1 0',
          position: 'relative',
          minHeight: 0, // разрешаем flex-сжатие
        }}
      >
        {coins.map((c) => (
          <div
            key={c}
            style={{
              position: c === active ? 'relative' : 'absolute',
              inset: 0,
              visibility: c === active ? 'visible' : 'hidden',
              display: 'flex',
              flex: '1 1 0',
              flexDirection: 'column',
              height: '100%',
              width: '100%',
            }}
          >
            <ChartWithData
              symbol={c}
              number_candles={number_candles}
              interv={interv}
              positions={positionsByCoin[c] || []}
              reportStatus={handleReport}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
