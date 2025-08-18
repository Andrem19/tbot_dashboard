import { useEffect, useState } from 'react';
import ValueFlash from './ValueFlash.jsx';

/** Определяем тип опциона по имени: 6-й символ с конца (C или P). */
function getOptionTypeFromName(name) {
  if (!name || typeof name !== 'string') return null;
  const idx = name.length - 6;
  if (idx < 0) return null;
  const ch = String(name[idx]).toUpperCase();
  return ch === 'C' || ch === 'P' ? ch : null;
}

/**
 * Панель simulation с таймером последнего обновления,
 * анимированным PnL (ValueFlash) и компактными метаданными.
 *
 * props:
 *   positions  – объект { position_1:{…}, position_2:{…}, … } | null
 *   updatedAt  – время последнего получения данных (ms)       | null
 *   simMeta    – объект { relAtr, periodAvgDist, periodAvgPnl, weNeed } | null
 */
export default function SimulationTable({ positions = null, updatedAt = null, simMeta = null }) {
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

  /* строки-метрики (PnL – первый, flash = true) */
  const rows = [
    { label: 'PnL', key: 'pnl', fmt: (v) => v.toFixed(2), flash: true },
    {
      label: 'Symbol',
      key: 'symbol',
      fmt: (v) => {
        const t = getOptionTypeFromName(v);
        const color =
          t === 'C' ? '#e74c3c' :
          t === 'P' ? '#2ecc71' : undefined;
        return <span style={{ color }}>{v}</span>;
      },
    },
    { label: 'Ask',          key: 'ask',          fmt: (v) => v.toFixed(2) },
    { label: 'Ask original', key: 'askOriginal',  fmt: (v) => v.toFixed(2) },
    { label: 'Target bid',   key: 'bestTargBid',  fmt: (v) => v.toFixed(2) },
    { label: 'p_t',          key: 'pt',           fmt: (v) => v.toFixed(4) },
    { label: 'Qty',          key: 'qty',          fmt: (v) => v.toFixed(6) },
    { label: 'IV',           key: 'iv',           fmt: (v) => v.toFixed(4) },
    { label: 'q_frac',       key: 'qFrac',        fmt: (v) => v.toFixed(6) },
    { label: 'PnL lower',    key: 'pnlLower',     fmt: (v) => v.toFixed(2) },
    { label: 'PnL upper',    key: 'pnlUpper',     fmt: (v) => v.toFixed(2) },
    { label: 'Strike %',     key: 'strikePerc',   fmt: (v) => v.toFixed(4) },
    { label: 'Lower %',      key: 'lowerPerc',    fmt: (v) => v.toFixed(4) },
    { label: 'Upper %',      key: 'upperPerc',    fmt: (v) => v.toFixed(4) },
    { label: 'Max amount',   key: 'maxAmount' },
    {
      label: 'Ask indicators',
      key: 'askIndicators',
      fmt: (v) =>
        Array.isArray(v) ? v.map((n) => n.toFixed(2)).join(' / ') : '-',
    },
  ];

  /* ——— компактная строка с таймером + метаданными симуляции ——— */
  const metaLabel = (title, val, fmt) => (
    <span title={title} style={{ whiteSpace: 'nowrap' }}>
      {title}: {val == null ? '—' : fmt ? fmt(val) : val}
    </span>
  );

  return (
    <div className="option-table-wrapper">
      {/* --- таймер и метрики в одну строку --- */}
      <div
        style={{
          fontSize: 12,
          marginBottom: 4,
          color: '#ccc',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <span>
          Last update:&nbsp;{secondsAgo == null ? '—' : `${secondsAgo}s ago`}
        </span>
        {simMeta && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', color: '#ddd' }}>
            {metaLabel('ATR(rel)', simMeta.relAtr, (v) => Number(v).toFixed(4))}
            {metaLabel('PnL(avg)', simMeta.periodAvgPnl, (v) => Number(v).toFixed(3))}
            {metaLabel('Exp_1', simMeta.exp1, (v) => Number(v).toFixed(2))}
            {metaLabel('Exp_2', simMeta.exp2, (v) => Number(v).toFixed(2))}
            {metaLabel('RR25', simMeta.RR25, (v) => Number(v).toFixed(4))}
            {metaLabel('Need', simMeta.weNeed)}
          </div>
        )}
      </div>

      {/* --- таблица --- */}
      <table className="option-table">
        <thead>
          <tr>
            <th style={{ width: 140 }}></th>
            {order.map((k) => (
              <th key={k}>{k.replace('position_', 'sim_')}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(({ label, key, fmt, flash }) => (
            <tr key={key}>
              <td>{label}</td>
              {order.map((k) => {
                const val = positions[k]?.[key];
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
