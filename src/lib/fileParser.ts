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
 * Handles XLSB/XLSX workbooks where the first sheet might be a title, summary, or cover tab.
 */
function getBestSheetRows(wb: XLSX.WorkBook): any[] {
  if (!wb || !wb.SheetNames || wb.SheetNames.length === 0) return [];
  
  let bestRows: any[] = [];
  
  for (const sheetName of wb.SheetNames) {
    const sheet = wb.Sheets[sheetName];
    if (!sheet) continue;
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: null }) as any[];
    if (rows.length > bestRows.length) {
      bestRows = rows;
    }
  }

  return bestRows;
}

/**
 * Case-insensitive, space-insensitive, and punctuation-agnostic key value accessor.
 */
function getRowVal(row: Record<string, any>, candidateKeys: string[]): any {
  if (!row) return undefined;

  // 1. Direct exact key match
  for (const k of candidateKeys) {
    if (row[k] !== undefined && row[k] !== null && row[k] !== '') {
      return row[k];
    }
  }

  // 2. Normalized matching (lowercase, no spaces, no underscores, no dots)
  const normMap: Record<string, any> = {};
  for (const rawKey of Object.keys(row)) {
    const normKey = rawKey.toLowerCase().replace(/[\s_\-.]/g, '');
    if (normMap[normKey] === undefined && row[rawKey] !== undefined && row[rawKey] !== null) {
      normMap[normKey] = row[rawKey];
    }
  }

  for (const k of candidateKeys) {
    const normCandidate = k.toLowerCase().replace(/[\s_\-.]/g, '');
    if (normMap[normCandidate] !== undefined && normMap[normCandidate] !== null && normMap[normCandidate] !== '') {
      return normMap[normCandidate];
    }
  }

  return undefined;
}

export function parseMainFile(fileBuffer: ArrayBuffer) {
  const wb = readWorkbook(fileBuffer);
  const rows = getBestSheetRows(wb);

  return rows.map(row => {
    const agId = String(getRowVal(row, ['agreementid', 'AGREEMENTID', 'agreement_id', 'agrmnt_id', 'loan_id', 'Loan ID', 'LOANID', 'Agreement No', 'AGREEMENTNO', 'AGREEMENT_NO']) || '').trim();
    const agNo = String(getRowVal(row, ['agreement_no', 'AGREEMENTNO', 'AGREEMENT_NO', 'Agreement No', 'loan_id', 'Loan No']) || agId).trim();
    const custName = String(getRowVal(row, ['customer_name', 'CUSTOMERNAME', 'Customer Name', 'CUSTOMER_NAME', 'customername', 'Borrower Name']) || '').trim();
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
    const sfdc = parseFloat(getRowVal(row, ['sfdc', 'SFDC', 'SFDC Amount'])) || 0;
    const online = parseFloat(getRowVal(row, ['online', 'Online', 'Online Amount'])) || 0;
    const dacDirect = parseFloat(getRowVal(row, ['dac', 'DAC', 'DAC Amount'])) || 0;
    
    // If SFDC or Online columns present, use their sum; otherwise use direct DAC
    const calculatedDac = (sfdc > 0 || online > 0) ? (sfdc + online) : dacDirect;
    const ecs = parseFloat(getRowVal(row, ['ecs', 'ECS', 'ECS Amount'])) || 0;
    const special = parseFloat(getRowVal(row, ['special', 'Special Pres', 'Special', 'Special Amount'])) || 0;

    return {
      agreementid: agId,
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
      
      return {
        ...rec,
        ...match,
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

  const aggregated: Record<string, { amount: number, dates: string[], firstRow: any }> = {};
  
  rows.forEach(row => {
    const agreementid = String(getRowVal(row, ['agreementid', 'AGREEMENTID', 'Loan ID', 'loan_id', 'Agreement No', 'AGREEMENT_NO']) || '').trim();
    if (!agreementid) return;
    
    // Attempt to read generic collection amount
    const amt = parseFloat(getRowVal(row, ['amount', 'Amount', 'Collection Amount', 'collection_amount', 'Collected', 'DAC', 'dac', 'Provisional Amount', 'provisional_amount'])) || 0;
    
    let dt = String(getRowVal(row, ['date', 'Date', 'Collection Date', 'collection_date']) || '').trim();
    if (!dt) dt = 'Unknown';
    
    if (!aggregated[agreementid]) aggregated[agreementid] = { amount: 0, dates: [], firstRow: row };
    aggregated[agreementid].amount += amt;
    if (dt !== 'Unknown' && !aggregated[agreementid].dates.includes(dt)) {
      aggregated[agreementid].dates.push(dt);
    }
  });

  return Object.entries(aggregated).map(([agreementid, data]) => ({
    ...data.firstRow,
    agreementid,
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
      
      return {
        ...rec,
        ...match,
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

