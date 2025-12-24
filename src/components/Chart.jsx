import { useEffect, useRef } from 'react';
import { createChart, CrosshairMode, LineStyle } from 'lightweight-charts';

/**
 * props:
 * candles  – [{ time, open, high, low, close }]
 * positions – массив объектов. Для новой БД ожидаем объект вида:
 * {
 * entryPx: number, // pos.open_price
 * sl: number,      // pos.sl_price
 * tp: number,      // pos.tp_price
 * openTime: number,// pos.timestamp_open
 * label: string,   // 'Long' / 'Short'
 * visible: boolean
 * }
 */
export default function Chart({ candles, positions = [] }) {
  const containerRef = useRef(null);
  const chartRef     = useRef(null);
  const seriesRef    = useRef(null);
  const prevLen      = useRef(0);
  const fitDone      = useRef(false);
  const userAtEnd    = useRef(true);
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
    
    // Стили контейнера
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
      // Если скролл близко к 0 (правый край), считаем userAtEnd
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

    // Логика первого рендера и обновлений
    if (!fitDone.current || data.length < prevLen.current) {
      series.setData(data);
      chart.timeScale().fitContent();
      fitDone.current = true;
      resizeChart();
    } else {
      // Инкрементальное обновление
      const last = data[data.length - 1];
      series.update(last);
    }
    
    prevLen.current = data.length;

    if (userAtEnd.current) {
      chart.timeScale().scrollToRealTime();
    }
  }, [candles]);

  // --- Отрисовка линий (SL, TP, Entry) ---
  useEffect(() => {
    const series = seriesRef.current;
    if (!series) return;

    // Удаляем старые линии
    priceLines.current.forEach(l => { try { series.removePriceLine(l); } catch {} });
    priceLines.current = [];

    positions.forEach(p => {
      if (!p.visible) return;

      const addLine = (price, color, title) => {
        if (!Number.isFinite(price)) return;
        const line = series.createPriceLine({
          price,
          color,
          lineWidth: 2,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
          title: title || '',
        });
        priceLines.current.push(line);
      };

      // Entry Price (Белый/Синий)
      addLine(p.entryPx, '#3a7afe', `Entry`);

      // SL (Красный)
      addLine(p.sl, '#e74c3c', `SL`);

      // TP (Зеленый)
      addLine(p.tp, '#2ecc71', `TP`);
    });

  }, [positions]);

  // --- Маркеры входа ---
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

      // Ищем ближайшую свечу к времени открытия
      // Время в базе в секундах (timestamp_open) или мс?
      // В JSON примере timestamp_open: 1766597096.643 (float sec). 
      // Приводим к int секундам
      const openTs = Math.floor(p.openTime);

      let closest = candleTimes[0];
      let minDiff = Math.abs(openTs - closest);

      for (let i = 1; i < candleTimes.length; i++) {
        const diff = Math.abs(openTs - candleTimes[i]);
        if (diff < minDiff) {
          minDiff = diff;
          closest = candleTimes[i];
        }
      }
      
      // Если разница слишком большая (например > 2 интервалов), можно не рисовать,
      // но для надежности рисуем на ближайшей найденной.
      markers.push({
        time: closest,
        position: 'aboveBar',
        color: '#f1c40f', // Желтая стрелка
        shape: 'arrowDown',
        text: 'Entry',
        size: 1,
      });
    });

    if (markers.length) series.setMarkers(markers);
  }, [positions, candles]);

  return <div ref={containerRef} className="chart-container" />;
}