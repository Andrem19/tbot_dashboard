import { useEffect, useState } from 'react';
import ValueFlash from './ValueFlash.jsx';

/**
 * Панель simulation с таймером последнего обновления
 * и анимированным PnL (ValueFlash).
 *
 * props:
 *   positions  – объект { position_1:{…}, position_2:{…}, … } | null
 *   updatedAt  – время последнего получения данных (ms)       | null
 */
export default function SimulationTable({ positions = null, updatedAt = null }) {
  /* ——— таймер «секунд с последнего обновления» ——— */
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const secondsAgo =
    updatedAt == null ? null : Math.max(0, Math.floor((now - updatedAt) / 1000));

  /* ——— данные существуют? ——— */
  const order = ['position_1', 'position_2', 'position_3'].filter(
    (k) => positions && positions[k]
  );
  if (!order.length) return null;

  /* строки-метрики
     → PnL помещаем первым и помечаем flash: true
  */
  const rows = [
    { label: 'PnL', key: 'pnl', fmt: (v) => v.toFixed(2), flash: true },
    { label: 'Symbol',        key: 'symbol' },
    { label: 'Ask',           key: 'ask',          fmt: (v) => v.toFixed(2) },
    { label: 'Ask original',  key: 'askOriginal',  fmt: (v) => v.toFixed(2) },    
    { label: 'Target bid',    key: 'bestTargBid',  fmt: (v) => v.toFixed(2) },
    { label: 'PnL upper',     key: 'pnlUpper',     fmt: (v) => v.toFixed(2) },
    { label: 'p_t',           key: 'pt',           fmt: (v) => v.toFixed(2) },
    {
      label: 'Strike %',
      key: 'strikePerc',
      fmt: (v) => v.toFixed(4),
    },
    {
      label: 'Lower %',
      key: 'lowerPerc',
      fmt: (v) => v.toFixed(4),
    },
    {
      label: 'Upper %',
      key: 'upperPerc',
      fmt: (v) => v.toFixed(4),
    },
    { label: 'Max amount',    key: 'maxAmount' },
    {
      label: 'Ask indicators',
      key: 'askIndicators',
      fmt: (v) =>
        Array.isArray(v) ? v.map((n) => n.toFixed(2)).join(' / ') : '-',
    },
  ];

  return (
    <div className="option-table-wrapper">
      {/* --- таймер --- */}
      <div style={{ fontSize: 12, marginBottom: 4, color: '#ccc' }}>
        Last update:&nbsp;
        {secondsAgo == null ? '—' : `${secondsAgo}s ago`}
      </div>

      {/* --- таблица --- */}
      <table className="option-table">
        <thead>
          <tr>
            <th style={{ width: 140 }}></th>
            {order.map((k) => (
              <th key={k}>{k.toUpperCase()}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(({ label, key, fmt, flash }) => (
            <tr key={key}>
              <td>{label}</td>
              {order.map((k) => {
                const val = positions[k]?.[key];
                /* ячейки PnL – чуть крупнее и с ValueFlash */
                if (flash) {
                  return (
                    <td
                      key={k + key}
                      style={{ fontWeight: 600, fontSize: 14 }}
                    >
                      {val == null ? (
                        '-'
                      ) : (
                        <ValueFlash
                          value={val}
                          formatter={(v) => v.toFixed(2)}
                        />
                      )}
                    </td>
                  );
                }
                /* остальные ячейки */
                return (
                  <td key={k + key}>
                    {val == null ? '-' : fmt ? fmt(val) : val}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
