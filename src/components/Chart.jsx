import { useEffect, useRef } from 'react';
import { createChart, CrosshairMode, LineStyle } from 'lightweight-charts';

/**
 * props:
 *   candles   – [{ time, open, high, low, close }]
 *   positions – [{ key, visible, entryPx, sl, tp, qty, colors, openTime }]
 */
export default function Chart({ candles, positions = [] }) {
  const containerRef   = useRef(null);
  const chartRef       = useRef(null);
  const seriesRef      = useRef(null);
  const userAtRightRef = useRef(true);
  const fitDoneRef     = useRef(false);
  const prevLenRef     = useRef(0);
  const prevFirstRef   = useRef(null);
  const linesRef       = useRef([]);
  const markersRef     = useRef([]);

  /* ——— helper: возвращаем контейнеру «нормальный» размер ——— */
  const normalizeSize = () => {
    const el = containerRef.current;
    const ch = chartRef.current;
    if (!el || !ch) return;

    // убираем навязанные библиотекой inline-ширину/высоту
    el.style.width  = '100%';
    el.style.height = '100%';

    // реальные размеры родителя .chart-wrapper
    const { width, height } = el.parentElement.getBoundingClientRect();
    if (width && height) ch.resize(width, height);
  };

  /* ——— инициализация ——— */
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const chart = createChart(el, {
      layout   : { background:{color:'#0f0f0f'}, textColor:'#d1d4dc' },
      grid     : { vertLines:{color:'#2B2B43'}, horzLines:{color:'#2B2B43'} },
      crosshair: { mode:CrosshairMode.Normal },
      rightPriceScale:{ borderVisible:false },
      timeScale:{ borderVisible:false, timeVisible:true, rightOffset:10, barSpacing:6 },
      handleScroll:{ mouseWheel:true, pressedMouseMove:true },
      handleScale :{ axisPressedMouseMove:true, mouseWheel:true, pinch:true },
    });

    const series = chart.addCandlestickSeries({
      upColor:'#26a69a', downColor:'#ef5350',
      wickUpColor:'#26a69a', wickDownColor:'#ef5350',
      borderVisible:false,
      priceFormat:{ type:'price', precision:2, minMove:0.01 },
    });

    chart.timeScale().subscribeVisibleLogicalRangeChange(() => {
      userAtRightRef.current = chart.timeScale().scrollPosition() === 0;
    });

    chartRef.current  = chart;
    seriesRef.current = series;

    normalizeSize();          // первый раз — сразу после создания

    return () => chart.remove();
  }, []);

  /* ——— свечи ——— */
  useEffect(() => {
    const chart  = chartRef.current;
    const series = seriesRef.current;
    if (!chart || !series || candles.length === 0) return;

    const data = candles.map(c => ({ time:c.time, open:c.open, high:c.high, low:c.low, close:c.close }));
    const first = data[0]?.time ?? null;
    const needReset =
      !fitDoneRef.current ||
      prevFirstRef.current == null ||
      prevFirstRef.current !== first ||
      data.length < prevLenRef.current;

    if (needReset) {
      series.setData(data);
      chart.timeScale().fitContent();
      fitDoneRef.current = true;
      prevLenRef.current = data.length;
      prevFirstRef.current = first;
      normalizeSize();        // библиотека перезаписала inline-hw → чистим
    } else {
      const diff = data.length - prevLenRef.current;
      if (diff > 0) data.slice(-diff).forEach(b => series.update(b));
      else series.update(data.at(-1));
      prevLenRef.current = data.length;
    }

    if (userAtRightRef.current) chart.timeScale().scrollToRealTime();
  }, [candles]);

  /* ——— ценовые линии ——— */
  useEffect(() => {
    const series = seriesRef.current;
    if (!series) return;

    linesRef.current.forEach(l => { try { series.removePriceLine(l); } catch {} });
    linesRef.current = [];

    positions.forEach(p => {
      if (!p.visible) return;
      const add = (price, color, title) => {
        if (price == null) return;
        linesRef.current.push(series.createPriceLine({
          price, color, lineWidth:2, lineStyle:LineStyle.Dashed,
          axisLabelVisible:true, title,
        }));
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
        position:'aboveBar',
        color:p.colors.entry,
        shape:'arrowDown',
        text:'',
      });
    });

    if (markers.length) series.setMarkers(markers);
    markersRef.current = markers;
  }, [positions, candles]);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver(() => {
      normalizeSize();
    });
    observer.observe(containerRef.current.parentElement);
    window.addEventListener('orientationchange', normalizeSize);
    return () => {
      observer.disconnect();
      window.removeEventListener('orientationchange', normalizeSize);
    };
  }, []);

  return <div ref={containerRef} className="chart-container" />;
}
