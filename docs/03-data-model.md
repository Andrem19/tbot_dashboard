# 03. Модель данных и интеграции

## Firebase Realtime Database

Приложение подписывается на узел `dashb` и ожидает структуру вида:

```json
{
  "pos": {
    "pos_exist": true,
    "symbol": "BTCUSDT",
    "open_price": 68000.0,
    "sl_price": 67000.0,
    "tp_price": 70000.0,
    "timestamp_open": 1730000000,
    "qty": 0.01,
    "current_pnl": 12.34,
    "side": 1
  },
  "report": {
    "winrate": 0.63,
    "avg_rr": 1.42
  },
  "hist": [
    {
      "timestamp_open": 1730000000,
      "close_time": 1730003600,
      "profit": 14.2,
      "side": 1
    }
  ]
}
```

### Как эти поля используются

- `pos.pos_exist` — есть ли активная позиция.
- `pos.current_pnl` — значение в header (`PnL`).
- `pos.*price` — линии `Entry/SL/TP` на графике.
- `hist[].timestamp_open/close_time` — маркеры входа/выхода на графике.
- `hist[].profit` — окраска и статистика в heatmap.
- `hist[].side` — маленький лейбл в ячейках heatmap.
- `report` — горизонтальный список метрик.

## Binance REST

Эндпоинт:
- `GET https://fapi.binance.com/fapi/v1/klines?symbol=...&interval=...&limit=...`

Преобразование свечи в приложении:

```js
{
  time: unixSeconds,
  open: number,
  high: number,
  low: number,
  close: number,
  volume: number
}
```

Ограничения:
- `limit` приводится к диапазону `1..1500`.
- Интервал строится из минут через `minutesToBinanceInterval()`.

## Binance WebSocket

Поток:
- `wss://fstream.binance.com/ws/{symbolLower}@kline_{interval}`

Логика обновления:
- если `candle.time === last.time`, последняя свеча перезаписывается;
- если `candle.time > last.time`, свеча добавляется в конец;
- старые/out-of-order свечи игнорируются.

## Временные зоны и время

- Внутри графика используется Unix timestamp в секундах.
- Для heatmap даты формируются через `Date` браузера (локальная таймзона пользователя).
