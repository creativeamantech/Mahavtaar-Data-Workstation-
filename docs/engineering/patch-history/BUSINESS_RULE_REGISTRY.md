# Business Rule & Financial Logic Registry

This document records the formal financial and operational business rules enforced in Mahavtaar Ledger.

## 1. Portfolio Recovery & Collections Engine (`/src/lib/calculations.ts`)

### Primary Mathematical Formulas
- **Confirmed DAC**: Sum of confirmed field collections on the account.
- **Provisional DAC**: Recent touchpoint collections merged via P2P sync (included in calculations if and only if `!is_conflict`).
- **Total Collection**:
  $$\text{Total} = \max(0, \text{DAC} + \text{ECS} + \text{Special})$$
- **POS Cleared**:
  $$\text{POS Cleared} = \text{Principal Outstanding} - \text{Total}$$
- **Foreclosure Cleared**:
  $$\text{FC Cleared} = \text{Approx Foreclosure} - \text{Total}$$
- **Rollback Condition**:
  $$\text{RB Condition} = 2 \times \text{EMI} - \text{Total}$$
  - A case qualifies for Rollback if $\text{RB Condition} \le 0$ or $(\text{POS} > 0 \land \text{POS Cleared} \le 0)$.

### EMI Clearance Hierarchy
1. If `last_month_paid_flag` is true, $\text{EMI Count} = 1$.
2. If `settlement_approved_amt` exists and $\text{DAC} \ge \text{Settlement}$, the settlement is honored.
3. Multiple EMI thresholds:
   - If $\text{pmt} \ge 4 \times \text{EMI}$, raw $= 4$
   - Else if $\text{pmt} \ge 3 \times \text{EMI}$, raw $= 3$
   - Else if $\text{pmt} \ge 2 \times \text{EMI}$, raw $= 2$
   - Else if $\text{pmt} \ge 1 \times \text{EMI}$, raw $= 1$
4. Capped at $\min(\text{raw}, \text{BOM Bucket} + 1)$ with POS validation.

---

## 2. Pivot Matrix & Performance Calculations (`/src/lib/pivots.ts`)

- **City Pivot Matrix**: Aggregates account count, total POS, paid count, paid POS, rollback POS, recovery percentage, and shortfall by City.
- **Team Performance Pivot**: Groups accounts by BOM Bucket and Executive Name with granular POS recovery rates.
- **Executive $\times$ City Cross-Tab**: Dynamic 2D matrix evaluating coverage across territories.
- **Daily Required POS (Pacing)**:
  $$\text{Daily Required POS} = \max\left(0, \frac{\text{Target POS} - \text{Paid POS}}{\text{Days Remaining}}\right)$$

---

## 3. Target Resolution Precedence (`/src/lib/targets.ts`)

When computing target recovery percentages for any record or territory, the system resolves targets according to the following strict fallback order:
1. `CITY__{city}__BKT__{bkt}`
2. `STATE__{state}__BKT__{bkt}`
3. `GLOBAL__BKT__{bkt}`
4. `CITY__{city}`
5. `STATE__{state}`
6. `GLOBAL`
7. Default: $0\%$
