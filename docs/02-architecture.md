# 02. Архитектура

## Высокоуровневая схема

1. `App.jsx` — центральная композиция экрана.
2. `useFirebaseData(path)` — подписка на Firebase (данные + connected).
3. `ChartTabs` + `useBinanceKlines(settings)` — работа с Binance свечами и WS.
4. `Chart` — рендер свечей и оверлеев (позиции/история).
5. `ReportStrip` + `HistoryHeatmap` — нижние аналитические панели.
6. UI работает в режиме только чтения: без отправки ордеров и без записи данных в Firebase.

## Потоки данных

### Поток A: Firebase

- Источник: Realtime Database путь `dashb`.
- Hook: `useFirebaseData('dashb')`.
- Выход:
  - `dashb.pos` -> уровни позиции + `current_pnl`;
  - `dashb.report` -> ключ-значение для `ReportStrip`;
  - `dashb.hist` -> массив закрытых сделок для `HistoryHeatmap` и маркеров в графике.

### Поток B: Binance

- Первичная загрузка: `fetchKlines(symbol, limit, interval)`.
- Онлайн-обновления: `createKlineWebSocket(symbol, interval, onKline)`.
- Hook: `useBinanceKlines({ coin, number_candles, interv })`.
- Логика:
  - загрузка initial candles;
  - запуск WS;
  - анти-дребезг при reconnect;
  - авто-reconnect через 5 секунд при обрыве;
  - ручной reconnect через кнопку в статус-баре.

## Структура каталогов

```text
src/
  App.jsx
  main.jsx
  index.css
  App.css
  firebase.js
  components/
    ChartTabs.jsx
    Chart.jsx
    ReportStrip.jsx
    HistoryHeatmap.jsx
    ValueFlash.jsx
  hooks/
    index.js
    useFirebaseData.js
    useBinanceKlines.js
  services/
    binance.js
  utils/
    intervals.js
```

## Ответственность модулей

- `App.jsx`: экран, состояние фильтров, связывание данных и компонент.
- `components/*`: визуализация.
- `hooks/*`: состояние и внешние подписки/соединения.
- `services/*`: API-обвязка.
- `utils/*`: чистые утилиты.

## Замечания по текущему состоянию

- `ValueFlash.jsx` присутствует, но в текущей версии не используется в UI.
- В проекте есть `collect.py` (служебный скрипт генерации code map), не используется рантаймом фронтенда.
