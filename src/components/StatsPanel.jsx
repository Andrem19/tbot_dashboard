import ValueFlash from './ValueFlash.jsx';

/**
 * props:
 *   stages = { first:{futPnl,optPnl,total}, second:{…} }
 *   totals = { fut, opt, total }
 */
export default function StatsPanel({ stages = {}, totals = {} }) {
  /* какие стадии действительно существуют */
  const cols = ['first', 'second'].filter((k) => stages[k]);

  /* строки‑метрики */
  const metrics = [
    { label: 'Futures uPnL', key: 'futPnl' },
    { label: 'Options uPnL', key: 'optPnl' },
    { label: 'Total uPnL',   key: 'total'  },
  ];

  return (
    <aside className="stats-panel">
      <h3 className="stats-title">
        Positions&nbsp;
        <span
          className="pos-dot"
          title={cols.length ? 'Есть активная позиция' : 'Позиции нет'}
          style={{ background: cols.length ? '#00cc66' : '#cc0033' }}
        />
      </h3>

      {cols.length ? (
        <table className="stats-table">
          {/* фиксируем ширины колонок: 45% — метрика, остальное поровну на данные */}
          <colgroup>
            <col style={{ width: '45%' }} />
            {cols.map(() => (
              <col key={Math.random()} style={{ width: `${55 / cols.length}%` }} />
            ))}
          </colgroup>

          <thead>
            <tr>
              <th className="metric-cell"></th>
              {cols.map((k) => (
                <th key={k} className="data-cell">{k}</th>
              ))}
            </tr>
          </thead>

          <tbody>
            {metrics.map(({ label, key }) => (
              <tr key={key}>
                <td className="metric-cell">{label}</td>
                {cols.map((k) => (
                  <td key={k + key} className="data-cell">
                    <ValueFlash
                      value={stages[k][key]}
                      formatter={(v) => (v == null ? '-' : Number(v).toFixed(2))}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div style={{ fontSize: 12, color: '#888' }}>No active positions</div>
      )}

      <div className="stats-row total overall-row">
        <span>Overall Total uPnL:</span>
        <ValueFlash
          value={totals.total}
          formatter={(v) => (v == null ? '-' : Number(v).toFixed(2))}
        />
      </div>
    </aside>
  );
}
