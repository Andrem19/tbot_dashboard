import { useCallback, useMemo, useRef, useState, useEffect } from 'react';
import Chart from './components/Chart.jsx';
import StatsPanel from './components/StatsPanel.jsx';
import { useBinanceKlines, useFirebaseData } from './hooks';
import './App.css';

/* ---------- утилиты ---------- */
function toUnixSeconds(str) {
  if (!str || typeof str !== 'string') return null;
  const m = str.match(
    /^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2}):(\d{2})(?:\.(\d{3,6}))?/
  );
  if (!m) return null;
  const [, y, mo, d, h, mi, s, msRaw = '000'] = m;
  const ms = Number(msRaw.slice(0, 3));
  const ts = Date.UTC(+y, +mo - 1, +d, +h, +mi, +s, ms);
  return Math.floor(ts / 1000);
}

const DEFAULT_SETTINGS = {
  coin: 'SOLUSDT',
  number_candles: 48,
  interv: 60,
};

// Допустимые интервалы Binance в минутах
const ALLOWED_MINUTES = [
  1, 3, 5, 15, 30, 60, 120, 240, 360, 480, 720, 1440, 4320, 10080, 43200,
];

function normalizeCoin(input) {
  const v = (input || '').toString().trim().toUpperCase();
  return v || DEFAULT_SETTINGS.coin;
}
function normalizeLimit(input) {
  const n = Math.floor(Number(input));
  if (!Number.isFinite(n)) return DEFAULT_SETTINGS.number_candles;
  return Math.min(1500, Math.max(1, n));
}
function normalizeInterv(input) {
  const n = Math.floor(Number(input));
  if (!Number.isFinite(n)) return DEFAULT_SETTINGS.interv;
  if (ALLOWED_MINUTES.includes(n)) return n;
  // выбираем ближайший допустимый
  let best = ALLOWED_MINUTES[0];
  let bestDiff = Math.abs(n - best);
  for (const m of ALLOWED_MINUTES) {
    const d = Math.abs(n - m);
    if (d < bestDiff) { best = m; bestDiff = d; }
  }
  return best;
}

function deriveSpotSymbol(optionSymbol) {
  if (!optionSymbol || typeof optionSymbol !== 'string') return null;
  const parts = optionSymbol.split('-');
  if (parts.length >= 2) {
    const base = parts[0];
    const quote = parts[parts.length - 1];
    if (base && quote) return (base + quote).toUpperCase();
  }
  return null;
}

/* ---------- компонент приложения ---------- */
export default function App() {
  const { data: realtimeData, connected: dbConnected } = useFirebaseData('dashboard');

  const [nowSec, setNowSec] = useState(() => Math.floor(Date.now() / 1000));
  useEffect(() => {
    const id = setInterval(() => setNowSec(Math.floor(Date.now() / 1000)), 60_000);
    return () => clearInterval(id);
  }, []);

  // form — строки для удобства контролируемых инпутов
  const [form, setForm] = useState(() => ({
    coin: DEFAULT_SETTINGS.coin,
    number_candles: String(DEFAULT_SETTINGS.number_candles),
    interv: String(DEFAULT_SETTINGS.interv),
  }));

  // settings — валидированные значения, которыми питается загрузчик/WS
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);

  const {
    candles,
    loading,
    wsConnected: klinesConnected,
  } = useBinanceKlines(settings);

  /* ---------- авто‑определение пары по опциону ---------- */
  const autoAppliedRef = useRef(false);
  useEffect(() => {
    if (!realtimeData?.state?.position_1?.long_leg?.info?.symbol) return;
    if (autoAppliedRef.current) return;
    const autoCoin = deriveSpotSymbol(realtimeData.state.position_1.long_leg.info.symbol);
    if (autoCoin) {
      autoAppliedRef.current = true;
      // в форму кладём строки
      const formVals = { coin: autoCoin, number_candles: String(48), interv: String(60) };
      setForm(formVals);
      // в настройки — числа
      setSettings({ coin: autoCoin, number_candles: 48, interv: 60 });
    }
  }, [realtimeData]);

  /* ---------- форма ---------- */
  const onChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: name === 'coin' ? value.toUpperCase() : value,
    }));
  };

  const onSubmit = useCallback(
    (e) => {
      e.preventDefault();
      const next = {
        coin: normalizeCoin(form.coin),
        number_candles: normalizeLimit(form.number_candles),
        interv: normalizeInterv(form.interv),
      };
      setForm({
        coin: next.coin,
        number_candles: String(next.number_candles),
        interv: String(next.interv),
      });
      setSettings(next);
    },
    [form]
  );

  /* ---------- расчёт derived‑данных ---------- */
  const parsed = useMemo(() => {
    if (!realtimeData) return null;

    const positionExists = realtimeData?.state?.position_1?.exist === true;
    if (!positionExists) {
      return { positionExists: false };
    }

    const entryPx =
      realtimeData?.state?.position_1?.position_info?.entryPx ?? null;

    const openTimeRaw = realtimeData?.state?.position_1?.open_time;
    const openTime = toUnixSeconds(openTimeRaw);

    const hoursToExp = realtimeData?.state?.position_1?.hours_to_exp ?? null;

    const lowerPerc = realtimeData?.params?.lower_perc;
    const upperPerc = realtimeData?.params?.upper_perc;

    const sl = entryPx && lowerPerc != null ? entryPx * (1 - lowerPerc) : null;
    const tp = entryPx && upperPerc != null ? entryPx * (1 + upperPerc) : null;

    const qty = realtimeData?.state?.position_1?.position_info?.size;

    const longLeg = realtimeData?.state?.position_1?.long_leg;
    const optionInfo = {
      name: longLeg?.name,
      contracts: longLeg?.contracts,
      unrealisedPnl: longLeg?.info?.unrealisedPnl,
      avgPrice: longLeg?.info?.avgPrice,
      markPrice: longLeg?.info?.markPrice,
      usedBid: longLeg?.info?.used_bid,
      symbol: longLeg?.info?.symbol,
    };

    const futPnl =
      realtimeData?.state?.position_1?.position_info?.unrealizedPnl ?? null;
    const optPnl = optionInfo.unrealisedPnl ?? null;

    const totalPnl =
      (futPnl ? Number(futPnl) : 0) + (optPnl ? Number(optPnl) : 0);

    let elapsedHours = 0;
    let totalHours = 0;
    let percentDone = 0;

    if (openTime && hoursToExp != null) {
      elapsedHours = Math.max(0, (nowSec - openTime) / 3600);
      totalHours = elapsedHours + Number(hoursToExp);
      percentDone = totalHours > 0 ? (elapsedHours / totalHours) * 100 : 0;
      percentDone = Math.min(100, Math.max(0, percentDone));
    }

    return {
      positionExists,
      entryPx,
      qty,
      sl,
      tp,
      openTime,
      hoursToExp,
      optionInfo,
      futPnl,
      optPnl,
      totalPnl,
      elapsedHours,
      totalHours,
      percentDone,
    };
  }, [realtimeData, nowSec]);

  const progressText =
    parsed?.positionExists && parsed?.hoursToExp != null
      ? `Прошло ${parsed.elapsedHours.toFixed(1)} ч / Осталось ${Number(
          parsed.hoursToExp
        ).toFixed(1)} ч`
      : '';

  /* ---------- render ---------- */
  return (
    <div className="app-container">
      {/* ── ФОРМА ─────────────────────────────────────────── */}
      <form className="form-row" onSubmit={onSubmit}>
        <label>
          Coin (symbol):
          <input
            name="coin"
            value={form.coin}
            placeholder="BTCUSDT"
            onChange={onChange}
            autoComplete="off"
            spellCheck="false"
          />
        </label>

        <label>
          Number candles:
          <input
            type="number"
            name="number_candles"
            min={1}
            max={1500}
            value={form.number_candles}
            onChange={onChange}
          />
        </label>

        <label>
          Interval (minutes):
          <input
            type="number"
            name="interv"
            min={1}
            step={1}
            value={form.interv}
            onChange={onChange}
          />
        </label>

        <button type="submit">Load</button>
      </form>

      {/* ── ГЛАВНЫЙ БЛОК ──────────────────────────────────── */}
      <div className="main-content">
        <div className="chart-wrapper">
          {loading && <div style={{ padding: 8, fontSize: 14 }}>Loading candles...</div>}
          {!loading && candles.length === 0 && (
            <div style={{ padding: 8, fontSize: 14 }}>No data.</div>
          )}
          {!loading && candles.length > 0 && (
            <Chart
              candles={candles}
              entryPx={parsed?.entryPx}
              sl={parsed?.sl}
              tp={parsed?.tp}
              openTime={parsed?.openTime}
              showExtras={parsed?.positionExists}
              qty={parsed?.qty}
            />
          )}
        </div>

        <StatsPanel
          futPnl={parsed?.futPnl}
          optPnl={parsed?.optPnl}
          totalPnl={parsed?.totalPnl}
          positionExists={parsed?.positionExists}
        />
      </div>

      {/* ── ПРОГРЕСС & ТАБЛИЦА ─────────────────────────────── */}
      {parsed?.positionExists && parsed?.hoursToExp != null && (
        <div className="progress-wrapper">
          <div className="progress-label">{progressText}</div>
          <div className="progress-bar">
            <div
              className="progress-fill-absolute"
              style={{ width: `${parsed.percentDone}%` }}
            />
          </div>
        </div>
      )}

      {parsed?.positionExists && parsed?.optionInfo?.name && (
        <div className="option-table-wrapper">
          <table className="option-table">
            <tbody>
              <tr>
                <td>Name</td>
                <td>{parsed.optionInfo.name}</td>
              </tr>
              <tr>
                <td>Contracts</td>
                <td>{parsed.optionInfo.contracts}</td>
              </tr>
              <tr>
                <td>Unrealised PnL</td>
                <td>{Number(parsed.optionInfo.unrealisedPnl).toFixed(2)}</td>
              </tr>
              <tr>
                <td>Avg Price</td>
                <td>
                  {Number(parsed.optionInfo.avgPrice).toFixed(2)} (
                  {Number(parsed.optionInfo.avgPrice * parsed.optionInfo.contracts).toFixed(2)})
                </td>
              </tr>
              <tr>
                <td>Mark Price</td>
                <td>{Number(parsed.optionInfo.markPrice).toFixed(2)}</td>
              </tr>
              <tr>
                <td>Used Bid</td>
                <td>{Number(parsed.optionInfo.usedBid).toFixed(2)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* ── СТАТУСНАЯ СТРОКА ──────────────────────────────── */}
      <div className="status-bar">
        <span>Chart&nbsp;WS:&nbsp;{klinesConnected ? 'Connected' : 'Disconnected'}</span>
        <span>DB:&nbsp;{dbConnected ? 'Connected' : 'Disconnected'}</span>
        <span>
          Showing {candles.length} candles for {settings.coin} @ {settings.interv}m
        </span>
      </div>
    </div>
  );
}
