import { describe, it, expect } from 'vitest';
import { calculateRow, safeNumber } from '../calculations';

describe('calculations.ts - Financial & Recovery Math Engine', () => {
  it('safeNumber handles invalid, NaN, Infinity and null values safely', () => {
    expect(safeNumber(null)).toBe(0);
    expect(safeNumber(undefined)).toBe(0);
    expect(safeNumber('abc')).toBe(0);
    expect(safeNumber(NaN)).toBe(0);
    expect(safeNumber(Infinity)).toBe(0);
    expect(safeNumber(12500)).toBe(12500);
    expect(safeNumber('4500.50')).toBe(4500.5);
  });

  it('calculates standard unpaid record with no collections', () => {
    const row = {
      agreementid: 'AGR001',
      principal_outstanding: 100000,
      emi_amt: 5000,
      bom_bkt: 1,
      dac: 0,
      ecs: 0,
      special: 0,
      approx_forclosure: 95000,
    };

    const res = calculateRow(row);
    expect(res.emi1).toBe(5000);
    expect(res.emi2).toBe(10000);
    expect(res.total).toBe(0);
    expect(res.posCleared).toBe(100000);
    expect(res.fcCleared).toBe(95000);
    expect(res.rbCondition).toBe(10000);
    expect(res.mainPaid).toBeNull();
    expect(res.unpaid).toBe(1);
    expect(res.mainUnpaidPOS).toBe(100000);
    expect(res.mainPaidPOS).toBeNull();
    expect(res.rollbackPOS).toBeNull();
    expect(res.emiCount).toBe(0);
  });

  it('calculates 1 EMI paid via DAC collection', () => {
    const row = {
      agreementid: 'AGR002',
      principal_outstanding: 50000,
      emi_amt: 4000,
      bom_bkt: 1,
      dac: 4000,
      ecs: 0,
      special: 0,
      approx_forclosure: 48000,
    };

    const res = calculateRow(row);
    expect(res.total).toBe(4000);
    expect(res.mainPaid).toBe(1);
    expect(res.unpaid).toBe(0);
    expect(res.mainPaidPOS).toBe(50000);
    expect(res.mainUnpaidPOS).toBeNull();
    expect(res.emiCount).toBe(1);
    expect(res.shortIn1).toBe(0);
    expect(res.rbCondition).toBe(4000); // 8000 - 4000
    expect(res.rollbackPOS).toBeNull();
  });

  it('calculates 2 EMI Rollback condition satisfied', () => {
    const row = {
      agreementid: 'AGR003',
      principal_outstanding: 80000,
      emi_amt: 3000,
      bom_bkt: 2,
      dac: 6000,
      ecs: 0,
      special: 0,
      approx_forclosure: 75000,
    };

    const res = calculateRow(row);
    expect(res.total).toBe(6000);
    expect(res.rbCondition).toBe(0); // 6000 - 6000 <= 0
    expect(res.rollbackPOS).toBe(80000);
    expect(res.emiCount).toBe(2);
    expect(res.teamRBPOS).toBe(80000);
  });

  it('accounts for Provisional DAC when not in conflict', () => {
    const row = {
      agreementid: 'AGR004',
      principal_outstanding: 60000,
      emi_amt: 5000,
      bom_bkt: 1,
      dac: 2000,
      provisional_dac: 3000,
      is_conflict: false,
    };

    const res = calculateRow(row);
    expect(res.total).toBe(5000);
    expect(res.mainPaid).toBe(1);
    expect(res.emiCount).toBe(1);
  });

  it('ignores Provisional DAC when conflict is flagged', () => {
    const row = {
      agreementid: 'AGR005',
      principal_outstanding: 60000,
      emi_amt: 5000,
      bom_bkt: 1,
      dac: 2000,
      provisional_dac: 3000,
      is_conflict: true,
    };

    const res = calculateRow(row);
    expect(res.total).toBe(2000);
    expect(res.mainPaid).toBeNull();
    expect(res.unpaid).toBe(1);
  });

  it('handles last_month_paid_flag correctly', () => {
    const row = {
      agreementid: 'AGR006',
      principal_outstanding: 40000,
      emi_amt: 5000,
      bom_bkt: 1,
      dac: 0,
      last_month_paid_flag: true,
    };

    const res = calculateRow(row);
    expect(res.mainPaid).toBe(1);
    expect(res.teamPaid).toBe(1);
    expect(res.emiCount).toBe(1);
  });

  it('handles Foreclosure full clearance', () => {
    const row = {
      agreementid: 'AGR007',
      principal_outstanding: 50000,
      approx_forclosure: 45000,
      emi_amt: 6000,
      bom_bkt: 1,
      dac: 45000,
    };

    const res = calculateRow(row);
    expect(res.fcCleared).toBe(0);
    expect(res.mainPaid).toBe(1);
    expect(res.teamPaid).toBe(1);
  });

  it('handles settlement approved amount meeting threshold', () => {
    const row = {
      agreementid: 'AGR008',
      principal_outstanding: 100000,
      emi_amt: 8000,
      bom_bkt: 3,
      dac: 25000,
      settlement_approved_amt: 25000,
      ecs: 0,
      special: 0,
      approx_forclosure: 90000,
    };

    const res = calculateRow(row);
    expect(res.total).toBe(25000);
    expect(res.mainPaid).toBe(1);
    expect(res.emiCount).toBeGreaterThanOrEqual(1);
  });

  it('handles multi-tier 3x and 4x EMI thresholds in high buckets', () => {
    const row = {
      agreementid: 'AGR009',
      principal_outstanding: 200000,
      emi_amt: 5000,
      bom_bkt: 4,
      dac: 20000, // 4 * 5000
      ecs: 0,
      special: 0,
      approx_forclosure: 180000,
    };

    const res = calculateRow(row);
    expect(res.total).toBe(20000);
    expect(res.emiCount).toBe(4);
    expect(res.mainPaid).toBe(1);
    expect(res.rollbackPOS).toBe(200000);
  });

  it('evaluates ECS and Special collection counts when DAC is 0', () => {
    const row = {
      agreementid: 'AGR010',
      principal_outstanding: 50000,
      emi_amt: 4000,
      bom_bkt: 1,
      dac: 0,
      ecs: 2000,
      special: 2000,
      approx_forclosure: 45000,
    };

    const res = calculateRow(row);
    expect(res.total).toBe(4000);
    expect(res.ecsCount).toBe(1);
    expect(res.ecsPOS).toBe(50000);
    expect(res.mainPaid).toBe(1);
  });

  it('calculates shortfall amounts shortIn1 and shortIn2 accurately', () => {
    const row = {
      agreementid: 'AGR011',
      principal_outstanding: 50000,
      emi_amt: 5000,
      bom_bkt: 2,
      dac: 3000,
      ecs: 0,
      special: 0,
      approx_forclosure: 48000,
    };

    const res = calculateRow(row);
    expect(res.shortIn1).toBe(2000); // 5000 - 3000

    const row2 = {
      agreementid: 'AGR012',
      principal_outstanding: 50000,
      emi_amt: 5000,
      bom_bkt: 2,
      dac: 7000,
      ecs: 0,
      special: 0,
      approx_forclosure: 48000,
    };

    const res2 = calculateRow(row2);
    expect(res2.shortIn1).toBe(0);
    expect(res2.shortIn2).toBe(3000); // 10000 - 7000
  });
});
