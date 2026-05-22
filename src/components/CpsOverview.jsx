import { formatSigned } from '../utils/cpsDashboard.js';

export default function CpsOverview({ overview }) {
  if (!overview) return null;
  const rule = overview.selectedRule || {};
  const pnl = Number(overview.currentPnl || 0);

  return (
    <section className="cps-overview">
      <div className="cps-overview-main">
        <div>
          <div className="panel-title">CPS Net Ledger</div>
          <div className="cps-strategy">{overview.strategyVersion || 'unknown strategy'}</div>
        </div>
        <div className={`cps-pnl ${pnl >= 0 ? 'positive' : 'negative'}`}>
          {pnl > 0 ? '+' : ''}{pnl.toFixed(4)}
        </div>
      </div>

      <div className="cps-kpi-grid">
        <Kpi label="target units" value={formatSigned(overview.targetSignedUnits, 4)} tone={overview.targetDirection} />
        <Kpi label="actual qty" value={formatSigned(overview.actualSignedQty, 6)} />
        <Kpi label="delta qty" value={formatSigned(overview.deltaSignedQty, 6)} />
        <Kpi label="active legs" value={overview.activeCount} />
        <Kpi label="shadow legs" value={overview.shadowCount} />
        <Kpi label="unit amount" value={`${Number(overview.amountPerUnit || 0).toFixed(2)} USDT`} />
      </div>

      <div className="cps-rule-strip">
        <span>signal: {overview.latestSignal} {overview.latestDirection || ''}</span>
        <span>source: {rule.source || 'N/A'}</span>
        <span>horizon: {rule.base_horizon_minutes || 'N/A'}m</span>
        <span>{rule.label || 'no selected rule'}</span>
      </div>
    </section>
  );
}

function Kpi({ label, value, tone }) {
  return (
    <div className={`cps-kpi ${tone || ''}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
