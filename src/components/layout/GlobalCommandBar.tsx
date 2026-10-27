import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandShortcut,
} from '@/components/ui/command';
import { useData } from '../../contexts/DataContext';
import { useAuth } from '../../contexts/AuthContext';
import {
  LayoutDashboard,
  Building2,
  Users,
  Search,
  FileSpreadsheet,
  Settings,
  Layers,
  Activity,
  CalendarCheck,
  CreditCard,
  Target,
  FileText,
} from 'lucide-react';
import { fmtCur } from '../../lib/formatters';

export function GlobalCommandBar() {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const navigate = useNavigate();
  const { records } = useData();
  const { isExecutive } = useAuth();

  // Keyboard shortcut listener: Cmd+K or Ctrl+K
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || (e.key === '/' && (e.target as HTMLElement).tagName !== 'INPUT' && (e.target as HTMLElement).tagName !== 'TEXTAREA')) {
        e.preventDefault();
        setOpen(openState => !openState);
      }
    };

    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  const handleSelect = (callback: () => void) => {
    setOpen(false);
    callback();
  };

  // Matched records based on search input (Agreement No or Customer Name)
  const matchedRecords = useMemo(() => {
    if (!search || search.trim().length < 2) return [];
    const query = search.toLowerCase().trim();

    const results = [];
    for (const r of records || []) {
      const name = String(r.customer_name || r.CUSTOMERNAME || r['Customer Name'] || r.CUSTOMER_NAME || '').toLowerCase();
      const id = String(r.agreementid || r.agreement_no || r.AGREEMENTNO || r.AGREEMENTID || '').toLowerCase();
      const city = String(r.city || r.City || '').toLowerCase();
      const exec = String(r.executive_name || '').toLowerCase();

      if (id.includes(query) || name.includes(query) || city.includes(query) || exec.includes(query)) {
        results.push(r);
        if (results.length >= 10) break;
      }
    }
    return results;
  }, [search, records]);

  // Unique cities
  const cities = useMemo(() => {
    const s = new Set<string>();
    (records || []).forEach(r => {
      const c = r.city || r.City;
      if (c) s.add(String(c).trim().toUpperCase());
    });
    return Array.from(s).sort();
  }, [records]);

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput
        placeholder="Search agreements, customers, pages, cities... (Esc to close)"
        value={search}
        onValueChange={setSearch}
      />
      <CommandList className="max-h-[420px]">
        <CommandEmpty>No matching results found.</CommandEmpty>

        {/* Quick Agreement Search Matches */}
        {matchedRecords.length > 0 && (
          <CommandGroup heading="Agreements & Customers">
            {matchedRecords.map((r, i) => {
              const id = String(r.agreementid || r.agreement_no || r.AGREEMENTNO || r.AGREEMENTID || '-');
              const name = String(r.customer_name || r.CUSTOMERNAME || r['Customer Name'] || r.CUSTOMER_NAME || '-');
              const city = String(r.city || r.City || '-');
              const pos = Number(r.principal_outstanding || 0);
              const bkt = r.bom_bkt;

              return (
                <CommandItem
                  key={id + '-' + i}
                  value={`agreement ${id} ${name} ${city}`}
                  onSelect={() => handleSelect(() => navigate(`/customer/${encodeURIComponent(id)}`))}
                  className="flex items-center justify-between py-2 cursor-pointer"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="p-1 rounded bg-primary/10 text-primary">
                      <CreditCard className="h-4 w-4" />
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="font-bold text-foreground text-xs truncate">{name}</span>
                      <span className="text-[11px] text-muted-foreground truncate font-mono">
                        {id} · {city} {bkt ? `· Bkt ${bkt}` : ''}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    <span className="text-xs font-semibold tabular-nums text-foreground">{fmtCur(pos)}</span>
                    <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-muted text-muted-foreground">View 360°</span>
                  </div>
                </CommandItem>
              );
            })}
          </CommandGroup>
        )}

        {/* Navigation Pages */}
        <CommandGroup heading="Navigation">
          <CommandItem
            value="dashboard global analytics overview"
            onSelect={() => handleSelect(() => navigate(isExecutive() ? '/exec-dashboard' : '/dashboard'))}
          >
            <LayoutDashboard className="mr-2 h-4 w-4 text-primary" />
            <span>Dashboard</span>
            <CommandShortcut>G D</CommandShortcut>
          </CommandItem>

          <CommandItem
            value="city pivot matrix geographical reports"
            onSelect={() => handleSelect(() => navigate('/city-pivot'))}
          >
            <Building2 className="mr-2 h-4 w-4 text-emerald-500" />
            <span>City Pivot Performance</span>
            <CommandShortcut>G C</CommandShortcut>
          </CommandItem>

          <CommandItem
            value="team pivot executive performance rankings"
            onSelect={() => handleSelect(() => navigate('/team-pivot'))}
          >
            <Users className="mr-2 h-4 w-4 text-indigo-500" />
            <span>Team Pivot Performance</span>
            <CommandShortcut>G T</CommandShortcut>
          </CommandItem>

          <CommandItem
            value="data explorer records search filter grid"
            onSelect={() => handleSelect(() => navigate('/explorer'))}
          >
            <Search className="mr-2 h-4 w-4 text-blue-500" />
            <span>Data Explorer</span>
            <CommandShortcut>G E</CommandShortcut>
          </CommandItem>

          <CommandItem
            value="data entry feedback update payment"
            onSelect={() => handleSelect(() => navigate('/data-entry'))}
          >
            <FileSpreadsheet className="mr-2 h-4 w-4 text-amber-500" />
            <span>Data Entry & Update</span>
          </CommandItem>

          <CommandItem
            value="pos band explorer slabs"
            onSelect={() => handleSelect(() => navigate('/band-explorer'))}
          >
            <Layers className="mr-2 h-4 w-4 text-purple-500" />
            <span>POS Band Explorer</span>
          </CommandItem>

          <CommandItem
            value="live monitoring real time field updates"
            onSelect={() => handleSelect(() => navigate('/live-monitoring'))}
          >
            <Activity className="mr-2 h-4 w-4 text-rose-500" />
            <span>Live Field Monitoring</span>
          </CommandItem>

          <CommandItem
            value="attendance punch daily tracking"
            onSelect={() => handleSelect(() => navigate('/attendance'))}
          >
            <CalendarCheck className="mr-2 h-4 w-4 text-teal-500" />
            <span>Attendance & Punch Log</span>
          </CommandItem>

          <CommandItem
            value="settings users targets configuration"
            onSelect={() => handleSelect(() => navigate('/settings'))}
          >
            <Settings className="mr-2 h-4 w-4 text-slate-500" />
            <span>System Settings</span>
          </CommandItem>
        </CommandGroup>

        {/* Filter Quick Links */}
        {cities.length > 0 && (
          <CommandGroup heading="Filter By City">
            {cities.slice(0, 8).map(city => (
              <CommandItem
                key={city}
                value={`city filter ${city}`}
                onSelect={() => handleSelect(() => navigate(`/explorer?city=${encodeURIComponent(city)}`))}
              >
                <Building2 className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
                <span>Explore City: {city}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}
