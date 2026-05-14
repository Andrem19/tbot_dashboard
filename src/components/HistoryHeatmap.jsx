import React, { useMemo, useState } from 'react';

/* --- Helpers --- */
function getColor(profit, minP, maxP) {
  if (profit === 0) return 'var(--bg-input)';
  if (profit > 0) {
    const ratio = maxP > 0 ? Math.min(1, profit / maxP) : 0;
    const opacity = 0.4 + (0.6 * ratio);
    return `rgba(38, 166, 154, ${opacity})`;
  } else {
    const ratio = minP < 0 ? Math.min(1, profit / minP) : 0;
    const opacity = 0.4 + (0.6 * ratio);
    return `rgba(239, 83, 80, ${opacity})`;
  }
}

function formatDateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatDateTime(value) {
  if (!Number.isFinite(Number(value))) return 'N/A';
  const date = new Date(Number(value) * 1000);
  if (Number.isNaN(date.getTime())) return 'N/A';
  return date.toLocaleString();
}

function formatValue(key, value) {
  if (value == null || value === '') return 'N/A';

  if (key === 'timestamp_open' || key === 'close_time') {
    return formatDateTime(value);
  }

  if (typeof value === 'number') {
    if (key === 'side') return String(value);
    if (Number.isInteger(value)) return String(value);
    return value.toFixed(4);
  }

  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return String(value);
}

function getDisplayPnl(item) {
  const posState = Number(item?.pos_exist);
  if (posState === 1 || posState === 2) {
    return Number(item?.current_pnl) || 0;
  }
  return Number(item?.profit) || 0;
}

const DETAIL_FIELD_ORDER = [
  'symbol',
  'side',
  'profit',
  'type_of_close',
  'amount_usdt',
  'qty',
  'open_price',
  'close_price',
  'sl_price',
  'tp_price',
  'duration_min',
  'timestamp_open',
  'close_time',
  'current_pnl',
  'pos_exist',
];

export default function HistoryHeatmap({ history = [] }) {
  const [selectedKeys, setSelectedKeys] = useState(new Set());
  const [activeKey, setActiveKey] = useState(null);

  const { weeklyCells, monthlyCells, historyMap, selectedStats } = useMemo(() => {
    if (!history || history.length === 0) {
      return {
        weeklyCells: [],
        monthlyCells: [],
        historyMap: {},
        selectedStats: { sum: 0, count: 0, trades: 0 },
      };
    }

    let minProfit = 0;
    let maxProfit = 0;
    const map = {};

    let minTs = Infinity;

    history.forEach((item) => {
      const displayPnl = getDisplayPnl(item);

      if (displayPnl < minProfit) minProfit = displayPnl;
      if (displayPnl > maxProfit) maxProfit = displayPnl;

      const ts = item.timestamp_open * 1000;
      if (ts < minTs) minTs = ts;

      const date = new Date(ts);
      const key = formatDateKey(date);

      const sideVal = Number.isFinite(item.side) ? item.side : null;

      if (map[key]) {
        map[key].profit += displayPnl;
        map[key].count += 1;
        map[key].items.push(item);
        if (sideVal != null) map[key].sides.push(sideVal);
      } else {
        map[key] = {
          dateKey: key,
          profit: displayPnl,
          count: 1,
          items: [item],
          sides: sideVal != null ? [sideVal] : [],
        };
      }
    });

    // Понедельник недели первой сделки
    const firstTradeDate = new Date(minTs);
    const dayOfWeek = firstTradeDate.getDay(); // 0=Sun..6=Sat
    const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

    const startWeekMonday = new Date(firstTradeDate);
    startWeekMonday.setDate(firstTradeDate.getDate() - diffToMonday);
    startWeekMonday.setHours(0, 0, 0, 0);

    // Сегодня
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // ============================
    // A) WEEKLY GRID (MOBILE)
    // ============================
    const endWeekSunday = new Date(today);
    const dowMon0 = (endWeekSunday.getDay() + 6) % 7; // Mon=0..Sun=6
    endWeekSunday.setDate(endWeekSunday.getDate() + (6 - dowMon0));
    endWeekSunday.setHours(0, 0, 0, 0);

    const weekly = [];
    const curW = new Date(startWeekMonday);

    while (curW <= endWeekSunday) {
      const key = formatDateKey(curW);
      const data = map[key];

      const dw = curW.getDay();
      const isWeekend = dw === 0 || dw === 6;
      const isFuture = curW.getTime() > today.getTime();

      weekly.push({
        id: `w-${key}`,
        dateStr: key,
        dayNum: curW.getDate(),
        type: isWeekend ? 'weekend' : 'trading',
        profit: data ? data.profit : 0,
        side: data ? data.sides.join(',') : null,
        count: data ? data.count : 0,
        hasData: !!data,
        color: data ? getColor(data.profit, minProfit, maxProfit) : null,
        isDisabled: isFuture,
      });

      curW.setDate(curW.getDate() + 1);
      curW.setHours(0, 0, 0, 0);
    }

    // ============================
    // B) MONTHLY GRID (DESKTOP)
    // ============================
    const startDate = new Date(minTs);
    startDate.setDate(1);
    startDate.setHours(0, 0, 0, 0);

    const endDate = new Date(today);

    const monthly = [];
    const current = new Date(startDate);

    while (current <= endDate) {
      const monthIndex = current.getMonth();

      for (let d = 1; d <= 31; d++) {
        const cellDate = new Date(current.getFullYear(), monthIndex, d);
        const isOverflow = cellDate.getMonth() !== monthIndex;

        if (isOverflow) {
          monthly.push({
            id: `spacer-${current.getFullYear()}-${monthIndex}-${d}`,
            type: 'spacer',
            dateStr: null,
            dayNum: null,
          });
          continue;
        }

        const key = formatDateKey(cellDate);
        const data = map[key];

        const dw = cellDate.getDay();
        const isWeekend = dw === 0 || dw === 6;

        cellDate.setHours(0, 0, 0, 0);

        const isBeforeStart = cellDate.getTime() < startWeekMonday.getTime();
        const isFuture = cellDate.getTime() > today.getTime();
        const hideOnMobile = isBeforeStart || isFuture;

        monthly.push({
          id: key,
          dateStr: key,
          dayNum: cellDate.getDate(),
          type: isWeekend ? 'weekend' : 'trading',
          profit: data ? data.profit : 0,
          side: data ? data.sides.join(',') : null,
          count: data ? data.count : 0,
          hasData: !!data,
          color: data ? getColor(data.profit, minProfit, maxProfit) : null,
          isHiddenOnMobile: hideOnMobile,
        });
      }

      current.setMonth(current.getMonth() + 1);
      current.setDate(1);
    }

    // Stats
    let sum = 0;
    let count = 0;
    let trades = 0;
    selectedKeys.forEach((key) => {
      if (map[key]) {
        sum += map[key].profit;
        count++;
        trades += map[key].count;
      }
    });

    return {
      weeklyCells: weekly,
      monthlyCells: monthly,
      historyMap: map,
      selectedStats: { sum, count, trades },
    };
  }, [history, selectedKeys]);

  /* --- Handlers --- */
  const toggleCell = (key) => {
    if (!key) return;
    const newSet = new Set(selectedKeys);
    if (newSet.has(key)) newSet.delete(key);
    else newSet.add(key);
    setSelectedKeys(newSet);
  };

  const openDayDetails = (key) => {
    setActiveKey(prev => (prev === key ? null : key));
  };

  const selectLastWeek = () => {
    const newSet = new Set();
    const today = new Date();
    for (let i = 0; i < 7; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      newSet.add(formatDateKey(d));
    }
    setSelectedKeys(newSet);
  };

  const selectCurrentMonth = () => {
    const newSet = new Set();
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth();
    for (let d = 1; d <= 31; d++) {
      const date = new Date(year, month, d);
      if (date.getMonth() !== month) break;
      if (date > today) break;
      newSet.add(formatDateKey(date));
    }
    setSelectedKeys(newSet);
  };

  const clearSelection = () => setSelectedKeys(new Set());

  if (!monthlyCells.length && !weeklyCells.length) {
    return <div className="heatmap-empty">No History Data</div>;
  }

  const activeDay = activeKey ? historyMap[activeKey] : null;

  const renderCells = (cells) =>
    cells.map((cell) => {
      if (cell.type === 'spacer') {
        return <div key={cell.id} className="heatmap-cell spacer" />;
      }

      const isSelected = selectedKeys.has(cell.dateStr);
      let cellClass = 'heatmap-cell';

      if (cell.type === 'weekend') cellClass += ' weekend';
      if (cell.isHiddenOnMobile) cellClass += ' hidden-mobile';
      if (!cell.hasData) cellClass += ' empty';
      if (isSelected) cellClass += ' selected';
      if (cell.isDisabled) cellClass += ' disabled';

      return (
        <div
          key={cell.id}
          className={cellClass}
          onClick={() => {
            if (!cell.isDisabled) {
              toggleCell(cell.dateStr);
              openDayDetails(cell.dateStr);
            }
          }}
          style={{ backgroundColor: cell.hasData ? cell.color : undefined }}
        >
          {cell.hasData && (
            <>
              <span className="hm-day-label">{cell.dayNum}</span>

              <span className="hm-side-label">{cell.side}</span>
              {cell.count > 1 && <span className="hm-count-badge">x{cell.count}</span>}

              <div className="hm-profit-val">
                {cell.profit > 0 ? '+' : ''}
                {Number(cell.profit).toFixed(2)}
              </div>
            </>
          )}

          {!cell.hasData && cell.dayNum != null && (
            <span className="hm-day-number-faded">{cell.dayNum}</span>
          )}
        </div>
      );
    });

  return (
    <div className="heatmap-container">
      {/* Header */}
      <div className="heatmap-header">
        <div className="hm-title-section">
          <h3 className="panel-title">Trading History</h3>
          {selectedKeys.size > 0 ? (
            <div className="hm-stats-box">
              <span>Sel: {selectedKeys.size}d</span>
              <span className="sep">|</span>
              <span>{selectedStats.trades}t</span>
              <span className="sep">|</span>
              <span
                style={{
                  color: selectedStats.sum >= 0 ? 'var(--green)' : 'var(--red)',
                  fontWeight: 'bold',
                }}
              >
                {selectedStats.sum > 0 ? '+' : ''}
                {selectedStats.sum.toFixed(2)} $
              </span>
            </div>
          ) : (
            <span className="hm-hint">Select cells for stats</span>
          )}
        </div>
        <div className="hm-actions">
          <button onClick={selectLastWeek}>Last Week</button>
          <button onClick={selectCurrentMonth}>Month</button>
          {selectedKeys.size > 0 && (
            <button onClick={clearSelection} className="btn-clear">
              Clear
            </button>
          )}
        </div>
      </div>

      {/* MOBILE: Weekly (Пн–Вс) */}
      <div className="heatmap-grid weekly">{renderCells(weeklyCells)}</div>

      {/* DESKTOP: Monthly (как было) */}
      <div className="heatmap-grid monthly">{renderCells(monthlyCells)}</div>

      {activeDay && (
        <div className="hm-details-panel">
          <div className="hm-details-header">
            <div>
              <div className="hm-details-title">{activeDay.dateKey}</div>
              <div className="hm-details-summary">
                <span>{activeDay.count} trades</span>
                <span className="sep">|</span>
                <span>signals: {activeDay.sides.join(',') || 'N/A'}</span>
                <span className="sep">|</span>
                <span style={{ color: activeDay.profit >= 0 ? 'var(--green)' : 'var(--red)' }}>
                  {activeDay.profit > 0 ? '+' : ''}
                  {activeDay.profit.toFixed(2)} $
                </span>
              </div>
            </div>
            <button type="button" className="hm-details-close" onClick={() => setActiveKey(null)}>
              Close
            </button>
          </div>

          <div className="hm-details-list">
            {activeDay.items.map((item, index) => {
              const fieldNames = [
                ...DETAIL_FIELD_ORDER.filter((field) => field in item),
                ...Object.keys(item).filter((field) => !DETAIL_FIELD_ORDER.includes(field)),
              ];

              return (
                <div key={`${activeDay.dateKey}-${index}`} className="hm-trade-card">
                  <div className="hm-trade-card-header">
                    <span>Trade #{index + 1}</span>
                    <span
                      style={{
                        color: getDisplayPnl(item) >= 0 ? 'var(--green)' : 'var(--red)',
                      }}
                    >
                      {getDisplayPnl(item) > 0 ? '+' : ''}
                      {getDisplayPnl(item).toFixed(4)} $
                    </span>
                  </div>

                  <div className="hm-trade-grid">
                    {fieldNames.map((field) => (
                      <div key={field} className="hm-trade-field">
                        <span className="hm-trade-key">{field}</span>
                        <span className="hm-trade-value">{formatValue(field, item[field])}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
