// src/components/StatsPanel.jsx
import ValueFlash from './ValueFlash.jsx';

export default function StatsPanel({
  futPnl,
  optPnl,
  totalPnl,
  positionExists,
}) {
  return (
    <aside className="stats-panel">
      <h3 className="stats-title">
        Position&nbsp;
        <span
          className="pos-dot"
          title={positionExists ? 'Есть активная позиция' : 'Позиции нет'}
          style={{ background: positionExists ? '#00cc66' : '#cc0033' }}
        />
      </h3>

      <div className="stats-row">
        <span>Futures uPnL:</span>
        <ValueFlash
          value={futPnl}
          formatter={(v) =>
            v == null ? '-' : Number(v).toFixed(2)
          }
        />
      </div>

      <div className="stats-row">
        <span>Options uPnL:</span>
        <ValueFlash
          value={optPnl}
          formatter={(v) =>
            v == null ? '-' : Number(v).toFixed(2)
          }
        />
      </div>

      <div className="stats-row total">
        <span>Total uPnL:</span>
        <ValueFlash
          value={totalPnl}
          formatter={(v) =>
            v == null ? '-' : Number(v).toFixed(2)
          }
        />
      </div>
    </aside>
  );
}
