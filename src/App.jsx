import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ChartTabs       from './components/ChartTabs.jsx';
import StatsPanel      from './components/StatsPanel.jsx';
import SimulationTable from './components/SimulationTable.jsx';
import { useFirebaseData } from './hooks';
import './App.css';

/* ─── утилиты ─────────────────────────────────────────────── */
function toUnixSeconds(str) {
  if (!str || typeof str !== 'string') return null;
  const m = str.match(
    /^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2}):(\d{2})(?:\.(\d{3,6}))?/
  );
  if (!m) return null;
  const [, y, mo, d, h, mi, s, msRaw = '000'] = m;
  const ms = Number(msRaw.slice(0, 3));
  return Math.floor(Date.UTC(+y, +mo - 1, +d, +h, +mi, +s, ms) / 1000);
}

/** Определение типа опциона по имени: берём 6-й символ с конца (C или P). */
function getOptionTypeFromName(name) {
  if (!name || typeof name !== 'string') return null;
  const idx = name.length - 6; // …-C-USDT  -> 'C' находится за 6 позиций до конца
  if (idx < 0) return null;
  const ch = String(name[idx]).toUpperCase();
  return ch === 'C' || ch === 'P' ? ch : null;
}

/* === НАСТРОЙКИ ПО УМОЛЧАНИЮ ================================================ */
const DEFAULT_SETTINGS = { coin: 'ETHUSDT', number_candles: 48, interv: 60 };
const ALLOWED_MINUTES = [
  1, 3, 5, 15, 30, 60, 120, 240, 360, 480, 720, 1440, 4320, 10080, 43200,
];
function normalizeCoin(v)   { const s = (v || '').toString().trim().toUpperCase(); return s || DEFAULT_SETTINGS.coin; }
function normalizeLimit(v)  { const n = Math.floor(Number(v)); return Number.isFinite(n) ? Math.min(1500, Math.max(1, n)) : DEFAULT_SETTINGS.number_candles; }
function normalizeInterv(v) {
  const n = Math.floor(Number(v));
  if (ALLOWED_MINUTES.includes(n)) return n;
  let best = ALLOWED_MINUTES[0], diff = Math.abs(n - best);
  for (const m of ALLOWED_MINUTES) {
    const d = Math.abs(n - m);
    if (d < diff) { best = m; diff = d; }
  }
  return best;
}

/* ─── цвета линий ─────────────────────────────────────────── */
const STAGE_COLORS = {
  first : { entry: '#5e6288ff', sl: '#e74c3c', tp: '#2ecc71' },
  second: { entry: '#ffffffff', sl: '#c0392b', tp: '#27ae60' },
};

/* ─── таблица опционов (как была, с окраской имени) ───────────────────────── */
function OptionTable({ stages }) {
  const order = ['first', 'second'];
  const rows  = [
    { label: 'Name',          key: 'name' },
    { label: 'Contracts',     key: 'contracts' },
    { label: 'Unrealised PnL', key: 'unrealisedPnl', fmt: (v) => v.toFixed(2) },
    {
      label: 'Avg Price',
      key  : 'avgPrice',
      fmt  : (v, inf) => `${v.toFixed(2)} (${(v * (inf.contracts || 0)).toFixed(2)})`,
    },
    { label: 'Mark Price', key: 'markPrice', fmt: (v) => v.toFixed(2) },
    { label: 'Used Bid',   key: 'usedBid',   fmt: (v) => v.toFixed(2) },
    { label: 'Max Size',   key: 'maxSize',   fmt: (v) => v.toFixed(2) },
  ];
  if (!order.some((k) => stages[k]?.optionInfo)) return null;
  return (
    <div className="option-table-wrapper">
      <table className="option-table">
        <thead>
          <tr>
            <th style={{ width: 140 }}></th>
            {order.map((k) => <th key={k}>{stages[k] ? k.toUpperCase() : ''}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map(({ label, key, fmt }) => (
            <tr key={key}>
              <td>{label}</td>
              {order.map((k) => {
                const inf = stages[k]?.optionInfo;
                const val = inf?.[key];

                // Специальная окраска ТОЛЬКО для поля Name по типу опциона
                if (key === 'name' && typeof val === 'string') {
                  const t = getOptionTypeFromName(val); // 'C' | 'P' | null
                  const color =
                    t === 'C' ? '#e74c3c' :
                    t === 'P' ? '#2ecc71' : undefined;
                  return (
                    <td key={k + key}>
                      <span style={{ color }}>{val}</span>
                    </td>
                  );
                }

                return (
                  <td key={k + key}>{val == null ? '-' : fmt ? fmt(val, inf) : val}</td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ─── главный компонент ───────────────────────────────────── */
export default function App() {
  /* heartbeat-таймер */
  const [nowSec, setNowSec] = useState(() => Math.floor(Date.now() / 1000));
  useEffect(() => {
    const id = setInterval(() => setNowSec(Math.floor(Date.now() / 1000)), 60_000);
    return () => clearInterval(id);
  }, []);

  /* Firebase */
  const { data: dashboard, connected: dbConnected } = useFirebaseData('dashboard');

  /* форма настроек */
  const [form, setForm] = useState({
    coin           : DEFAULT_SETTINGS.coin,
    number_candles : String(DEFAULT_SETTINGS.number_candles),
    interv         : String(DEFAULT_SETTINGS.interv),
  });
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const onChange  = (e) => setForm((p) => ({ ...p, [e.target.name]: e.target.value }));
  const onSubmit  = useCallback(
    (e) => {
      e.preventDefault();
      setSettings({
        coin          : normalizeCoin(form.coin),
        number_candles: normalizeLimit(form.number_candles),
        interv        : normalizeInterv(form.interv),
      });
    },
    [form],
  );

  /* чек-боксы видимости линий */
  const [visible, setVisible] = useState({ first: true, second: true });

  /* ---------- stages ---------- */
  const stages = useMemo(() => {
    const res = {}, st = dashboard?.stages || {};
    for (const [k, obj] of Object.entries(st)) {
      if (!obj?.exist || !obj.position?.exist) continue;
      const entry   = obj.position.position_info?.entryPx ?? null;
      const lower   = obj.lower_perc ?? null;
      const upper   = obj.upper_perc ?? null;
      const openUts = toUnixSeconds(obj.position.open_time);
      const h2e     = obj.position.leg?.hours_to_exp ?? null;

      // Имя и тип опциона по правилу «6-й символ с конца»
      const optionName = obj.position.leg?.name || '';
      const optType    = getOptionTypeFromName(optionName); // 'C' | 'P' | null

      let elapsed = 0, total = 0, percent = 0;
      if (openUts && h2e != null) {
        elapsed = Math.max(0, (nowSec - openUts) / 3600);
        total   = elapsed + Number(h2e);
        percent = total > 0 ? Math.min(100, Math.max(0, (elapsed / total) * 100)) : 0;
      }

      res[k] = {
        baseCoin : (obj.base_coin || 'SOL').toUpperCase(),
        entryPx  : entry,
        sl       : entry && lower != null ? entry * (1 - lower) : null,
        tp       : entry && upper != null ? entry * (1 + upper) : null,
        qty      : obj.position.position_info?.size ?? null,
        futPnl   : obj.position.position_info?.unrealizedPnl ?? null,
        optPnl   : obj.position.leg?.info?.unrealisedPnl ?? null,

        optionInfo: {
          name          : optionName,
          contracts     : obj.position.leg?.contracts,
          unrealisedPnl : obj.position.leg?.info?.unrealisedPnl,
          avgPrice      : obj.position.leg?.info?.avgPrice,
          markPrice     : obj.position.leg?.info?.markPrice,
          usedBid       : obj.position.leg?.info?.used_bid,
          maxSize       : obj.position.leg?.info?.max_size,
        },

        // добавляем тип (используется в Chart и для окраски Name)
        optType,

        colors   : STAGE_COLORS[k] || {},
        progress : { elapsed, remaining: h2e, percent },
        openTime : openUts,
      };
    }
    return res;
  }, [dashboard, nowSec]);

  /* ---------- simulation positions ---------- */
  const [simUpdatedAt, setSimUpdatedAt] = useState(null);
  const prevSimJsonRef = useRef(null);
  const simulationPositions = useMemo(() => {
    const sim = dashboard?.stages?.simulation;
    if (!sim) return null;
    const map = {};
    ['position_1', 'position_2', 'position_3'].forEach((k) => {
      const p = sim[k];
      if (!p) return;
      map[k] = {
        symbol      : p.symbol,
        ask         : p.ask,
        askIndicators: p.ask_indicators,
        askOriginal : p.ask_original,
        bestTargBid : p.best_targ_bid,
        lowerPerc   : p.lower_perc,
        maxAmount   : p.max_amount,
        pt          : p.p_t,
        pnl         : p.pnl,
        pnlUpper    : p.pnl_upper,
        strikePerc  : p.strike_perc,
        upperPerc   : p.upper_perc,
        qty         : p.qty,
        pnlLower    : p.pnl_lower,
        iv          : p.iv,
        qFrac       : p.q_frac,
      };
    });
    return Object.keys(map).length ? map : null;
  }, [dashboard]);

  /* --- метаданные симуляции (для вывода рядом с таймером) --- */
  const simMeta = useMemo(() => {
    const sim = dashboard?.stages?.simulation;
    if (!sim) return null;
    return {
      relAtr        : Array.isArray(sim.atr) ? sim.atr[1] : null,
      periodAvgDist : sim.period_avg_dist ?? null,
      periodAvgPnl  : sim.period_avg_pnl ?? null,
      weNeed        : sim.we_need ?? null,
      exp1          : dashboard?.stages?.first?.expect,
      exp2          : dashboard?.stages?.second?.expect,
    };
  }, [dashboard]);

  useEffect(() => {
    const json = simulationPositions ? JSON.stringify(simulationPositions) : null;
    if (json !== prevSimJsonRef.current) {
      prevSimJsonRef.current = json;
      if (simulationPositions) setSimUpdatedAt(Date.now());
    }
  }, [simulationPositions]);

  /* позиции → массив для графиков */
  const chartPositions = useMemo(
    () => Object.entries(stages).map(([k, v]) => ({ key: k, visible: visible[k], ...v })),
    [stages, visible],
  );

  /* группируем по монетам */
  const positionsByCoin = useMemo(() => {
    const m = {};
    chartPositions.forEach((p) => (m[`${p.baseCoin}USDT`] ||= []).push(p));
    return m;
  }, [chartPositions]);

  /* список вкладок */
  const tabCoins = Object.keys(positionsByCoin).length
    ? Object.keys(positionsByCoin)
    : [settings.coin];

  /* суммарные uPnL */
  const totals = useMemo(() => {
    let fut = 0, opt = 0;
    for (const v of Object.values(stages)) {
      fut += Number(v.futPnl || 0);
      opt += Number(v.optPnl || 0);
    }
    return { fut, opt, total: fut + opt };
  }, [stages]);

  /* статус активного графика */
  const [chartStatus, setChartStatus] = useState({
    coin: tabCoins[0],
    wsConnected: false,
    candleCount: 0,
    reconnect: () => {},
  });

  /* -- СИНХРОН С «Coin» ТОЛЬКО ЕСЛИ ФАКТИЧЕСКИ ПОМЕНЯЛСЯ АКТИВНЫЙ ГРАФИК ---- */
  const prevChartCoinRef = useRef(chartStatus.coin);
  useEffect(() => {
    if (
      chartStatus.coin &&
      chartStatus.coin !== form.coin &&
      chartStatus.coin !== prevChartCoinRef.current
    ) {
      setForm((prev) => ({ ...prev, coin: chartStatus.coin }));
    }
    prevChartCoinRef.current = chartStatus.coin;
  }, [chartStatus.coin, form.coin]);

  /* ─── JSX ──────────────────────────────────────────────── */
  return (
    <div className="app-container">
      {/* верхняя панель настроек */}
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
            name="number_candles"
            min="1"
            max="1500"
            value={form.number_candles}
            onChange={onChange}
          />
        </label>
        <label>
          Interval&nbsp;(m)
          <input
            type="number"
            name="interv"
            min="1"
            value={form.interv}
            onChange={onChange}
          />
        </label>
        <label className="checkbox">
          <input
            type="checkbox"
            checked={visible.first}
            onChange={(e) => setVisible((p) => ({ ...p, first: e.target.checked }))}
          />
          first
        </label>
        <label className="checkbox">
          <input
            type="checkbox"
            checked={visible.second}
            onChange={(e) => setVisible((p) => ({ ...p, second: e.target.checked }))}
          />
          second
        </label>
        <button type="submit">Load</button>
      </form>

      {/* контент */}
      <div className="main-content">
        <ChartTabs
          coins={tabCoins}
          number_candles={settings.number_candles}
          interv={settings.interv}
          positionsByCoin={positionsByCoin}
          onStatusChange={setChartStatus}
        />
        <StatsPanel
          stages={{
            first : stages.first  && {
              futPnl: stages.first.futPnl,
              optPnl: stages.first.optPnl,
              total : Number(stages.first.futPnl || 0) + Number(stages.first.optPnl || 0),
            },
            second: stages.second && {
              futPnl: stages.second.futPnl,
              optPnl: stages.second.optPnl,
              total : Number(stages.second.futPnl || 0) + Number(stages.second.optPnl || 0),
            },
          }}
          totals={totals}
        />
      </div>

      {/* прогресс-бары */}
      {['first', 'second'].map((k) => {
        const pr = stages[k]?.progress;
        if (!pr || pr.remaining == null) return null;
        const lbl = `${k}: прошло ${pr.elapsed.toFixed(1)} ч / осталось ${pr.remaining.toFixed(1)} ч`;
        return (
          <div className="progress-wrapper" key={'p' + k}>
            <div className="progress-label">{lbl}</div>
            <div className="progress-bar">
              <div
                className="progress-fill-absolute"
                style={{ width: `${pr.percent}%`, background: stages[k].colors.entry }}
              />
            </div>
          </div>
        );
      })}

      {/* таблица опционов first/second */}
      <OptionTable stages={stages} />

      {/* таблица simulation + таймер + метрики */}
      <SimulationTable
        positions={simulationPositions}
        updatedAt={simUpdatedAt}
        simMeta={simMeta}
      />

      {/* нижняя строка */}
      <div className="status-bar">
        <span>
          Chart&nbsp;WS:&nbsp;
          {chartStatus.wsConnected ? 'Connected' : 'Disconnected'}
          {!chartStatus.wsConnected && (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                try { chartStatus.reconnect?.(); } catch (err) { console.error(err); }
              }}
              title="Reconnect WebSocket now"
              aria-label="Reconnect WebSocket"
              style={{
                marginLeft   : 6,
                padding      : '0 6px',
                background   : '#333',
                color        : '#fff',
                border       : '1px solid #555',
                borderRadius : 3,
                cursor       : 'pointer',
                fontSize     : 12,
                lineHeight   : '14px',
                pointerEvents: 'auto',
              }}
            >
              ↻
            </button>
          )}
        </span>
        <span>DB:&nbsp;{dbConnected ? 'Connected' : 'Disconnected'}</span>
        <span>{`Showing ${chartStatus.candleCount} candles for ${chartStatus.coin} @ ${settings.interv}m`}</span>
      </div>
    </div>
  );
}
