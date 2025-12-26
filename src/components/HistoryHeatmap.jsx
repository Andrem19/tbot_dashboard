import React, { useMemo, useState, useCallback } from 'react';

/* --- Helpers --- */

// Color logic
function getColor(profit, minP, maxP) {
  if (profit === 0) return 'var(--bg-input)'; // Neutral background for 0
  if (profit > 0) {
    const ratio = maxP > 0 ? Math.min(1, profit / maxP) : 0;
    const opacity = 0.4 + (0.6 * ratio);
    return `rgba(38, 166, 154, ${opacity})`; // Green
  } else {
    const ratio = minP < 0 ? Math.min(1, profit / minP) : 0;
    const opacity = 0.4 + (0.6 * ratio);
    return `rgba(239, 83, 80, ${opacity})`; // Red
  }
}

function formatDateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export default function HistoryHeatmap({ history = [] }) {
  // Use a Set for multiple selection
  const [selectedKeys, setSelectedKeys] = useState(new Set());

  // 1. Prepare Data Grid (Full Months 1-31)
  const { gridCells, historyMap, minP, maxP } = useMemo(() => {
    if (!history || history.length === 0) {
      return { gridCells: [], historyMap: {}, minP: 0, maxP: 0 };
    }

    let minProfit = 0;
    let maxProfit = 0;
    const map = {};

    // 1. Map history
    history.forEach(item => {
      if (item.profit < minProfit) minProfit = item.profit;
      if (item.profit > maxProfit) maxProfit = item.profit;
      const date = new Date(item.timestamp_open * 1000);
      const key = formatDateKey(date);
      // If multiple trades same day, sum them up or take last? 
      // Usually heatmaps sum up for the day. Let's assume one entry per day or sum.
      // For safety, if key exists, we sum profit.
      if (map[key]) {
        map[key].profit += item.profit;
        map[key].count = (map[key].count || 1) + 1;
      } else {
        map[key] = { ...item, count: 1 };
      }
    });

    // 2. Determine Date Range (Start of first month -> Today)
    const timestamps = history.map(h => h.timestamp_open * 1000);
    const minTime = Math.min(...timestamps);
    const now = new Date();
    
    // Start from the 1st of the starting month
    const startDate = new Date(minTime);
    startDate.setDate(1); 
    startDate.setHours(0,0,0,0);

    const endDate = new Date(now); 

    const cells = [];
    const current = new Date(startDate);

    // Loop Month by Month
    while (current <= endDate) {
      const monthIndex = current.getMonth(); // 0-11
      // Loop Days 1 to 31
      for (let d = 1; d <= 31; d++) {
        // Create a specific date for this cell
        const cellDate = new Date(current.getFullYear(), monthIndex, d);
        const dayOfWeek = cellDate.getDay(); // 0=Sun, 6=Sat
        
        // Check if valid date (e.g. Feb 30 is invalid -> rolls over to Mar)
        // If cellDate.getMonth() !== monthIndex, it means we overflowed (e.g. Feb 30)
        const isOverflow = cellDate.getMonth() !== monthIndex;
        
        // We create a "Spacer" for overflow days to keep the 31-grid alignment on desktop
        if (isOverflow) {
          cells.push({
            id: `spacer-${current.getFullYear()}-${monthIndex}-${d}`,
            type: 'spacer',
            dateStr: null,
            profit: 0
          });
          continue;
        }

        const key = formatDateKey(cellDate);
        const data = map[key];
        const isWeekend = (dayOfWeek === 0 || dayOfWeek === 6);

        cells.push({
          id: key,
          dateStr: key,
          type: isWeekend ? 'weekend' : 'trading', // weekend vs trading day
          profit: data ? data.profit : 0,
          hasData: !!data,
          color: data ? getColor(data.profit, minProfit, maxProfit) : null,
          fullDate: cellDate
        });
      }

      // Move to next month
      current.setMonth(current.getMonth() + 1);
      current.setDate(1);
    }

    return { gridCells: cells, historyMap: map, minP: minProfit, maxP: maxProfit };
  }, [history]);

  /* --- Handlers --- */

  const toggleCell = (key) => {
    if (!key) return;
    const newSet = new Set(selectedKeys);
    if (newSet.has(key)) {
      newSet.delete(key);
    } else {
      newSet.add(key);
    }
    setSelectedKeys(newSet);
  };

  // Select Last Week (last 7 calendar days)
  const selectLastWeek = () => {
    const newSet = new Set();
    const today = new Date();
    for (let i = 0; i < 7; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const key = formatDateKey(d);
      // Only add if it exists in our map (has data) or is a valid trading day?
      // Let's selecting distinct keys regardless of data to show 0.
      newSet.add(key);
    }
    setSelectedKeys(newSet);
  };

  // Select Current Month
  const selectCurrentMonth = () => {
    const newSet = new Set();
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth();
    // Loop 1 to 31
    for (let d = 1; d <= 31; d++) {
       const date = new Date(year, month, d);
       if (date.getMonth() !== month) break;
       newSet.add(formatDateKey(date));
    }
    setSelectedKeys(newSet);
  };

  const clearSelection = () => setSelectedKeys(new Set());

  // Calculate Stats
  const selectedStats = useMemo(() => {
    let sum = 0;
    let count = 0;
    selectedKeys.forEach(key => {
      const item = historyMap[key];
      if (item) {
        sum += item.profit;
        count += 1;
      }
    });
    return { sum, count };
  }, [selectedKeys, historyMap]);

  if (!gridCells.length) return <div className="heatmap-empty">No History Data</div>;

  return (
    <div className="heatmap-container">
      {/* Top Bar: Title + Stats + Buttons */}
      <div className="heatmap-header">
        <div className="hm-title-section">
          <h3 className="panel-title">Trading History</h3>
          
          {selectedKeys.size > 0 ? (
             <div className="hm-stats-box">
                <span>Selected: {selectedKeys.size} days</span>
                <span className="sep">|</span>
                <span>Total: </span>
                <span style={{ 
                    color: selectedStats.sum >= 0 ? 'var(--green)' : 'var(--red)',
                    fontWeight: 'bold'
                }}>
                  {selectedStats.sum > 0 ? '+' : ''}{selectedStats.sum.toFixed(2)} $
                </span>
             </div>
          ) : (
            <span className="hm-hint">Select cells to see total</span>
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
          // Spacer logic is handled via CSS classes
          if (cell.type === 'spacer') {
            return <div key={cell.id} className="heatmap-cell spacer" />;
          }

          const isSelected = selectedKeys.has(cell.dateStr);
          
          // Determining class for weekends/empty days
          let cellClass = "heatmap-cell";
          if (cell.type === 'weekend') cellClass += " weekend";
          if (!cell.hasData) cellClass += " empty";
          if (isSelected) cellClass += " selected";

          return (
            <div
              key={cell.id}
              className={cellClass}
              onClick={() => toggleCell(cell.dateStr)}
              title={`${cell.dateStr} | PnL: ${cell.profit}`}
              style={{
                 // Only set background if it has data, otherwise CSS handles default
                 backgroundColor: cell.hasData ? cell.color : undefined
              }}
            >
              {cell.hasData && (
                 <>
                   <span className="hm-day-label">{new Date(cell.dateStr).getDate()}</span>
                   <div className="hm-profit-val">
                      {cell.profit > 0 ? '+' : ''}{cell.profit}
                   </div>
                 </>
              )}
              {/* Show date number even if empty, for calendar context */}
              {!cell.hasData && cell.type !== 'spacer' && (
                 <span className="hm-day-number-faded">{new Date(cell.dateStr).getDate()}</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}