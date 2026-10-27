import { describe, it, expect } from 'vitest';
import {
  normalizeKeyPart,
  buildTargetKey,
  resolveTargetPct,
  resolveTarget,
  findMatchingRecordsCountAccurate,
} from '../targets';

describe('targets.ts - Hierarchical Target Resolution and Forecasting Engine', () => {
  it('normalizes string keys cleanly', () => {
    expect(normalizeKeyPart('  mumbai  ')).toBe('MUMBAI');
    expect(normalizeKeyPart(null)).toBe('');
    expect(normalizeKeyPart(undefined)).toBe('');
    expect(normalizeKeyPart(123)).toBe('123');
  });

  it('buildTargetKey constructs correct hierarchy identifiers', () => {
    expect(buildTargetKey({})).toBe('GLOBAL');
    expect(buildTargetKey({ bkt: '1' })).toBe('GLOBAL__BKT__1');
    expect(buildTargetKey({ city: 'Pune', bkt: '2' })).toBe('CITY__PUNE__BKT__2');
    expect(buildTargetKey({ state: 'Maharashtra', bkt: '3' })).toBe('STATE__MAHARASHTRA__BKT__3');
    expect(buildTargetKey({ city: 'Mumbai' })).toBe('CITY__MUMBAI');
    expect(buildTargetKey({ state: 'Gujarat' })).toBe('STATE__GUJARAT');
  });

  it('resolveTargetPct follows strict fallback precedence (City+Bkt > State+Bkt > Global+Bkt > City > State > Global)', () => {
    const targets = {
      'GLOBAL': 0.50,
      'STATE__MAHARASHTRA': 0.60,
      'CITY__MUMBAI': 0.70,
      'GLOBAL__BKT__1': 0.75,
      'STATE__MAHARASHTRA__BKT__1': 0.80,
      'CITY__MUMBAI__BKT__1': 0.85,
    };

    // Exact City+Bkt match
    expect(resolveTargetPct(targets, { city: 'Mumbai', state: 'Maharashtra', bkt: '1' })).toBe(0.85);

    // Fallback to State+Bkt if City is different
    expect(resolveTargetPct(targets, { city: 'Nagpur', state: 'Maharashtra', bkt: '1' })).toBe(0.80);

    // Fallback to Global+Bkt if State is different
    expect(resolveTargetPct(targets, { city: 'Ahmedabad', state: 'Gujarat', bkt: '1' })).toBe(0.75);

    // Fallback to City if Bkt is different
    expect(resolveTargetPct(targets, { city: 'Mumbai', state: 'Maharashtra', bkt: '2' })).toBe(0.70);

    // Fallback to State if City has no override
    expect(resolveTargetPct(targets, { city: 'Nagpur', state: 'Maharashtra', bkt: '2' })).toBe(0.60);

    // Fallback to Global
    expect(resolveTargetPct(targets, { city: 'Ahmedabad', state: 'Gujarat', bkt: '2' })).toBe(0.50);
  });

  it('resolveTarget handles scheduled target dates', () => {
    const today = new Date().toISOString().split('T')[0];
    const targets = {
      'GLOBAL@@2099-12-31': 0.90,
      'CITY__MUMBAI': 0.65,
    };

    const res = resolveTarget(targets, { city: 'Pune' });
    expect(res.pct).toBe(0.90);
    expect(res.date).toBe('2099-12-31');
  });

  it('findMatchingRecordsCountAccurate counts records resolving to target key', () => {
    const targets = {
      'GLOBAL': 0.50,
      'CITY__MUMBAI__BKT__1': 0.85,
    };

    const records = [
      { city: 'Mumbai', state: 'Maharashtra', bom_bkt: 1 },
      { city: 'Mumbai', state: 'Maharashtra', bom_bkt: 2 },
      { city: 'Pune', state: 'Maharashtra', bom_bkt: 1 },
    ];

    const countMumbaiBkt1 = findMatchingRecordsCountAccurate('CITY__MUMBAI__BKT__1', targets, records);
    expect(countMumbaiBkt1).toBe(1);

    const countGlobal = findMatchingRecordsCountAccurate('GLOBAL', targets, records);
    expect(countGlobal).toBe(2);
  });
});
