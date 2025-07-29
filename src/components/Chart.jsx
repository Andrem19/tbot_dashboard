import { useEffect, useRef } from 'react';
import { createChart, CrosshairMode, LineStyle } from 'lightweight-charts';

/**
 * props:
 *   candles   – [{ time, open, high, low, close }]
 *   positions – [{ key, visible, entryPx, sl, tp, qty, colors }]
 */
export default function Chart({ candles, positions = [] }) {
  const containerRef       = useRef(null);
  const chartRef           = useRef(null);
  const seriesRef          = useRef(null);
  const resizeObsRef       = useRef(null);

  /* --- состояния, нужные только внутри --- */
  const userAtRightRef     = useRef(true);
  const didFitRef          = useRef(false);
  const lastLenRef         = useRef(0);
  const prevFirstTimeRef   = useRef(null);

  const priceLinesRef      = useRef([]);   // все созданные линии, чтобы потом удалить

  /* ──── инициализация графика ────────────────────────────── */
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    if (el.clientHeight === 0) el.style.height = '320px';

    const chart = createChart(el, {
      layout: { background: { color: '#0f0f0f' }, textColor: '#d1d4dc' },
      grid:   { vertLines: { color: '#2B2B43' }, horzLines: { color: '#2B2B43' } },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderVisible: false },
      timeScale: { borderVisible: false, timeVisible: true, rightOffset: 10, barSpacing: 6 },
      handleScroll: { mouseWheel: true, pressedMouseMove: true },
      handleScale:  { axisPressedMouseMove: true, mouseWheel: true, pinch: true },
      width:  el.clientWidth,
      height: el.clientHeight,
    });

    const series = chart.addCandlestickSeries({
      upColor: '#26a69a',
      downColor: '#ef5350',
      wickUpColor: '#26a69a',
      wickDownColor: '#ef5350',
      borderVisible: false,
      priceFormat: { type: 'price', precision: 2, minMove: 0.01 },
    });

    chart.timeScale().subscribeVisibleLogicalRangeChange(() => {
      userAtRightRef.current = chart.timeScale().scrollPosition() === 0;
    });

    chartRef.current  = chart;
    seriesRef.current = series;

    resizeObsRef.current = new ResizeObserver(
      ([{ contentRect: { width, height } }]) => {
        if (width && height) chart.applyOptions({ width, height });
      }
    );
    resizeObsRef.current.observe(el);

    return () => {
      resizeObsRef.current?.disconnect();
      chart.remove();
    };
  }, []);

  /* ──── обработка поступающих свечей ─────────────────────── */
  useEffect(() => {
    const series = seriesRef.current;
    const chart  = chartRef.current;
    if (!series || candles.length === 0) return;

    const data = candles.map(({ time, open, high, low, close }) => ({
      time, open, high, low, close,
    }));

    const firstTime = data[0]?.time ?? null;
    const needReset =
      !didFitRef.current ||                              // первый рендер
      prevFirstTimeRef.current == null ||                // не было предыдущего
      prevFirstTimeRef.current !== firstTime ||          // сдвинулся первый бар (другой набор)
      data.length < lastLenRef.current;                  // длина уменьшилась (также новый набор)

    if (needReset) {
      series.setData(data);
      chart.timeScale().fitContent();
      didFitRef.current      = true;
      lastLenRef.current     = data.length;
      prevFirstTimeRef.current = firstTime;
    } else {
      const diff = data.length - lastLenRef.current;
      if (diff > 0) {
        data.slice(-diff).forEach((bar) => series.update(bar));
        lastLenRef.current = data.length;
      } else {
        // та же длина: обновляем последний бар
        series.update(data[data.length - 1]);
      }
    }

    if (userAtRightRef.current) chart.timeScale().scrollToRealTime();
  }, [candles]);

  /* ──── price‑линии для стадий ──────────────────────────── */
  useEffect(() => {
    const series = seriesRef.current;
    if (!series) return;

    // Удаляем старые линии
    priceLinesRef.current.forEach((ln) => {
      try { series.removePriceLine(ln); } catch {}
    });
    priceLinesRef.current = [];

    // Создаём новые
    positions.forEach((p) => {
      if (!p.visible) return;
      const add = (price, color, title) => {
        if (price == null) return;
        const ln = series.createPriceLine({
          price,
          color,
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
          title,
        });
        priceLinesRef.current.push(ln);
      };
      add(p.entryPx, p.colors.entry, `${p.key} ${p.qty ?? ''}`.trim());
      add(p.sl,       p.colors.sl,    `${p.key} SL`);
      add(p.tp,       p.colors.tp,    `${p.key} TP`);
    });
  }, [positions]);

  return <div ref={containerRef} className="chart-container" />;
}
