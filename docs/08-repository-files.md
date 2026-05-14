# 08. Файлы репозитория

## Корень проекта

- `package.json` — зависимости и npm-скрипты.
- `package-lock.json` — lockfile npm.
- `vite.config.mjs` — Vite-конфиг + `base` для GitHub Pages.
- `eslint.config.js` — ESLint-конфигурация.
- `tsconfig.app.json`, `tsconfig.node.json`, `tsconfig.tsbuildinfo` — TypeScript/Vite служебные файлы (проект на JS, но конфиги остались от шаблона).
- `index.html` — HTML-оболочка Vite.
- `README.md` — описание dashboard, настройки и модели данных.
- `.env.example` — шаблон Firebase-переменных окружения.
- `favicon.svg` — иконка проекта.
- `collect.py` — локальная утилита генерации текстовой карты проекта и кода.

## Каталог `src/`

Основная кодовая база фронтенда. Подробно описано в `05-components-and-hooks.md`.

## Каталог `public/`

- `vite.svg` — стандартный ассет Vite.
- `404.html` — страница для fallback на GitHub Pages.

## Каталог `dist/`

Собранные production-ассеты (результат `npm run build`).

## Каталог `.github/`

Служебные файлы GitHub (workflow/настройки репозитория, если присутствуют).

## Что не участвует в runtime приложения

- `collect.py`
- `code_map_*.txt`
- Firebase Realtime Database exports
- шаблонный/служебный контент Vite и TypeScript-конфиги
