import React, { useMemo } from 'react';

/**
 * Получение цвета на основе профита.
 * Градиент: Темно-красный (отрицательный) -> Серый (0) -> Темно-зеленый (положительный).
 */
function getColor(profit, minP, maxP) {
  if (profit === 0) return '#2a2e39'; // Нейтральный цвет (как фон инпутов)
  
  // Используем прозрачность для градации, чтобы цвета были в стиле темы
  if (profit > 0) {
    // Зеленый: #26a69a
    const ratio = maxP > 0 ? Math.min(1, profit / maxP) : 0;
    // От темного к яркому зеленому. 
    // Минимум 20% прозрачности, максимум 100%
    const opacity = 0.2 + (0.8 * ratio);
    return `rgba(38, 166, 154, ${opacity})`; 
  } else {
    // Красный: #ef5350
    const ratio = minP < 0 ? Math.min(1, profit / minP) : 0;
    const opacity = 0.2 + (0.8 * ratio);
    return `rgba(239, 83, 80, ${opacity})`;
  }
}

/** Проверка, является ли день выходным (Суббота=6, Воскресенье=0) */
function isWeekend(date) {
  const day = date.getDay();
  return day === 0 || day === 6;
}

/** Форматирование даты в YYYY-MM-DD для ключей карты */
function formatDateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export default function HistoryHeatmap({ history = [] }) {
  const { gridCells } = useMemo(() => {
    if (!history || history.length === 0) return { gridCells: [] };

    // 1. Находим мин/макс профит для градиента
    let minP = 0, maxP = 0;
    const historyMap = {};

    history.forEach(item => {
      if (item.profit < minP) minP = item.profit;
      if (item.profit > maxP) maxP = item.profit;
      
      // Ключ по дате открытия сделки
      const date = new Date(item.timestamp_open * 1000);
      const key = formatDateKey(date);
      // Если сделок несколько за день, берем последнюю или суммируем (в данном коде просто перезаписываем/берем последнюю)
      historyMap[key] = item;
    });

    // 2. Генерируем календарную сетку
    // Находим самую раннюю дату
    const timestamps = history.map(h => h.timestamp_open * 1000);
    const minTime = Math.min(...timestamps);
    const maxTime = Date.now();

    const startDate = new Date(minTime);
    const endDate = new Date(maxTime);

    const cells = [];
    const current = new Date(startDate);

    // Сдвигаем current на начало недели (Понедельник), чтобы сетка была ровной
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
            side: data?.side,     // <--- СТАЛО
            profit: data?.profit,
            color: data ? getColor(data.profit, minP, maxP) : '#222',
        });
      }
      // Следующий день
      current.setDate(current.getDate() + 1);
    }

    return { gridCells: cells };
  }, [history]);

  if (!gridCells.length) return <div className="heatmap-empty">No History Data</div>;

  return (
    <div className="heatmap-container">
      <h3 className="panel-title">Trading History Heatmap</h3>
      <div className="heatmap-grid">
        {gridCells.map((cell) => (
          <div 
            key={cell.dateStr} 
            className="heatmap-cell"
            style={{ backgroundColor: cell.color }}
            title={`${cell.dateStr} | Profit: ${cell.profit ?? '-'}`}
          >
            {cell.hasData && (
                <>
                    <div className="hm-signal">{cell.side}</div>   {/* <--- СТАЛО */}
                    <div className="hm-profit">{cell.profit?.toFixed(2)}</div>
                </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}