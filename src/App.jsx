import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Chart from './components/Chart.jsx';
import StatsPanel from './components/StatsPanel.jsx';
import { useBinanceKlines, useFirebaseData } from './hooks';
import './App.css';

/* ──── вспомогательные функции ────────────────────────────── */
function toUnixSeconds(str) {
  if (!str || typeof str !== 'string') return null;
  const m = str.match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2}):(\d{2})(?:\.(\d{3,6}))?/);
  if (!m) return null;
  const [, y, mo, d, h, mi, s, msRaw = '000'] = m;
  const ms = Number(msRaw.slice(0, 3));
  return Math.floor(Date.UTC(+y, +mo - 1, +d, +h, +mi, +s, ms) / 1000);
}

const DEFAULT_SETTINGS = { coin: 'SOLUSDT', number_candles: 48, interv: 60 };
const ALLOWED_MINUTES  = [1,3,5,15,30,60,120,240,360,480,720,1440,4320,10080,43200];

function normalizeCoin(v){ const s=(v||'').toString().trim().toUpperCase(); return s || DEFAULT_SETTINGS.coin; }
function normalizeLimit(v){ const n=Math.floor(Number(v)); return Number.isFinite(n) ? Math.min(1500, Math.max(1,n)) : DEFAULT_SETTINGS.number_candles; }
function normalizeInterv(v){
  const n = Math.floor(Number(v));
  if (ALLOWED_MINUTES.includes(n)) return n;
  let best = ALLOWED_MINUTES[0], diff = Math.abs(n - best);
  for (const m of ALLOWED_MINUTES){
    const d = Math.abs(n - m);
    if (d < diff){ best = m; diff = d; }
  }
  return best;
}
function deriveSpotSymbol(opt){ if(!opt) return null; const p=opt.split('-'); return p.length>=2 ? (p[0]+p.at(-1)).toUpperCase() : null; }

/* ──── цвета линий ─────────────────────────────────────────── */
const STAGE_COLORS = {
  first : { entry:'#5e6288ff', sl:'#e74c3c', tp:'#2ecc71' },
  second: { entry:'#ffffffff', sl:'#c0392b', tp:'#27ae60' },
};

/* ──── таблица опционов (оставлена без изменений) ──────────── */
function OptionTable({ stages }) {
  const order = ['first','second'];
  const rows = [
    {label:'Name', key:'name'},
    {label:'Contracts', key:'contracts'},
    {label:'Unrealised PnL', key:'unrealisedPnl', fmt:v=>Number(v).toFixed(2)},
    {label:'Avg Price', key:'avgPrice', fmt:(v,inf)=>`${Number(v).toFixed(2)} (${Number(v*(inf.contracts||0)).toFixed(2)})`},
    {label:'Mark Price', key:'markPrice', fmt:v=>Number(v).toFixed(2)},
    {label:'Used Bid', key:'usedBid', fmt:v=>Number(v).toFixed(2)},
    {label:'Max Size', key:'maxSize', fmt:v=>Number(v).toFixed(2)},
  ];
  if (!order.some(k => stages[k]?.optionInfo)) return null;

  return (
    <div className="option-table-wrapper">
      <table className="option-table">
        <thead>
          <tr>
            <th style={{width:140}}></th>
            {order.map(k => <th key={k}>{stages[k] ? k.toUpperCase() : ''}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map(({label,key,fmt}) => (
            <tr key={key}>
              <td>{label}</td>
              {order.map(k => {
                const inf = stages[k]?.optionInfo; const val = inf?.[key];
                return <td key={k+key}>{val==null ? '-' : (fmt ? fmt(val,inf) : val)}</td>;
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
  /* время-«heartbeat» */
  const [nowSec, setNowSec] = useState(() => Math.floor(Date.now() / 1000));
  useEffect(() => {
    const id = setInterval(() => setNowSec(Math.floor(Date.now() / 1000)), 60_000);
    return () => clearInterval(id);
  }, []);

  /* Firebase */
  const { data: dashboard, connected: dbConnected } = useFirebaseData('dashboard');

  /* форма выбора параметров */
  const [form, setForm] = useState({
    coin: DEFAULT_SETTINGS.coin,
    number_candles: String(DEFAULT_SETTINGS.number_candles),
    interv: String(DEFAULT_SETTINGS.interv),
  });
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);

  const onChange = e => setForm(p => ({ ...p, [e.target.name]: e.target.value }));
  const onSubmit = useCallback(e => {
    e.preventDefault();
    setSettings({
      coin: normalizeCoin(form.coin),
      number_candles: normalizeLimit(form.number_candles),
      interv: normalizeInterv(form.interv),
    });
  }, [form]);

  /* Binance: свечи + соединение + reconnect */
  const { candles, loading, wsConnected, reconnect } = useBinanceKlines(settings);

  /* чек-боксы видимости позиций */
  const [visible, setVisible] = useState({ first:true, second:true });

  /* авто-определение coin по данным dashboard */
  const autoAppliedRef = useRef(false);
  useEffect(() => {
    if (autoAppliedRef.current || !dashboard?.stages) return;
    for (const s of Object.values(dashboard.stages)) {
      const spot = deriveSpotSymbol(s?.position?.leg?.info?.symbol);
      if (spot) {
        autoAppliedRef.current = true;
        setForm(f => ({ ...f, coin: spot }));
        setSettings(sg => ({ ...sg, coin: spot }));
        break;
      }
    }
  }, [dashboard]);

  /* stages для графика и панели */
  const stages = useMemo(() => {
    const res = {}, st = dashboard?.stages || {};
    for (const [k, obj] of Object.entries(st)) {
      if (!obj?.exist || !obj.position?.exist) continue;
      const entry   = obj.position.position_info?.entryPx ?? null;
      const lower   = obj.lower_perc ?? null;
      const upper   = obj.upper_perc ?? null;
      const openUts = toUnixSeconds(obj.position.open_time);
      const h2e     = obj.position.leg?.hours_to_exp ?? null;

      let elapsed = 0, total = 0, percent = 0;
      if (openUts && h2e != null) {
        elapsed = Math.max(0, (nowSec - openUts) / 3600);
        total   = elapsed + Number(h2e);
        percent = total > 0 ? Math.min(100, Math.max(0, (elapsed / total) * 100)) : 0;
      }

      res[k] = {
        entryPx: entry,
        sl     : entry && lower != null ? entry * (1 - lower) : null,
        tp     : entry && upper != null ? entry * (1 + upper) : null,
        qty    : obj.position.position_info?.size ?? null,
        futPnl : obj.position.position_info?.unrealizedPnl ?? null,
        optPnl : obj.position.leg?.info?.unrealisedPnl ?? null,
        optionInfo: {
          name           : obj.position.leg?.name,
          contracts      : obj.position.leg?.contracts,
          unrealisedPnl  : obj.position.leg?.info?.unrealisedPnl,
          avgPrice       : obj.position.leg?.info?.avgPrice,
          markPrice      : obj.position.leg?.info?.markPrice,
          usedBid        : obj.position.leg?.info?.used_bid,
          maxSize        : obj.position.leg?.info?.max_size,
        },
        colors  : STAGE_COLORS[k] || {},
        progress: { elapsed, remaining: h2e, percent },
        openTime: openUts,
      };
    }
    return res;
  }, [dashboard, nowSec]);

  /* позиции для графика */
  const chartPositions = useMemo(() =>
    Object.entries(stages).map(([k, v]) => ({ key:k, visible:visible[k], ...v })),
  [stages, visible]);

  /* totalling uPnL */
  const totals = useMemo(() => {
    let fut = 0, opt = 0;
    for (const v of Object.values(stages)) {
      fut += Number(v.futPnl || 0);
      opt += Number(v.optPnl || 0);
    }
    return { fut, opt, total: fut + opt };
  }, [stages]);

  /* ─── JSX ───────────────────────────────────────────────── */
  return (
    <div className="app-container">

      {/* ─── форма параметров ─────────────────────────────── */}
      <form className="form-row" onSubmit={onSubmit}>
        <label>Coin
          <input
            name="coin"
            value={form.coin}
            onChange={onChange}
            autoComplete="off"
            spellCheck="false"
          />
        </label>
        <label>Candles
          <input
            type="number"
            name="number_candles"
            min="1"
            max="1500"
            value={form.number_candles}
            onChange={onChange}
          />
        </label>
        <label>Interval&nbsp;(m)
          <input
            type="number"
            name="interv"
            min="1"
            value={form.interv}
            onChange={onChange}
          />
        </label>

        {/* чек-боксы стадий */}
        <label className="checkbox">
          <input
            type="checkbox"
            checked={visible.first}
            onChange={e => setVisible(p => ({ ...p, first:e.target.checked }))}
          />
          first
        </label>
        <label className="checkbox">
          <input
            type="checkbox"
            checked={visible.second}
            onChange={e => setVisible(p => ({ ...p, second:e.target.checked }))}
          />
          second
        </label>

        <button type="submit">Load</button>
      </form>

      {/* ─── основное содержимое ──────────────────────────── */}
      <div className="main-content">
        <div className="chart-wrapper">
          {loading && <div style={{padding:8}}>Loading…</div>}
          {!loading && candles.length === 0 && <div style={{padding:8}}>No data.</div>}
          {candles.length > 0 && (
            <Chart candles={candles} positions={chartPositions} />
          )}
        </div>

        <StatsPanel
          stages={{
            first : stages.first  && { futPnl:stages.first.futPnl,  optPnl:stages.first.optPnl,  total:Number(stages.first.futPnl||0)+Number(stages.first.optPnl||0) },
            second: stages.second && { futPnl:stages.second.futPnl, optPnl:stages.second.optPnl, total:Number(stages.second.futPnl||0)+Number(stages.second.optPnl||0) },
          }}
          totals={totals}
        />
      </div>

      {/* ─── progress-bars ───────────────────────────────── */}
      {['first','second'].map(k => {
        const pr = stages[k]?.progress;
        if (!pr || pr.remaining == null) return null;
        const lbl = `${k}: прошло ${pr.elapsed.toFixed(1)} ч / осталось ${pr.remaining.toFixed(1)} ч`;
        return (
          <div className="progress-wrapper" key={'p'+k}>
            <div className="progress-label">{lbl}</div>
            <div className="progress-bar">
              <div
                className="progress-fill-absolute"
                style={{ width:`${pr.percent}%`, background:stages[k].colors.entry }}
              />
            </div>
          </div>
        );
      })}

      {/* ─── таблица опционов ─────────────────────────────── */}
      <OptionTable stages={stages} />

      {/* ─── status-bar снизу ─────────────────────────────── */}
      <div className="status-bar">
        <span>
          Chart&nbsp;WS:&nbsp;
          {wsConnected ? 'Connected' : 'Disconnected'}
          {!wsConnected && (
            <button
              type="button"
              onClick={reconnect}
              title="Reconnect WebSocket now"
              style={{
                marginLeft: 6,
                padding: '0 6px',
                background: '#333',
                color: '#fff',
                border: '1px solid #555',
                borderRadius: 3,
                cursor: 'pointer',
                fontSize: 12,
                lineHeight: '14px',
              }}
            >
              ↻
            </button>
          )}
        </span>
        <span>DB:&nbsp;{dbConnected ? 'Connected' : 'Disconnected'}</span>
        <span>{`Showing ${candles.length} candles for ${settings.coin} @ ${settings.interv}m`}</span>
      </div>
    </div>
  );
}
