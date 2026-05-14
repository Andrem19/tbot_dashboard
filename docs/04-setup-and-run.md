# 04. Установка и запуск

## Требования

- Node.js LTS (рекомендуется 20+)
- npm

## Установка

```bash
npm install
```

## Переменные окружения

Используются переменные Vite (`VITE_*`) для Firebase:

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_DATABASE_URL`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`

Локальные файлы окружения не коммитятся. Для старта скопируйте `.env.example` в `.env` или `.env.local`.

Production deployment создает `.env.production` из GitHub Actions secrets.

`src/firebase.js` проверяет, что `VITE_FIREBASE_DATABASE_URL` задан и начинается с `https://`.

## Локальный запуск

```bash
npm run dev
```

Обычно Vite поднимается на `http://localhost:5173`.

## Production сборка

```bash
npm run build
```

## Локальный preview production

```bash
npm run preview
```

## Логирование

- `main.jsx`: лог старта рендера.
- `firebase.js`: в `PROD` печатает `firebaseConfig`.
- `useBinanceKlines.js`: ошибки REST/WS и reconnect warning.
- `useFirebaseData.js`: ошибки подписки `onValue`.
