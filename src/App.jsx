import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ChartTabs from './components/ChartTabs.jsx';
import ReportStrip from './components/ReportStrip.jsx';
import HistoryHeatmap from './components/HistoryHeatmap.jsx';
import { useFirebaseData } from './hooks';
import './App.css';

/* === НАСТРОЙКИ ПО УМОЛЧАНИЮ === */
const DEFAULT_SETTINGS = { coin: 'BTCUSDT', number_candles: 100, interv: 60 };

export default function App() {
  /* --- Firebase: читаем путь 'dashb' --- */
  const { data: dashb, connected: dbConnected } = useFirebaseData('dashb');

  /* --- Состояние формы (Settings) --- */
  const [form, setForm] = useState({
    coin: DEFAULT_SETTINGS.coin,
    number_candles: String(DEFAULT_SETTINGS.number_candles),
    interv: String(DEFAULT_SETTINGS.interv),
  });
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);

  /* --- ТАЙМЕР ОБНОВЛЕНИЯ (Новая логика) --- */
  const [secondsAgo, setSecondsAgo] = useState(0);

  // 1. Тикаем каждую секунду
  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsAgo(prev => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // 2. Сбрасываем таймер, когда приходят новые данные по позиции
  useEffect(() => {
    setSecondsAgo(0);
  }, [dashb?.pos]); // Зависимость от объекта позиции

  /* --- Обработчики формы --- */
  const onChange = (e) => setForm(p => ({ ...p, [e.target.name]: e.target.value }));
  
  const onSubmit = useCallback((e) => {
    e.preventDefault();
    setSettings({
      coin: (form.coin || 'BTCUSDT').toUpperCase(),
      number_candles: Number(form.number_candles) || 100,
      interv: Number(form.interv) || 60,
    });
  }, [form]);

  /* --- Разбор данных из DB --- */
  const chartPositions = useMemo(() => {
    const p = dashb?.pos;
    if (!p || !p.pos_exist) return []; 
    return [{
      key: 'CurrentPos',
      visible: true,
      baseCoin: p.symbol,
      entryPx: p.open_price,
      sl: p.sl_price,
      tp: p.tp_price,
      openTime: p.timestamp_open,
      qty: p.qty,
      pnl: p.current_pnl,
      side: p.side
    }];
  }, [dashb]);

  const positionsByCoin = useMemo(() => {
    const m = {};
    chartPositions.forEach(p => {
      const sym = p.baseCoin || settings.coin;
      if (!m[sym]) m[sym] = [];
      m[sym].push(p);
    });
    return m;
  }, [chartPositions, settings.coin]);

  const reportData = dashb?.report || null;
  const historyData = dashb?.hist || [];
  const currentPnl = dashb?.pos?.pos_exist ? dashb.pos.current_pnl : null;

  /* --- Состояние чарта --- */
  const [chartStatus, setChartStatus] = useState({
    coin: settings.coin,
    wsConnected: false,
    candleCount: 0,
    reconnect: () => {},
  });

  return (
    <div className="app-container">
      {/* Верхняя панель настроек */}
      <form className="form-row" onSubmit={onSubmit}>
        <label>Coin <input name="coin" value={form.coin} onChange={onChange} /></label>
        <label>Candles <input type="number" name="number_candles" value={form.number_candles} onChange={onChange} /></label>
        <label>Interval (m) <input type="number" name="interv" value={form.interv} onChange={onChange} /></label>
        <button type="submit">Load</button>
        
        {/* PnL + Таймер */}
        {currentPnl != null && (
           <div className="header-pnl" style={{ color: currentPnl >= 0 ? 'var(--green)' : 'var(--red)' }}>
             <span style={{ marginRight: '6px' }}>PnL: {currentPnl.toFixed(4)}</span>
             
             {/* Маленький таймер обновления */}
             <span style={{ 
               fontSize: '10px', 
               color: '#787b86', // Серый цвет (вторичный текст)
               fontFamily: 'monospace',
               border: '1px solid #363c4e',
               padding: '1px 4px',
               borderRadius: '3px',
               minWidth: '24px',
               display: 'inline-block',
               textAlign: 'center'
             }}>
               {secondsAgo}s
             </span>
           </div>
        )}
      </form>

      <div className="main-content">
        <ChartTabs
          coins={[settings.coin]}
          number_candles={settings.number_candles}
          interv={settings.interv}
          positionsByCoin={positionsByCoin}
          history={historyData}
          onStatusChange={setChartStatus}
        />
      </div>

      <ReportStrip report={reportData} />
      <HistoryHeatmap history={historyData} />

      <div className="status-bar">
        <div style={{ display: 'flex', gap: '10px' }}>
            <span>WS: {chartStatus.wsConnected ? <span style={{color:'var(--green)'}}>Connected</span> : 'Disconnected'}</span>
            <span>DB: {dbConnected ? <span style={{color:'var(--green)'}}>ON</span> : 'OFF'}</span>
        </div>
        {!chartStatus.wsConnected && (
             <button onClick={() => chartStatus.reconnect?.()}>↻ Reconnect WS</button>
        )}
      </div>
    </div>
  );
}