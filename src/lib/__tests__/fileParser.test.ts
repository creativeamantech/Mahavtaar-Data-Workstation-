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
  resolveCustomerName,
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

    it('parseMainFile detects customer name with exact header "customer Name"', () => {
      const sampleRows = [
        {
          AGREEMENTID: 'CUST_NAME_01',
          'customer Name': 'Pooja Agarwal',
          State: 'DELHI',
          City: 'DELHI',
          bom_bkt: 2,
          emi_amt: 4500,
          principal_outstanding: 90000,
          DAC: 4500,
        },
      ];
      const buffer = createXlsbBuffer(sampleRows);
      const parsed = parseMainFile(buffer);
      expect(parsed).toHaveLength(1);
      expect(parsed[0].agreementid).toBe('CUST_NAME_01');
      expect(parsed[0].customer_name).toBe('Pooja Agarwal');
      expect(parsed[0]['customer Name']).toBe('Pooja Agarwal');
    });

    it('parseMainFile handles header offset with title banner and "customer Name"', () => {
      const wb = XLSX.utils.book_new();
      const wsData = [
        ['BANK PORTFOLIO REPORT - CONFIDENTIAL'],
        ['Generated at 2026-10-27'],
        ['Agreement ID', 'customer Name', 'City', 'State', 'BOM Bucket', 'EMI Amount', 'POS'],
        ['CUST_BANNER_01', 'Vikram Malhotra', 'NOIDA', 'UP', 1, 6000, 120000],
      ];
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      XLSX.utils.book_append_sheet(wb, ws, 'Data');
      const buffer = XLSX.write(wb, { bookType: 'xlsb', type: 'array' }) as ArrayBuffer;

      const parsed = parseMainFile(buffer);
      expect(parsed).toHaveLength(1);
      expect(parsed[0].agreementid).toBe('CUST_BANNER_01');
      expect(parsed[0].customer_name).toBe('Vikram Malhotra');
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

  describe('Customer Name Ingestion & Fallback Logic', () => {
    it('prioritizes standard "customer_name" key when present', () => {
      const row = {
        agreementid: 'AGR_01',
        customer_name: 'Ananya Roy',
        'customer Name': 'Fallback Roy',
      };
      expect(resolveCustomerName(row)).toBe('Ananya Roy');
    });

    it('does NOT take generic "name" as customer name, prioritizing "customer Name"', () => {
      const row = {
        agreementid: 'AGR_02',
        name: 'Rohan Sharma (Executive)',
        'customer Name': 'Amitabh Bachchan',
      };
      // Generic "name" must be ignored; "customer Name" must be taken
      expect(resolveCustomerName(row)).toBe('Amitabh Bachchan');
    });

    it('returns empty string if only generic "name" or "NAME" is present without customer keys', () => {
      expect(resolveCustomerName({ agreementid: 'AGR_02B', name: 'John Doe' })).toBe('');
      expect(resolveCustomerName({ agreementid: 'AGR_02C', NAME: 'Jane Doe' })).toBe('');
      expect(resolveCustomerName({ agreementid: 'AGR_02D', Name: 'Alice Smith' })).toBe('');
    });

    it('falls back to "customer Name" (exact match) if standard keys are not found', () => {
      const row = {
        agreementid: 'AGR_03',
        'customer Name': 'Praveen Sharma',
      };
      expect(resolveCustomerName(row)).toBe('Praveen Sharma');
    });

    it('falls back to "customer Name" case-insensitively ("Customer Name", "CUSTOMER NAME", "customer name", "cUsToMeR nAmE")', () => {
      expect(resolveCustomerName({ 'Customer Name': 'Ritu Verma' })).toBe('Ritu Verma');
      expect(resolveCustomerName({ 'CUSTOMER NAME': 'Karan Johar' })).toBe('Karan Johar');
      expect(resolveCustomerName({ 'customer name': 'Nisha Gupta' })).toBe('Nisha Gupta');
      expect(resolveCustomerName({ 'cUsToMeR nAmE': 'Varun Dhawan' })).toBe('Varun Dhawan');
    });

    it('falls back to "customer Name" when standard "customer_name" is blank or whitespace', () => {
      const row = {
        agreementid: 'AGR_04',
        customer_name: '   ',
        'customer Name': 'Deepak Chopra',
      };
      expect(resolveCustomerName(row)).toBe('Deepak Chopra');
    });

    it('handles customer Name with surrounding whitespace in key name', () => {
      const row = {
        agreementid: 'AGR_06',
        '  customer Name  ': 'Arun Jaitley',
      };
      expect(resolveCustomerName(row)).toBe('Arun Jaitley');
    });

    it('falls back to banking variants if customer Name is not found', () => {
      expect(resolveCustomerName({ 'Cust Name': 'Sunil Gavaskar' })).toBe('Sunil Gavaskar');
      expect(resolveCustomerName({ 'Borrower Name': 'Kapil Dev' })).toBe('Kapil Dev');
      expect(resolveCustomerName({ 'Client Name': 'Rahul Dravid' })).toBe('Rahul Dravid');
    });

    it('full parseMainFile populates customer_name, customer Name, Customer Name from "customer Name" header in .xlsx', () => {
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet([
        {
          agreementid: 'AGR_FALLBACK_10',
          'customer Name': 'Sanjay Singhania',
          city: 'MUMBAI',
          bom_bkt: 1,
        },
      ]);
      XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
      const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;

      const parsed = parseMainFile(buffer);
      expect(parsed).toHaveLength(1);
      expect(parsed[0].customer_name).toBe('Sanjay Singhania');
      expect(parsed[0]['customer Name']).toBe('Sanjay Singhania');
      expect(parsed[0]['Customer Name']).toBe('Sanjay Singhania');
    });
  });
});

