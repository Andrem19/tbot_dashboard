// src/components/ValueFlash.jsx
import { useEffect, useRef, useState } from 'react';

export default function ValueFlash({
  value,
  formatter = (v) => (v == null ? '-' : v),
  duration = 500,
}) {
  const [flash, setFlash] = useState(false);
  const prevRef = useRef(value);

  useEffect(() => {
    if (prevRef.current !== value) {
      setFlash(true);
      const t = setTimeout(() => setFlash(false), duration);
      prevRef.current = value;
      return () => clearTimeout(t);
    }
  }, [value, duration]);

  // Направление изменения – позволит менять цвет
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
