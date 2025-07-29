import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Chart from './components/Chart.jsx';
import StatsPanel from './components/StatsPanel.jsx';
import { useBinanceKlines, useFirebaseData } from './hooks';
import './App.css';

/* ──── утилиты ─────────────────────────────────────────────── */
function toUnixSeconds(str) {
  if (!str || typeof str !== 'string') return null;
  const m = str.match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2}):(\d{2})(?:\.(\d{3,6}))?/);
  if (!m) return null;
  const [, y, mo, d, h, mi, s, msRaw = '000'] = m;
  const ms = Number(msRaw.slice(0, 3));
  return Math.floor(Date.UTC(+y, +mo - 1, +d, +h, +mi, +s, ms) / 1000);
}
const DEFAULT_SETTINGS = { coin: 'SOLUSDT', number_candles: 48, interv: 60 };
const ALLOWED_MINUTES = [1, 3, 5, 15, 30, 60, 120, 240, 360, 480, 720, 1440, 4320, 10080, 43200];
function normalizeCoin(v) {
  const s = (v || '').toString().trim().toUpperCase();
  return s || DEFAULT_SETTINGS.coin;
}
function normalizeLimit(v) {
  const n = Math.floor(Number(v));
  return Number.isFinite(n) ? Math.min(1500, Math.max(1, n)) : DEFAULT_SETTINGS.number_candles;
}
function normalizeInterv(v) {
  const n = Math.floor(Number(v));
  if (ALLOWED_MINUTES.includes(n)) return n;
  let best = ALLOWED_MINUTES[0], bestDiff = Math.abs(n - best);
  for (const m of ALLOWED_MINUTES) {
    const d = Math.abs(n - m);
    if (d < bestDiff) { best = m; bestDiff = d; }
  }
  return best;
}
function deriveSpotSymbol(optSym) {
  if (!optSym) return null;
  const parts = optSym.split('-');
  return parts.length >= 2 ? (parts[0] + parts.at(-1)).toUpperCase() : null;
}

/* ──── цвета линий ─────────────────────────────────────────── */
const STAGE_COLORS = {
  first:  { entry: '#3498db', sl: '#e74c3c', tp: '#2ecc71' },
  second: { entry: '#f39c12', sl: '#c0392b', tp: '#27ae60' },
};

/* ──── вспомогательный компонент таблицы опционов ─────────── */
function OptionTable({ stages }) {
  const order = ['first', 'second'];
  const metrics = [
    { label: 'Name', key: 'name', fmt: (v) => v },
    { label: 'Contracts', key: 'contracts' },
    { label: 'Unrealised PnL', key: 'unrealisedPnl', fmt: (v) => Number(v).toFixed(2) },
    {
      label: 'Avg Price',
      key: 'avgPrice',
      fmt: (v, info) =>
        `${Number(v).toFixed(2)} (${Number(v * (info.contracts ?? 0)).toFixed(2)})`,
    },
    { label: 'Mark Price', key: 'markPrice', fmt: (v) => Number(v).toFixed(2) },
    { label: 'Used Bid', key: 'usedBid', fmt: (v) => Number(v).toFixed(2) },
  ];

  const hasAny = order.some((k) => stages[k]?.optionInfo);
  if (!hasAny) return null;

  return (
    <div className="option-table-wrapper">
      <table className="option-table">
        <thead>
          <tr>
            <th style={{ width: 140 }}></th>
            {order.map((k) => (
              <th key={k} style={{ textTransform: 'uppercase' }}>
                {stages[k] ? k : ''}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {metrics.map(({ label, key, fmt }) => (
            <tr key={key}>
              <td>{label}</td>
              {order.map((k) => {
                const info = stages[k]?.optionInfo;
                const val = info?.[key];
                return (
                  <td key={k + key}>
                    {val == null ? '-' : fmt ? fmt(val, info) : val}
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

/* ──── основной компонент приложения ───────────────────────── */
export default function App() {
  /* ---------- Firebase dashboard ---------- */
  const { data: dashboard, connected: dbConnected } = useFirebaseData('dashboard');

  /* ---------- форма ---------- */
  const [form, setForm] = useState({
    coin: DEFAULT_SETTINGS.coin,
    number_candles: String(DEFAULT_SETTINGS.number_candles),
    interv: String(DEFAULT_SETTINGS.interv),
  });
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const onChange = (e) => setForm((p) => ({ ...p, [e.target.name]: e.target.value }));
  const onSubmit = useCallback(
    (e) => {
      e.preventDefault();
      setSettings({
        coin: normalizeCoin(form.coin),
        number_candles: normalizeLimit(form.number_candles),
        interv: normalizeInterv(form.interv),
      });
    },
    [form]
  );

  /* ---------- Binance свечи ---------- */
  const { candles, loading, wsConnected } = useBinanceKlines(settings);

  /* ---------- чек‑боксы стадий ---------- */
  const [visible, setVisible] = useState({ first: true, second: true });

  /* ---------- auto‑coin by option symbol ---------- */
  const autoAppliedRef = useRef(false);
  useEffect(() => {
    const st = dashboard?.stages;
    if (autoAppliedRef.current || !st) return;
    for (const stage of Object.values(st)) {
      const sym = stage?.position?.leg?.info?.symbol;
      const spot = deriveSpotSymbol(sym);
      if (spot) {
        autoAppliedRef.current = true;
        setForm((f) => ({ ...f, coin: spot }));
        setSettings((s) => ({ ...s, coin: spot }));
        break;
      }
    }
  }, [dashboard]);

  /* ---------- парсим стадии ---------- */
  const stages = useMemo(() => {
    const res = {};
    const st = dashboard?.stages || {};
    for (const [key, obj] of Object.entries(st)) {
      if (!obj?.exist || !obj.position?.exist) continue;
      const entry = obj.position.position_info?.entryPx ?? null;
      const lower = obj.lower_perc ?? null;
      const upper = obj.upper_perc ?? null;
      res[key] = {
        entryPx: entry,
        sl: entry && lower != null ? entry * (1 - lower) : null,
        tp: entry && upper != null ? entry * (1 + upper) : null,
        qty: obj.position.position_info?.size ?? null,
        futPnl: obj.position.position_info?.unrealizedPnl ?? null,
        optPnl: obj.position.leg?.info?.unrealisedPnl ?? null,
        optionInfo: {
          name: obj.position.leg?.name,
          contracts: obj.position.leg?.contracts,
          unrealisedPnl: obj.position.leg?.info?.unrealisedPnl,
          avgPrice: obj.position.leg?.info?.avgPrice,
          markPrice: obj.position.leg?.info?.markPrice,
          usedBid: obj.position.leg?.info?.used_bid,
        },
        colors: STAGE_COLORS[key] || {},
      };
    }
    return res;
  }, [dashboard]);

  /* ---------- Chart‑позиции ---------- */
  const chartPositions = useMemo(
    () =>
      Object.entries(stages).map(([k, v]) => ({
        key: k,
        visible: visible[k],
        ...v,
      })),
    [stages, visible]
  );

  /* ---------- агрегированные uPnL ---------- */
  const totals = useMemo(() => {
    let fut = 0,
      opt = 0;
    for (const v of Object.values(stages)) {
      fut += Number(v.futPnl || 0);
      opt += Number(v.optPnl || 0);
    }
    return { fut, opt, total: fut + opt };
  }, [stages]);

  /* ──── render ───────────────────────────────────────────── */
  return (
    <div className="app-container">
      {/* ───── ФОРМА ─────────────────────────────────────── */}
      <form className="form-row" onSubmit={onSubmit}>
        <label>
          Coin
          <input
            name="coin"
            value={form.coin}
            onChange={onChange}
            autoComplete="off"
            spellCheck="false"
          />
        </label>
        <label>
          Candles
          <input
            type="number"
            min="1"
            max="1500"
            name="number_candles"
            value={form.number_candles}
            onChange={onChange}
          />
        </label>
        <label>
          Interval&nbsp;(m)
          <input
            type="number"
            min="1"
            name="interv"
            value={form.interv}
            onChange={onChange}
          />
        </label>
        {/* чекбоксы */}
        <label>
          <input
            type="checkbox"
            checked={visible.first}
            onChange={(e) => setVisible((p) => ({ ...p, first: e.target.checked }))}
          />
          &nbsp;first
        </label>
        <label>
          <input
            type="checkbox"
            checked={visible.second}
            onChange={(e) => setVisible((p) => ({ ...p, second: e.target.checked }))}
          />
          &nbsp;second
        </label>
        <button type="submit">Load</button>
      </form>

      {/* ───── основная область ─────────────────────────── */}
      <div className="main-content">
        <div className="chart-wrapper">
          {loading && <div style={{ padding: 8 }}>Loading…</div>}
          {!loading && candles.length === 0 && <div style={{ padding: 8 }}>No data.</div>}
          {candles.length > 0 && <Chart candles={candles} positions={chartPositions} />}
        </div>

        <StatsPanel
          stages={{
            first:
              stages.first && {
                futPnl: stages.first.futPnl,
                optPnl: stages.first.optPnl,
                total: Number(stages.first.futPnl || 0) + Number(stages.first.optPnl || 0),
              },
            second:
              stages.second && {
                futPnl: stages.second.futPnl,
                optPnl: stages.second.optPnl,
                total: Number(stages.second.futPnl || 0) + Number(stages.second.optPnl || 0),
              },
          }}
          totals={totals}
        />
      </div>

      {/* ───── таблица опционов (общая) ─────────────────── */}
      <OptionTable stages={stages} />

      {/* ───── статусная строка ─────────────────────────── */}
      <div className="status-bar">
        <span>Chart&nbsp;WS:&nbsp;{wsConnected ? 'Connected' : 'Disconnected'}</span>
        <span>DB:&nbsp;{dbConnected ? 'Connected' : 'Disconnected'}</span>
        <span>{`Showing ${candles.length} candles for ${settings.coin} @ ${settings.interv}m`}</span>
      </div>
    </div>
  );
}
