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

    // Находим самую раннюю сделку
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

    // 2. Рассчитываем Понедельник недели первой сделки (для скрытия старых дней)
    const firstTradeDate = new Date(minTs);
    const dayOfWeek = firstTradeDate.getDay(); 
    const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    
    const startWeekMonday = new Date(firstTradeDate);
    startWeekMonday.setDate(firstTradeDate.getDate() - diffToMonday);
    startWeekMonday.setHours(0, 0, 0, 0); 

    // 3. Определяем "Сегодня" (для скрытия будущих дней)
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 4. Генерируем сетку
    const startDate = new Date(minTs);
    startDate.setDate(1); 
    startDate.setHours(0, 0, 0, 0);
    
    // endDate берем как "сегодня", но цикл все равно пробежит до 31 числа текущего месяца
    const endDate = new Date(today);
    
    const cells = [];
    const current = new Date(startDate);

    // Loop Month by Month
    while (current <= endDate) {
      const monthIndex = current.getMonth();
      
      // Loop Days 1 to 31
      for (let d = 1; d <= 31; d++) {
        const cellDate = new Date(current.getFullYear(), monthIndex, d);
        const isOverflow = cellDate.getMonth() !== monthIndex; 
        
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
        const dw = cellDate.getDay(); 
        const isWeekend = (dw === 0 || dw === 6);
        
        // Устанавливаем время в 0 для корректного сравнения
        cellDate.setHours(0, 0, 0, 0);

        // ЛОГИКА СКРЫТИЯ:
        // 1. Скрываем если это старое (до недели первого трейда)
        const isBeforeStart = cellDate.getTime() < startWeekMonday.getTime();
        // 2. Скрываем если это будущее (больше чем сегодня)
        const isFuture = cellDate.getTime() > today.getTime();

        const hideOnMobile = isBeforeStart || isFuture;

        cells.push({
          id: key,
          dateStr: key,
          type: isWeekend ? 'weekend' : 'trading',
          profit: data ? data.profit : 0,
          hasData: !!data,
          color: data ? getColor(data.profit, minProfit, maxProfit) : null,
          isHiddenOnMobile: hideOnMobile // <--- Теперь скрывает и старое, и будущее
        });
      }
      
      current.setMonth(current.getMonth() + 1);
      current.setDate(1);
    }

    // Stats
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
       // Не выделяем будущее в "Select Month"
       if (date > today) break; 
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
          // Этот класс уже имеет display: none !important в CSS для мобилок
          if (cell.isHiddenOnMobile) cellClass += " hidden-mobile"; 
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
                      {Math.floor(cell.profit)}
                   </div>
                 </>
              )}
              {/* Дата показывается, только если есть данные ИЛИ если это не мобильный режим */}
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