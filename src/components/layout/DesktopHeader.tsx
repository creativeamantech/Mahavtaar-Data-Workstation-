import { ChevronLeft, ChevronRight, Search, Bell, UserCircle, Menu, LogOut } from "lucide-react";
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { useData } from '../../contexts/DataContext';
import { useAuth } from '../../contexts/AuthContext';
import { useMemo, useState, useRef, useEffect } from 'react';
import { ThemeToggle } from '../ThemeToggle';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AgentNotifications } from '../agent/AgentNotifications';
import { SyncStatusIndicator } from '../sync/SyncStatusIndicator';

export function DesktopHeader({ collapsed, setCollapsed }: { collapsed?: boolean; setCollapsed?: (val: boolean | ((prev: boolean) => boolean)) => void }) {
  const { records,  } = useData();
  const { user, logout } = useAuth();
  const location = useLocation();
  const isExplorer = location.pathname === '/explorer';

  

  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setIsSearchFocused(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const searchResults = useMemo(() => {
    if (!searchQuery || searchQuery.length < 2) return [];
    const q = searchQuery.toLowerCase();
    
    const matches = [];
    for (const r of records || []) {
      const name = String(r.customer_name || r.CUSTOMERNAME || r['Customer Name'] || r.CUSTOMER_NAME || '').toLowerCase();
      const id = String(r.agreementid || r.agreement_no || r.AGREEMENTNO || r.AGREEMENTID || '').toLowerCase();
      
      if (name.includes(q) || id.includes(q)) {
        matches.push(r);
        if (matches.length >= 8) break;
      }
    }
    return matches;
  }, [searchQuery, records]);

  const handleSearchSubmit = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && searchQuery.trim()) {
      setIsSearchFocused(false);
      navigate('/explorer?q=' + encodeURIComponent(searchQuery.trim()));
      setSearchQuery('');
    }
  };

  return (
    <header className="hidden md:flex sticky top-0 z-30 justify-between items-center px-4 h-14 bg-card/95 backdrop-blur border-b border-border shadow-sm">
      <div className="flex items-center gap-3 w-1/4">
        {setCollapsed && (
          <button 
            type="button"
            onClick={() => setCollapsed(prev => !prev)}
            className="p-1.5 hover:bg-muted rounded-md transition-colors text-muted-foreground hover:text-foreground shrink-0"
            title="Toggle Sidebar"
          >
            <Menu className="h-5 w-5" />
          </button>
        )}
        
        {/* Navigation */}
        <div className="flex items-center gap-1 bg-muted/30 p-1 rounded-lg border border-border/50">
          <button 
            type="button"
            onClick={() => {
              if (window.history.state && window.history.state.idx > 0) {
                navigate(-1);
              } else {
                navigate('/dashboard', { replace: true });
              }
            }} 
            className="p-1.5 hover:bg-muted rounded-md transition-colors text-muted-foreground hover:text-foreground" 
            title="Go Back"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button type="button" onClick={() => navigate(1)} className="p-1.5 hover:bg-muted rounded-md transition-colors text-muted-foreground hover:text-foreground" title="Go Forward">
            <ChevronRight className="h-4 w-4" />
          </button>          
        </div>
      </div>

      <div className="flex-1 flex justify-center px-4">
        <div className="relative" ref={searchContainerRef}>
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input 
            type="text" 
            placeholder="Quick Search or Agreements..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setIsSearchFocused(true)}
            onKeyDown={handleSearchSubmit}
            className="pl-9 pr-14 h-9 bg-muted/50 border border-border rounded-full text-xs font-medium focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/50 transition-all w-[300px] lg:w-[400px]"
          />
          <kbd 
            onClick={() => {
              const event = new KeyboardEvent('keydown', { key: 'k', metaKey: true });
              document.dispatchEvent(event);
            }}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 cursor-pointer pointer-events-auto inline-flex items-center gap-0.5 rounded border border-border bg-card px-1.5 py-0.5 text-[10px] font-mono font-bold text-muted-foreground shadow-xs hover:bg-muted"
            title="Press Cmd+K or Ctrl+K"
          >
            ⌘K
          </kbd>
          
          {isSearchFocused && searchQuery.length >= 2 && (
            <div className="absolute top-full mt-2 w-full lg:w-[500px] bg-card border border-border rounded-xl shadow-xl z-50 overflow-hidden left-1/2 -translate-x-1/2">
              <div className="p-2 border-b border-border bg-muted/30">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Search Results</span>
              </div>
              <div className="max-h-[300px] overflow-y-auto">
                {searchResults.length === 0 ? (
                  <div className="p-4 text-center text-sm text-muted-foreground">No matches found for "{searchQuery}"</div>
                ) : (
                  searchResults.map((r, i) => {
                    const id = r.agreementid || r.agreement_no || r.AGREEMENTNO || r.AGREEMENTID || '-';
                    const name = r.customer_name || r.CUSTOMERNAME || r['Customer Name'] || r.CUSTOMER_NAME || '-';
                    const city = r.city || r.City || '-';
                    return (
                      <div 
                        key={i}
                        onClick={() => {
                          setIsSearchFocused(false);
                          navigate('/explorer?q=' + encodeURIComponent(id));
                          setSearchQuery('');
                        }}
                        className="p-3 border-b border-border hover:bg-muted/50 cursor-pointer transition-colors flex items-center justify-between"
                      >
                        <div className="flex flex-col min-w-0 flex-1">
                          <span className="text-sm font-bold text-primary truncate">{name}</span>
                          <span className="text-xs text-muted-foreground truncate">{id} &bull; {city}</span>
                        </div>
                        <div className="shrink-0 ml-3">
                          <span className="px-2 py-0.5 rounded-full bg-muted text-[10px] font-bold uppercase text-muted-foreground">Bkt {r.bom_bkt}</span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
              {searchResults.length > 0 && (
                <div 
                  className="p-2 text-center text-xs font-semibold text-primary hover:bg-primary/10 cursor-pointer transition-colors border-t border-border"
                  onClick={() => {
                    setIsSearchFocused(false);
                    navigate('/explorer?q=' + encodeURIComponent(searchQuery.trim()));
                    setSearchQuery('');
                  }}
                >
                  View all results in Explorer
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3 text-muted-foreground w-1/4 justify-end">
        
        
        <div className="flex items-center gap-1.5 border-l border-border pl-3">
          <SyncStatusIndicator />
          <ThemeToggle />
          {user?.role === 'EXECUTIVE' ? (
            <AgentNotifications />
          ) : (
            <button className="p-2 hover:bg-muted rounded-full transition-colors relative" title="Notifications">
              <Bell className="h-4 w-4" />
              <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-primary ring-2 ring-card"></span>
            </button>
          )}
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 hover:bg-muted p-1 pr-2 rounded-full transition-colors ml-1 border border-border/50">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/20 text-primary text-xs font-bold shadow-sm">
                  {user?.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                </div>
                <div className="flex flex-col items-start min-w-0 max-w-[120px]">
                  <span className="text-xs font-bold text-foreground truncate w-full text-left">{user?.name}</span>
                  <span className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider truncate w-full text-left">{user?.role}</span>
                </div>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>My Account</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate('/profile')} className="cursor-pointer">
                <UserCircle className="mr-2 h-4 w-4" />
                <span>Profile</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={logout} className="cursor-pointer text-orange-500 focus:text-orange-500">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2 h-4 w-4"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                <span>Lock Session</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={logout} className="cursor-pointer text-destructive focus:text-destructive">
                <LogOut className="mr-2 h-4 w-4" />
                <span>Log out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
