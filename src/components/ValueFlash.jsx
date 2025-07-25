import { useEffect, useRef, useState } from 'react';

/**
 * Число «подпрыгивает» (scale) и на‑лету окрашивается:
 *   • зелёный фон — значение выросло;
 *   • красный фон — значение снизилось.
 */
export default function ValueFlash({
  value,
  formatter = (v) => (v == null ? '-' : v),
  duration = 500,            // длительность подпрыгивания, мс
}) {
  const prevValRef = useRef(value);

  const [flash, setFlash]       = useState(false);   // scale‑эффект
  const [direction, setDir]     = useState('none');  // up / down / none

  /* ---------- обработка изменения входного значения ---------- */
  useEffect(() => {
    if (prevValRef.current !== value) {
      // вычисляем направление до обновления prevValRef
      const newDir =
        prevValRef.current == null || value == null
          ? 'none'
          : value > prevValRef.current
          ? 'up'
          : value < prevValRef.current
          ? 'down'
          : 'none';

      setDir(newDir);
      setFlash(true);                     // запускаем «подпрыгивание»
      const t = setTimeout(() => setFlash(false), duration);

      prevValRef.current = value;         // фиксируем новое значение
      return () => clearTimeout(t);
    }
  }, [value, duration]);

  return (
    <span className={`flash-val ${flash ? 'flash' : ''} ${direction}`}>
      {formatter(value)}
    </span>
  );
}
