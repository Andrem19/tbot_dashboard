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

export default function HistoryHeatmap({ history = [] }) {
  const [selectedKeys, setSelectedKeys] = useState(new Set());

  // 1. Prepare Data Grid
  const { weeklyCells, monthlyCells, historyMap, selectedStats } = useMemo(() => {
    if (!history || history.length === 0) {
      return {
        weeklyCells: [],
        monthlyCells: [],
        historyMap: {},
        selectedStats: { sum: 0, count: 0 },
      };
    }

    let minProfit = 0;
    let maxProfit = 0;
    const map = {};

    // Находим самую раннюю сделку
    let minTs = Infinity;

    history.forEach((item) => {
      if (item.profit < minProfit) minProfit = item.profit;
      if (item.profit > maxProfit) maxProfit = item.profit;

      const ts = item.timestamp_open * 1000;
      if (ts < minTs) minTs = ts;

      const date = new Date(ts);
      const key = formatDateKey(date);

      if (map[key]) {
        map[key].profit += item.profit;
        map[key].count = (map[key].count || 1) + 1;
      } else {
        map[key] = { ...item, count: 1 };
      }
    });

    // 2. Рассчитываем Понедельник недели первой сделки
    const firstTradeDate = new Date(minTs);
    const dayOfWeek = firstTradeDate.getDay(); // 0=Sun..6=Sat
    const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

    const startWeekMonday = new Date(firstTradeDate);
    startWeekMonday.setDate(firstTradeDate.getDate() - diffToMonday);
    startWeekMonday.setHours(0, 0, 0, 0);

    // 3. "Сегодня"
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // ============================
    // A) WEEKLY GRID (MOBILE): Пн–Вс, одна строка = одна неделя
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

      const dw = curW.getDay(); // 0=Sun..6=Sat
      const isWeekend = dw === 0 || dw === 6;
      const isFuture = curW.getTime() > today.getTime();

      weekly.push({
        id: `w-${key}`,
        dateStr: key,
        dayNum: curW.getDate(),
        type: isWeekend ? 'weekend' : 'trading',
        profit: data ? data.profit : 0,
        hasData: !!data,
        color: data ? getColor(data.profit, minProfit, maxProfit) : null,
        isDisabled: isFuture, // чтобы неделя была 7 клеток, но будущее нельзя кликать
      });

      curW.setDate(curW.getDate() + 1);
      curW.setHours(0, 0, 0, 0);
    }

    // ============================
    // B) MONTHLY GRID (DESKTOP): как было (1..31, spacer, weekend)
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
    selectedKeys.forEach((key) => {
      if (map[key]) {
        sum += map[key].profit;
        count++;
      }
    });

    return {
      weeklyCells: weekly,
      monthlyCells: monthly,
      historyMap: map,
      selectedStats: { sum, count },
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
            if (!cell.isDisabled) toggleCell(cell.dateStr);
          }}
          style={{ backgroundColor: cell.hasData ? cell.color : undefined }}
        >
          {cell.hasData && (
            <>
              <span className="hm-day-label">{cell.dayNum}</span>
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
    </div>
  );
}
