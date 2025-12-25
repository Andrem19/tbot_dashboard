import { useEffect, useRef } from 'react';
import { createChart, CrosshairMode, LineStyle } from 'lightweight-charts';

export default function Chart({ candles, positions = [], history = [] }) {
  const containerRef = useRef(null);
  const chartRef     = useRef(null);
  const seriesRef    = useRef(null);
  
  const firstCandleTime = useRef(null); 
  const fitDone         = useRef(false);
  const priceLines      = useRef([]);
  
  // Ref для доступа к актуальным позициям внутри autoscaleInfoProvider (который создается один раз)
  const positionsRef = useRef(positions);

  // Обновляем ref при изменении пропса positions
  useEffect(() => {
    positionsRef.current = positions;
  }, [positions]);

  // --- Инициализация графика ---
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    
    const isMobile = window.innerWidth < 768;

    el.style.width  = '100%';
    el.style.height = '100%';
    el.style.overflow = 'hidden';

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
        },
        autoScale: true,
        ticksVisible: true, 
      },
      
      timeScale: {
        borderVisible: false,
        timeVisible: true,
        rightOffset: 0,
        barSpacing: isMobile ? 6 : 8,
        minBarSpacing: 2,
        fixLeftEdge: false, 
        fixRightEdge: false,
      },

      handleScroll: { 
          mouseWheel: true, 
          pressedMouseMove: true, 
          vertTouchDrag: true,
          horzTouchDrag: true,
      },
      handleScale: { 
          axisPressedMouseMove: true,
          mouseWheel: true, 
          pinch: true,
      },
    });

    const series = chart.addCandlestickSeries({
      upColor: '#26a69a', downColor: '#ef5350',
      wickUpColor: '#26a69a', wickDownColor: '#ef5350',
      borderVisible: false,
      priceFormat: { type: 'price', precision: 2, minMove: 0.01 },
      
      // === РЕШЕНИЕ ПРОБЛЕМЫ 2: Умный авто-масштаб ===
      // Эта функция заставляет график учитывать цены TP и SL при расчете границ экрана
      autoscaleInfoProvider: (original) => {
        const res = original();
        const currentPositions = positionsRef.current || [];
        
        // Если есть свечи и есть активные позиции
        if (res.priceRange !== null && currentPositions.length > 0) {
           let min = res.priceRange.minValue;
           let max = res.priceRange.maxValue;

           // Пробегаемся по позициям и расширяем границы min/max
           currentPositions.forEach(p => {
             if (!p.visible) return;
             // Собираем все цены (Entry, SL, TP), которые являются числами
             const vals = [p.entryPx, p.sl, p.tp].filter(v => Number.isFinite(v));
             vals.forEach(v => {
               if (v < min) min = v;
               if (v > max) max = v;
             });
           });

           res.priceRange.minValue = min;
           res.priceRange.maxValue = max;
        }
        return res;
      },
    });

    chartRef.current  = chart;
    seriesRef.current = series;

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

  // --- Обновление данных ---
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

    const currentStartTime = data.length > 0 ? data[0].time : null;
    const isNewDataSet = currentStartTime !== firstCandleTime.current || !fitDone.current;

    if (isNewDataSet) {
      series.setData(data);
      chart.timeScale().scrollToRealTime();
      fitDone.current = true;
      firstCandleTime.current = currentStartTime;
    } else {
      const last = data[data.length - 1];
      series.update(last);
    }
  }, [candles]);

  // --- Линии позиций ---
  useEffect(() => {
    const series = seriesRef.current;
    if (!series || candles.length === 0) return;

    priceLines.current.forEach(l => { try { series.removePriceLine(l); } catch {} });
    priceLines.current = [];

    // === РЕШЕНИЕ ПРОБЛЕМЫ 1: Убрали title ===
    // Убрали параметр title из createPriceLine.
    // Теперь на оси будет только чистое число (цена), без текста и тире.
    // Цвета (Entry=Синий, SL=Красный, TP=Зеленый) остаются.
    const addLine = (price, color, style = LineStyle.Dashed) => {
      if (!Number.isFinite(price)) return;
      const line = series.createPriceLine({
        price,
        color,
        lineWidth: 1,
        lineStyle: style,
        axisLabelVisible: true,
        title: '', // Пустая строка убирает текст и тире с метки оси
      });
      priceLines.current.push(line);
    };

    positions.forEach(p => {
      if (!p.visible) return;
      addLine(p.entryPx, '#2962ff', LineStyle.Solid); 
      addLine(p.sl, '#ef5350');
      addLine(p.tp, '#26a69a');
    });
  }, [positions, candles]);

  // --- Маркеры истории ---
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