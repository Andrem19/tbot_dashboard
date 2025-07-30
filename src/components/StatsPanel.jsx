import ValueFlash from './ValueFlash.jsx';

/**
 * props:
 *   stages = {
 *     first:  { futPnl, optPnl, total },
 *     second: { futPnl, optPnl, total }
 *   }
 *   totals = { fut, opt, total }
 */
export default function StatsPanel({ stages = {}, totals = {} }) {
  /* какие стадии реально есть */
  const order = ['first', 'second'].filter((k) => stages[k]);

  /* набор строк таблицы */
  const rows = [
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
          title={order.length ? 'Есть активная позиция' : 'Позиции нет'}
          style={{ background: order.length ? '#00cc66' : '#cc0033' }}
        />
      </h3>

      {order.length > 0 ? (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left' }}></th>
              {order.map((k) => (
                <th key={k} style={{ textTransform: 'capitalize', textAlign: 'right' }}>
                  {k}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {rows.map(({ label, key }) => (
              <tr
                key={key}
                className={key === 'total' ? 'stats-row total' : 'stats-row'}
              >
                <td>{label}</td>
                {order.map((k) => (
                  <td key={k + key} style={{ textAlign: 'right' }}>
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
        <div style={{ fontSize: 13, color: '#888' }}>No active positions</div>
      )}

      {/* общий итог по всем выбранным стадиям */}
      <div className="stats-row total" style={{ marginTop: 8 }}>
        <span>Overall Total uPnL:</span>
        <ValueFlash
          value={totals.total}
          formatter={(v) => (v == null ? '-' : Number(v).toFixed(2))}
        />
      </div>
    </aside>
  );
}
