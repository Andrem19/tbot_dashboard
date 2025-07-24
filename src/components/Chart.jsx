// src/components/Chart.jsx
import { useEffect, useRef } from 'react';
import {
  createChart,
  CrosshairMode,
  LineStyle,
} from 'lightweight-charts';

/**
 * props:
 *  candles: [{ time(sec), open, high, low, close }]
 *  entryPx?: number
 *  sl?: number
 *  tp?: number
 *  openTime?: number   // UNIX seconds
 *  showExtras?: boolean
 */
export default function Chart({
  candles,
  entryPx,
  sl,
  tp,
  openTime,
  showExtras,
}) {
  const containerRef = useRef(null);
  const chartRef = useRef(null);
  const seriesRef = useRef(null);
  const roRef = useRef(null);

  // refs для горизонтальных линий
  const entryLineRef = useRef(null);
  const slLineRef = useRef(null);
  const tpLineRef = useRef(null);

  // маркеры
  const prevMarkersRef = useRef([]);

  // флаги для обновлений
  const didInitialFitRef = useRef(false);
  const lastSetDataLenRef = useRef(0);
  const userAtRightEdgeRef = useRef(true);

  // === Создание графика ===
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    if (container.clientHeight === 0) container.style.height = '320px';

    const chart = createChart(container, {
      layout: { background: { color: '#0f0f0f' }, textColor: '#d1d4dc' },
      grid: {
        vertLines: { color: '#2B2B43' },
        horzLines: { color: '#2B2B43' },
      },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderVisible: false },
      timeScale: {
        borderVisible: false,
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 10,
        barSpacing: 6,
      },
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: true,
      },
      handleScale: {
        axisPressedMouseMove: true,
        mouseWheel: true,
        pinch: true,
      },
      width: container.clientWidth,
      height: container.clientHeight,
    });

    const series = chart.addCandlestickSeries({
      upColor: '#26a69a',
      downColor: '#ef5350',
      wickUpColor: '#26a69a',
      wickDownColor: '#ef5350',
      borderVisible: false,
      priceFormat: {
        type: 'price',
        precision: 2,
        minMove: 0.01,
      },
    });

    chart.timeScale().subscribeVisibleLogicalRangeChange(() => {
      userAtRightEdgeRef.current = chart.timeScale().scrollPosition() === 0;
    });

    chartRef.current = chart;
    seriesRef.current = series;

    // Resize observer
    roRef.current = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      if (width > 0 && height > 0) {
        chart.applyOptions({ width, height });
      }
    });
    roRef.current.observe(container);

    return () => {
      roRef.current?.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, []);

  // === Установка/обновление свечей ===
  useEffect(() => {
    if (!seriesRef.current || candles.length === 0) return;

    const data = candles.map((c) => ({
      time: c.time,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }));

    if (!didInitialFitRef.current) {
      seriesRef.current.setData(data);
      chartRef.current?.timeScale().fitContent();
      didInitialFitRef.current = true;
      lastSetDataLenRef.current = data.length;
      return;
    }

    if (data.length > lastSetDataLenRef.current) {
      const newBars = data.slice(lastSetDataLenRef.current);
      newBars.forEach((bar) => seriesRef.current.update(bar));
      lastSetDataLenRef.current = data.length;
    } else {
      const lastBar = data[data.length - 1];
      seriesRef.current.update(lastBar);
    }

    if (userAtRightEdgeRef.current) {
      chartRef.current?.timeScale().scrollToRealTime();
    }
  }, [candles]);

  // === Горизонтальные линии (Entry, SL, TP) ===
  useEffect(() => {
    if (!seriesRef.current) return;

    // если не нужно показывать дополнительные линии — удаляем
    if (!showExtras) {
      [entryLineRef, slLineRef, tpLineRef].forEach((r) => {
        if (r.current) {
          seriesRef.current.removePriceLine(r.current);
          r.current = null;
        }
      });
      return;
    }

    const createOrUpdateLine = (ref, price, color, title) => {
      if (price == null) {
        if (ref.current) {
          seriesRef.current.removePriceLine(ref.current);
          ref.current = null;
        }
        return;
      }
      if (ref.current) {
        seriesRef.current.removePriceLine(ref.current);
        ref.current = null;
      }
      ref.current = seriesRef.current.createPriceLine({
        price,
        color,
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title,
      });
    };

    createOrUpdateLine(entryLineRef, entryPx, '#3498db', 'Entry');
    createOrUpdateLine(slLineRef, sl, '#e74c3c', 'SL');
    createOrUpdateLine(tpLineRef, tp, '#2ecc71', 'TP');
  }, [entryPx, sl, tp, showExtras]);

  // === Маркер входа (openTime) ===
  useEffect(() => {
    if (!seriesRef.current) return;

    // чистим маркеры, если не нужно
    if (!showExtras || !openTime) {
      if (prevMarkersRef.current.length) {
        seriesRef.current.setMarkers([]);
        prevMarkersRef.current = [];
      }
      return;
    }

    if (!candles.length) return;

    const times = candles.map((c) => c.time);

    // найдём ближайший таймстамп свечи к openTime
    let closestTime = times[0];
    let minDiff = Math.abs(openTime - closestTime);
    for (let i = 1; i < times.length; i++) {
      const diff = Math.abs(openTime - times[i]);
      if (diff < minDiff) {
        minDiff = diff;
        closestTime = times[i];
      }
    }

    const marker = {
      time: closestTime,
      position: 'aboveBar', // можно belowBar / inBar
      color: '#ffffff',
      shape: 'arrowDown', // 'circle', 'square', 'arrowUp', 'arrowDown'
      text: 'Open',
    };

    seriesRef.current.setMarkers([marker]);
    prevMarkersRef.current = [marker];
  }, [openTime, candles, showExtras]);

  return (
    <div
      ref={containerRef}
      className="chart-container"
      style={{ position: 'relative' }}
    />
  );
}
