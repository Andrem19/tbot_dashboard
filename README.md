# Trading Bot Dashboard

Read-only React dashboard for monitoring a trading bot in the browser. The app subscribes to Firebase Realtime Database for bot state, loads market candles from Binance Futures, and visualizes current position, PnL, reports, and trade history.

## Features

- Live Firebase subscription for bot state under the `dashb` path.
- Binance Futures candle loading and WebSocket updates.
- Candlestick chart with current position levels and history markers.
- Header controls for symbol, candle count, and interval.
- PnL, position age, database status, and WebSocket status indicators.
- Report strip for aggregated bot metrics.
- Daily history heatmap for trade outcome inspection.
- GitHub Pages deployment workflow.

## Tech Stack

- React 18
- Vite
- Firebase Realtime Database
- lightweight-charts
- Binance Futures REST and WebSocket APIs

## Configuration

Create a local `.env` file from `.env.example`:

```bash
cp .env.example .env
```

Set Firebase web app values:

```env
VITE_FIREBASE_API_KEY=replace-with-firebase-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_DATABASE_URL=https://your-project-default-rtdb.region.firebasedatabase.app
VITE_FIREBASE_PROJECT_ID=your-project
VITE_FIREBASE_STORAGE_BUCKET=your-project.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=000000000000
VITE_FIREBASE_APP_ID=1:000000000000:web:example
```

Firebase web config values are not server secrets, but project-specific runtime config should stay in local env files or deployment secrets. Database security rules must protect any sensitive trading data.

## Development

```bash
npm install
npm run dev
```

Build:

```bash
npm run build
```

Preview production build:

```bash
npm run preview
```

## Data Model

The dashboard expects Firebase data under `dashb`:

```json
{
  "pos": {
    "pos_exist": true,
    "symbol": "BTCUSDT",
    "open_price": 68000,
    "sl_price": 67000,
    "tp_price": 70000,
    "timestamp_open": 1730000000,
    "qty": 0.01,
    "current_pnl": 12.34,
    "side": 1
  },
  "report": {
    "winrate": 0.63,
    "avg_rr": 1.42
  },
  "hist": []
}
```

More implementation notes are in [`docs/`](docs/).

## Scope

This dashboard does not send trading commands and does not write to Firebase. It is intentionally a read-only monitoring interface.
