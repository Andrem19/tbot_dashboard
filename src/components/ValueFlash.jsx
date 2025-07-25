import { useEffect, useRef, useState } from 'react';

/**
 * Отображает число, которое «подпрыгивает» при обновлении
 * и окрашивается в зелёный/красный в зависимости от направления.
 */
export default function ValueFlash({
  value,
  formatter = (v) => (v == null ? '-' : v),
  duration = 500, // время «подпрыгивания» в мс
}) {
  const prevRef = useRef(value);
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    if (prevRef.current !== value) {
      setFlash(true);
      const t = setTimeout(() => setFlash(false), duration);
      prevRef.current = value;
      return () => clearTimeout(t);
    }
  }, [value, duration]);

  const dir =
    prevRef.current == null || value == null
      ? 'none'
      : value > prevRef.current
      ? 'up'
      : value < prevRef.current
      ? 'down'
      : 'none';

  return (
    <span className={`flash-val ${flash ? 'flash' : ''} ${dir}`}>
      {formatter(value)}
    </span>
  );
}
