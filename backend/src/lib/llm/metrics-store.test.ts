import { describe, it, expect, beforeEach } from 'vitest';
import { metricsStore, computeScore } from './metrics-store';

describe('metrics-store', () => {
  beforeEach(() => {
    // @ts-ignore — reset for tests
    metricsStore.store = new Map();
  });

  it('should track success and failures', () => {
    metricsStore.recordSuccess('openrouter', 1200);
    const m = metricsStore.snapshot('openrouter');
    expect(m.successCount).toBe(1);
    expect(m.failureCount).toBe(0);
    expect(m.recentLatencies).toEqual([1200]);
  });

  it('should cap recentLatencies at 20', () => {
    for (let i = 0; i < 25; i++) {
      metricsStore.recordSuccess('test', i * 100);
    }
    const m = metricsStore.snapshot('test');
    expect(m.recentLatencies.length).toBe(20);
  });

  it('should compute score', () => {
    metricsStore.recordSuccess('good', 500);
    metricsStore.recordSuccess('good', 300);
    const goodScore = computeScore('good');
    expect(goodScore).toBeGreaterThan(0.8);
  });

  it('should penalize failures', () => {
    // Pure failure: 100% fail, no successes at all
    metricsStore.recordFailure('bad');
    metricsStore.recordFailure('bad');
    metricsStore.recordFailure('bad');
    metricsStore.recordFailure('bad');
    metricsStore.recordFailure('bad');
    const m = metricsStore.snapshot('bad');
    expect(m.failureCount).toBe(5);
    expect(m.successCount).toBe(0);
    // With 0% success rate: score = 0.4*0.5 + 0.4*1.0 + 0.2*0 = 0.6 (0.5 floor prevents full zeroing)
    const badScore = computeScore('bad');
    expect(badScore).toBeLessThan(computeScore('good'));
  });

  it('should prefer faster provider', () => {
    metricsStore.recordSuccess('fast', 200);
    metricsStore.recordSuccess('fast', 300);
    metricsStore.recordSuccess('slow', 5000);
    metricsStore.recordSuccess('slow', 6000);
    expect(computeScore('fast')).toBeGreaterThan(computeScore('slow'));
  });
});
