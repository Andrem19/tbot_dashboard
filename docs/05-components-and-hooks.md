# 05. Компоненты, хуки и сервисы

## `src/App.jsx`

Ключевая роль: orchestration.

Что делает:
- хранит форму (`coin`, `number_candles`, `interv`) и применённые `settings`;
- подписывается на Firebase `dashb`;
- считает `secondsAgo` (таймер с момента последнего обновления `dashb.pos`);
- готовит `positionsByCoin` для графика;
- прокидывает status callback в `ChartTabs`;
- отображает шапку, график, отчёт, heatmap, status-bar.

## `src/components/ChartTabs.jsx`

- Внутренний `ChartWithData` связывает `useBinanceKlines` + `Chart`.
- Отправляет наверх `wsConnected/reconnect/candleCount`.
- Управляет активной вкладкой и синхронизирует её с массивом `coins`.

## `src/components/Chart.jsx`

- Инициализирует `lightweight-charts` и candlestick series.
- Ресайз через `ResizeObserver`.
- Обновляет series через `setData`/`update`.
- Рисует линии позиции (`Entry/SL/TP`) через `createPriceLine`.
- Рисует маркеры истории (`E` на вход и `profit` на выход).
- Кастомный `autoscaleInfoProvider` расширяет диапазон под уровни позиции.

## `src/components/ReportStrip.jsx`

- Принимает объект `report`.
- Отрисовывает пары `key:value` в горизонтальную полосу.
- Числа округляет до 4 знаков.

## `src/components/HistoryHeatmap.jsx`

- Агрегирует историю по дням.
- Строит 2 сетки:
  - mobile: недельная (7 колонок);
  - desktop: месячная (31 колонка).
- Выделение дней и быстрая выборка:
  - `Last Week`
  - `Month`
  - `Clear`
- Показывает сумму выбранных дней.
- Цвет ячейки зависит от относительного уровня прибыли/убытка.

## `src/components/ValueFlash.jsx`

- Анимация числа при изменении (`up/down` + `flash`).
- На текущий момент не подключён в `App.jsx`.

## `src/hooks/useFirebaseData.js`

- Подписка на `.info/connected` -> `connected`.
- Подписка на произвольный `path` -> `data`.
- Нормализует путь (убирает ведущий `/`).
- Возвращает `{ data, connected }`.

## `src/hooks/useBinanceKlines.js`

- Загружает initial свечи.
- Поддерживает WS live-стрим.
- Защищает от конкурентных connect через `connectingRef`.
- Поддерживает авто-reconnect (5 сек) и ручной reconnect.
- Возвращает `{ candles, loading, wsConnected, reconnect }`.

## `src/services/binance.js`

- `fetchKlines(...)`: REST-запрос + преобразование формата.
- `createKlineWebSocket(...)`: создание WS и парсинг `json.k`.

## `src/utils/intervals.js`

- Маппинг минут в Binance interval (`1m`, `5m`, `1h`, `1d`, ...).
- Неподдерживаемые значения fallback в `1m`.
