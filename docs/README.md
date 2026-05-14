# Документация проекта `tbot_dashboard`

Этот каталог содержит полное описание текущего состояния проекта:

1. [`01-overview.md`](./01-overview.md) — назначение проекта и ключевые функции.
2. [`02-architecture.md`](./02-architecture.md) — архитектура, потоки данных и структура кода.
3. [`03-data-model.md`](./03-data-model.md) — формат данных из Firebase и Binance.
4. [`04-setup-and-run.md`](./04-setup-and-run.md) — установка, запуск, переменные окружения.
5. [`05-components-and-hooks.md`](./05-components-and-hooks.md) — описание компонентов, хуков и сервисов.
6. [`06-styling-and-ui.md`](./06-styling-and-ui.md) — UI, адаптивность и CSS-переменные.
7. [`07-deployment-and-ops.md`](./07-deployment-and-ops.md) — сборка, деплой и эксплуатационные заметки.
8. [`08-repository-files.md`](./08-repository-files.md) — назначение файлов и каталогов репозитория.
9. [`ABOUT.md`](./ABOUT.md) — краткое описание сути проекта и его границ ответственности.

## Кратко о проекте

`tbot_dashboard` — веб-дашборд на React + Vite для мониторинга торговых данных:
- читает состояние бота из Firebase Realtime Database;
- загружает и в реальном времени обновляет свечи Binance Futures;
- отображает график, текущую позицию, отчёт и историю сделок.
