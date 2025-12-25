import React, { useMemo, useState } from 'react';

function getColor(profit, minP, maxP) {
  if (profit === 0) return '#2a2e39';
  if (profit > 0) {
    const ratio = maxP > 0 ? Math.min(1, profit / maxP) : 0;
    const opacity = 0.3 + (0.7 * ratio); // Чуть ярче
    return `rgba(38, 166, 154, ${opacity})`;
  } else {
    const ratio = minP < 0 ? Math.min(1, profit / minP) : 0;
    const opacity = 0.3 + (0.7 * ratio);
    return `rgba(239, 83, 80, ${opacity})`;
  }
}

function isWeekend(date) {
  const day = date.getDay();
  return day === 0 || day === 6;
}

function formatDateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export default function HistoryHeatmap({ history = [] }) {
  // Состояние для выбранной ячейки (для мобильных и ПК)
  const [selectedCell, setSelectedCell] = useState(null);

  const { gridCells } = useMemo(() => {
    if (!history || history.length === 0) return { gridCells: [] };
    
    let minP = 0, maxP = 0;
    const historyMap = {};
    
    history.forEach(item => {
      if (item.profit < minP) minP = item.profit;
      if (item.profit > maxP) maxP = item.profit;
      const date = new Date(item.timestamp_open * 1000);
      const key = formatDateKey(date);
      historyMap[key] = item;
    });

    const timestamps = history.map(h => h.timestamp_open * 1000);
    const minTime = Math.min(...timestamps);
    const maxTime = Date.now();
    
    const startDate = new Date(minTime);
    const endDate = new Date(maxTime);
    
    const cells = [];
    const current = new Date(startDate);
    
    // Выравниваем на понедельник, чтобы сетка была красивой
    const day = current.getDay();
    const diff = current.getDate() - day + (day === 0 ? -6 : 1);
    current.setDate(diff);

    while (current <= endDate) {
      if (!isWeekend(current)) {
        const key = formatDateKey(current);
        const data = historyMap[key];
        cells.push({
            dateStr: key,
            hasData: !!data,
            side: data?.side,
            profit: data?.profit,
            color: data ? getColor(data.profit, minP, maxP) : '#1e222d', // Цвет пустой ячейки под фон
        });
      }
      current.setDate(current.getDate() + 1);
    }
    return { gridCells: cells };
  }, [history]);

  if (!gridCells.length) return <div className="heatmap-empty">No History Data</div>;

  return (
    <div className="heatmap-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
         <h3 className="panel-title" style={{ margin: 0 }}>Trading History</h3>
         {/* Отображаем детали выбранного дня здесь */}
         {selectedCell && (
             <div style={{ fontSize: '12px', color: '#fff', fontWeight: 'bold' }}>
                 {selectedCell.dateStr}: 
                 <span style={{ 
                     color: (selectedCell.profit || 0) >= 0 ? '#26a69a' : '#ef5350',
                     marginLeft: '6px'
                 }}>
                    {selectedCell.profit ? selectedCell.profit.toFixed(2) : '0.00'} $
                 </span>
             </div>
         )}
      </div>

      <div className="heatmap-grid">
        {gridCells.map((cell) => {
          const isSelected = selectedCell?.dateStr === cell.dateStr;
          return (
            <div
              key={cell.dateStr}
              className="heatmap-cell"
              onClick={() => setSelectedCell(cell)} // Клик работает везде
              style={{ 
                  backgroundColor: cell.color,
                  border: isSelected ? '2px solid #fff' : 'none', // Белая рамка при выборе
                  transform: isSelected ? 'scale(0.95)' : 'none'
              }}
            >
              {cell.hasData && (
                  <>
                      <div className="hm-signal">{cell.side}</div>
                      <div className="hm-profit">{cell.profit?.toFixed(1)}</div>
                  </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}