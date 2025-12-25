import { useEffect, useRef } from 'react';
import { createChart, CrosshairMode, LineStyle } from 'lightweight-charts';

/**
 * props:
 * candles  – [{ time, open, high, low, close }]
 * positions – Активная позиция (Current Position)
 * history   – История сделок (из dashb.hist)
 */
export default function Chart({ candles, positions = [], history = [] }) {
  const containerRef = useRef(null);
  const chartRef     = useRef(null);
  const seriesRef    = useRef(null);
  const prevLen      = useRef(0);
  const fitDone      = useRef(false);
  const userAtEnd    = useRef(true);
  
  // Храним ссылки на линии цен, чтобы удалять их при обновлении
  const priceLines   = useRef([]);

  // --- Ресайз графика ---
  const resizeChart = () => {
    const el = containerRef.current;
    const chart = chartRef.current;
    if (!el || !chart) return;
    let wrap = el;
    while (wrap && !wrap.classList.contains('chart-wrapper')) {
      wrap = wrap.parentElement;
    }
    const target = wrap || el;
    const { width, height } = target.getBoundingClientRect();
    if (width > 0 && height > 0) chart.resize(width, height);
  };

  // --- Инициализация ---
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    
    el.style.width  = '100%';
    el.style.height = '100%';

    const chart = createChart(el, {
      layout: { 
          background: { color: '#131722' }, // var(--bg-main)
          textColor: '#787b86'              // var(--text-secondary)
      },
      grid: { 
          vertLines: { color: '#1e222d' },  // var(--bg-panel) - еле заметная сетка
          horzLines: { color: '#1e222d' } 
      },
      crosshair: { 
          mode: CrosshairMode.Normal,
          vertLine: {
            color: '#758696',
            labelBackgroundColor: '#758696',
          },
          horzLine: {
            color: '#758696',
            labelBackgroundColor: '#758696',
          },
      },
      rightPriceScale: { borderVisible: false },
      timeScale: {
        borderVisible: false,
        timeVisible: true,
        rightOffset: 10,
        barSpacing: 6,
      },
      // ... handleScroll и прочее ...
    });

    const series = chart.addCandlestickSeries({
      upColor: '#26a69a',         // var(--green)
      downColor: '#ef5350',       // var(--red)
      wickUpColor: '#26a69a',
      wickDownColor: '#ef5350',
      borderVisible: false,
      priceFormat: { type: 'price', precision: 2, minMove: 0.01 },
    });

    chart.timeScale().subscribeVisibleLogicalRangeChange(() => {
      const sp = chart.timeScale().scrollPosition();
      userAtEnd.current = sp === 0 || sp < 0.5; 
    });

    chartRef.current  = chart;
    seriesRef.current = series;

    window.addEventListener('resize', resizeChart);
    resizeChart();

    return () => {
      window.removeEventListener('resize', resizeChart);
      chart.remove();
    };
  }, []);

  // --- Данные свечей ---
  useEffect(() => {
    const chart  = chartRef.current;
    const series = seriesRef.current;
    if (!chart || !series || candles.length === 0) return;

    const data = candles.map(c => ({
      time : c.time,
      open : c.open,
      high : c.high,
      low  : c.low,
      close: c.close,
    }));

    if (!fitDone.current || data.length < prevLen.current) {
      series.setData(data);
      chart.timeScale().fitContent();
      fitDone.current = true;
      resizeChart();
    } else {
      const last = data[data.length - 1];
      series.update(last);
    }
    
    prevLen.current = data.length;

    if (userAtEnd.current) {
      chart.timeScale().scrollToRealTime();
    }
  }, [candles]);

  // --- ЛИНИИ (Только для Активной Позиции) ---
  useEffect(() => {
    const series = seriesRef.current;
    if (!series || candles.length === 0) return;

    // 1. Очистка старых линий
    priceLines.current.forEach(l => { try { series.removePriceLine(l); } catch {} });
    priceLines.current = [];

    const addLine = (price, color, title, style = LineStyle.Dashed) => {
      if (!Number.isFinite(price)) return;
      const line = series.createPriceLine({
        price,
        color,
        lineWidth: 1, // Тонкие линии
        lineStyle: style,
        axisLabelVisible: true,
        title: title || '',
      });
      priceLines.current.push(line);
    };

    // Рисуем линии только для positions (Active)
    positions.forEach(p => {
      if (!p.visible) return;
      // Entry
      addLine(p.entryPx, '#2962ff', `Entry`, LineStyle.Solid); 
      // SL
      addLine(p.sl, '#ef5350', `SL`);
      // TP
      addLine(p.tp, '#26a69a', `TP`);
    });

    // ПРИМЕЧАНИЕ: Для history мы здесь ничего не рисуем (линий нет)

  }, [positions, candles]); // Зависит от positions

  // --- МАРКЕРЫ (Активная + История) ---
  useEffect(() => {
    const series = seriesRef.current;
    if (!series) return;
    
    // Сбрасываем маркеры
    series.setMarkers([]);

    if (candles.length === 0) return;

    const candleTimes = candles.map(c => c.time);
    const markers = [];

    // Хелпер для поиска ближайшей свечи
    const findClosestTime = (targetTs) => {
      if (!targetTs) return null;
      const ts = Math.floor(targetTs);
      
      // Если время далеко за пределами диапазона свечей — игнорируем
      // Берем запас например в (интервал * 2)
      // Для простоты: проверяем, попадает ли в диапазон мин/макс времени свечей
      const minTime = candleTimes[0];
      const maxTime = candleTimes[candleTimes.length - 1];
      
      // Если сделка была сильно раньше первой свечи, не рисуем
      if (ts < minTime) return null; 
      
      // Ищем ближайшую
      let closest = minTime;
      let minDiff = Math.abs(ts - minTime);

      // Простая итерация (можно оптимизировать бинарным, но для 1000 свечей и так быстро)
      for (let i = 1; i < candleTimes.length; i++) {
        const diff = Math.abs(ts - candleTimes[i]);
        if (diff < minDiff) {
          minDiff = diff;
          closest = candleTimes[i];
        }
      }
      return closest;
    };

    // 1. Маркеры для АКТИВНОЙ позиции (Entry)
    positions.forEach(p => {
      const t = findClosestTime(p.openTime);
      if (t) {
        // markers.push({
        //   time: t,
        //   position: 'aboveBar',
        //   color: '#f1c40f', // Желтый для активной
        //   shape: 'arrowDown',
        //   text: 'Entry',
        //   size: 1,
        // });
      }
    });

    // 2. Маркеры для ИСТОРИИ (Entry + Close)
    if (history && history.length > 0) {
      history.forEach(h => {
        // --- Entry Marker (History) ---
        const tOpen = findClosestTime(h.timestamp_open);
        if (tOpen) {
          const entryColor = h.side === 2 ? '#e74c3c' : '#3a7afe';
          markers.push({
            time: tOpen,
            position: 'aboveBar',
            color: entryColor, // Серый для истории
            shape: 'arrowDown',
            // Можно добавить text: 'E', если нужно, или оставить пустым
            text: 'E',
            size: 0.8, // Поменьше
          });
        }

        // --- Close Marker (History) ---
        const tClose = findClosestTime(h.close_time);
        if (tClose) {
          // Форматируем профит
          const profitVal = parseFloat(h.profit || 0);
          const profitStr = profitVal > 0 ? `+${profitVal.toFixed(2)}` : `${profitVal.toFixed(2)}`;
          // Цвет в зависимости от профита (зеленоватый или красноватый) или просто фиолетовый
          const pColor = profitVal >= 0 ? '#2ecc71' : '#e74c3c';

          markers.push({
            time: tClose,
            position: 'aboveBar', // Над свечей
            color: '#9b59b6',    // Фиолетовая стрелка
            shape: 'arrowDown',
            text: profitStr,     // Текст профита
            size: 0.8,
          });
        }
      });
    }

    // ВАЖНО: Маркеры должны быть отсортированы по времени
    markers.sort((a, b) => a.time - b.time);

    if (markers.length) series.setMarkers(markers);

  }, [positions, candles, history]);

  return <div ref={containerRef} className="chart-container" />;
}