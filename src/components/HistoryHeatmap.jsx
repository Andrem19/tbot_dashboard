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
  const { gridCells, historyMap, selectedStats } = useMemo(() => {
    if (!history || history.length === 0) {
      return { gridCells: [], historyMap: {}, selectedStats: { sum: 0, count: 0 } };
    }

    let minProfit = 0;
    let maxProfit = 0;
    const map = {};

    // 1. Map history & find min timestamp
    let minTs = Infinity;
    history.forEach(item => {
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

    // 2. Рассчитываем понедельник недели, в которой была ПЕРВАЯ сделка
    // Это нужно для мобильной версии, чтобы обрезать пустые недели до старта
    const firstTradeDate = new Date(minTs);
    firstTradeDate.setHours(0,0,0,0);
    const day = firstTradeDate.getDay(); // 0-Sun, 1-Mon...
    // Смещаемся на понедельник (если вс, то -6, иначе день-1)
    const diff = firstTradeDate.getDate() - day + (day === 0 ? -6 : 1);
    const firstTradeWeekMonday = new Date(firstTradeDate);
    firstTradeWeekMonday.setDate(diff);
    firstTradeWeekMonday.setHours(0,0,0,0); // Обнуляем время для корректного сравнения

    // 3. Start Date logic (для ПК всегда начинаем с 1-го числа месяца первой сделки)
    const now = new Date();
    const startDate = new Date(minTs);
    startDate.setDate(1); 
    startDate.setHours(0,0,0,0);
    const endDate = new Date(now);

    const cells = [];
    const current = new Date(startDate);

    // Loop Month by Month
    while (current <= endDate) {
      const monthIndex = current.getMonth();
      
      // Loop Days 1 to 31 (Строка месяца для ПК)
      for (let d = 1; d <= 31; d++) {
        const cellDate = new Date(current.getFullYear(), monthIndex, d);
        const isOverflow = cellDate.getMonth() !== monthIndex; // Февраль 30 и т.д.
        
        // Spacer (пустышка для выравнивания сетки на ПК)
        if (isOverflow) {
          cells.push({
            id: `spacer-${current.getFullYear()}-${monthIndex}-${d}`,
            type: 'spacer',
            dateStr: null
          });
          continue;
        }

        const key = formatDateKey(cellDate);
        const data = map[key];
        const dayOfWeek = cellDate.getDay(); 
        const isWeekend = (dayOfWeek === 0 || dayOfWeek === 6);

        // Флаг: ячейка находится ДО недели старта? (Скрываем на моб)
        const isBeforeStartWeek = cellDate < firstTradeWeekMonday;

        cells.push({
          id: key,
          dateStr: key,
          type: isWeekend ? 'weekend' : 'trading',
          profit: data ? data.profit : 0,
          hasData: !!data,
          color: data ? getColor(data.profit, minProfit, maxProfit) : null,
          isBeforeStartWeek // <--- Новый флаг
        });
      }
      // Move to next month
      current.setMonth(current.getMonth() + 1);
      current.setDate(1);
    }

    // Stats for header
    let sum = 0; 
    let count = 0;
    selectedKeys.forEach(key => {
      if (map[key]) {
        sum += map[key].profit;
        count++;
      }
    });

    return { gridCells: cells, historyMap: map, minP: minProfit, maxP: maxProfit, selectedStats: { sum, count } };
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
       newSet.add(formatDateKey(date));
    }
    setSelectedKeys(newSet);
  };

  const clearSelection = () => setSelectedKeys(new Set());

  if (!gridCells.length) return <div className="heatmap-empty">No History Data</div>;

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
                <span style={{ 
                    color: selectedStats.sum >= 0 ? 'var(--green)' : 'var(--red)',
                    fontWeight: 'bold'
                }}>
                  {selectedStats.sum > 0 ? '+' : ''}{selectedStats.sum.toFixed(2)} $
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
             <button onClick={clearSelection} className="btn-clear">Clear</button>
          )}
        </div>
      </div>

      {/* Grid */}
      <div className="heatmap-grid">
        {gridCells.map((cell) => {
          if (cell.type === 'spacer') {
            return <div key={cell.id} className="heatmap-cell spacer" />;
          }

          const isSelected = selectedKeys.has(cell.dateStr);
          let cellClass = "heatmap-cell";
          if (cell.type === 'weekend') cellClass += " weekend";
          if (cell.isBeforeStartWeek) cellClass += " before-mobile-start"; // CSS скроет это на моб
          if (!cell.hasData) cellClass += " empty";
          if (isSelected) cellClass += " selected";

          return (
            <div
              key={cell.id}
              className={cellClass}
              onClick={() => toggleCell(cell.dateStr)}
              style={{ backgroundColor: cell.hasData ? cell.color : undefined }}
            >
              {cell.hasData && (
                 <>
                   <span className="hm-day-label">{new Date(cell.dateStr).getDate()}</span>
                   <div className="hm-profit-val">
                      {Number(cell.profit).toFixed(2)}
                   </div>
                 </>
              )}
              {!cell.hasData && (
                 <span className="hm-day-number-faded">{new Date(cell.dateStr).getDate()}</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}