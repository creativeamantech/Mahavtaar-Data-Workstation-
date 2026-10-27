import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import {
  parseMainFile,
  parsePaidFile,
  parseAdditionalFile,
  parseCorrectedFile,
  detectColumns,
  mergePaidIntoRecords,
  mergeAdditionalIntoRecords,
  mergeCorrectedIntoRecords,
} from '../fileParser';

describe('fileParser.ts - Multi-File Ingestion & Merge Invariants', () => {
  const baseRecords = [
    {
      agreementid: 'AGR_M1',
      customer_name: 'Amit Kumar',
      city: 'MUMBAI',
      state: 'MAHARASHTRA',
      bom_bkt: 1,
      principal_outstanding: 100000,
      emi_amt: 5000,
      dac: 0,
      provisional_dac: 0,
      ecs: 0,
      special: 0,
    },
    {
      agreementid: 'AGR_M2',
      customer_name: 'Sunita Sharma',
      city: 'DELHI',
      state: 'DELHI',
      bom_bkt: 2,
      principal_outstanding: 80000,
      emi_amt: 4000,
      dac: 0,
      provisional_dac: 0,
      ecs: 0,
      special: 0,
    },
  ];

  it('mergePaidIntoRecords updates DAC and clears provisional matches', () => {
    const paidRows = [
      {
        agreementid: 'AGR_M1',
        dac: 5000,
        ecs: 0,
        special: 0,
      },
    ];

    const merged = mergePaidIntoRecords(baseRecords, paidRows);
    expect(merged).toHaveLength(2);
    
    const rec1 = merged.find((r: any) => r.agreementid === 'AGR_M1');
    expect(rec1.dac).toBe(5000);
    expect(rec1.dac_source).toBe('PAID_FILE');
  });

  it('mergeAdditionalIntoRecords adds provisional dac without overriding corrected records', () => {
    const recordsWithOneCorrected = [
      {
        ...baseRecords[0],
        dac: 10000,
        dac_source: 'CORRECTED',
      },
      baseRecords[1],
    ];

    const additionalRows = [
      {
        agreementid: 'AGR_M1',
        provisional_dac: 3000,
        collection_dates: '2026-08-20',
      },
      {
        agreementid: 'AGR_M2',
        provisional_dac: 4000,
        collection_dates: '2026-08-21',
      },
    ];

    const result = mergeAdditionalIntoRecords(recordsWithOneCorrected, additionalRows);
    expect(result.stats.alreadyCorrected).toBe(1);
    expect(result.stats.newValidProv).toBe(1);
    
    const rec1 = result.merged.find((r: any) => r.agreementid === 'AGR_M1');
    expect(rec1.dac).toBe(10000); // Maintained corrected value

    const rec2 = result.merged.find((r: any) => r.agreementid === 'AGR_M2');
    expect(rec2.provisional_dac).toBe(4000);
  });

  it('mergeCorrectedIntoRecords overrides DAC and sets CORRECTED source', () => {
    const correctedRows = [
      {
        agreementid: 'AGR_M2',
        corrected_dac: 8000,
      },
    ];

    const result = mergeCorrectedIntoRecords(baseRecords, correctedRows);
    expect(result.matched).toBe(1);
    const rec2 = result.merged.find((r: any) => r.agreementid === 'AGR_M2');
    expect(rec2.dac).toBe(8000);
    expect(rec2.dac_source).toBe('CORRECTED');
  });

  describe('XLSB (Excel Binary Workbook) Support', () => {
    function createXlsbBuffer(rows: any[]): ArrayBuffer {
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(rows);
      XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
      return XLSX.write(wb, { bookType: 'xlsb', type: 'array' }) as ArrayBuffer;
    }

    it('parseMainFile parses .xlsb binary files correctly', () => {
      const sampleRows = [
        {
          AGREEMENTID: 'XLSB_MAIN_01',
          CUSTOMERNAME: 'Rajesh Verma',
          State: 'MAHARASHTRA',
          City: 'MUMBAI',
          bom_bkt: 1,
          emi_amt: 7500,
          principal_outstanding: 150000,
          DAC: 7500,
          'Final EX. Name': 'Rohan Das',
        },
      ];
      const buffer = createXlsbBuffer(sampleRows);
      const parsed = parseMainFile(buffer);
      expect(parsed).toHaveLength(1);
      expect(parsed[0].agreementid).toBe('XLSB_MAIN_01');
      expect(parsed[0].customer_name).toBe('Rajesh Verma');
      expect(parsed[0].city).toBe('MUMBAI');
      expect(parsed[0].dac).toBe(7500);
      expect(parsed[0].executive_name).toBe('Rohan Das');
    });

    it('parsePaidFile parses .xlsb binary files correctly', () => {
      const sampleRows = [
        {
          AGREEMENTID: 'XLSB_PAID_01',
          SFDC: 4000,
          Online: 1000,
          ECS: 2000,
        },
      ];
      const buffer = createXlsbBuffer(sampleRows);
      const parsed = parsePaidFile(buffer);
      expect(parsed).toHaveLength(1);
      expect(parsed[0].agreementid).toBe('XLSB_PAID_01');
      expect(parsed[0].dac).toBe(5000); // SFDC + Online
      expect(parsed[0].ecs).toBe(2000);
    });

    it('parseAdditionalFile & detectColumns parse .xlsb binary files correctly', () => {
      const sampleRows = [
        {
          AGREEMENTID: 'XLSB_ADD_01',
          Amount: 3500,
          Date: '2026-10-15',
        },
      ];
      const buffer = createXlsbBuffer(sampleRows);
      const parsed = parseAdditionalFile(buffer);
      expect(parsed).toHaveLength(1);
      expect(parsed[0].agreementid).toBe('XLSB_ADD_01');
      expect(parsed[0].provisional_dac).toBe(3500);

      const detection = detectColumns(buffer);
      expect(detection.headers).toContain('AGREEMENTID');
      expect(detection.rowCount).toBe(1);
    });

    it('parseCorrectedFile parses .xlsb binary files correctly', () => {
      const sampleRows = [
        {
          AGREEMENTID: 'XLSB_CORR_01',
          'Confirmed DAC': 12000,
        },
      ];
      const buffer = createXlsbBuffer(sampleRows);
      const parsed = parseCorrectedFile(buffer);
      expect(parsed).toHaveLength(1);
      expect(parsed[0].agreementid).toBe('XLSB_CORR_01');
      expect(parsed[0].corrected_dac).toBe(12000);
    });
  });
});

