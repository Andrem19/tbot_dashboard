// src/components/Chart.jsx
import { useEffect, useRef } from 'react';
import { createChart, CrosshairMode, LineStyle } from 'lightweight-charts';

/**
 * props:
 *   candles   – [{ time, open, high, low, close }]
 *   positions – [{ key, visible, entryPx, sl, tp, qty, colors, openTime }]
 */
export default function Chart({ candles, positions = [] }) {
  const containerRef = useRef(null);
  const chartRef     = useRef(null);
  const seriesRef    = useRef(null);

  const prevLen   = useRef(0);
  const prevFirst = useRef(null);
  const fitDone   = useRef(false);
  const userAtEnd = useRef(true);

  const priceLines = useRef([]);
  const markersRef = useRef([]);

  /* ——— подгоняем размер под фактическую высоту .chart-wrapper ——— */
  const resizeChart = () => {
    const el = containerRef.current;
    const chart = chartRef.current;
    if (!el || !chart) return;

    // .chart-wrapper — ближайший родитель по классу
    let wrap = el;
    while (wrap && !wrap.classList.contains('chart-wrapper')) {
      wrap = wrap.parentElement;
    }
    const target = wrap || el;
    const { width, height } = target.getBoundingClientRect();
    if (width > 0 && height > 0) chart.resize(width, height);
  };

  /* ——— инициализация ——— */
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    // контейнеру нужны 100 % ширины/высоты, но этого достаточно один раз
    el.style.width  = '100%';
    el.style.height = '100%';

    const chart = createChart(el, {
      layout: { background: { color: '#0f0f0f' }, textColor: '#d1d4dc' },
      grid:   { vertLines: { color: '#2B2B43' }, horzLines: { color: '#2B2B43' } },
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
      upColor      : '#26a69a',
      downColor    : '#ef5350',
      wickUpColor  : '#26a69a',
      wickDownColor: '#ef5350',
      borderVisible: false,
      priceFormat  : { type: 'price', precision: 2, minMove: 0.01 },
    });

    chart.timeScale().subscribeVisibleLogicalRangeChange(() => {
      userAtEnd.current = chart.timeScale().scrollPosition() === 0;
    });

    chartRef.current  = chart;
    seriesRef.current = series;

    /* реагируем только на resize/orientationchange окна — никаких observer-ов */
    window.addEventListener('resize', resizeChart);
    window.addEventListener('orientationchange', resizeChart);

    resizeChart(); // первый раз

    return () => {
      window.removeEventListener('resize', resizeChart);
      window.removeEventListener('orientationchange', resizeChart);
      chart.remove();
    };
  }, []);

  /* ——— обновляем свечи ——— */
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

    const first = data[0]?.time ?? null;
    const needReset =
      !fitDone.current ||
      prevFirst.current == null ||
      prevFirst.current !== first ||
      data.length < prevLen.current;

    if (needReset) {
      series.setData(data);
      chart.timeScale().fitContent();
      fitDone.current  = true;
      prevLen.current  = data.length;
      prevFirst.current = first;
      resizeChart(); // подгоняем один раз
    } else {
      const diff = data.length - prevLen.current;
      if (diff > 0) data.slice(-diff).forEach(series.update);
      else series.update(data.at(-1));
      prevLen.current = data.length;
    }

    if (userAtEnd.current) chart.timeScale().scrollToRealTime();
  }, [candles]);

  /* ——— ценовые линии ——— */
  useEffect(() => {
    const series = seriesRef.current;
    if (!series) return;
    priceLines.current.forEach(l => { try { series.removePriceLine(l); } catch {} });
    priceLines.current = [];

    positions.forEach(p => {
      if (!p.visible) return;
      const add = (price, color, title) => {
        if (price == null) return;
        priceLines.current.push(
          series.createPriceLine({
            price,
            color,
            lineWidth: 2,
            lineStyle: LineStyle.Dashed,
            axisLabelVisible: true,
            title,
          }),
        );
      };
      add(p.entryPx, p.colors.entry, `${p.key} ${p.qty ?? ''}`.trim());
      add(p.sl,      p.colors.sl,    `${p.key} SL`);
      add(p.tp,      p.colors.tp,    `${p.key} TP`);
    });
  }, [positions]);

  /* ——— маркеры ——— */
  useEffect(() => {
    const series = seriesRef.current;
    if (!series) return;

    series.setMarkers([]);
    markersRef.current = [];
    if (candles.length === 0) return;

    const times = candles.map(c => c.time);
    const markers = [];

    positions.forEach(p => {
      if (!p.visible || !p.openTime) return;
      let closest = times[0], min = Math.abs(p.openTime - times[0]);
      for (let i = 1; i < times.length; i++) {
        const d = Math.abs(p.openTime - times[i]);
        if (d < min) { min = d; closest = times[i]; }
      }
      markers.push({
        time: closest,
        position: 'aboveBar',
        color: p.colors.entry,
        shape: 'arrowDown',
        text: '',
      });
    });

    if (markers.length) series.setMarkers(markers);
    markersRef.current = markers;
  }, [positions, candles]);

  return <div ref={containerRef} className="chart-container" />;
}
