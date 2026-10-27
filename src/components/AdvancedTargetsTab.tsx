import { useState, useMemo, useEffect } from 'react';
import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { calculateRow } from '../lib/calculations';
import { Target, Trash2, Plus, Layers } from 'lucide-react';
import { toast } from 'sonner';

export function AdvancedTargetsTab() {
  const { records, targets, setTarget } = useData();
  const { user } = useAuth();
  
  // Add Target Form State
  const [level, setLevel] = useState<'GLOBAL' | 'STATE' | 'CITY'>('CITY');
  const [targetCategory, setTargetCategory] = useState<'MAIN' | 'ROLLBACK' | 'MILESTONE1' | 'MILESTONE2'>('MAIN');
  const [selectedState, setSelectedState] = useState<string>('ALL');
  const [selectedCity, setSelectedCity] = useState<string>('ALL');
  const [selectedBucket, setSelectedBucket] = useState<string>('ALL');
  
  const getDefaultEndOfMonth = () => {
    const now = new Date();
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return lastDay.toISOString().split('T')[0];
  };
  const [targetDate, setTargetDate] = useState<string>(getDefaultEndOfMonth());
  const [targetPct, setTargetPct] = useState<string>('');

  const buckets = useMemo(() => ['ALL', ...Array.from(new Set(records.map(r => String(r.bom_bkt || '').trim().toUpperCase()).filter(Boolean))).sort()], [records]);
  const states = useMemo(() => ['ALL', ...Array.from(new Set(records.map(r => String(r.state || r.State || '').trim().toUpperCase()).filter(Boolean))).sort()], [records]);
  const cities = useMemo(() => {
    let match = records;
    if (level === 'STATE' && selectedState !== 'ALL') {
      match = match.filter(r => String(r.state || r.State || '').trim().toUpperCase() === selectedState);
    }
    return ['ALL', ...Array.from(new Set(match.map(r => String(r.city || r.City || '').trim().toUpperCase()).filter(Boolean))).sort()];
  }, [records, level, selectedState]);

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

  const handleAddTarget = async () => {
    if (!targetDate) {
      toast.error('Please select a valid target date');
      return;
    }
    if (!currentKey) {
      toast.error('Please select a specific State or City based on your level.');
      return;
    }
    const numPct = parseFloat(targetPct);
    if (isNaN(numPct) || numPct <= 0) {
      toast.error('Target percentage must be greater than 0%');
      return;
    }
    
    const catPrefix = targetCategory === 'MAIN' ? '' : `CAT_${targetCategory}::`;
    const fullKey = `${catPrefix}${currentKey}@@${targetDate}`;
    
    await setTarget(fullKey, numPct, user?.name || 'System');
    toast.success(`${targetCategory} Target saved successfully!`);
    setTargetPct(''); // Reset input
  };

  const handleRemoveTarget = async (key: string) => {
    await setTarget(key, 0, user?.name || 'System');
    toast.success('Target removed successfully');
  };

  const configuredTargets = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return Object.entries(targets)
      .filter(([_, pct]) => pct > 0)
      .map(([fullKey, pct]) => {
        let isRollback = false;
        let isM1 = false;
        let isM2 = false;
        let rawKey = fullKey;
        let categoryLabel = 'Main Target';

        if (rawKey.startsWith('CAT_ROLLBACK::')) {
          isRollback = true;
          categoryLabel = 'Rollback';
          rawKey = rawKey.replace('CAT_ROLLBACK::', '');
        } else if (rawKey.startsWith('CAT_MILESTONE1::')) {
          isM1 = true;
          categoryLabel = 'Milestone 1';
          rawKey = rawKey.replace('CAT_MILESTONE1::', '');
        } else if (rawKey.startsWith('CAT_MILESTONE2::')) {
          isM2 = true;
          categoryLabel = 'Milestone 2';
          rawKey = rawKey.replace('CAT_MILESTONE2::', '');
        }

        const parts = rawKey.split('@@');
        const key = parts[0];
        const date = parts.length > 1 ? parts[1] : 'No Date';
        
        let stateLabel = 'All';
        let cityLabel = 'All';
        let bucketLabel = 'All';
        
        let match = records;
        
        if (key === 'GLOBAL') {
          // All defaults
        } else if (key.startsWith('GLOBAL__BKT__')) {
          bucketLabel = key.replace('GLOBAL__BKT__', '');
          match = match.filter(r => String(r.bom_bkt || '').trim().toUpperCase() === bucketLabel);
        } else if (key.startsWith('CITY__')) {
          const p = key.split('__BKT__');
          cityLabel = p[0].replace('CITY__', '');
          if (p.length > 1) {
            bucketLabel = p[1];
            match = match.filter(r => String(r.city || r.City || '').trim().toUpperCase() === cityLabel && String(r.bom_bkt || '').trim().toUpperCase() === bucketLabel);
          } else {
            match = match.filter(r => String(r.city || r.City || '').trim().toUpperCase() === cityLabel);
          }
        } else if (key.startsWith('STATE__')) {
          const p = key.split('__BKT__');
          stateLabel = p[0].replace('STATE__', '');
          if (p.length > 1) {
            bucketLabel = p[1];
            match = match.filter(r => String(r.state || r.State || '').trim().toUpperCase() === stateLabel && String(r.bom_bkt || '').trim().toUpperCase() === bucketLabel);
          } else {
            match = match.filter(r => String(r.state || r.State || '').trim().toUpperCase() === stateLabel);
          }
        }

        let totalPos = 0;
        let paidPos = 0;
        match.forEach(r => {
          const posVal = Number(r.principal_outstanding) || 0;
          totalPos += posVal;
          const c = calculateRow(r);
          
          if (isRollback) {
            paidPos += c.rollbackPOS || 0;
          } else if (isM1) {
            paidPos += (c.total >= c.emi1 ? posVal : 0);
          } else if (isM2) {
            paidPos += (c.total >= c.emi2 ? posVal : 0);
          } else {
            if (c.mainPaid === 1 || c.teamPaid === 1) {
              paidPos += c.mainPaidPOS || c.teamPaidPOS || 0;
            }
          }
        });

        const targetPos = (pct * totalPos) / 100;
        const needed = Math.max(0, targetPos - paidPos);
        const progress = targetPos > 0 ? Math.min(100, (paidPos / targetPos) * 100) : 0;

        let daysLeft = 1;
        if (date !== 'No Date') {
           const diff = new Date(date).getTime() - new Date(today).getTime();
           const d = Math.ceil(diff / (1000 * 60 * 60 * 24));
           daysLeft = d > 0 ? d : 1;
        }
        
        return {
          key: fullKey,
          categoryLabel,
          stateLabel,
          cityLabel,
          bucketLabel,
          pct,
          date,
          totalPos,
          targetPos,
          paidPos,
          needed,
          progress,
          dailyReq: needed > 0 ? needed / daysLeft : 0
        };
      }).sort((a, b) => b.totalPos - a.totalPos);
  }, [targets, records]);

  return (
    <div className="space-y-6">
      
      {/* Create Target Rule Section */}
      <Card className="border border-border/80 shadow-md">
        <CardHeader className="pb-4 border-b bg-muted/20">
          <CardTitle className="text-base flex items-center gap-2">
            <Plus className="w-4 h-4 text-primary" /> Create Target Rule
          </CardTitle>
          <CardDescription className="text-xs">
            Add a new target category for any combination of State, City, and Bucket.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-7 gap-4 items-end">
           <div className="space-y-1.5">
             <label className="text-xs font-semibold uppercase text-muted-foreground">Category</label>
             <Select value={targetCategory} onValueChange={(val: any) => setTargetCategory(val)}>
               <SelectTrigger className="font-semibold text-primary"><SelectValue /></SelectTrigger>
               <SelectContent>
                 <SelectItem value="MAIN">Main Target</SelectItem>
                 <SelectItem value="ROLLBACK">Rollback</SelectItem>
                 <SelectItem value="MILESTONE1">Milestone 1</SelectItem>
                 <SelectItem value="MILESTONE2">Milestone 2</SelectItem>
               </SelectContent>
             </Select>
           </div>
           
           <div className="space-y-1.5">
             <label className="text-xs font-semibold uppercase text-muted-foreground">Level</label>
             <Select value={level} onValueChange={(val: any) => { setLevel(val); setSelectedState('ALL'); setSelectedCity('ALL'); }}>
               <SelectTrigger><SelectValue /></SelectTrigger>
               <SelectContent>
                 <SelectItem value="GLOBAL">Global</SelectItem>
                 <SelectItem value="STATE">State</SelectItem>
                 <SelectItem value="CITY">City</SelectItem>
               </SelectContent>
             </Select>
           </div>
           
           {(level === 'STATE' || level === 'CITY') && (
             <div className="space-y-1.5">
               <label className="text-xs font-semibold uppercase text-muted-foreground">State</label>
               <Select value={selectedState} onValueChange={(val) => { setSelectedState(val); setSelectedCity('ALL'); }}>
                 <SelectTrigger><SelectValue /></SelectTrigger>
                 <SelectContent>
                   {states.map(s => <SelectItem key={s} value={s}>{s === 'ALL' ? 'All States' : s}</SelectItem>)}
                 </SelectContent>
               </Select>
             </div>
           )}

           {level === 'CITY' && (
             <div className="space-y-1.5">
               <label className="text-xs font-semibold uppercase text-muted-foreground">City</label>
               <Select value={selectedCity} onValueChange={setSelectedCity}>
                 <SelectTrigger><SelectValue /></SelectTrigger>
                 <SelectContent>
                   {cities.map(c => <SelectItem key={c} value={c}>{c === 'ALL' ? 'All Cities' : c}</SelectItem>)}
                 </SelectContent>
               </Select>
             </div>
           )}

           <div className="space-y-1.5">
             <label className="text-xs font-semibold uppercase text-muted-foreground">Bucket</label>
             <Select value={selectedBucket} onValueChange={setSelectedBucket}>
               <SelectTrigger><SelectValue /></SelectTrigger>
               <SelectContent>
                 {buckets.map(b => <SelectItem key={b} value={b}>{b === 'ALL' ? 'All Buckets' : `Bucket ${b}`}</SelectItem>)}
               </SelectContent>
             </Select>
           </div>

           <div className="space-y-1.5">
             <label className="text-xs font-semibold uppercase text-muted-foreground">Target %</label>
             <Input 
                type="number" 
                placeholder="e.g. 20" 
                value={targetPct}
                onChange={(e) => setTargetPct(e.target.value)}
             />
           </div>

           <div className="space-y-1.5">
             <label className="text-xs font-semibold uppercase text-muted-foreground">Deadline</label>
             <Input 
                type="date" 
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
             />
           </div>

           <Button onClick={handleAddTarget} className="w-full">
             Add Target
           </Button>
        </CardContent>
      </Card>

      {/* Target Table */}
      <Card className="border border-border/80 shadow-md">
        <CardHeader className="pb-3 border-b bg-card">
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <Layers className="w-4 h-4 text-primary" />
            Active Target Configurations
          </CardTitle>
          <CardDescription className="text-xs">
            Overview of all currently active target rules in the system.
          </CardDescription>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-muted/30 text-muted-foreground text-xs uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3 font-semibold border-b">Category</th>
                <th className="px-4 py-3 font-semibold border-b">State</th>
                <th className="px-4 py-3 font-semibold border-b">City</th>
                <th className="px-4 py-3 font-semibold border-b">Bucket</th>
                <th className="px-4 py-3 font-semibold border-b text-right">Base POS</th>
                <th className="px-4 py-3 font-semibold border-b text-right">Target</th>
                <th className="px-4 py-3 font-semibold border-b text-right">Collected (Cat.)</th>
                <th className="px-4 py-3 font-semibold border-b text-right">Needed</th>
                <th className="px-4 py-3 font-semibold border-b">Deadline</th>
                <th className="px-4 py-3 font-semibold border-b">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {configuredTargets.length === 0 ? (
                <tr>
                  <td colSpan={10} className="text-center py-8 text-muted-foreground">
                    <Target className="w-8 h-8 mx-auto mb-2 opacity-20" />
                    No active targets configured. Add one above.
                  </td>
                </tr>
              ) : (
                configuredTargets.map((t) => (
                  <tr key={t.key} className="hover:bg-muted/10 transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <Badge variant="outline" className={
                        t.categoryLabel === 'Rollback' ? 'border-purple-500 text-purple-600 bg-purple-500/10' :
                        t.categoryLabel === 'Main Target' ? 'border-primary text-primary bg-primary/10' :
                        'border-amber-500 text-amber-600 bg-amber-500/10'
                      }>
                        {t.categoryLabel}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {t.stateLabel === 'All' ? <Badge variant="secondary" className="font-normal text-[10px]">ALL STATES</Badge> : <span className="font-medium">{t.stateLabel}</span>}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {t.cityLabel === 'All' ? <Badge variant="secondary" className="font-normal text-[10px]">ALL CITIES</Badge> : <span className="font-medium">{t.cityLabel}</span>}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {t.bucketLabel === 'All' ? <Badge variant="secondary" className="font-normal text-[10px]">ALL BUCKETS</Badge> : <Badge className="bg-primary/10 text-primary border-primary/20 hover:bg-primary/20">{t.bucketLabel}</Badge>}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      ₹{t.totalPos.toLocaleString('en-IN')}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <div className="font-semibold text-primary">{t.pct.toFixed(2)}%</div>
                      <div className="text-[10px] text-muted-foreground">₹{t.targetPos.toLocaleString('en-IN')}</div>
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap font-medium text-emerald-600 dark:text-emerald-400">
                      ₹{t.paidPos.toLocaleString('en-IN')}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      {t.needed <= 0 ? (
                        <span className="text-emerald-600 text-xs font-bold bg-emerald-500/10 px-2 py-1 rounded-full">Achieved ✓</span>
                      ) : (
                        <div>
                           <div className="font-bold text-red-500">₹{t.needed.toLocaleString('en-IN')}</div>
                           <div className="text-[10px] text-amber-600 dark:text-amber-400">₹{Math.round(t.dailyReq).toLocaleString('en-IN')}/d</div>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-xs">
                      {t.date}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => handleRemoveTarget(t.key)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
