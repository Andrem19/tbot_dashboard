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
  
  // 1. Текущая позиция (pos)
  // Превращаем её в массив для Chart, если pos_exist === 1
  const chartPositions = useMemo(() => {
    const p = dashb?.pos;
    if (!p || !p.pos_exist) return []; // Если позиции нет или pos_exist=0

    return [{
      key: 'CurrentPos',
      visible: true,
      baseCoin: p.symbol, // Для группировки по вкладкам
      entryPx: p.open_price,
      sl: p.sl_price,
      tp: p.tp_price,
      openTime: p.timestamp_open,
      qty: p.qty,
      // Доп поля
      pnl: p.current_pnl,
      side: p.side
    }];
  }, [dashb]);

  // Группировка для ChartTabs (хотя у нас одна монета, структура требует)
  const positionsByCoin = useMemo(() => {
    const m = {};
    chartPositions.forEach(p => {
      // Если символ приходит без USDT (редко), добавляем, но обычно в базе 'BTCUSDT'
      const sym = p.baseCoin || settings.coin;
      if (!m[sym]) m[sym] = [];
      m[sym].push(p);
    });
    return m;
  }, [chartPositions, settings.coin]);

  // 2. Report (словарь)
  const reportData = dashb?.report || null;

  // 3. History (массив)
  const historyData = dashb?.hist || [];

  // 4. Текущий PnL для отображения в заголовке или статус баре
  const currentPnl = dashb?.pos?.pos_exist ? dashb.pos.current_pnl : null;

  /* --- Состояние чарта (для отображения внизу) --- */
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
        
        {/* Отображаем текущий PnL прямо в хедере, если есть позиция */}
        {currentPnl != null && (
           <div className="header-pnl" style={{ marginLeft: 'auto', color: currentPnl >= 0 ? '#2ecc71' : '#e74c3c' }}>
             Active PnL: {currentPnl.toFixed(4)}
           </div>
        )}
      </form>

      {/* Компактный отчет (Report) */}
      <ReportStrip report={reportData} />

      <div className="main-content">
        {/* Основной график */}
        <ChartTabs
          coins={[settings.coin]} // Или Object.keys(positionsByCoin) если хотим авто-вкладки
          number_candles={settings.number_candles}
          interv={settings.interv}
          positionsByCoin={positionsByCoin}
          onStatusChange={setChartStatus}
        />
      </div>

      {/* Тепловая карта (Hist) под графиком */}
      <HistoryHeatmap history={historyData} />

      {/* Статус бар (подвал) */}
      <div className="status-bar">
        <span>WS: {chartStatus.wsConnected ? 'Connected' : 'Disconnected'}</span>
        <span>DB: {dbConnected ? 'Connected' : 'Disc.'}</span>
        {chartStatus.wsConnected ? (
             <span className="ws-ok">●</span>
        ) : (
            <button onClick={() => chartStatus.reconnect?.()}>↻ Reconnect WS</button>
        )}
      </div>
    </div>
  );
}