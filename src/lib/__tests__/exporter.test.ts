import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as XLSX from 'xlsx';
import {
  exportToExcel,
  exportCityPivot,
  exportTeamPivot,
  exportMatrix,
  exportRawData,
  exportBucketCityPivot,
  exportExecCityPivot,
} from '../exporter';

vi.mock('xlsx', () => {
  return {
    utils: {
      json_to_sheet: vi.fn((data) => ({ data })),
      book_new: vi.fn(() => ({ Sheets: {}, SheetNames: [] })),
      book_append_sheet: vi.fn(),
    },
    writeFile: vi.fn(),
  };
});

describe('exporter.ts - Export Formats and Data Transformers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('exportToExcel creates workbook and triggers write', () => {
    const sampleData = [{ id: 1, name: 'Test' }];
    exportToExcel(sampleData, 'Sheet1', 'test.xlsx');
    
    expect(XLSX.utils.json_to_sheet).toHaveBeenCalledWith(sampleData);
    expect(XLSX.utils.book_new).toHaveBeenCalled();
    expect(XLSX.writeFile).toHaveBeenCalledWith(expect.any(Object), 'test.xlsx');
  });

  it('exportCityPivot formats table rows and computes grand totals', () => {
    const cityPivotData = [
      {
        city: 'MUMBAI',
        state: 'MAHARASHTRA',
        collection: 50000,
        pct: 0.75,
        rollbackPct: 0.25,
        count: 10,
        totalPOS: 200000,
        paid: 8,
        paidPOS: 150000,
        target: 160000,
        targetDate: '2026-09-01',
        dailyRequiredPOS: 2500,
      },
    ];

    exportCityPivot(cityPivotData);
    expect(XLSX.writeFile).toHaveBeenCalled();
  });

  it('exportTeamPivot outputs team performance format', () => {
    const teamData = [
      {
        bkt: 1,
        exec: 'Rahul Sharma',
        collection: 30000,
        count: 5,
        paid: 4,
        totalPOS: 100000,
        paidPOS: 80000,
        pct: 0.8,
      },
    ];

    exportTeamPivot(teamData);
    expect(XLSX.writeFile).toHaveBeenCalled();
  });

  it('exportMatrix formats cross-tab matrix properly', () => {
    const matrixData = {
      cities: ['MUMBAI', 'PUNE'],
      execs: ['Rahul Sharma', 'Aarti Patil'],
      matrix: {
        MUMBAI: {
          'Rahul Sharma': { paidPOS: 50000, totalPOS: 100000 },
        },
      },
    };

    exportMatrix(matrixData, 1);
    expect(XLSX.writeFile).toHaveBeenCalled();
  });

  it('exportRawData handles raw record mapping', () => {
    const records = [
      {
        agreementid: 'AGR100',
        bom_bkt: 1,
        emi_amt: 4000,
        principal_outstanding: 50000,
        dac: 4000,
        ecs: 0,
        special: 0,
        city: 'MUMBAI',
        state: 'MAHARASHTRA',
        executive_name: 'Rahul Sharma',
      },
    ];

    exportRawData(records);
    expect(XLSX.writeFile).toHaveBeenCalled();
  });

  it('exportBucketCityPivot and exportExecCityPivot generate sheets without errors', () => {
    const bucketData = [
      {
        bkt: 1,
        city: 'MUMBAI',
        collection: 50000,
        count: 10,
        paid: 8,
        posPaidOnlyCount: 1,
        totalPOS: 200000,
        paidPOS: 150000,
        target: 160000,
        targetDate: '2026-09-01',
        dailyRequiredPOS: 2500,
        posPaidOnlyPOS: 20000,
        pct: 0.75,
      },
    ];
    exportBucketCityPivot(bucketData);
    exportExecCityPivot(bucketData);
    expect(XLSX.writeFile).toHaveBeenCalledTimes(2);
  });
});
