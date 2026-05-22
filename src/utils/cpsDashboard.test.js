import test from 'node:test';
import assert from 'node:assert/strict';

import { CPS_SCHEMA_VERSION, normalizeDashboardData } from './cpsDashboard.js';

test('normalizes CPS net-ledger Firebase state', () => {
  const data = {
    schema_version: CPS_SCHEMA_VERSION,
    pos: {
      strategy_version: 'ut3_cps',
      symbol: 'BTCUSDT',
      current_pnl: 12.5,
      current_price: 100,
      target_signed_units: -1.25,
      target_signed_qty: -0.0125,
      actual_signed_qty: -0.01,
      delta_signed_qty: -0.0025,
      amount_per_unit_usdt: 100,
      latest_signal: 2,
      latest_direction: 'short',
      selected_rule: { source: 'family_a', label: 'rule_a', base_horizon_minutes: 180 },
    },
    cps_ledger: {
      active: [{
        leg_id: 'leg-1',
        symbol: 'BTCUSDT',
        direction: 'short',
        signed_units: -1.25,
        effective_size: 1.25,
        entry_price: 100,
        entry_time: 1000,
        emergency_stop_bps: 30,
        take_profit_bps: 100,
        estimated_pnl_usdt: 1.5,
      }],
      shadow: [{ leg_id: 'shadow-1', status: 'shadow' }],
      recently_closed: [{ symbol: 'BTCUSDT', profit: 2 }],
    },
    cps_executions: [{ id: 1, target_id: 'target', status: 'executed' }],
    cps_history: [{ symbol: 'BTCUSDT', timestamp_open: 1000, profit: 2 }],
  };

  const out = normalizeDashboardData(data, 'ETHUSDT');

  assert.equal(out.isCps, true);
  assert.equal(out.overview.strategyVersion, 'ut3_cps');
  assert.equal(out.overview.targetDirection, 'short');
  assert.equal(out.overview.activeCount, 1);
  assert.equal(out.ledger.shadow.length, 1);
  assert.equal(out.executions.length, 1);
  assert.equal(out.history.length, 1);
  assert.equal(out.chartPositions.length, 1);
  assert.equal(out.chartPositions[0].side, 2);
  assert.equal(out.chartPositions[0].tp, 99);
  assert.equal(Number(out.chartPositions[0].sl.toFixed(4)), 100.3);
});

test('keeps legacy dashboard fallback readable', () => {
  const out = normalizeDashboardData({
    pos: {
      pos_exist: 1,
      symbol: 'BTCUSDT',
      open_price: 100,
      timestamp_open: 1000,
      qty: 0.2,
      current_pnl: 3,
      side: 1,
    },
    hist: [{ profit: 3 }],
    report: { pnl: 3 },
  });

  assert.equal(out.isCps, false);
  assert.equal(out.chartPositions.length, 1);
  assert.equal(out.chartPositions[0].label, 'Net');
  assert.equal(out.history.length, 1);
  assert.deepEqual(out.report, { pnl: 3 });
});
