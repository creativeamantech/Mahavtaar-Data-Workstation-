import * as XLSX from 'xlsx';

/**
 * Robustly reads an Excel/XLSB/CSV workbook buffer.
 * Ensures ArrayBuffer is safely wrapped in a Uint8Array for binary sheet parsers.
 */
function readWorkbook(fileBuffer: ArrayBuffer): XLSX.WorkBook {
  const data = fileBuffer instanceof ArrayBuffer ? new Uint8Array(fileBuffer) : new Uint8Array(fileBuffer as any);
  return XLSX.read(data, { type: 'array', cellDates: true });
}

/**
 * Auto-detects and extracts rows from the best sheet in a workbook.
 * Handles XLSB/XLSX workbooks where the first sheet might be a title, summary, or cover tab,
 * or where column headers are located on row 2 or 3 after title banners.
 */
function extractSheetData(sheet: XLSX.WorkSheet): any[] {
  if (!sheet) return [];

  // Try raw row-by-row array inspection to find the header row
  const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' }) as any[][];
  if (!rawRows || rawRows.length === 0) return [];

  const KNOWN_KEYWORDS = ['agreement', 'loan', 'customer', 'cust', 'borrower', 'bkt', 'bucket', 'pos', 'emi', 'dac', 'ecs', 'city', 'state'];
  let headerRowIdx = 0;
  let maxKeywordMatches = 0;

  for (let r = 0; r < Math.min(20, rawRows.length); r++) {
    const row = rawRows[r];
    if (!Array.isArray(row)) continue;
    let matches = 0;
    for (const cell of row) {
      const str = String(cell || '').toLowerCase().replace(/[\s_\-.]/g, '');
      if (KNOWN_KEYWORDS.some(kw => str.includes(kw))) {
        matches++;
      }
    }
    if (matches > maxKeywordMatches) {
      maxKeywordMatches = matches;
      headerRowIdx = r;
    }
  }

  // If a header row was identified (even at row 0, 1, 2...), use that row's headers
  if (maxKeywordMatches >= 1) {
    const rawHeaders = rawRows[headerRowIdx];
    const dataRows = rawRows.slice(headerRowIdx + 1);
    const parsed = dataRows.map(rowArr => {
      const obj: Record<string, any> = {};
      rawHeaders.forEach((h, colIdx) => {
        const headerKey = String(h || '').trim();
        if (headerKey) {
          obj[headerKey] = rowArr[colIdx] !== undefined ? rowArr[colIdx] : null;
        }
      });
      return obj;
    }).filter(rowObj => Object.values(rowObj).some(v => v !== null && v !== ''));

    if (parsed.length > 0) return parsed;
  }

  // Fallback to standard sheet_to_json
  return (XLSX.utils.sheet_to_json(sheet, { defval: null }) as any[]) || [];
}

function getBestSheetRows(wb: XLSX.WorkBook): any[] {
  if (!wb || !wb.SheetNames || wb.SheetNames.length === 0) return [];
  
  let bestRows: any[] = [];
  
  for (const sheetName of wb.SheetNames) {
    const sheet = wb.Sheets[sheetName];
    if (!sheet) continue;
    const rows = extractSheetData(sheet);
    if (rows.length > bestRows.length) {
      bestRows = rows;
    }
  }

  return bestRows;
}

/**
 * Case-insensitive, space-insensitive, and punctuation-agnostic key value accessor.
 * Prioritizes non-empty values over empty keys.
 */
function getRowVal(row: Record<string, any>, candidateKeys: string[]): any {
  if (!row) return undefined;

  // 1. Direct exact key match (checking for non-empty value)
  for (const k of candidateKeys) {
    const val = row[k];
    if (val !== undefined && val !== null && String(val).trim() !== '') {
      return val;
    }
  }

  // 2. Normalized candidates set
  const normCandidates = new Set(candidateKeys.map(k => k.toLowerCase().replace(/[\s_\-.]/g, '')));

  // 3. Normalized scan on row keys (prioritizing non-empty values)
  for (const rawKey of Object.keys(row)) {
    const normKey = rawKey.toLowerCase().replace(/[\s_\-.]/g, '');
    if (normCandidates.has(normKey)) {
      const val = row[rawKey];
      if (val !== undefined && val !== null && String(val).trim() !== '') {
        return val;
      }
    }
  }

  // 4. Fuzzy fallback for customer name
  if (candidateKeys.some(k => k.toLowerCase().includes('customer') || k.toLowerCase().includes('cust'))) {
    for (const rawKey of Object.keys(row)) {
      const normKey = rawKey.toLowerCase().replace(/[\s_\-.]/g, '');
      if (normKey === 'name') continue;
      if (normKey.includes('customer') || (normKey.includes('cust') && normKey.includes('name')) || normKey.includes('borrower')) {
        const val = row[rawKey];
        if (val !== undefined && val !== null && String(val).trim() !== '') {
          return val;
        }
      }
    }
  }

  return undefined;
}

/**
 * Resolves customer name during file ingestion with explicit fallback logic:
 * 1. Checks standard 'customer_name' keys (and direct casing variants).
 *    NOTE: Does NOT take generic 'name' as customer name.
 * 2. If not found or empty, falls back to look for 'customer Name' (case-insensitive across all keys).
 * 3. Additional fallback for banking/loan industry variants ('cust name', 'borrower name', etc.).
 */
export function resolveCustomerName(row: Record<string, any>): string {
  if (!row || typeof row !== 'object') return '';

  // 1. Check standard 'customer_name' keys first (explicitly excluding generic 'name')
  const standardCandidateKeys = [
    'customer_name',
    'CUSTOMER_NAME',
    'Customer_Name',
    'Customer_name',
    'customername',
    'CUSTOMERNAME'
  ];

  for (const key of standardCandidateKeys) {
    if (Object.prototype.hasOwnProperty.call(row, key)) {
      const val = row[key];
      if (val !== undefined && val !== null && String(val).trim() !== '') {
        return String(val).trim();
      }
    }
  }

  // Also check standard 'customer_name' case-insensitively (never match generic 'name')
  for (const rawKey of Object.keys(row)) {
    const norm = rawKey.trim().toLowerCase();
    if (norm === 'customer_name') {
      const val = row[rawKey];
      if (val !== undefined && val !== null && String(val).trim() !== '') {
        return String(val).trim();
      }
    }
  }

  // 2. Fallback logic: look for 'customer Name' (case-insensitive)
  // Matches "customer Name", "Customer Name", "CUSTOMER NAME", "customer name", etc.
  for (const rawKey of Object.keys(row)) {
    const norm = rawKey.trim().toLowerCase();
    if (norm === 'customer name') {
      const val = row[rawKey];
      if (val !== undefined && val !== null && String(val).trim() !== '') {
        return String(val).trim();
      }
    }
  }

  // Also check clean/compact 'customername' or 'customer' (never lone 'name')
  for (const rawKey of Object.keys(row)) {
    const compact = rawKey.trim().toLowerCase().replace(/[\s_\-.]/g, '');
    if (compact === 'customername' || compact === 'customer') {
      const val = row[rawKey];
      if (val !== undefined && val !== null && String(val).trim() !== '') {
        return String(val).trim();
      }
    }
  }

  // 3. Extended banking/loan industry fallbacks (e.g. 'cust name', 'borrower name', 'client name')
  const extendedCandidates = [
    'cust name',
    'cust_name',
    'custname',
    'borrower name',
    'borrower_name',
    'borrower',
    'applicant name',
    'applicant_name',
    'applicant',
    'client name',
    'party name',
    'account name'
  ];

  for (const rawKey of Object.keys(row)) {
    const compactKey = rawKey.trim().toLowerCase().replace(/[\s_\-.]/g, '');
    for (const ext of extendedCandidates) {
      if (compactKey === ext.replace(/[\s_\-.]/g, '')) {
        const val = row[rawKey];
        if (val !== undefined && val !== null && String(val).trim() !== '') {
          return String(val).trim();
        }
      }
    }
  }

  // 4. Fuzzy fallback: keys containing 'customer' or ('cust' + 'name') or 'borrower' (NEVER lone 'name')
  for (const rawKey of Object.keys(row)) {
    const compactKey = rawKey.trim().toLowerCase().replace(/[\s_\-.]/g, '');
    if (compactKey === 'name') continue; // Never take generic 'name'
    if (
      compactKey.includes('customer') ||
      (compactKey.includes('cust') && compactKey.includes('name')) ||
      compactKey.includes('borrower')
    ) {
      const val = row[rawKey];
      if (val !== undefined && val !== null && String(val).trim() !== '') {
        return String(val).trim();
      }
    }
  }

  return '';
}

export function parseMainFile(fileBuffer: ArrayBuffer) {
  const wb = readWorkbook(fileBuffer);
  const rows = getBestSheetRows(wb);

  return rows.map(row => {
    const agId = String(getRowVal(row, ['agreementid', 'AGREEMENTID', 'agreement_id', 'agrmnt_id', 'loan_id', 'Loan ID', 'LOANID', 'Agreement No', 'AGREEMENTNO', 'AGREEMENT_NO']) || '').trim();
    const agNo = String(getRowVal(row, ['agreement_no', 'AGREEMENTNO', 'AGREEMENT_NO', 'Agreement No', 'loan_id', 'Loan No']) || agId).trim();
    const custName = resolveCustomerName(row);
    const bomBkt = parseInt(getRowVal(row, ['bom_bkt', 'BOM Bucket', 'BOM_BKT', 'Bucket', 'BKT'])) || 1;
    const emiAmt = parseFloat(getRowVal(row, ['emi_amt', 'EMI Amount', 'EMI_AMT', 'EMI', 'Emi'])) || 0;
    const pos = parseFloat(getRowVal(row, ['principal_outstanding', 'Principal Outstanding', 'POS', 'POS Amount', 'PRINCIPAL_OUTSTANDING'])) || 0;
    const bcc = parseFloat(getRowVal(row, ['bcc_pending', 'BCC Pending', 'BCC'])) || 0;
    const penal = parseFloat(getRowVal(row, ['penal_pending', 'Penal Pending', 'Penal'])) || 0;
    const fc = parseFloat(getRowVal(row, ['approx_forclosure', 'Approx Forclosure', 'Approx Foreclosure', 'Foreclosure Amount', 'FC'])) || 0;
    const state = String(getRowVal(row, ['state', 'State', 'STATE']) || '').trim().toUpperCase();
    const city = String(getRowVal(row, ['city', 'City', 'CITY']) || '').trim().toUpperCase();
    const execName = String(getRowVal(row, ['executive_name', 'Final EX. Name', 'Final EX. name', 'Final EX.NAME', 'EX. Name', 'EX. name', 'EX.NAME', 'Final Executive Name', 'final_executive_name', 'Final Executive', 'final_executive', 'Executive Name', 'executive_name', 'Executive', 'executive']) || '').trim();
    const allocDate = getRowVal(row, ['allocation_date', 'Final Allocation Date', 'final_allocation_date', 'Allocation Date', 'AllocationDate']) || null;
    const dac = parseFloat(getRowVal(row, ['dac', 'DAC', 'DAC Amount', 'Collected DAC'])) || 0;
    const ecs = parseFloat(getRowVal(row, ['ecs', 'ECS', 'ECS Amount'])) || 0;
    const special = parseFloat(getRowVal(row, ['special', 'Special', 'Special Pres', 'Special Collection'])) || 0;
    const newTotal = parseFloat(getRowVal(row, ['new_total', 'New Total', 'NEW_TOTAL'])) || 0;
    const settlementRaw = getRowVal(row, ['settlement_approved_amt', 'Settlement Approved Amount', 'Settlement Amount', 'Settlement']);
    const settlement = settlementRaw != null && settlementRaw !== '' ? parseFloat(settlementRaw) : null;
    const lastMonthPaid = Boolean(getRowVal(row, ['last_month_paid_flag', 'Last Month Paid Flag', 'Last Month Paid']));

    return {
      ...row,
      agreementid: agId,
      agreement_no: agNo,
      customer_name: custName,
      'Customer Name': custName,
      'customer Name': custName,
      CUSTOMER_NAME: custName,
      CUSTOMERNAME: custName,
      bom_bkt: bomBkt,
      emi_amt: emiAmt,
      principal_outstanding: pos,
      bcc_pending: bcc,
      penal_pending: penal,
      approx_forclosure: fc,
      state: state,
      city: city,
      executive_name: execName,
      allocation_date: allocDate,
      dac: dac,
      ecs: ecs,
      special: special,
      new_total: newTotal,
      settlement_approved_amt: settlement,
      last_month_paid_flag: lastMonthPaid,
      dac_source: 'FILE' as const,
      ecs_source: 'FILE' as const,
      special_source: 'FILE' as const,
    };
  }).filter(r => r.agreementid);
}

export function parsePaidFile(fileBuffer: ArrayBuffer) {
  const wb = readWorkbook(fileBuffer);
  const rows = getBestSheetRows(wb);

  return rows.map(row => {
    const agId = String(getRowVal(row, ['agreementid', 'AGREEMENTID', 'agreement_id', 'loan_id', 'Loan ID', 'Agreement No']) || '').trim();
    const custName = resolveCustomerName(row);
    const sfdc = parseFloat(getRowVal(row, ['sfdc', 'SFDC', 'SFDC Amount'])) || 0;
    const online = parseFloat(getRowVal(row, ['online', 'Online', 'Online Amount'])) || 0;
    const dacDirect = parseFloat(getRowVal(row, ['dac', 'DAC', 'DAC Amount'])) || 0;
    
    // If SFDC or Online columns present, use their sum; otherwise use direct DAC
    const calculatedDac = (sfdc > 0 || online > 0) ? (sfdc + online) : dacDirect;
    const ecs = parseFloat(getRowVal(row, ['ecs', 'ECS', 'ECS Amount'])) || 0;
    const special = parseFloat(getRowVal(row, ['special', 'Special Pres', 'Special', 'Special Amount'])) || 0;

    return {
      agreementid: agId,
      customer_name: custName || undefined,
      'customer Name': custName || undefined,
      'Customer Name': custName || undefined,
      dac: calculatedDac,
      ecs: ecs,
      special: special,
    };
  }).filter(r => r.agreementid);
}

export function mergePaidIntoRecords(existingRecords: any[], paidRows: any[]) {
  const paidMap: Record<string, any> = {};
  paidRows.forEach(r => { paidMap[r.agreementid] = r; });

  return existingRecords.map(rec => {
    const match = paidMap[String(rec.agreementid)];
    if (match) {
      let newProv = rec.provisional_dac;
      let is_conflict = rec.is_conflict || false;
      
      const rawProv = rec.provisional_dac_raw || rec.provisional_dac;
      if (rawProv && match.dac > 0) {
        if (rawProv === match.dac) {
          newProv = 0;
          is_conflict = false;
        } else {
          is_conflict = true;
        }
      }

      const existingCust = rec.customer_name || rec['customer Name'] || rec['Customer Name'] || '';
      const fallbackCust = existingCust || match.customer_name || match['customer Name'] || '';
      
      return {
        ...rec,
        ...match,
        customer_name: fallbackCust,
        'customer Name': fallbackCust,
        'Customer Name': fallbackCust,
        dac: match.dac,
        ecs: match.ecs,
        special: match.special,
        dac_source: 'PAID_FILE',
        ecs_source: 'PAID_FILE',
        special_source: 'PAID_FILE',
        provisional_dac: newProv,
        is_conflict,
      };
    }
    return rec;
  });
}

export function parseAdditionalFile(fileBuffer: ArrayBuffer) {
  const wb = readWorkbook(fileBuffer);
  const rows = getBestSheetRows(wb);

  const aggregated: Record<string, { amount: number, dates: string[], firstRow: any, custName: string }> = {};
  
  rows.forEach(row => {
    const agreementid = String(getRowVal(row, ['agreementid', 'AGREEMENTID', 'Loan ID', 'loan_id', 'Agreement No', 'AGREEMENT_NO']) || '').trim();
    if (!agreementid) return;
    
    const custName = resolveCustomerName(row);
    // Attempt to read generic collection amount
    const amt = parseFloat(getRowVal(row, ['amount', 'Amount', 'Collection Amount', 'collection_amount', 'Collected', 'DAC', 'dac', 'Provisional Amount', 'provisional_amount'])) || 0;
    
    let dt = String(getRowVal(row, ['date', 'Date', 'Collection Date', 'collection_date']) || '').trim();
    if (!dt) dt = 'Unknown';
    
    if (!aggregated[agreementid]) aggregated[agreementid] = { amount: 0, dates: [], firstRow: row, custName: '' };
    aggregated[agreementid].amount += amt;
    if (custName && !aggregated[agreementid].custName) {
      aggregated[agreementid].custName = custName;
    }
    if (dt !== 'Unknown' && !aggregated[agreementid].dates.includes(dt)) {
      aggregated[agreementid].dates.push(dt);
    }
  });

  return Object.entries(aggregated).map(([agreementid, data]) => ({
    ...data.firstRow,
    agreementid,
    customer_name: data.custName || undefined,
    'customer Name': data.custName || undefined,
    'Customer Name': data.custName || undefined,
    provisional_dac: data.amount,
    collection_dates: data.dates.length > 0 ? data.dates.join(', ') : 'Unknown',
  }));
}

export function mergeAdditionalIntoRecords(existingRecords: any[], additionalRows: any[]) {
  const additionalMap: Record<string, any> = {};
  additionalRows.forEach(r => { additionalMap[r.agreementid] = r; });

  let newConflicts = 0;
  let newValidProv = 0;
  let alreadyCorrected = 0;
  let alreadyConfirmed = 0;

  const merged = existingRecords.map(rec => {
    const match = additionalMap[String(rec.agreementid)];
    if (match) {
      if (rec.dac_source === 'CORRECTED' || rec.is_corrected) {
        alreadyCorrected++;
        return rec; // Rule: REJECT/IGNORE already corrected records. Do not overwrite or recreate conflict.
      }

      let provisional_dac = match.provisional_dac;
      const currentConfirmedDac = rec.dac || 0;
      let is_conflict = false;
      
      if (currentConfirmedDac === provisional_dac && currentConfirmedDac > 0) {
        // Exact confirmation, so zero out provisional
        provisional_dac = 0;
        alreadyConfirmed++;
      } else if (currentConfirmedDac > 0 && currentConfirmedDac !== provisional_dac) {
        // Mismatch
        is_conflict = true;
        newConflicts++;
      } else {
        newValidProv++;
      }
      
      const existingCust = rec.customer_name || rec['customer Name'] || rec['Customer Name'] || '';
      const fallbackCust = existingCust || match.customer_name || match['customer Name'] || '';

      return {
        ...rec,
        ...match,
        customer_name: fallbackCust,
        'customer Name': fallbackCust,
        'Customer Name': fallbackCust,
        provisional_dac: provisional_dac,
        provisional_dac_raw: match.provisional_dac, // store raw just in case
        provisional_collection_dates: match.collection_dates,
        is_conflict,
      };
    }
    return rec;
  });

  return { merged, stats: { newConflicts, newValidProv, alreadyCorrected, alreadyConfirmed, uniqueLoans: additionalRows.length } };
}

export function parseCorrectedFile(fileBuffer: ArrayBuffer) {
  const wb = readWorkbook(fileBuffer);
  const rows = getBestSheetRows(wb);

  return rows.map(row => ({
    agreementid: String(getRowVal(row, ['agreementid', 'AGREEMENTID', 'Loan ID', 'loan_id', 'Agreement No', 'AGREEMENT_NO']) || '').trim(),
    corrected_dac: parseFloat(getRowVal(row, ['confirmed_dac', 'Confirmed DAC', 'DAC', 'dac', 'Corrected DAC', 'corrected_dac', 'Confirmed Amount'])) || 0,
  })).filter(r => r.agreementid);
}

export function mergeCorrectedIntoRecords(existingRecords: any[], correctedRows: any[]) {
  const map: Record<string, any> = {};
  correctedRows.forEach(r => { map[r.agreementid] = r; });

  let matched = 0;
  const merged = existingRecords.map(rec => {
    const match = map[String(rec.agreementid)];
    if (match) {
      matched++;
      return {
        ...rec,
        ...match,
        dac: match.corrected_dac,
        dac_source: 'CORRECTED',
        is_corrected: true,
        provisional_dac: 0,
        is_conflict: false,
      };
    }
    return rec;
  });
  return { merged, matched, total: correctedRows.length };
}

export function detectColumns(fileBuffer: ArrayBuffer) {
  const wb = readWorkbook(fileBuffer);
  const rows = getBestSheetRows(wb);
  if (rows.length === 0) return { headers: [], rowCount: 0, sample: [] };
  const headers = Object.keys(rows[0]);
  return { headers, rowCount: rows.length, sample: rows.slice(0, 3) };
}

