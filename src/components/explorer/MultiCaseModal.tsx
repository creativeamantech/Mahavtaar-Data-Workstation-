import React from 'react';
import { X, CheckCircle2, DollarSign, Layers } from 'lucide-react';
import { fmtCur } from '../../lib/formatters';
import { calculateRow } from '../../lib/calculations';
import { BucketBadge } from './BucketBadge';
import { StatusBadge } from './StatusBadge';

interface MultiCaseModalProps {
  data: {
    name: string;
    records: any[];
  } | null;
  onClose: () => void;
  onSelectRecord: (record: any) => void;
}

export function MultiCaseModal({ data, onClose, onSelectRecord }: MultiCaseModalProps) {
  if (!data) return null;

  const totalPos = data.records.reduce((acc, r) => acc + (Number(r.principal_outstanding) || 0), 0);
  const totalEmi = data.records.reduce((acc, r) => acc + (Number(r.emi_amt) || 0), 0);
  const totalDac = data.records.reduce((acc, r) => acc + (Number(r.dac ?? r.DAC) || 0), 0);
  const paidCount = data.records.filter(r => calculateRow(r).mainPaid === 1).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-card w-full max-w-5xl max-h-[85vh] rounded-2xl shadow-2xl border border-border flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-4 border-b border-border bg-muted/20 flex justify-between items-center shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <Layers className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-bold text-foreground">{data.name}</h2>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Found {data.records.length} related loan accounts for this customer
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-muted rounded-full transition-colors text-muted-foreground hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Summary Strip */}
        <div className="bg-muted/40 border-b border-border px-4 py-2.5 flex flex-wrap items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground">Total POS:</span>
            <span className="font-mono font-bold text-foreground">{fmtCur(totalPos)}</span>
          </div>
          <span className="text-muted-foreground/30">|</span>
          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground">Total EMI:</span>
            <span className="font-mono font-semibold text-foreground">{fmtCur(totalEmi)}</span>
          </div>
          <span className="text-muted-foreground/30">|</span>
          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground">DAC Cleared:</span>
            <span className="font-mono font-bold text-sky-600 dark:text-sky-400">{fmtCur(totalDac)}</span>
          </div>
          <span className="text-muted-foreground/30">|</span>
          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground">Resolution:</span>
            <span className="font-semibold text-emerald-600 dark:text-emerald-400">
              {paidCount} of {data.records.length} Paid
            </span>
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto">
          <table className="w-full text-left border-collapse whitespace-nowrap">
            <thead className="sticky top-0 z-20 bg-muted/95 backdrop-blur shadow-xs text-[10px] uppercase tracking-wider text-muted-foreground font-bold border-b border-border">
              <tr>
                <th className="px-3 py-2.5">Aggr No</th>
                <th className="px-3 py-2.5">Bucket</th>
                <th className="px-3 py-2.5">State</th>
                <th className="px-3 py-2.5">City</th>
                <th className="px-3 py-2.5">Executive</th>
                <th className="px-3 py-2.5 text-right">POS</th>
                <th className="px-3 py-2.5 text-right">EMI</th>
                <th className="px-3 py-2.5 text-right">ECS</th>
                <th className="px-3 py-2.5 text-right">DAC</th>
                <th className="px-3 py-2.5 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="text-xs divide-y divide-border/60">
              {data.records.map((r, idx) => {
                const c = calculateRow(r);
                const isPaid = c.mainPaid === 1;
                const isPartial = !isPaid && (c.totalCleared > 0 || (Number(r.dac ?? r.DAC) || 0) > 0);
                const aggr = r.agreementid || r.agreement_no || r.AGREEMENTNO || r.AGREEMENTID || '-';

                return (
                  <tr key={idx} className="hover:bg-muted/30 transition-colors">
                    <td className="px-3 py-2 font-mono font-bold text-primary cursor-pointer hover:underline" onClick={() => { onClose(); onSelectRecord(r); }}>
                      {aggr}
                    </td>
                    <td className="px-3 py-2">
                      <BucketBadge bkt={r.bom_bkt} />
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{r.state || r.State || '-'}</td>
                    <td className="px-3 py-2 text-muted-foreground">{r.city || r.City || '-'}</td>
                    <td className="px-3 py-2 text-muted-foreground">{r.executive_name || r['Executive Name'] || '-'}</td>
                    <td className="px-3 py-2 text-right font-mono font-bold text-foreground">{fmtCur(Number(r.principal_outstanding) || 0)}</td>
                    <td className="px-3 py-2 text-right font-mono text-muted-foreground">{fmtCur(Number(r.emi_amt) || 0)}</td>
                    <td className="px-3 py-2 text-right font-mono text-muted-foreground">{fmtCur(Number(r.ecs ?? r.ECS) || 0)}</td>
                    <td className="px-3 py-2 text-right font-mono font-bold text-sky-600 dark:text-sky-400">{fmtCur(Number(r.dac ?? r.DAC) || 0)}</td>
                    <td className="px-3 py-2 text-right">
                      <StatusBadge isPaid={isPaid} isPartial={isPartial} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-border bg-muted/10 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold bg-muted hover:bg-muted/80 text-foreground rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
