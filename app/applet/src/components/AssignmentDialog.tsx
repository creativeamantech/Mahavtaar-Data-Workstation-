/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useMemo, useEffect } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription, 
  DialogFooter 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { fmtCur } from '../lib/formatters';
import { 
  Equal, 
  Scale, 
  PieChart, 
  BarChart3, 
  Plus, 
  Trash2, 
  CheckCircle2, 
  Users, 
  Layers,
  Sparkles,
  Info,
  Search,
  ChevronDown,
  ChevronUp,
  FileText
} from 'lucide-react';
import { toast } from 'sonner';

export type DistMode = 'EQUAL' | 'POS' | 'PERCENT' | 'CUSTOM';

interface AssignmentDialogProps {
  isOpen: boolean;
  onClose: () => void;
  casesToAssign: any[];
  availableAgents: string[];
  onAssign: (updates: { agreementid: string; field: string; value: string }[]) => Promise<void> | void;
}

export function AssignmentDialog({
  isOpen,
  onClose,
  casesToAssign,
  availableAgents,
  onAssign,
}: AssignmentDialogProps) {
  const [distMode, setDistMode] = useState<DistMode>('EQUAL');
  const [selectedAgents, setSelectedAgents] = useState<{ name: string; val: string }[]>([
    { name: '', val: '' }
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Case table inspection inside modal
  const [showCaseTable, setShowCaseTable] = useState(false);
  const [caseSearchTerm, setCaseSearchTerm] = useState('');
  const [excludedCaseIds, setExcludedCaseIds] = useState<Set<string>>(new Set());

  // Initialize with the first available agent if only one empty entry exists
  useEffect(() => {
    if (isOpen) {
      setExcludedCaseIds(new Set());
      setCaseSearchTerm('');
      if (availableAgents.length > 0 && selectedAgents.length === 1 && !selectedAgents[0].name) {
        setSelectedAgents([{ name: availableAgents[0] || '', val: '' }]);
      }
    }
  }, [isOpen, availableAgents]);

  // Active cases (excluding any manually excluded by the user)
  const effectiveCases = useMemo(() => {
    return casesToAssign.filter(c => {
      const id = String(c.agreementid || c.agreement_no || c.id || c.loan_id);
      return !excludedCaseIds.has(id);
    });
  }, [casesToAssign, excludedCaseIds]);

  const totalCases = effectiveCases.length;
  const totalPOS = useMemo(() => {
    return effectiveCases.reduce((sum, c) => sum + (Number(c.principal_outstanding) || Number(c.amount) || 0), 0);
  }, [effectiveCases]);

  const distinctCities = useMemo(() => {
    const s = new Set<string>();
    casesToAssign.forEach(c => {
      const city = c.city || c.City || c.location;
      if (city) s.add(String(city).trim());
    });
    return Array.from(s);
  }, [casesToAssign]);

  const distinctBuckets = useMemo(() => {
    const s = new Set<string>();
    casesToAssign.forEach(c => {
      const bkt = c.bom_bkt || c.bucket || c.Bucket;
      if (bkt) s.add(String(bkt).trim());
    });
    return Array.from(s);
  }, [casesToAssign]);

  // Valid non-empty agents
  const validAgents = useMemo(() => {
    return selectedAgents.filter(a => a.name.trim() !== '');
  }, [selectedAgents]);

  // Simulation calculation with map of case -> assigned agent
  const { simulation, caseAgentMapping } = useMemo(() => {
    if (validAgents.length === 0 || totalCases === 0) {
      return { simulation: [], caseAgentMapping: new Map<string, string>() };
    }

    const available = [...effectiveCases];
    const results: { name: string; count: number; pos: number; percentage: number }[] = [];
    const mapping = new Map<string, string>();

    if (distMode === 'EQUAL') {
      const N = validAgents.length;
      const base = Math.floor(available.length / N);
      let remainder = available.length % N;
      let idx = 0;

      validAgents.forEach(agent => {
        const count = base + (remainder > 0 ? 1 : 0);
        if (remainder > 0) remainder--;

        let agentPos = 0;
        for (let i = 0; i < count; i++) {
          if (idx < available.length) {
            const c = available[idx];
            const id = String(c.agreementid || c.agreement_no || c.id || c.loan_id);
            mapping.set(id, agent.name.trim());
            agentPos += (Number(c.principal_outstanding) || Number(c.amount) || 0);
            idx++;
          }
        }

        results.push({
          name: agent.name.trim(),
          count,
          pos: agentPos,
          percentage: totalCases > 0 ? Math.round((count / totalCases) * 100) : 0,
        });
      });
    } else if (distMode === 'POS') {
      // Sort cases descending by POS
      available.sort((a, b) => {
        const posA = Number(a.principal_outstanding) || Number(a.amount) || 0;
        const posB = Number(b.principal_outstanding) || Number(b.amount) || 0;
        return posB - posA;
      });

      const loads = validAgents.map(a => ({ name: a.name.trim(), count: 0, pos: 0 }));

      available.forEach(c => {
        const cPos = Number(c.principal_outstanding) || Number(c.amount) || 0;
        // Assign to agent with lowest total POS
        loads.sort((a, b) => a.pos - b.pos);
        loads[0].count += 1;
        loads[0].pos += cPos;
        const id = String(c.agreementid || c.agreement_no || c.id || c.loan_id);
        mapping.set(id, loads[0].name);
      });

      loads.forEach(l => {
        results.push({
          name: l.name,
          count: l.count,
          pos: l.pos,
          percentage: totalCases > 0 ? Math.round((l.count / totalCases) * 100) : 0,
        });
      });
    } else if (distMode === 'PERCENT') {
      let idx = 0;
      let accumulated = 0;

      validAgents.forEach((agent, i) => {
        const pct = parseFloat(agent.val) || 0;
        let count = Math.round(totalCases * (pct / 100));
        if (i === validAgents.length - 1) {
          count = Math.max(0, totalCases - accumulated);
        }
        accumulated += count;

        let agentPos = 0;
        for (let j = 0; j < count; j++) {
          if (idx < available.length) {
            const c = available[idx];
            const id = String(c.agreementid || c.agreement_no || c.id || c.loan_id);
            mapping.set(id, agent.name.trim());
            agentPos += (Number(c.principal_outstanding) || Number(c.amount) || 0);
            idx++;
          }
        }

        results.push({
          name: agent.name.trim(),
          count,
          pos: agentPos,
          percentage: pct,
        });
      });
    } else if (distMode === 'CUSTOM') {
      let idx = 0;

      validAgents.forEach(agent => {
        const count = parseInt(agent.val) || 0;
        let agentPos = 0;
        for (let j = 0; j < count; j++) {
          if (idx < available.length) {
            const c = available[idx];
            const id = String(c.agreementid || c.agreement_no || c.id || c.loan_id);
            mapping.set(id, agent.name.trim());
            agentPos += (Number(c.principal_outstanding) || Number(c.amount) || 0);
            idx++;
          }
        }

        results.push({
          name: agent.name.trim(),
          count,
          pos: agentPos,
          percentage: totalCases > 0 ? Math.round((count / totalCases) * 100) : 0,
        });
      });
    }

    return { simulation: results, caseAgentMapping: mapping };
  }, [validAgents, effectiveCases, distMode, totalCases]);

  // Filtered cases for modal preview table
  const modalFilteredCases = useMemo(() => {
    if (!caseSearchTerm.trim()) return casesToAssign;
    const term = caseSearchTerm.toLowerCase().trim();
    return casesToAssign.filter(c => {
      const id = String(c.agreementid || c.agreement_no || c.id || c.loan_id || '').toLowerCase();
      const cust = String(c.customer_name || c['Customer Name'] || '').toLowerCase();
      const city = String(c.city || c.City || '').toLowerCase();
      return id.includes(term) || cust.includes(term) || city.includes(term);
    });
  }, [casesToAssign, caseSearchTerm]);

  const handleAddAgentRow = () => {
    setSelectedAgents([...selectedAgents, { name: '', val: '' }]);
  };

  const handleRemoveAgentRow = (index: number) => {
    const next = [...selectedAgents];
    next.splice(index, 1);
    if (next.length === 0) next.push({ name: '', val: '' });
    setSelectedAgents(next);
  };

  const handleQuickAddAll = () => {
    if (availableAgents.length === 0) return;
    setSelectedAgents(availableAgents.map(name => ({ name, val: '' })));
  };

  const handleToggleExcludeCase = (id: string) => {
    const next = new Set(excludedCaseIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setExcludedCaseIds(next);
  };

  const handleConfirm = async () => {
    if (validAgents.length === 0) {
      toast.error("Please add and select at least one agent.");
      return;
    }

    if (totalCases === 0) {
      toast.error("No pending cases selected to assign.");
      return;
    }

    if (distMode === 'PERCENT') {
      const totalPct = validAgents.reduce((s, a) => s + (parseFloat(a.val) || 0), 0);
      if (Math.abs(totalPct - 100) > 0.1) {
        toast.error(`Target percentages must equal 100%. Currently sums to ${totalPct}%.`);
        return;
      }
    }

    if (distMode === 'CUSTOM') {
      const requestedTotal = validAgents.reduce((s, a) => s + (parseInt(a.val) || 0), 0);
      if (requestedTotal > totalCases) {
        toast.error(`Total requested cases (${requestedTotal}) exceeds selected cases (${totalCases}).`);
        return;
      }
    }

    const available = [...effectiveCases];
    const updates: { agreementid: string; field: string; value: string }[] = [];

    if (distMode === 'EQUAL') {
      const N = validAgents.length;
      const base = Math.floor(available.length / N);
      let remainder = available.length % N;
      let caseIdx = 0;

      validAgents.forEach(agent => {
        const count = base + (remainder > 0 ? 1 : 0);
        if (remainder > 0) remainder--;

        for (let i = 0; i < count; i++) {
          if (caseIdx < available.length) {
            const c = available[caseIdx++];
            const id = String(c.agreementid || c.agreement_no || c.id || c.loan_id);
            updates.push({ agreementid: id, field: 'executive_name', value: agent.name.trim() });
          }
        }
      });
    } else if (distMode === 'POS') {
      available.sort((a, b) => {
        const posA = Number(a.principal_outstanding) || Number(a.amount) || 0;
        const posB = Number(b.principal_outstanding) || Number(b.amount) || 0;
        return posB - posA;
      });

      const loads = validAgents.map(a => ({ name: a.name.trim(), pos: 0 }));

      available.forEach(c => {
        const cPos = Number(c.principal_outstanding) || Number(c.amount) || 0;
        loads.sort((a, b) => a.pos - b.pos);
        const chosen = loads[0];
        const id = String(c.agreementid || c.agreement_no || c.id || c.loan_id);
        updates.push({ agreementid: id, field: 'executive_name', value: chosen.name });
        chosen.pos += cPos;
      });
    } else if (distMode === 'PERCENT') {
      let caseIdx = 0;
      let assignedCount = 0;

      validAgents.forEach((agent, index) => {
        const pct = parseFloat(agent.val) || 0;
        let count = Math.round(totalCases * (pct / 100));
        if (index === validAgents.length - 1) {
          count = totalCases - assignedCount;
        }

        for (let i = 0; i < count; i++) {
          if (caseIdx < available.length) {
            const c = available[caseIdx++];
            const id = String(c.agreementid || c.agreement_no || c.id || c.loan_id);
            updates.push({ agreementid: id, field: 'executive_name', value: agent.name.trim() });
            assignedCount++;
          }
        }
      });
    } else if (distMode === 'CUSTOM') {
      let caseIdx = 0;

      validAgents.forEach(agent => {
        const count = parseInt(agent.val) || 0;
        for (let i = 0; i < count; i++) {
          if (caseIdx < available.length) {
            const c = available[caseIdx++];
            const id = String(c.agreementid || c.agreement_no || c.id || c.loan_id);
            updates.push({ agreementid: id, field: 'executive_name', value: agent.name.trim() });
          }
        }
      });
    }

    try {
      setIsSubmitting(true);
      await onAssign(updates);
      toast.success(`Successfully allocated ${updates.length} cases across ${validAgents.length} agents!`);
      onClose();
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Failed to distribute assignments.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[92vh] flex flex-col p-0 overflow-hidden border border-border shadow-2xl bg-card">
        {/* Header */}
        <DialogHeader className="p-5 border-b border-border bg-muted/20">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <DialogTitle className="text-xl font-bold flex items-center gap-2 text-foreground">
                <Users className="h-5 w-5 text-primary" />
                Case Distribution & Assignment
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-1">
                Allocate selected portfolio cases intelligently across field recovery executives.
              </DialogDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-xs font-bold px-3 py-1">
                {totalCases} Selected Cases
              </Badge>
              <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-xs font-bold px-3 py-1">
                {fmtCur(totalPOS)}
              </Badge>
            </div>
          </div>

          {/* Scope details pills */}
          <div className="flex flex-wrap items-center gap-2 mt-3 text-xs text-muted-foreground">
            {distinctCities.length > 0 && (
              <span className="inline-flex items-center gap-1 bg-muted px-2.5 py-1 rounded-md">
                <span className="font-medium text-foreground">Cities ({distinctCities.length}):</span>{' '}
                {distinctCities.slice(0, 4).join(', ')}{distinctCities.length > 4 ? ` +${distinctCities.length - 4}` : ''}
              </span>
            )}
            {distinctBuckets.length > 0 && (
              <span className="inline-flex items-center gap-1 bg-muted px-2.5 py-1 rounded-md">
                <span className="font-medium text-foreground">Buckets:</span>{' '}
                {distinctBuckets.join(', ')}
              </span>
            )}

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowCaseTable(!showCaseTable)}
              className="ml-auto h-7 text-xs font-semibold bg-background"
            >
              <FileText className="h-3.5 w-3.5 mr-1 text-primary" />
              {showCaseTable ? 'Hide Case Table' : `Inspect Case Table (${casesToAssign.length})`}
              {showCaseTable ? <ChevronUp className="h-3.5 w-3.5 ml-1" /> : <ChevronDown className="h-3.5 w-3.5 ml-1" />}
            </Button>
          </div>
        </DialogHeader>

        {/* Body content */}
        <div className="p-5 overflow-y-auto space-y-5 flex-1 bg-background/50">
          {/* Collapsible Case Information Table inside Modal */}
          {showCaseTable && (
            <div className="bg-card border border-border rounded-xl p-4 shadow-xs space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary" />
                  <span className="text-xs font-bold uppercase tracking-wider text-foreground">
                    Cases Selected for This Allocation ({effectiveCases.length} / {casesToAssign.length})
                  </span>
                </div>
                <div className="w-64 relative">
                  <Search className="h-3.5 w-3.5 absolute left-2.5 top-2 text-muted-foreground" />
                  <Input
                    value={caseSearchTerm}
                    onChange={e => setCaseSearchTerm(e.target.value)}
                    placeholder="Search agreement, customer..."
                    className="h-7 text-xs pl-7"
                  />
                </div>
              </div>

              <div className="max-h-60 overflow-y-auto border border-border rounded-lg">
                <table className="w-full text-xs text-left">
                  <thead className="bg-muted/50 border-b border-border sticky top-0 text-[10px] uppercase font-bold text-muted-foreground">
                    <tr>
                      <th className="p-2 text-center w-8">Include</th>
                      <th className="p-2">Agreement ID</th>
                      <th className="p-2">Customer Name</th>
                      <th className="p-2">City</th>
                      <th className="p-2 text-center">Bucket</th>
                      <th className="p-2 text-right">POS (₹)</th>
                      <th className="p-2">Assigned Agent (Preview)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {modalFilteredCases.map(c => {
                      const id = String(c.agreementid || c.agreement_no || c.id || c.loan_id);
                      const isExcluded = excludedCaseIds.has(id);
                      const assignedAgent = caseAgentMapping.get(id);

                      return (
                        <tr key={id} className={`hover:bg-muted/20 transition-colors ${isExcluded ? 'opacity-40 bg-muted/30' : ''}`}>
                          <td className="p-2 text-center">
                            <Checkbox
                              checked={!isExcluded}
                              onCheckedChange={() => handleToggleExcludeCase(id)}
                              className="border-muted-foreground data-[state=checked]:bg-primary"
                            />
                          </td>
                          <td className="p-2 font-mono font-bold text-foreground">{id}</td>
                          <td className="p-2 font-medium">{c.customer_name || c['Customer Name'] || 'N/A'}</td>
                          <td className="p-2 text-muted-foreground">{c.city || c.City || 'N/A'}</td>
                          <td className="p-2 text-center">
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                              BKT {c.bom_bkt || c.bucket || '1'}
                            </Badge>
                          </td>
                          <td className="p-2 text-right font-semibold text-foreground">
                            {fmtCur(Number(c.principal_outstanding) || Number(c.amount) || 0)}
                          </td>
                          <td className="p-2">
                            {assignedAgent ? (
                              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-[10px] font-bold">
                                {assignedAgent}
                              </Badge>
                            ) : (
                              <span className="text-[10px] text-muted-foreground italic">Pending</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Strategy Selector */}
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-2">
              1. Distribution Strategy
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {[
                { id: 'EQUAL', label: 'Equal Split', desc: 'Even case counts', icon: Equal },
                { id: 'POS', label: 'POS Balanced', desc: 'Equal ₹ load balance', icon: Scale },
                { id: 'PERCENT', label: 'Percentage (%)', desc: 'Custom share ratio', icon: PieChart },
                { id: 'CUSTOM', label: 'Custom Count', desc: 'Exact case numbers', icon: BarChart3 },
              ].map(strat => {
                const Icon = strat.icon;
                const isSelected = distMode === strat.id;
                return (
                  <button
                    key={strat.id}
                    type="button"
                    onClick={() => setDistMode(strat.id as DistMode)}
                    className={`flex flex-col items-center text-center p-3 rounded-xl border transition-all ${
                      isSelected
                        ? 'bg-primary/10 border-primary text-primary shadow-sm ring-1 ring-primary'
                        : 'bg-card border-border hover:bg-muted text-muted-foreground'
                    }`}
                  >
                    <Icon className="h-5 w-5 mb-1 text-primary" />
                    <span className="text-xs font-bold">{strat.label}</span>
                    <span className="text-[10px] text-muted-foreground">{strat.desc}</span>
                  </button>
                );
              })}
            </div>
            
            {/* Strategy Hint */}
            <div className="mt-2.5 p-3 rounded-lg bg-primary/5 border border-primary/15 text-xs text-muted-foreground flex items-start gap-2">
              <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              <div>
                {distMode === 'EQUAL' && "Distributes the total cases evenly among the selected agents. Any odd remainder is handed to the first agents in sequence."}
                {distMode === 'POS' && "Sorts cases by outstanding monetary value (POS) and load-balances so each agent handles a nearly equal total rupee amount."}
                {distMode === 'PERCENT' && "Enter target percentages for each agent. The sum of all agent percentages must equal exactly 100%."}
                {distMode === 'CUSTOM' && "Manually define exact case quantities for each executive."}
              </div>
            </div>
          </div>

          {/* Agents List */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                2. Select Assigned Agents ({validAgents.length})
              </label>
              {availableAgents.length > 0 && (
                <Button 
                  type="button" 
                  variant="ghost" 
                  size="sm" 
                  onClick={handleQuickAddAll}
                  className="h-7 text-xs font-semibold text-primary hover:bg-primary/10"
                >
                  <Sparkles className="h-3.5 w-3.5 mr-1" />
                  Add All Active Agents ({availableAgents.length})
                </Button>
              )}
            </div>

            <div className="space-y-2.5 max-h-52 overflow-y-auto pr-1">
              {selectedAgents.map((agent, idx) => (
                <div key={idx} className="flex items-center gap-2 bg-card p-2 rounded-xl border border-border shadow-xs">
                  <div className="flex-1">
                    <Input
                      value={agent.name}
                      onChange={(e) => {
                        const next = [...selectedAgents];
                        next[idx].name = e.target.value;
                        setSelectedAgents(next);
                      }}
                      placeholder="Type agent name or select..."
                      list="assignment-agents-list"
                      className="h-9 text-sm"
                    />
                  </div>

                  {distMode === 'PERCENT' && (
                    <div className="w-28 relative flex items-center">
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        value={agent.val}
                        onChange={(e) => {
                          const next = [...selectedAgents];
                          next[idx].val = e.target.value;
                          setSelectedAgents(next);
                        }}
                        placeholder="%"
                        className="h-9 pr-6 text-sm"
                      />
                      <span className="absolute right-2 text-xs font-bold text-muted-foreground">%</span>
                    </div>
                  )}

                  {distMode === 'CUSTOM' && (
                    <div className="w-28">
                      <Input
                        type="number"
                        min="1"
                        max={totalCases}
                        value={agent.val}
                        onChange={(e) => {
                          const next = [...selectedAgents];
                          next[idx].val = e.target.value;
                          setSelectedAgents(next);
                        }}
                        placeholder="Cases"
                        className="h-9 text-sm"
                      />
                    </div>
                  )}

                  {(distMode === 'EQUAL' || distMode === 'POS') && (
                    <div className="w-24 h-9 px-2 flex items-center justify-center bg-muted/60 rounded-md text-[11px] font-bold uppercase text-muted-foreground">
                      Auto Split
                    </div>
                  )}

                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemoveAgentRow(idx)}
                    className="h-9 w-9 text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAddAgentRow}
              className="mt-2.5 h-8 text-xs font-semibold"
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              Add Agent
            </Button>
          </div>

          {/* Live Preview / Simulation */}
          {simulation.length > 0 && (
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Layers className="h-3.5 w-3.5 text-primary" />
                  Allocation Preview Simulation
                </span>
                <span className="text-xs font-semibold text-muted-foreground">
                  Total: {simulation.reduce((s, r) => s + r.count, 0)} / {totalCases} Cases
                </span>
              </div>

              <div className="divide-y divide-border text-xs">
                {simulation.map((item, idx) => (
                  <div key={idx} className="py-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="h-6 w-6 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center text-[10px]">
                        {idx + 1}
                      </div>
                      <span className="font-semibold text-foreground">{item.name}</span>
                    </div>

                    <div className="flex items-center gap-4">
                      <span className="font-bold text-primary">
                        {item.count} Cases
                      </span>
                      <span className="font-medium text-muted-foreground">
                        {fmtCur(item.pos)}
                      </span>
                      <Badge variant="secondary" className="text-[10px] font-bold">
                        {item.percentage}%
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <DialogFooter className="p-4 border-t border-border bg-muted/20 flex flex-row items-center justify-between sm:justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button 
            type="button" 
            onClick={handleConfirm} 
            disabled={isSubmitting || validAgents.length === 0 || totalCases === 0}
            className="bg-primary text-primary-foreground font-bold shadow-md"
          >
            <CheckCircle2 className="h-4 w-4 mr-1.5" />
            {isSubmitting ? 'Distributing...' : `Confirm & Assign (${totalCases} Cases)`}
          </Button>
        </DialogFooter>

        {/* Datalist for fast agent autocomplete */}
        <datalist id="assignment-agents-list">
          {availableAgents.map((agent, i) => (
            <option key={i} value={agent} />
          ))}
        </datalist>
      </DialogContent>
    </Dialog>
  );
}
