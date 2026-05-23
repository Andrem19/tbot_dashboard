import { formatSigned } from '../utils/cpsDashboard.js';

export default function CpsLedgerPanel({ ledger, executions = [] }) {
  if (!ledger) return null;
  return (
    <section className="cps-ledger-panel">
      <LedgerSection title="Active Virtual Legs" rows={ledger.active || []} empty="No active virtual legs" />
      <LedgerSection title="Shadow Legs" rows={ledger.shadow || []} empty="No shadow bootstrap legs" compact />
      <Executions rows={executions} />
    </section>
  );
}

function LedgerSection({ title, rows, empty, compact = false }) {
  return (
    <div className="cps-ledger-section">
      <div className="cps-section-header">
        <h3>{title}</h3>
        <span>{rows.length}</span>
      </div>
      {rows.length === 0 ? (
        <div className="cps-empty">{empty}</div>
      ) : (
        <div className={`cps-leg-grid ${compact ? 'compact' : ''}`}>
          {rows.map((leg) => <LegCard key={leg.leg_id || leg.id} leg={leg} />)}
        </div>
      )}
    </div>
  );
}

function LegCard({ leg }) {
  const pnl = Number(leg.estimated_pnl_usdt || 0);
  const timing = legTiming(leg);
  return (
    <article className={`cps-leg-card ${leg.direction || ''} ${leg.status || ''}`}>
      <div className="cps-leg-head">
        <span>{leg.direction || 'unknown'} {formatSigned(leg.signed_units, 2)}u</span>
        <strong className={pnl >= 0 ? 'positive' : 'negative'}>{pnl > 0 ? '+' : ''}{pnl.toFixed(4)}</strong>
      </div>
      <div className="cps-leg-meta">
        <span>{leg.family_id || 'family?'}</span>
        <span>{leg.status || 'status?'}</span>
        <span>size {Number(leg.effective_size || 0).toFixed(2)}x</span>
        <span>SL {Number(leg.emergency_stop_bps || 0).toFixed(0)}bps</span>
        <span>TP {Number(leg.take_profit_bps || 0).toFixed(0)}bps</span>
      </div>
      <div className="cps-leg-timing">
        <span>opened {timing.openedAt}</span>
        <span>planned {timing.duration}</span>
        <span>elapsed {timing.elapsed}</span>
        <span className={timing.overdue ? 'negative' : ''}>{timing.remainingLabel} {timing.remaining}</span>
      </div>
      <div className="cps-rule-label">{leg.rule_label || leg.slot_id || 'no rule label'}</div>
    </article>
  );
}

function legTiming(leg) {
  const nowMs = Date.now();
  const entryMs = toMs(leg.entry_ms || leg.entry_time);
  const exitMs = toMs(leg.planned_exit_ms || leg.planned_exit_time);
  const closeMs = toMs(leg.closed_at_ms || leg.close_time);
  const endMs = closeMs || exitMs;
  const elapsedEndMs = closeMs || nowMs;
  const durationMs = entryMs && exitMs ? Math.max(0, exitMs - entryMs) : 0;
  const elapsedMs = entryMs ? Math.max(0, elapsedEndMs - entryMs) : 0;
  const remainingMs = entryMs && exitMs ? exitMs - (closeMs || nowMs) : 0;
  const overdue = !closeMs && remainingMs < 0;
  return {
    openedAt: formatDateTime(entryMs),
    duration: formatDuration(durationMs),
    elapsed: formatDuration(elapsedMs),
    remaining: closeMs ? formatDateTime(closeMs) : formatDuration(Math.abs(remainingMs)),
    remainingLabel: closeMs ? 'closed' : overdue ? 'overdue' : 'left',
    overdue,
    endAt: formatDateTime(endMs),
  };
}

function toMs(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return n < 10_000_000_000 ? n * 1000 : n;
}

function formatDateTime(ms) {
  if (!ms) return 'n/a';
  return new Intl.DateTimeFormat('en-GB', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZoneName: 'short',
  }).format(new Date(ms));
}

function formatDuration(ms) {
  if (!ms) return 'n/a';
  const totalMinutes = Math.max(0, Math.round(ms / 60_000));
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  if (days) return `${days}d ${hours}h`;
  if (hours) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function Executions({ rows }) {
  return (
    <div className="cps-ledger-section">
      <div className="cps-section-header">
        <h3>Recent Rebalances</h3>
        <span>{rows.length}</span>
      </div>
      {rows.length === 0 ? (
        <div className="cps-empty">No rebalance records</div>
      ) : (
        <div className="cps-execution-list">
          {rows.slice(0, 8).map((row) => (
            <div key={`${row.id}-${row.target_id}`} className={`cps-execution-row ${row.status}`}>
              <span>{row.status}</span>
              <span>{row.side || 'hold'}</span>
              <span>target {formatSigned(row.target_signed_units, 4)}u</span>
              <span>delta {formatSigned(row.delta_signed_qty, 6)}</span>
              {row.error && <span className="negative">{row.error}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
