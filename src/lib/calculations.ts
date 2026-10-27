/**
 * Mahavtaar Ledger - Deterministic Financial Calculation Engine
 * Pure mathematical functions for portfolio recovery, rollback conditions, and shortfall analytics.
 */

import { LoanRecord, LoanRecordComputed } from '../types/domain';

/**
 * Coerces value to a safe finite number. Returns 0 for NaN/Infinity/null/undefined.
 */
export function safeNumber(val: any, defaultVal = 0): number {
  if (val === null || val === undefined || val === '') return defaultVal;
  const num = Number(val);
  return Number.isFinite(num) ? num : defaultVal;
}

/**
 * Evaluates recovery performance, EMI clearance, shortfall amounts, and rollback qualification.
 */
export function calculateRow(row: Partial<LoanRecord> | Record<string, any>): LoanRecordComputed {
  const e = Math.max(0, safeNumber(row.emi_amt ?? row.EMI ?? row['EMI Amount']));
  const pos = Math.max(0, safeNumber(row.principal_outstanding ?? row.POS ?? row['Principal Outstanding']));
  
  // Base confirmed DAC
  let dac = safeNumber(row.dac ?? row.DAC);
  
  // Include Provisional DAC if it exists and is NOT a conflict
  if (row.provisional_dac && !row.is_conflict) {
    dac += safeNumber(row.provisional_dac);
  }
  
  const ecs = safeNumber(row.ecs ?? row.ECS);
  const special = safeNumber(row.special ?? row.Special);
  const approxFC = safeNumber(row.approx_forclosure ?? row['Approx Forclosure']);
  const bkt = Math.max(1, safeNumber(row.bom_bkt ?? row['BOM Bucket'], 1));
  
  const settlementRaw = row.settlement_approved_amt ?? row['Settlement Approved Amount'];
  const settlement = settlementRaw != null && settlementRaw !== '' ? safeNumber(settlementRaw) : null;
  const lastMonthPaid = Boolean(row.last_month_paid_flag ?? row['Last Month Paid Flag']);

  const emi1 = e;
  const emi2 = e * 2;
  const emi3 = e * 3;
  const emi4 = e * 4;
  
  const total = Math.max(0, dac + ecs + special);
  const newTotal = safeNumber(row.new_total ?? row['New Total']);
  const remaining = total - newTotal;
  const totalPerEmi = e > 0 ? total / e : 0;
  const posCleared = pos - total;
  const fcCleared = approxFC - total;
  const rbCondition = emi2 - total;

  const shortIn1 = (!approxFC || !total) ? null : (total < emi1 ? emi1 - total : 0);
  const shortIn2 = (!approxFC || !total) ? null : (total > emi1 && total < emi2 ? emi2 - total : null);

  const ecsCount = (dac >= emi1 && emi1 > 0) ? null : (((ecs + special) >= emi1 && emi1 > 0) ? 1 : null);
  const ecsPOS = (dac >= emi1 && emi1 > 0) ? null : (((ecs + special) >= emi1 && emi1 > 0) ? pos : null);

  let emiCount = 0;
  if (lastMonthPaid) {
    emiCount = 1;
  } else {
    let pmt = dac;
    let settlementValid = false;
    if (settlement !== null) {
      if (dac >= settlement) {
        settlementValid = true;
        pmt = settlement;
      } else {
        pmt = 0;
      }
    }
    
    let raw = 0;
    if (emi4 > 0 && pmt >= emi4) raw = 4;
    else if (emi3 > 0 && pmt >= emi3) raw = 3;
    else if (emi2 > 0 && pmt >= emi2) raw = 2;
    else if (emi1 > 0 && pmt >= emi1) raw = 1;

    if (raw === 0) {
      if (approxFC > 0 && fcCleared <= 0) raw = 1;
      else if (settlement !== null && emi1 > 0 && settlement < emi1 && settlementValid) raw = 1;
    } else {
      if (e > 0 && pos < raw * e) raw = 1;
    }
    emiCount = Math.min(raw, bkt + 1);
  }

  const teamPaid = (total >= emi1 && emi1 > 0) || (approxFC > 0 && fcCleared <= 0) || lastMonthPaid ? 1 : null;
  const teamUnpaid = teamPaid ? null : 1;
  const teamPaidPOS = teamPaid ? pos : null;
  const teamRBPOS = rbCondition <= 0 ? pos : null;

  const mainPaid = (total >= emi1 && emi1 > 0) || (pos > 0 && posCleared <= 0) || (approxFC > 0 && fcCleared <= 0) || lastMonthPaid ? 1 : null;
  const unpaid = mainPaid ? 0 : 1;
  const mainUnpaidPOS = unpaid ? pos : null;
  const mainPaidPOS = mainPaid ? pos : null;
  const rollbackPOS = (rbCondition <= 0 || (pos > 0 && posCleared <= 0)) ? pos : null;

  return {
    emi1,
    emi2,
    emi3,
    emi4,
    total,
    remaining,
    totalPerEmi,
    shortIn1,
    shortIn2,
    ecsCount,
    ecsPOS,
    rbCondition,
    posCleared,
    fcCleared,
    emiCount,
    teamPaid,
    teamUnpaid,
    teamPaidPOS,
    teamRBPOS,
    mainPaid,
    unpaid,
    mainUnpaidPOS,
    mainPaidPOS,
    rollbackPOS,
  };
}
