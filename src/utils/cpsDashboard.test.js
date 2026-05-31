import test from 'node:test';
import assert from 'node:assert/strict';

import { CPS_SCHEMA_VERSION, normalizeDashboardData } from './cpsDashboard.js';

test('normalizes CPS net-ledger Firebase state', () => {
  const data = {
    schema_version: CPS_SCHEMA_VERSION,
    pos: {
      strategy_version: 'ut8_cps_20260531_181254_2a4d754b',
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
    cps_reconciliation: {
      status: 'ok',
      unsafe_to_trade: false,
      active_leg_count: 1,
      target_signed_units: -1.25,
    },
    cps_events: [{
      event_type: 'reconciliation_result',
      event_ms: 1760000000000,
      status: 'ok',
      details_json: '{"active_legs":1,"target_units":-1.25}',
    }],
    cps_contract: {
      contract_version: 'ut8_cps_net_ledger_contract_v1',
      strategy_version: 'ut8_cps_20260531_181254_2a4d754b',
      contract_hash: 'cd6800b2cf7a26d70882690582f122388cd50ea03eef631d2d26793635e2373a',
      snapshot_job_id: 'cps_20260531_181254_2a4d754b',
      execution_model: 'net_ledger',
      exchange_position_model: 'single_net_position',
      max_active_legs: 2,
      max_entries_per_hour: 1,
      max_effective_size: 1,
    },
    strategy_runtime_state: {
      active_strategy_id: 'ut8_cps_20260531_181254_2a4d754b',
      active_contract_hash: 'cd6800b2cf7a26d70882690582f122388cd50ea03eef631d2d26793635e2373a',
      migrated_at_ms: 1760000000000,
      trading_enabled: true,
      status: 'ready',
    },
    cps_history: [{ symbol: 'BTCUSDT', timestamp_open: 1000, profit: 2 }],
  };

  const out = normalizeDashboardData(data, 'ETHUSDT');

  assert.equal(out.isCps, true);
  assert.equal(out.overview.strategyVersion, 'ut8_cps_20260531_181254_2a4d754b');
  assert.equal(out.overview.targetDirection, 'short');
  assert.equal(out.overview.activeCount, 1);
  assert.equal(out.ledger.shadow.length, 1);
  assert.equal(out.executions.length, 1);
  assert.equal(out.events.length, 1);
  assert.equal(out.events[0].details.active_legs, 1);
  assert.equal(out.overview.contractVersion, 'ut8_cps_net_ledger_contract_v1');
  assert.equal(out.overview.maxActiveLegs, 2);
  assert.equal(out.overview.maxEntriesPerHour, 1);
  assert.equal(out.overview.maxEffectiveSize, 1);
  assert.equal(out.overview.reconciliationStatus, 'ok');
  assert.equal(out.overview.reconciliation.active_leg_count, 1);
  assert.equal(out.overview.runtimeState.status, 'ready');
  assert.equal(out.overview.runtimeState.trading_enabled, true);
  assert.deepEqual(out.warnings, []);
  assert.equal(out.history.length, 1);
  assert.equal(out.chartPositions.length, 1);
  assert.equal(out.chartPositions[0].side, 2);
  assert.equal(out.chartPositions[0].tp, 99);
  assert.equal(Number(out.chartPositions[0].sl.toFixed(4)), 100.3);
});

test('surfaces strategy runtime migration warnings', () => {
  const out = normalizeDashboardData({
    schema_version: CPS_SCHEMA_VERSION,
    pos: { strategy_version: 'ut8_cps_20260531_181254_2a4d754b' },
    cps_signal: {},
    cps_contract: {
      contract_version: 'ut8_cps_net_ledger_contract_v1',
      strategy_version: 'ut8_cps_20260531_181254_2a4d754b',
      contract_hash: 'hash',
    },
    strategy_runtime_state: {
      status: 'blocked',
      trading_enabled: false,
      notes: 'strategy_contract_changed_requires_explicit_db_migration',
    },
    cps_reconciliation: { status: 'ok', unsafe_to_trade: false },
  });

  assert.ok(out.warnings.includes('strategy runtime blocked'));
  assert.ok(out.warnings.includes('strategy trading disabled'));
  assert.equal(out.overview.runtimeState.notes, 'strategy_contract_changed_requires_explicit_db_migration');
});

test('uses contract strategy version and safe recovery statuses without warnings', () => {
  const out = normalizeDashboardData({
    schema_version: CPS_SCHEMA_VERSION,
    pos: {},
    cps_signal: {},
    cps_contract: {
      contract_version: 'ut8_cps_net_ledger_contract_v1',
      strategy_version: 'ut8_cps_contract',
      contract_hash: 'hash',
    },
    cps_reconciliation: { status: 'ok', unsafe_to_trade: false },
    cps_events: [{ event_type: 'reconciliation_result', status: 'recovery_ok' }],
  });

  assert.equal(out.overview.strategyVersion, 'ut8_cps_contract');
  assert.deepEqual(out.warnings, []);
});

test('does not surface old rejected recovery event after successful reconciliation', () => {
  const out = normalizeDashboardData({
    schema_version: CPS_SCHEMA_VERSION,
    pos: {},
    cps_signal: {},
    cps_contract: {
      contract_version: 'ut8_cps_net_ledger_contract_v1',
      strategy_version: 'ut8_cps_contract',
      contract_hash: 'hash',
    },
    cps_reconciliation: { status: 'ok', unsafe_to_trade: false },
    cps_events: [
      { event_type: 'reconciliation_result', event_ms: 2000, status: 'recovery_ok' },
      {
        event_type: 'signal_rejected',
        event_ms: 1000,
        status: 'rejected',
        reason: 'recovery_contract_validation_failed',
      },
    ],
  });

  assert.deepEqual(out.warnings, []);
});

test('surfaces CPS dashboard contract and signal warnings', () => {
  const out = normalizeDashboardData({
    schema_version: CPS_SCHEMA_VERSION,
    pos: { strategy_version: 'ut8_cps_20260531_181254_2a4d754b' },
    cps_signal: {
      signal: 0,
      status: 'fail_closed',
      generated_ms: Date.now() - 3 * 60 * 60 * 1000,
    },
    cps_reconciliation: { status: 'missing_exchange_position', unsafe_to_trade: true },
    cps_ledger: {},
    cps_events: [{ event_type: 'rebalance_failed', status: 'failed', reason: 'exchange_position_mismatch' }],
  });

  assert.equal(out.isCps, true);
  assert.ok(out.warnings.includes('missing cps_contract'));
  assert.ok(out.warnings.includes('missing contract_hash'));
  assert.ok(out.warnings.includes('signal fail-closed'));
  assert.ok(out.warnings.includes('stale signal'));
  assert.ok(out.warnings.includes('reconciliation unsafe: missing_exchange_position'));
  assert.ok(out.warnings.some((warning) => warning.includes('rebalance_failed')));
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
  assert.equal(out.events.length, 0);
  assert.deepEqual(out.report, { pnl: 3 });
});
