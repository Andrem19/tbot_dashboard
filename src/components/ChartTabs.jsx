// src/components/ChartTabs.jsx
import { useEffect, useRef, useState } from 'react';
import Chart from './Chart.jsx';
import { useBinanceKlines } from '../hooks';

/* ── График + WebSocket ───────────────────────────────────── */
function ChartWithData({ symbol, number_candles, interv, positions, history, reportStatus }) {
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
      {/* ...loading logic... */}
      {candles.length > 0 && (
         <Chart candles={candles} positions={positions} history={history} />
      )}
    </div>
  );
}

/* ── Вкладки ──────────────────────────────────────────────── */
export default function ChartTabs({
  coins = [],
  number_candles,
  interv,
  positionsByCoin = {},
  history = [], // <--- Добавляем проп
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
          flex: '1 1 0',      // Растягиваемся
          position: 'relative',
          minHeight: 0,       // Важно для Firefox и мобильных
          display: 'flex',    // Делаем этот контейнер тоже флексом
          flexDirection: 'column',
          height: '100%',     // Явная высота
        }}
      >
        {coins.map((c) => (
          <div
            key={c}
            style={{
              position: c === active ? 'relative' : 'absolute', // relative для активного
              inset: 0,
              visibility: c === active ? 'visible' : 'hidden',
              display: c === active ? 'flex' : 'none',          // Скрываем из потока неактивные
              flex: '1 1 0',
              flexDirection: 'column',
              height: '100%',     // <--- ВАЖНО: передаем высоту дальше в ChartWithData
              width: '100%',
              overflow: 'hidden', // Обрезаем лишнее
            }}
          >
            <ChartWithData
              symbol={c}
              number_candles={number_candles}
              interv={interv}
              positions={positionsByCoin[c] || []}
              history={history}
              reportStatus={handleReport}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
