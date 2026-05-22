export const CPS_SCHEMA_VERSION = 'cps_net_ledger_v1';

export function normalizeDashboardData(dashb, fallbackCoin = 'BTCUSDT') {
  const isCps = dashb?.schema_version === CPS_SCHEMA_VERSION;
  if (!isCps) {
    return {
      isCps: false,
      report: dashb?.report || null,
      history: asArray(dashb?.hist),
      chartPositions: legacyChartPositions(dashb?.pos, fallbackCoin),
      overview: null,
      ledger: null,
      executions: [],
    };
  }

  const ledger = dashb?.cps_ledger || {};
  const pos = dashb?.pos || {};
  const signal = dashb?.cps_signal || {};
  const active = asArray(ledger.active);
  const shadow = asArray(ledger.shadow);
  const closed = asArray(ledger.recently_closed);

  return {
    isCps: true,
    report: dashb?.report || null,
    history: asArray(dashb?.cps_history),
    chartPositions: active.map((leg) => cpsLegChartPosition(leg, fallbackCoin)),
    overview: {
      schemaVersion: dashb?.schema_version,
      strategyVersion: pos.strategy_version || signal.version || '',
      symbol: pos.symbol || fallbackCoin,
      currentPnl: finiteNumber(pos.current_pnl),
      currentPrice: finiteNumber(pos.current_price),
      targetSignedUnits: finiteNumber(pos.target_signed_units),
      targetSignedQty: finiteNumber(pos.target_signed_qty),
      actualSignedQty: finiteNumber(pos.actual_signed_qty),
      deltaSignedQty: finiteNumber(pos.delta_signed_qty),
      targetDirection: signedDirection(pos.target_signed_units),
      activeCount: Number(pos.active_virtual_leg_count ?? active.length),
      shadowCount: Number(pos.shadow_virtual_leg_count ?? shadow.length),
      amountPerUnit: finiteNumber(pos.amount_per_unit_usdt),
      latestSignal: Number(pos.latest_signal ?? signal.signal ?? 0),
      latestDirection: pos.latest_direction || signal.direction || '',
      selectedRule: pos.selected_rule || signal.selected_rule || {},
      features: signal.features || {},
    },
    ledger: {
      active,
      shadow,
      recentlyClosed: closed,
      summary: ledger.summary || {},
    },
    executions: asArray(dashb?.cps_executions),
  };
}

function legacyChartPositions(pos, fallbackCoin) {
  if (!pos || !pos.pos_exist) return [];
  return [{
    key: 'CurrentPos',
    visible: true,
    baseCoin: pos.symbol || fallbackCoin,
    entryPx: finiteNumber(pos.open_price),
    sl: finiteNumber(pos.sl_price),
    tp: finiteNumber(pos.tp_price),
    openTime: Number(pos.timestamp_open || 0),
    qty: finiteNumber(pos.qty),
    pnl: finiteNumber(pos.current_pnl),
    side: Number(pos.side || pos.pos_exist || 0),
    label: 'Net',
  }];
}

function cpsLegChartPosition(leg, fallbackCoin) {
  const entryPx = finiteNumber(leg.entry_price);
  const stopBps = finiteNumber(leg.emergency_stop_bps);
  const takeBps = finiteNumber(leg.take_profit_bps);
  const isLong = leg.direction === 'long' || Number(leg.side) === 1;
  return {
    key: leg.leg_id,
    visible: true,
    baseCoin: leg.symbol || fallbackCoin,
    entryPx,
    sl: stopBps > 0 && entryPx > 0 ? entryPx * (isLong ? 1 - stopBps / 10000 : 1 + stopBps / 10000) : null,
    tp: takeBps > 0 && entryPx > 0 ? entryPx * (isLong ? 1 + takeBps / 10000 : 1 - takeBps / 10000) : null,
    openTime: Number(leg.entry_time || 0),
    qty: finiteNumber(leg.effective_size),
    pnl: finiteNumber(leg.estimated_pnl_usdt),
    side: Number(leg.side || (isLong ? 1 : 2)),
    label: `${leg.direction || 'leg'} ${formatUnits(leg.signed_units)}`,
    ruleLabel: leg.rule_label || '',
    familyId: leg.family_id || '',
  };
}

export function asArray(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (value && typeof value === 'object') return Object.values(value).filter(Boolean);
  return [];
}

export function finiteNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function formatSigned(value, digits = 4) {
  const n = finiteNumber(value);
  const prefix = n > 0 ? '+' : '';
  return `${prefix}${n.toFixed(digits)}`;
}

export function formatUnits(value) {
  return `${formatSigned(value, 2)}u`;
}

export function signedDirection(value) {
  const n = finiteNumber(value);
  if (n > 0) return 'long';
  if (n < 0) return 'short';
  return 'flat';
}
