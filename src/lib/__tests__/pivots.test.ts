import { describe, it, expect } from 'vitest';
import { buildCityPivot, buildTeamPivot, buildCrossTab, computeDailyRequiredPOS } from '../pivots';

describe('pivots.ts - Aggregation and Pivot Matrix Calculations', () => {
  const records = [
    {
      agreementid: 'AGR1',
      city: 'MUMBAI',
      state: 'MAHARASHTRA',
      executive_name: 'Rahul Sharma',
      bom_bkt: 1,
      principal_outstanding: 100000,
      emi_amt: 5000,
      dac: 5000,
      ecs: 0,
      special: 0,
    },
    {
      agreementid: 'AGR2',
      city: 'MUMBAI',
      state: 'MAHARASHTRA',
      executive_name: 'Rahul Sharma',
      bom_bkt: 1,
      principal_outstanding: 200000,
      emi_amt: 8000,
      dac: 0,
      ecs: 0,
      special: 0,
    },
    {
      agreementid: 'AGR3',
      city: 'PUNE',
      state: 'MAHARASHTRA',
      executive_name: 'Aarti Patil',
      bom_bkt: 2,
      principal_outstanding: 150000,
      emi_amt: 6000,
      dac: 12000,
      ecs: 0,
      special: 0,
    },
  ];

  it('buildCityPivot aggregates counts, total POS, and paid POS', () => {
    const cityPivot = buildCityPivot(records);
    expect(cityPivot).toHaveLength(2);

    const mumbai = cityPivot.find(c => c.city === 'MUMBAI');
    expect(mumbai).toBeDefined();
    expect(mumbai?.count).toBe(2);
    expect(mumbai?.totalPOS).toBe(300000);
    expect(mumbai?.paid).toBe(1);
    expect(mumbai?.paidPOS).toBe(100000);
    expect(mumbai?.pct).toBeCloseTo(100000 / 300000);

    const pune = cityPivot.find(c => c.city === 'PUNE');
    expect(pune).toBeDefined();
    expect(pune?.count).toBe(1);
    expect(pune?.totalPOS).toBe(150000);
    expect(pune?.paid).toBe(1);
    expect(pune?.paidPOS).toBe(150000);
    expect(pune?.pct).toBe(1.0);
  });

  it('buildTeamPivot groups by bucket and executive name', () => {
    const teamPivot = buildTeamPivot(records);
    expect(teamPivot.length).toBeGreaterThanOrEqual(2);

    const rahul = teamPivot.find(t => t.exec === 'Rahul Sharma');
    expect(rahul).toBeDefined();
    expect(rahul?.count).toBe(2);
    expect(rahul?.paid).toBe(1);
  });

  it('buildCrossTab constructs an executive x city matrix', () => {
    const crossTab = buildCrossTab(records);
    expect(crossTab.cities).toContain('MUMBAI');
    expect(crossTab.cities).toContain('PUNE');
    expect(crossTab.execs).toContain('Rahul Sharma');
    expect(crossTab.execs).toContain('Aarti Patil');
    expect(crossTab.matrix['MUMBAI']['Rahul Sharma'].totalPOS).toBe(300000);
  });

  it('computeDailyRequiredPOS calculates required pace', () => {
    const targetPOS = 100000;
    const paidPOS = 40000;
    // Without targetDate, returns full needed
    expect(computeDailyRequiredPOS(targetPOS, paidPOS)).toBe(60000);
    // When target is met, returns 0
    expect(computeDailyRequiredPOS(targetPOS, 120000)).toBe(0);
  });
});
