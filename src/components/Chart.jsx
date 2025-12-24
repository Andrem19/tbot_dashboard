import { useEffect, useRef } from 'react';
import { createChart, CrosshairMode, LineStyle } from 'lightweight-charts';

/**
 * props:
 * candles  – [{ time, open, high, low, close }]
 * positions – Активная позиция (массив)
 * history   – История сделок (массив из dashb.hist)
 */
export default function Chart({ candles, positions = [], history = [] }) {
  const containerRef = useRef(null);
  const chartRef     = useRef(null);
  const seriesRef    = useRef(null);
  const prevLen      = useRef(0);
  const fitDone      = useRef(false);
  const userAtEnd    = useRef(true);
  
  // Храним ссылки на созданные линии, чтобы удалять их при обновлении
  const priceLines   = useRef([]);
  const markersRef   = useRef([]);

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
      layout: { background: { color: '#0f0f0f' }, textColor: '#d1d4dc' },
      grid:   { vertLines: { color: '#1f1f1f' }, horzLines: { color: '#1f1f1f' } },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderVisible: false },
      timeScale: {
        borderVisible: false,
        timeVisible  : true,
        rightOffset  : 10,
        barSpacing   : 6,
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

  // --- Отрисовка линий (Активные позиции + История) ---
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

    // Время первой загруженной свечи
    const firstCandleTime = candles[0].time;

    // 2. Рендер АКТИВНЫХ позиций
    positions.forEach(p => {
      if (!p.visible) return;
      // Жирнее для активной
      addLine(p.entryPx, '#3a7afe', `Entry`, LineStyle.Solid); 
      addLine(p.sl, '#e74c3c', `SL`);
      addLine(p.tp, '#2ecc71', `TP`);
    });

    // 3. Рендер ИСТОРИИ (dashb.hist)
    // Рисуем только если open_time >= времени первой свечи на графике
    if (history && history.length > 0) {
      history.forEach(h => {
        // Если сделка началась раньше, чем у нас есть данные свечей — пропускаем полностью
        if (h.timestamp_open < firstCandleTime) return;

        // Entry (История) - Серый цвет
        addLine(h.open_price, '#888888', 'Hist Entry', LineStyle.Dotted);

        // Close (История) - Фиолетовый + Профит
        // Форматируем профит
        const profitStr = h.profit > 0 ? `+${h.profit.toFixed(2)}` : `${h.profit.toFixed(2)}`;
        addLine(h.close_price, '#9b59b6', `Close (${profitStr})`, LineStyle.Dotted);
      });
    }

  }, [positions, candles, history]); // Перерисовываем при изменении истории или свечей

  // --- Маркеры входа (только для активной позиции) ---
  useEffect(() => {
    const series = seriesRef.current;
    if (!series) return;
    
    series.setMarkers([]);
    markersRef.current = [];

    if (candles.length === 0 || positions.length === 0) return;

    const candleTimes = candles.map(c => c.time);
    const markers = [];

    positions.forEach(p => {
      if (!p.openTime) return;
      const openTs = Math.floor(p.openTime);
      
      // Ищем ближайшую свечу
      let closest = candleTimes[0];
      let minDiff = Math.abs(openTs - closest);

      for (let i = 1; i < candleTimes.length; i++) {
        const diff = Math.abs(openTs - candleTimes[i]);
        if (diff < minDiff) {
          minDiff = diff;
          closest = candleTimes[i];
        }
      }
      
      markers.push({
        time: closest,
        position: 'aboveBar',
        color: '#f1c40f',
        shape: 'arrowDown',
        text: 'Entry',
        size: 1,
      });
    });

    if (markers.length) series.setMarkers(markers);
  }, [positions, candles]);

  return <div ref={containerRef} className="chart-container" />;
}