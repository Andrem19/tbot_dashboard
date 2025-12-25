import { useEffect, useRef } from 'react';
import { createChart, CrosshairMode, LineStyle } from 'lightweight-charts';

/**
 * props:
 * candles  – [{ time, open, high, low, close }]
 * positions – Активная позиция
 * history   – История сделок
 */
export default function Chart({ candles, positions = [], history = [] }) {
  const containerRef = useRef(null);
  const chartRef     = useRef(null);
  const seriesRef    = useRef(null);
  
  // Для отслеживания смены датасета
  const firstCandleTime = useRef(null); 
  const fitDone         = useRef(false);
  const userAtEnd       = useRef(true);
  
  const priceLines      = useRef([]);

  // --- Инициализация и Ресайз ---
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    
    const isMobile = window.innerWidth < 768;

    // Стили контейнера, чтобы он занимал все место
    el.style.width  = '100%';
    el.style.height = '100%';
    el.style.overflow = 'hidden'; // Важно, чтобы не вылезало

    const chart = createChart(el, {
      layout: { 
          background: { color: '#131722' }, 
          textColor: '#787b86' 
      },
      grid: { 
          vertLines: { color: '#1e222d' }, 
          horzLines: { color: '#1e222d' } 
      },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { 
        borderVisible: false,
        scaleMargins: {
            top: isMobile ? 0.2 : 0.1, 
            bottom: isMobile ? 0.2 : 0.1,
        }
      },
      timeScale: {
        borderVisible: false,
        timeVisible: true,
        rightOffset: isMobile ? 2 : 10,
        barSpacing: isMobile ? 3 : 6,
        minBarSpacing: 2,
        fixLeftEdge: true, // Фикс левого края
      },
      handleScroll: { mouseWheel: true, pressedMouseMove: true },
      handleScale : { axisPressedMouseMove: true, mouseWheel: true, pinch: true },
    });

    const series = chart.addCandlestickSeries({
      upColor: '#26a69a', downColor: '#ef5350',
      wickUpColor: '#26a69a', wickDownColor: '#ef5350',
      borderVisible: false,
      priceFormat: { type: 'price', precision: 2, minMove: 0.01 },
    });

    chart.timeScale().subscribeVisibleLogicalRangeChange(() => {
      const sp = chart.timeScale().scrollPosition();
      userAtEnd.current = sp === 0 || sp < 0.5;
    });

    chartRef.current  = chart;
    seriesRef.current = series;

    // --- ИСПОЛЬЗУЕМ ResizeObserver ---
    // Это решает проблему пропавшей шкалы времени.
    // График будет точно подгоняться под размер родительского div'а.
    const resizeObserver = new ResizeObserver((entries) => {
      if (entries.length === 0 || !entries[0].target) return;
      const { width, height } = entries[0].contentRect;
      chart.resize(width, height);
    });

    resizeObserver.observe(el);

    return () => {
      resizeObserver.disconnect();
      chart.remove();
    };
  }, []);

  // --- Логика обновления данных (Исправлена кнопка Load) ---
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

    // Определяем, новые это данные или обновление текущих
    const currentStartTime = data.length > 0 ? data[0].time : null;
    
    // Если время первой свечи изменилось - значит загрузили новый тикер или таймфрейм
    // ИЛИ если это самый первый рендер (!fitDone.current)
    const isNewDataSet = currentStartTime !== firstCandleTime.current || !fitDone.current;

    if (isNewDataSet) {
      // Полная перезапись данных
      series.setData(data);
      chart.timeScale().fitContent();
      
      fitDone.current = true;
      firstCandleTime.current = currentStartTime;
      
    } else {
      // Просто обновление последней свечи (Live цена)
      const last = data[data.length - 1];
      series.update(last);
    }
    
    if (userAtEnd.current) {
      chart.timeScale().scrollToRealTime();
    }
  }, [candles]);

  // --- ЛИНИИ (Positions) ---
  useEffect(() => {
    const series = seriesRef.current;
    if (!series || candles.length === 0) return;

    priceLines.current.forEach(l => { try { series.removePriceLine(l); } catch {} });
    priceLines.current = [];

    const addLine = (price, color, title, style = LineStyle.Dashed) => {
      if (!Number.isFinite(price)) return;
      const line = series.createPriceLine({
        price,
        color,
        lineWidth: 1,
        lineStyle: style,
        axisLabelVisible: true,
        title: title || '',
      });
      priceLines.current.push(line);
    };

    positions.forEach(p => {
      if (!p.visible) return;
      addLine(p.entryPx, '#2962ff', `Entry`, LineStyle.Solid); 
      addLine(p.sl, '#ef5350', `SL`);
      addLine(p.tp, '#26a69a', `TP`);
    });
  }, [positions, candles]);

  // --- МАРКЕРЫ (History) ---
  useEffect(() => {
    const series = seriesRef.current;
    if (!series) return;
    
    series.setMarkers([]);
    if (candles.length === 0) return;

    const candleTimes = candles.map(c => c.time);
    const markers = [];

    const findClosestTime = (targetTs) => {
      if (!targetTs) return null;
      const ts = Math.floor(targetTs);
      const minTime = candleTimes[0];
      
      if (ts < minTime) return null; 
      
      let closest = minTime;
      let minDiff = Math.abs(ts - minTime);

      for (let i = 1; i < candleTimes.length; i++) {
        const diff = Math.abs(ts - candleTimes[i]);
        if (diff < minDiff) {
          minDiff = diff;
          closest = candleTimes[i];
        }
      }
      return closest;
    };

    // Маркеры истории
    if (history && history.length > 0) {
      history.forEach(h => {
        const tOpen = findClosestTime(h.timestamp_open);
        if (tOpen) {
          const entryColor = h.side === 2 ? '#e74c3c' : '#3a7afe';
          markers.push({
            time: tOpen,
            position: 'aboveBar',
            color: entryColor,
            shape: 'arrowDown',
            text: 'E',
            size: 0.8,
          });
        }

        const tClose = findClosestTime(h.close_time);
        if (tClose) {
          const profitVal = parseFloat(h.profit || 0);
          const profitStr = profitVal > 0 ? `+${profitVal.toFixed(2)}` : `${profitVal.toFixed(2)}`;
          const pColor = profitVal >= 0 ? '#2ecc71' : '#e74c3c';

          markers.push({
            time: tClose,
            position: 'aboveBar',
            color: '#9b59b6',
            shape: 'arrowDown',
            text: profitStr,
            size: 0.8,
          });
        }
      });
    }

    markers.sort((a, b) => a.time - b.time);
    if (markers.length) series.setMarkers(markers);

  }, [positions, candles, history]);

  return <div ref={containerRef} className="chart-container" />;
}