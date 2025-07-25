import { useEffect, useRef, useState } from 'react';

/**
 * Отображает число, которое «подпрыгивает» и
 * на 0.3 сек подсвечивается красным при обновлении.
 */
export default function ValueFlash({
  value,
  formatter = (v) => (v == null ? '-' : v),
  duration = 500,            // время «подпрыгивания»
  highlightMs = 300,         // время красной подсветки
}) {
  const prevRef = useRef(value);

  const [flash, setFlash] = useState(false);        // масштаб
  const [red, setRed] = useState(false);            // красный фон

  /* ---------- реакция на изменение значения ---------- */
  useEffect(() => {
    if (prevRef.current !== value) {
      setFlash(true);
      setRed(true);

      const t1 = setTimeout(() => setFlash(false), duration);
      const t2 = setTimeout(() => setRed(false), highlightMs);

      prevRef.current = value;
      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
      };
    }
  }, [value, duration, highlightMs]);

  /* ---------- направление изменения ---------- */
  const dir =
    prevRef.current == null || value == null
      ? 'none'
      : value > prevRef.current
      ? 'up'
      : value < prevRef.current
      ? 'down'
      : 'none';

  return (
    <span className={`flash-val ${flash ? 'flash' : ''} ${red ? 'flash-red' : ''} ${dir}`}>
      {formatter(value)}
    </span>
  );
}
