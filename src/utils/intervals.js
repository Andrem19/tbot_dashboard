export function minutesToBinanceInterval(minutes) {
  if (minutes === 1) return '1m';
  if (minutes === 3) return '3m';
  if (minutes === 5) return '5m';
  if (minutes === 15) return '15m';
  if (minutes === 30) return '30m';
  if (minutes === 60) return '1h';
  if (minutes === 120) return '2h';
  if (minutes === 240) return '4h';
  if (minutes === 360) return '6h';
  if (minutes === 480) return '8h';
  if (minutes === 720) return '12h';
  if (minutes === 1440) return '1d';
  if (minutes === 4320) return '3d';
  if (minutes === 10080) return '1w';
  if (minutes === 43200) return '1M';
  return '1m';
}
