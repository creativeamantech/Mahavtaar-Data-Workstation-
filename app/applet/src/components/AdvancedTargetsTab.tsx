import { useState, useMemo, useEffect } from 'react';
import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { calculateRow } from '../lib/calculations';
import { 
  Target, 
  Calendar, 
  CalendarDays, 
  TrendingUp, 
  Trash2, 
  Calculator, 
  Clock, 
  Percent, 
  IndianRupee,
  Layers,
  Check
} from 'lucide-react';
import { toast } from 'sonner';

export function AdvancedTargetsTab() {
  const { records, targets, setTarget } = useData();
  const { user } = useAuth();
  
  const [level, setLevel] = useState<'GLOBAL' | 'STATE' | 'CITY'>('GLOBAL');
  const [selectedState, setSelectedState] = useState<string>('ALL');
  const [selectedCity, setSelectedCity] = useState<string>('ALL');
  const [selectedBucket, setSelectedBucket] = useState<string>('ALL');
  
  // Default target date to end of current month
  const getDefaultEndOfMonth = () => {
    const now = new Date();
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return lastDay.toISOString().split('T')[0];
  };

  const [targetDate, setTargetDate] = useState<string>(getDefaultEndOfMonth());
  const [targetPct, setTargetPct] = useState<string>('20');
  const [targetAmt, setTargetAmt] = useState<string>('');

  // Extract unique values
  const buckets = useMemo(() => Array.from(new Set(records.map(r => String(r.bom_bkt || '').trim().toUpperCase()).filter(Boolean))).sort(), [records]);
  const states = useMemo(() => Array.from(new Set(records.map(r => String(r.state || r.State || '').trim().toUpperCase()).filter(Boolean))).sort(), [records]);
  const cities = useMemo(() => {
    let match = records;
    if (level === 'STATE' && selectedState !== 'ALL') {
      match = match.filter(r => String(r.state || r.State || '').trim().toUpperCase() === selectedState);
    }
    return Array.from(new Set(match.map(r => String(r.city || r.City || '').trim().toUpperCase()).filter(Boolean))).sort();
  }, [records, level, selectedState]);

  // Calculate matching scope records & statistics
  const scopeData = useMemo(() => {
    let match = records;
    if (level === 'STATE' && selectedState !== 'ALL') {
      match = match.filter(r => String(r.state || r.State || '').trim().toUpperCase() === selectedState);
    } else if (level === 'CITY' && selectedCity !== 'ALL') {
      match = match.filter(r => String(r.city || r.City || '').trim().toUpperCase() === selectedCity);
    }
    
    if (selectedBucket !== 'ALL') {
      match = match.filter(r => String(r.bom_bkt || '').trim().toUpperCase() === selectedBucket);
    }
    
    let totalPos = 0;
    let paidPos = 0;
    let paidCount = 0;

    match.forEach(r => {
      const posVal = Number(r.principal_outstanding) || 0;
      totalPos += posVal;
      const c = calculateRow(r);
      if (c.mainPaid === 1 || c.teamPaid === 1) {
        paidCount++;
        paidPos += c.mainPaidPOS || c.teamPaidPOS || 0;
      }
    });

    return { 
      count: match.length, 
      totalPos, 
      paidPos, 
      paidCount 
    };
  }, [records, level, selectedState, selectedCity, selectedBucket]);

  const currentKey = useMemo(() => {
    const b = selectedBucket === 'ALL' ? '' : selectedBucket;
    if (level === 'GLOBAL') {
      return b ? `GLOBAL__BKT__${b}` : 'GLOBAL';
    } else if (level === 'STATE' && selectedState !== 'ALL') {
      return b ? `STATE__${selectedState}__BKT__${b}` : `STATE__${selectedState}`;
    } else if (level === 'CITY' && selectedCity !== 'ALL') {
      return b ? `CITY__${selectedCity}__BKT__${b}` : `CITY__${selectedCity}`;
    }
    return '';
  }, [level, selectedState, selectedCity, selectedBucket]);

  // Sync existing target if already set for this key + date
  useEffect(() => {
    if (currentKey && targetDate) {
      const existingPct = targets[`${currentKey}@@${targetDate}`] ?? targets[currentKey];
      if (existingPct && existingPct > 0) {
        setTargetPct(existingPct.toString());
        if (scopeData.totalPos > 0) {
          const amt = Math.round((existingPct * scopeData.totalPos) / 100);
          setTargetAmt(amt.toString());
        }
      }
    }
  }, [currentKey, targetDate, targets, scopeData.totalPos]);

  // When totalPos changes, recalculate target amount based on current pct
  const handlePctChange = (valStr: string) => {
    setTargetPct(valStr);
    const num = parseFloat(valStr);
    if (!isNaN(num) && scopeData.totalPos > 0) {
      const amt = Math.round((num * scopeData.totalPos) / 100);
      setTargetAmt(amt.toString());
    } else {
      setTargetAmt('');
    }
  };

  const handleAmtChange = (valStr: string) => {
    setTargetAmt(valStr);
    const num = parseFloat(valStr);
    if (!isNaN(num) && scopeData.totalPos > 0) {
      const pct = (num / scopeData.totalPos) * 100;
      setTargetPct(pct.toFixed(2));
    } else {
      setTargetPct('');
    }
  };

  // Quick preset percentages
  const handleApplyPreset = (pctVal: number) => {
    setTargetPct(pctVal.toString());
    if (scopeData.totalPos > 0) {
      const amt = Math.round((pctVal * scopeData.totalPos) / 100);
      setTargetAmt(amt.toString());
    }
  };

  // Quick date shortcuts
  const setQuickDate = (daysFromNow: number) => {
    const d = new Date();
    d.setDate(d.getDate() + daysFromNow);
    setTargetDate(d.toISOString().split('T')[0]);
  };

  // Calculations for the current scope preview
  const numPct = parseFloat(targetPct) || 0;
  const targetPosGoal = Math.round((numPct * scopeData.totalPos) / 100);
  const neededPos = Math.max(0, targetPosGoal - scopeData.paidPos);
  
  const remainingDays = useMemo(() => {
    if (!targetDate) return 1;
    const today = new Date().toISOString().split('T')[0];
    const diff = new Date(targetDate).getTime() - new Date(today).getTime();
    const d = Math.ceil(diff / (1000 * 60 * 60 * 24));
    return d > 0 ? d : 1;
  }, [targetDate]);

  const dailyRequiredPOS = neededPos > 0 ? neededPos / remainingDays : 0;
  const isAchieved = targetPosGoal > 0 && scopeData.paidPos >= targetPosGoal;
  const progressPct = targetPosGoal > 0 ? Math.min(100, (scopeData.paidPos / targetPosGoal) * 100) : 0;

  const handleSaveTarget = async () => {
    if (!targetDate) {
      toast.error('Please select a valid target date');
      return;
    }
    if (!currentKey) {
      toast.error('Please select a valid filter combination');
      return;
    }
    if (numPct <= 0) {
      toast.error('Target percentage must be greater than 0%');
      return;
    }

    const fullKey = `${currentKey}@@${targetDate}`;
    await setTarget(fullKey, numPct, user?.name || 'System');
    toast.success(`Target of ${numPct}% (₹${targetPosGoal.toLocaleString('en-IN')}) saved successfully!`);
  };

  const handleRemoveTarget = async (key: string) => {
    await setTarget(key, 0, user?.name || 'System');
    toast.success('Target removed successfully');
  };

  // Configured Targets with full breakdown (Total POS, Paid, Needed, Daily Required)
  const configuredTargets = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return Object.entries(targets)
      .filter(([_, pct]) => pct > 0)
      .map(([fullKey, pct]) => {
        const parts = fullKey.split('@@');
        const key = parts[0];
        const date = parts.length > 1 ? parts[1] : null;
        let label = key;
        let scopeBadge = 'Global';
        
        let match = records;
        if (key === 'GLOBAL') {
          label = 'Global (All Buckets & Cities)';
          scopeBadge = 'Global';
        } else if (key.startsWith('GLOBAL__BKT__')) {
          const b = key.replace('GLOBAL__BKT__', '');
          label = `Global - Bucket ${b}`;
          scopeBadge = `Bucket ${b}`;
          match = match.filter(r => String(r.bom_bkt || '').trim().toUpperCase() === b);
        } else if (key.startsWith('CITY__')) {
          const p = key.split('__BKT__');
          const c = p[0].replace('CITY__', '');
          if (p.length > 1) {
            label = `City: ${c} - Bucket ${p[1]}`;
            scopeBadge = `${c} (Bkt ${p[1]})`;
            match = match.filter(r => String(r.city || r.City || '').trim().toUpperCase() === c && String(r.bom_bkt || '').trim().toUpperCase() === p[1]);
          } else {
            label = `City: ${c} (All Buckets)`;
            scopeBadge = `${c}`;
            match = match.filter(r => String(r.city || r.City || '').trim().toUpperCase() === c);
          }
        } else if (key.startsWith('STATE__')) {
          const p = key.split('__BKT__');
          const s = p[0].replace('STATE__', '');
          if (p.length > 1) {
            label = `State: ${s} - Bucket ${p[1]}`;
            scopeBadge = `${s} (Bkt ${p[1]})`;
            match = match.filter(r => String(r.state || r.State || '').trim().toUpperCase() === s && String(r.bom_bkt || '').trim().toUpperCase() === p[1]);
          } else {
            label = `State: ${s} (All Buckets)`;
            scopeBadge = `${s}`;
            match = match.filter(r => String(r.state || r.State || '').trim().toUpperCase() === s);
          }
        }

        let totalPos = 0;
        let paidPos = 0;
        match.forEach(r => {
          const posVal = Number(r.principal_outstanding) || 0;
          totalPos += posVal;
          const c = calculateRow(r);
          if (c.mainPaid === 1 || c.teamPaid === 1) {
            paidPos += c.mainPaidPOS || c.teamPaidPOS || 0;
          }
        });

        const targetPos = Math.round((pct * totalPos) / 100);
        const needed = Math.max(0, targetPos - paidPos);
        
        let daysLeft = 1;
        if (date) {
          const diff = new Date(date).getTime() - new Date(today).getTime();
          const d = Math.ceil(diff / (1000 * 60 * 60 * 24));
          daysLeft = d > 0 ? d : 1;
        }

        const dailyReq = needed > 0 ? needed / daysLeft : 0;
        const progress = targetPos > 0 ? Math.min(100, (paidPos / targetPos) * 100) : 0;

        return {
          key: fullKey,
          label,
          scopeBadge,
          pct,
          targetPos,
          totalPos,
          paidPos,
          needed,
          date: date || 'No Deadline',
          daysLeft,
          dailyReq,
          progress,
          isOverdue: date ? date < today : false
        };
      });
  }, [targets, records]);

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Target Logic & Formula Card */}
      <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-accent/10 border border-primary/20 rounded-2xl p-5 shadow-sm">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="p-2 bg-primary/20 text-primary rounded-xl">
                <Calculator className="w-5 h-5" />
              </span>
              <h2 className="text-lg font-bold tracking-tight">Global & Regional Target Formulation</h2>
              <Badge variant="outline" className="bg-background/80 font-mono text-[11px] text-primary border-primary/30">
                Formula Active
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground max-w-2xl leading-relaxed">
              Targets are defined as a percentage of Total POS. The system calculates the <span className="font-semibold text-foreground">Target Goal</span>, subtracts <span className="font-semibold text-foreground">Paid POS</span> to find the <span className="font-semibold text-foreground">Needed POS</span>, and divides by the remaining target days to establish the <span className="font-semibold text-foreground">Daily Required POS</span>.
            </p>
          </div>
        </div>

        {/* Step-by-Step Flow Visualization */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-4 pt-4 border-t border-primary/15">
          <div className="bg-background/80 backdrop-blur-sm p-3 rounded-xl border border-border/80 flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs text-muted-foreground font-medium mb-1">
              <span>Step 1: Target Goal</span>
              <Percent className="w-3.5 h-3.5 text-primary" />
            </div>
            <div className="font-semibold text-sm text-foreground">Total POS × Target %</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">= Target POS Amount (₹)</div>
          </div>

          <div className="bg-background/80 backdrop-blur-sm p-3 rounded-xl border border-border/80 flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs text-muted-foreground font-medium mb-1">
              <span>Step 2: Recovery Balance</span>
              <TrendingUp className="w-3.5 h-3.5 text-blue-500" />
            </div>
            <div className="font-semibold text-sm text-foreground">Target POS - Paid POS</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">= Needed POS (Outstanding)</div>
          </div>

          <div className="bg-background/80 backdrop-blur-sm p-3 rounded-xl border border-border/80 flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs text-muted-foreground font-medium mb-1">
              <span>Step 3: Timeline</span>
              <CalendarDays className="w-3.5 h-3.5 text-amber-500" />
            </div>
            <div className="font-semibold text-sm text-foreground">Target Date - Today</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">= Days Remaining</div>
          </div>

          <div className="bg-background/80 backdrop-blur-sm p-3 rounded-xl border border-border/80 flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs text-muted-foreground font-medium mb-1">
              <span>Step 4: Daily Run Rate</span>
              <Clock className="w-3.5 h-3.5 text-emerald-500" />
            </div>
            <div className="font-semibold text-sm text-foreground">Needed POS ÷ Days</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">= Daily Required POS (₹/day)</div>
          </div>
        </div>
      </div>

      {/* Target Setting Builder Card */}
      <Card className="border border-border/80 shadow-md">
        <CardHeader className="pb-3 border-b bg-card">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Target className="w-4 h-4 text-primary" />
                Configure Target Rule
              </CardTitle>
              <CardDescription className="text-xs">
                Select your geographical or bucket scope, set the percentage goal and target deadline.
              </CardDescription>
            </div>
            <Badge variant="secondary" className="text-xs font-semibold">
              {scopeData.count} Records in Scope
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-6 pt-5 bg-card">
          {/* Scope Filters */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Level</label>
              <Select value={level} onValueChange={(val: any) => { setLevel(val); setSelectedState('ALL'); setSelectedCity('ALL'); }}>
                <SelectTrigger className="h-9 font-medium text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="GLOBAL">Global (All Areas)</SelectItem>
                  <SelectItem value="STATE">Specific State</SelectItem>
                  <SelectItem value="CITY">Specific City</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {level === 'STATE' && (
              <div className="space-y-1.5 animate-in fade-in">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">State</label>
                <Select value={selectedState} onValueChange={setSelectedState}>
                  <SelectTrigger className="h-9 font-medium text-xs">
                    <SelectValue placeholder="Select State..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All States</SelectItem>
                    {states.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}

            {level === 'CITY' && (
              <div className="space-y-1.5 animate-in fade-in">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">City</label>
                <Select value={selectedCity} onValueChange={setSelectedCity}>
                  <SelectTrigger className="h-9 font-medium text-xs">
                    <SelectValue placeholder="Select City..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All Cities</SelectItem>
                    {cities.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Bucket Filter</label>
              <Select value={selectedBucket} onValueChange={setSelectedBucket}>
                <SelectTrigger className="h-9 font-medium text-xs">
                  <SelectValue placeholder="All Buckets" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Buckets</SelectItem>
                  {buckets.map(b => <SelectItem key={b} value={b}>Bucket {b}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Target Date</label>
                <span className="text-[10px] text-primary font-medium">{remainingDays} days left</span>
              </div>
              <input 
                type="date" 
                value={targetDate}
                onChange={e => setTargetDate(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs font-medium ring-offset-background focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
              />
            </div>
          </div>

          {/* Quick Date Shortcuts */}
          <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
            <span className="text-muted-foreground text-[11px] font-medium mr-1 flex items-center gap-1">
              <Calendar className="w-3 h-3" /> Quick Deadlines:
            </span>
            <Button 
              type="button" 
              variant="outline" 
              size="sm" 
              className="h-7 text-xs px-2.5 rounded-full"
              onClick={() => setTargetDate(getDefaultEndOfMonth())}
            >
              End of Month
            </Button>
            <Button 
              type="button" 
              variant="outline" 
              size="sm" 
              className="h-7 text-xs px-2.5 rounded-full"
              onClick={() => setQuickDate(7)}
            >
              +7 Days
            </Button>
            <Button 
              type="button" 
              variant="outline" 
              size="sm" 
              className="h-7 text-xs px-2.5 rounded-full"
              onClick={() => setQuickDate(15)}
            >
              +15 Days
            </Button>
            <Button 
              type="button" 
              variant="outline" 
              size="sm" 
              className="h-7 text-xs px-2.5 rounded-full"
              onClick={() => setQuickDate(30)}
            >
              +30 Days
            </Button>
          </div>

          {/* Dual Percentage & Amount Input */}
          <div className="p-5 bg-muted/40 rounded-2xl border border-border/80 space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <div className="text-sm font-bold text-foreground flex items-center gap-2">
                  <span>Target Value Input</span>
                  <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-md font-semibold">Dual Sync</span>
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  Set as percentage of Total POS or direct target currency amount.
                </div>
              </div>

              {/* Quick Preset Buttons */}
              <div className="flex flex-wrap items-center gap-1.5">
                {[10, 15, 20, 25, 30, 50].map(p => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => handleApplyPreset(p)}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-md border transition-all ${
                      parseFloat(targetPct) === p 
                        ? 'bg-primary text-primary-foreground border-primary shadow-sm' 
                        : 'bg-background hover:bg-muted text-muted-foreground border-border'
                    }`}
                  >
                    {p}%
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div className="space-y-1.5 bg-background p-3.5 rounded-xl border">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <Percent className="w-3.5 h-3.5 text-primary" /> Target Percentage (%)
                  </label>
                  <span className="text-[10px] text-muted-foreground font-mono">0.00% to 100%</span>
                </div>
                <div className="relative flex items-center">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    placeholder="e.g. 20"
                    value={targetPct}
                    onChange={e => handlePctChange(e.target.value)}
                    className="h-10 w-full rounded-lg border border-input bg-card px-3 text-sm font-bold focus:outline-none focus:border-primary pr-8"
                  />
                  <span className="absolute right-3 text-sm font-bold text-muted-foreground">%</span>
                </div>
              </div>

              <div className="space-y-1.5 bg-background p-3.5 rounded-xl border">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <IndianRupee className="w-3.5 h-3.5 text-primary" /> Target Amount (₹)
                  </label>
                  <span className="text-[10px] text-muted-foreground font-mono">Auto-Calculated</span>
                </div>
                <div className="relative flex items-center">
                  <span className="absolute left-3 text-sm font-bold text-muted-foreground">₹</span>
                  <input
                    type="number"
                    placeholder="e.g. 2000000"
                    value={targetAmt}
                    onChange={e => handleAmtChange(e.target.value)}
                    className="h-10 w-full rounded-lg border border-input bg-card pl-8 pr-3 text-sm font-bold focus:outline-none focus:border-primary"
                  />
                </div>
              </div>
            </div>

            {/* Live Calculation Preview Dashboard */}
            <div className="pt-4 border-t border-border/80 space-y-3">
              <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                <span>Calculated Run Rate Preview</span>
                <span className="text-primary font-semibold">{scopeData.count} accounts matching</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-card p-3 rounded-xl border space-y-0.5">
                  <div className="text-[11px] text-muted-foreground font-medium">Scope Total POS</div>
                  <div className="text-sm font-bold font-mono text-foreground">
                    ₹{scopeData.totalPos.toLocaleString('en-IN')}
                  </div>
                  <div className="text-[10px] text-muted-foreground">Base principal pool</div>
                </div>

                <div className="bg-card p-3 rounded-xl border space-y-0.5">
                  <div className="text-[11px] text-muted-foreground font-medium">Target POS Goal</div>
                  <div className="text-sm font-bold font-mono text-primary">
                    ₹{targetPosGoal.toLocaleString('en-IN')}
                  </div>
                  <div className="text-[10px] text-primary/80 font-medium">
                    {numPct.toFixed(2)}% of base POS
                  </div>
                </div>

                <div className="bg-card p-3 rounded-xl border space-y-0.5">
                  <div className="text-[11px] text-muted-foreground font-medium">Paid POS (Collected)</div>
                  <div className="text-sm font-bold font-mono text-emerald-600 dark:text-emerald-400">
                    ₹{scopeData.paidPos.toLocaleString('en-IN')}
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    {scopeData.paidCount} accounts resolved
                  </div>
                </div>

                <div className={`p-3 rounded-xl border space-y-0.5 ${isAchieved ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-card'}`}>
                  <div className="text-[11px] text-muted-foreground font-medium">Needed POS</div>
                  <div className={`text-sm font-bold font-mono ${isAchieved ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>
                    {isAchieved ? 'Achieved ✓' : `₹${neededPos.toLocaleString('en-IN')}`}
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    {isAchieved ? 'Target completed' : 'Remaining to collect'}
                  </div>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="space-y-1.5 pt-1">
                <div className="flex justify-between text-xs font-medium text-muted-foreground">
                  <span>Target Progress</span>
                  <span className="font-semibold text-foreground">{progressPct.toFixed(1)}%</span>
                </div>
                <Progress value={progressPct} className="h-2 rounded-full" />
              </div>

              {/* Daily Required POS Highlight Box */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200">
                <div className="flex items-center gap-3">
                  <span className="p-2 bg-amber-500/20 rounded-lg text-amber-600 dark:text-amber-400">
                    <Clock className="w-5 h-5" />
                  </span>
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-300">
                      Daily Required POS (Run Rate)
                    </div>
                    <div className="text-xl font-bold font-mono text-amber-600 dark:text-amber-400">
                      ₹{Math.round(dailyRequiredPOS).toLocaleString('en-IN')} <span className="text-xs font-medium text-muted-foreground">/ day</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <Button 
                    type="button" 
                    onClick={handleSaveTarget}
                    className="w-full sm:w-auto px-6 font-bold shadow-md bg-primary hover:bg-primary/90 text-primary-foreground"
                  >
                    <Check className="w-4 h-4 mr-2" /> Save Target
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Configured Active Targets List */}
      <Card className="border border-border/80 shadow-md">
        <CardHeader className="pb-3 border-b bg-card">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Layers className="w-4 h-4 text-primary" />
                Active Configured Targets ({configuredTargets.length})
              </CardTitle>
              <CardDescription className="text-xs">
                Review existing target rules, needed principal balance, and required daily collection velocity.
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0 divide-y bg-card">
          {configuredTargets.length === 0 ? (
            <div className="text-center py-12 px-4 space-y-2">
              <Target className="w-10 h-10 text-muted-foreground/40 mx-auto" />
              <div className="text-sm font-semibold text-foreground">No active targets configured</div>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                Use the target rule builder above to assign recovery percentages to global, state, or city scopes.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border/60">
              {configuredTargets.map(t => (
                <div key={t.key} className="p-4 hover:bg-muted/30 transition-colors flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                  <div className="space-y-1.5 flex-1 min-w-[240px]">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-sm text-foreground">{t.label}</span>
                      <Badge variant="outline" className="text-[10px] font-semibold bg-primary/5 text-primary border-primary/20">
                        {t.scopeBadge}
                      </Badge>
                      {t.needed <= 0 ? (
                        <Badge variant="default" className="text-[10px] font-semibold bg-emerald-600 text-white">
                          Achieved ✓
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-[10px] font-semibold text-muted-foreground">
                          {t.daysLeft} days left
                        </Badge>
                      )}
                    </div>

                    <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                      <span>Base POS: <strong className="text-foreground">₹{t.totalPos.toLocaleString('en-IN')}</strong></span>
                      <span>Target: <strong className="text-primary">{t.pct.toFixed(2)}% (₹{t.targetPos.toLocaleString('en-IN')})</strong></span>
                      <span>Collected: <strong className="text-emerald-600 dark:text-emerald-400">₹{t.paidPos.toLocaleString('en-IN')}</strong></span>
                      <span>Deadline: <strong className="text-foreground">{t.date}</strong></span>
                    </div>

                    {/* Progress */}
                    <div className="w-full max-w-md pt-1">
                      <Progress value={t.progress} className="h-1.5 rounded-full" />
                    </div>
                  </div>

                  {/* Needed & Daily Required Highlight */}
                  <div className="flex items-center gap-6 self-end md:self-center">
                    <div className="text-right">
                      <div className="text-[11px] text-muted-foreground font-medium">Needed POS</div>
                      <div className={`text-sm font-bold font-mono ${t.needed <= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>
                        {t.needed <= 0 ? '₹0 (Achieved)' : `₹${t.needed.toLocaleString('en-IN')}`}
                      </div>
                    </div>

                    <div className="text-right pl-4 border-l border-border/80">
                      <div className="text-[11px] text-muted-foreground font-medium">Daily Required POS</div>
                      <div className="text-sm font-bold font-mono text-amber-600 dark:text-amber-400">
                        ₹{Math.round(t.dailyReq).toLocaleString('en-IN')}/day
                      </div>
                    </div>

                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => handleRemoveTarget(t.key)}
                      className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 h-8 w-8 p-0"
                      title="Delete target rule"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
