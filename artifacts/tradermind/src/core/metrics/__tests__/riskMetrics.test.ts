import { describe, expect, it } from 'vitest';
import type { Trade } from '../../../db/database';
import { computeRiskMetrics } from '../riskMetrics';

let nextId = 0;

function makeTrade(overrides: Partial<Trade> = {}): Trade {
  return {
    id: `risk-test-${nextId++}`,
    symbol: 'EURUSD',
    direction: 'long',
    entryPrice: 1,
    stopLoss: 0.9,
    result: 'win',
    status: 'closed',
    openedAt: 0,
    closedAt: 1,
    rMultiple: 1,
    riskPercentage: 1,
    ...overrides,
  } as Trade;
}

describe('riskMetrics regression coverage', () => {
  it('calculates Kelly from trades with R data only and uses the standard formula', () => {
    const metrics = computeRiskMetrics([
      makeTrade({ rMultiple: 2 }),
      makeTrade({ rMultiple: 2 }),
      makeTrade({ result: 'loss', rMultiple: -1 }),
      makeTrade({ result: 'loss', rMultiple: -1 }),
      makeTrade({ rMultiple: null, result: 'breakeven' }),
    ]);

    expect(metrics.kellyPct).toBeCloseTo(25);
  });

  it('uses downside deviation across all R observations for Sortino', () => {
    const metrics = computeRiskMetrics([
      makeTrade({ rMultiple: 2 }),
      makeTrade({ rMultiple: 2 }),
      makeTrade({ result: 'loss', rMultiple: -1 }),
      makeTrade({ result: 'loss', rMultiple: -1 }),
    ]);

    expect(metrics.sortinoRatio).toBeCloseTo(0.5 / Math.sqrt(0.5));
  });
});