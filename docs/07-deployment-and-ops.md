# 07. Сборка, деплой и эксплуатация

## Скрипты npm

- `npm run dev` — локальная разработка.
- `npm run build` — production сборка в `dist/`.
- `npm run preview` — локальный просмотр production-сборки.
- `npm run predeploy` — алиас на `build`.
- `npm run deploy` — публикация `dist/` в GitHub Pages.

## GitHub Pages

В `package.json` задано:

- `homepage: "https://Andrem19.github.io/tbot_dashboard"`

В `vite.config.mjs`:

- `base` переключается по команде:
  - build: `/tbot_dashboard/`
  - dev: `/`

Это нужно для корректных путей ассетов на Pages.

## Runtime-зависимости

- Firebase Realtime Database должен быть доступен и возвращать узел `dashb`.
- Binance REST/WS должны быть доступны из сети клиента.

## Наблюдаемость и отладка

Проверка проблем по шагам:

1. Нет данных на экране:
   - проверить `VITE_FIREBASE_*`;
   - проверить `DB: ON/OFF` в статус-баре;
   - проверить, что в БД есть узел `dashb`.

2. Нет свечей/замер графика:
   - проверить `WS: Connected/Disconnected`;
   - нажать `Reconnect WS`;
   - проверить корректность `coin` и `interv`.

3. Heatmap пустой:
   - убедиться, что `dashb.hist` существует и содержит сделки.

## Технический долг / риски

- В `.env.*` хранятся реальные значения конфигурации Firebase; лучше держать их в защищённых CI/CD секретах.
- `ValueFlash.jsx` не используется и может быть удалён или подключён по назначению.
- `README.md` в корне пока шаблонный от Vite, без описания проекта.
