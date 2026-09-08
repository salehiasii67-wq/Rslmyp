import { describe, expect, it } from 'vitest';
import type { Trade } from '../../db/database';
import {
  calcBaseMetrics,
  getByDay,
  getDecisionQualityAnalysis,
  getEvolution,
  getPerfInsights,
  getScorecard,
} from '../performanceService';

let nextId = 0;

function makeTrade(overrides: Partial<Trade> = {}): Trade {
  return {
    id: `performance-test-${nextId++}`,
    sessionId: null,
    strategyId: null,
    accountId: null,
    boxId: null,
    symbol: 'EURUSD',
    market: null,
    direction: 'long',
    entryPrice: 1,
    exitPrice: 1.1,
    stopLoss: 0.9,
    takeProfit: null,
    positionSize: 1,
    riskPercentage: 1,
    riskAmount: 1,
    rMultiple: 1,
    result: 'win',
    profitLoss: 100,
    fees: null,
    status: 'closed',
    openedAt: Date.UTC(2026, 0, 1, 12),
    closedAt: Date.UTC(2026, 0, 1, 13),
    reasonForExit: null,
    emotions: '[]',
    emotionNotes: null,
    notes: null,
    screenshots: '[]',
    adherenceScore: null,
    adherenceRating: null,
    adherenceNotes: null,
    review: '{}',
    postTradeReview: '{}',
    tags: '[]',
    createdAt: 0,
    liveMonitoring: null,
    plannedEntry: null,
    plannedSL: null,
    plannedTP: null,
    plannedRR: null,
    plannedRisk: null,
    plannedPositionSize: null,
    tradingSession: 'asia',
    setupType: 'common',
    timezone: 'UTC',
    entryReason: null,
    lesson: null,
    slMoved: null,
    tpMoved: null,
    partialClose: null,
    addedToPosition: null,
    reducedPosition: null,
    manualExit: null,
    managementReason: null,
    mtfAnalysis: null,
    ...overrides,
  };
}

describe('performanceService regression coverage', () => {
  it('maps UTC weekday numbers to the correct Persian names', () => {
    const sunday = makeTrade({ openedAt: Date.UTC(2026, 8, 6, 12) });
    const saturday = makeTrade({ openedAt: Date.UTC(2026, 8, 12, 12) });

    expect(getByDay([sunday, saturday]).map(day => day.dayName)).toEqual(['یکشنبه', 'شنبه']);
  });

  it('uses net P/L for financial metrics when fees are recorded separately', () => {
    const metrics = calcBaseMetrics([
      makeTrade({ profitLoss: 100, fees: 10 }),
      makeTrade({ result: 'loss', rMultiple: -1, profitLoss: -50, fees: 5 }),
    ]);

    expect(metrics.totalPnL).toBe(35);
    expect(metrics.profitFactor).toBeCloseTo(90 / 55);
  });

  it('selects the best session and setup by average R, not by frequency', () => {
    const trades = [
      ...Array.from({ length: 20 }, (_, i) => makeTrade({
        tradingSession: 'asia',
        setupType: 'common',
        rMultiple: i % 2 === 0 ? 0.2 : -0.1,
        profitLoss: i % 2 === 0 ? 20 : -10,
        openedAt: Date.UTC(2026, 0, 1 + i, 12),
      })),
      ...Array.from({ length: 20 }, (_, i) => makeTrade({
        tradingSession: 'london',
        setupType: 'rare',
        rMultiple: 2,
        profitLoss: 200,
        openedAt: Date.UTC(2026, 1, 1 + i, 12),
      })),
    ];

    const insights = getPerfInsights(trades);
    expect(insights.find(insight => insight.id === 'best-session')?.title).toContain('لندن');
    expect(insights.find(insight => insight.id === 'best-setup')?.title).toContain('rare');
  });

  it('includes a score of exactly 100 in the excellent decision bucket', () => {
    const trade = makeTrade({
      postTradeReview: JSON.stringify({
        tradeQualityScore: 5,
        executionQualityScore: 5,
        analysisQualityScore: 5,
        riskMgmtQualityScore: 5,
      }),
    });

    const analysis = getDecisionQualityAnalysis([trade]);
    expect(analysis.buckets).toEqual([
      expect.objectContaining({ level: 'excellent', count: 1 }),
    ]);
  });

  it('counts only closed trades when calculating the scorecard review rate', () => {
    const reviewed = JSON.stringify({ completedAt: 1 });
    const scorecard = getScorecard([
      makeTrade({ postTradeReview: reviewed }),
      makeTrade({ status: 'open', result: 'open', postTradeReview: reviewed }),
    ]);

    expect(scorecard.components.find(component => component.label === 'پیشرفت یادگیری')?.details)
      .toContain('نرخ ریویو: 100%');
  });

  it('groups dates at the year boundary using ISO week years', () => {
    const evolution = getEvolution([
      makeTrade({ openedAt: Date.UTC(2020, 11, 31, 12) }),
      makeTrade({ openedAt: Date.UTC(2021, 0, 1, 12) }),
      makeTrade({ openedAt: Date.UTC(2021, 0, 4, 12) }),
    ], 'week');

    expect(evolution.map(period => period.periodKey)).toEqual(['2020-W53', '2021-W01']);
    expect(evolution[0].count).toBe(2);
  });
});