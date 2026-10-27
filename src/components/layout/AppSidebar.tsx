import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { VIEWS } from '../../constants/permissions';
import { 
  Home, Edit3, UserPlus, TrendingUp, Target, 
  Search, Building2, GitFork, Waves, 
  MonitorPlay, MessageSquare, CalendarClock, 
  Sliders, History, LogOut, Hexagon, PanelLeftClose, PanelLeftOpen,
  ChevronDown, ChevronRight, Network, Wifi
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';

const NAV_GROUPS = [
  {
    title: 'Strategy & Monitoring',
    items: [
      { label: 'Admin Strategy', icon: Home, path: '/dashboard', view: VIEWS.DASHBOARD },
      { label: 'Executive Strategy', icon: TrendingUp, path: '/exec-dashboard', view: VIEWS.EXEC_DASHBOARD },
      { label: 'Live Tracking', icon: MonitorPlay, path: '/live-monitoring', view: VIEWS.LIVE_MONITORING },
    ]
  },
  {
    title: 'Execution Tracking',
    items: [
      { label: 'Team Performance', icon: Target, path: '/exec-team-perf', view: VIEWS.EXEC_TEAM_PERF },
      { label: 'Data Explorer', icon: Search, path: '/explorer', view: VIEWS.DATA_EXPLORER },
      { label: 'Band Analysis', icon: Waves, path: '/band-explorer', view: VIEWS.CITY_TEAM_MATRIX },
    ]
  },
  {
    title: 'Reconciliation',
    items: [
      { label: 'City Ledger', icon: Building2, path: '/city-pivot', view: VIEWS.CITY_PIVOT },
      { label: 'Team Ledger', icon: GitFork, path: '/team-pivot', view: VIEWS.TEAM_PIVOT },
      { label: 'Quality & Feedback', icon: MessageSquare, path: '/feedbacks', view: VIEWS.FEEDBACKS },
    ]
  },
  {
    title: 'System & Data',
    items: [
      { label: 'Data Ingestion', icon: Edit3, path: '/data-entry', view: VIEWS.DATA_ENTRY },
      { label: 'Case Assignment', icon: UserPlus, path: '/assignment', view: VIEWS.ASSIGNMENT },
      { label: 'Attendance Logs', icon: CalendarClock, path: '/attendance', view: VIEWS.ATTENDANCE },
      { label: 'Connectivity Hub', icon: Wifi, path: '/connectivity', view: VIEWS.CONNECTIVITY_HUB },
      { label: 'Settings', icon: Sliders, path: '/settings', view: VIEWS.SETTINGS },
      { label: 'Audit Logs', icon: History, path: '/audit', view: VIEWS.AUDIT_LOG },
    ]
  }
];

export function AppSidebar({ collapsed, setCollapsed, mobileOpen, setMobileOpen }: { collapsed: boolean, setCollapsed: (c: boolean | ((prev: boolean) => boolean)) => void, mobileOpen: boolean, setMobileOpen: (v: boolean) => void }) {
  const { user, logout, hasPermission } = useAuth();
  const location = useLocation();
  
  // Track expanded state for groups
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  // Auto-expand group containing active route on mount
  useEffect(() => {
    const currentGroup = NAV_GROUPS.find(g => g.items.some(i => i.path === location.pathname));
    if (currentGroup) {
      setExpandedGroups(prev => ({ ...prev, [currentGroup.title]: true }));
    }
  }, [location.pathname]);

  const toggleGroup = (title: string) => {
    if (collapsed) {
      // If clicking a group icon while collapsed, auto-expand the sidebar and open the group
      setCollapsed(false);
      setExpandedGroups(prev => ({ ...prev, [title]: true }));
    } else {
      setExpandedGroups(prev => ({ ...prev, [title]: !prev[title] }));
    }
  };

  return (
    <aside className={`fixed left-0 top-0 z-40 flex h-screen flex-col bg-card/95 backdrop-blur-md text-foreground transition-all duration-300 ease-in-out ${collapsed ? 'w-[72px]' : 'w-[260px]'}`}>
      {/* Header / Logo */}
      <div className="flex h-[72px] shrink-0 items-center justify-center bg-muted/30 transition-all duration-300 border-b border-border">
        <div className={`flex items-center gap-3 transition-all duration-300 ${collapsed ? 'px-0 justify-center' : 'px-6 w-full'}`}>
          <div className="relative flex h-8 w-8 shrink-0 items-center justify-center text-primary transition-transform hover:scale-110">
            <Hexagon className="absolute inset-0 h-full w-full fill-primary/20 stroke-primary stroke-[2]" />
            <span className="z-10 font-sans text-sm font-bold text-primary">M</span>
          </div>
          {!collapsed && (
            <div className="flex flex-col animate-in fade-in zoom-in duration-300">
              <h1 className="font-heading text-lg font-black tracking-tight text-foreground leading-tight">Mahavtaar</h1>
              <p className="font-sans text-[10px] font-bold uppercase tracking-widest text-primary/80">Enterprise</p>
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden py-4 scrollbar-thin scrollbar-thumb-white/10 flex flex-col gap-2">
        {NAV_GROUPS.map((group, idx) => {
          
          const visibleItems = group.items.filter(item => hasPermission(item.view));
          if (visibleItems.length === 0) return null;
          
          const isExpanded = expandedGroups[group.title];
          const hasActiveChild = visibleItems.some(i => i.path === location.pathname);

          return (
            <div key={group.title} className="px-3 flex flex-col gap-0.5">
              {!collapsed ? (
                <button 
                  onClick={() => toggleGroup(group.title)}
                  className={`w-full flex items-center justify-between px-3 py-2 mt-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-colors ${hasActiveChild ? 'text-primary' : 'text-muted-foreground/70 hover:text-foreground hover:bg-muted'}`}
                >
                  {group.title}
                  {isExpanded ? <ChevronDown className="w-3.5 h-3.5 opacity-70" /> : <ChevronRight className="w-3.5 h-3.5 opacity-70" />}
                </button>
              ) : (
                <div className="mx-auto mt-4 mb-2 h-px w-6 bg-white/10" />
              )}
              
              {/* Items */}
              <div className={`flex flex-col gap-0.5 overflow-hidden transition-all duration-200 ${!collapsed && !isExpanded ? 'max-h-0 opacity-0' : 'max-h-[500px] opacity-100'}`}>
                {visibleItems.map(item => {
                  const active = location.pathname === item.path;
                  return (
                    <Tooltip key={item.path} delayDuration={0}>
                      <TooltipTrigger asChild>
                        <Link
                          to={item.path}
                          onClick={() => setMobileOpen(false)}
                          className={`group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200 overflow-hidden ${
                            active 
                              ? 'bg-primary/15 text-primary' 
                              : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                          }`}
                        >
                          {active && (
                            <div className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-primary" />
                          )}
                          <item.icon className={`h-[18px] w-[18px] shrink-0 transition-transform duration-200 ${active ? 'text-primary' : 'group-hover:scale-110'}`} />
                          <span className={`truncate transition-all duration-300 ${collapsed ? 'w-0 opacity-0' : 'w-auto opacity-100'}`}>
                            {item.label}
                          </span>
                        </Link>
                      </TooltipTrigger>
                      {collapsed && (
                        <TooltipContent side="right" sideOffset={10} className="font-semibold text-xs bg-popover text-foreground border-border">
                          {item.label}
                        </TooltipContent>
                      )}
                    </Tooltip>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="mt-auto shrink-0 bg-muted/30 p-3 transition-all duration-300 border-t border-border">
        {/* Toggle Button */}
        <button
          onClick={() => setCollapsed(c => !c)}
          className={`flex w-full items-center gap-2 rounded-lg py-2 text-xs font-bold uppercase tracking-wider text-muted-foreground/70 transition-all duration-200 hover:bg-muted hover:text-foreground ${collapsed ? 'justify-center' : 'justify-start px-3'}`}
        >
          {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <><PanelLeftClose className="h-4 w-4" /> <span>Collapse</span></>}
        </button>
      </div>
    </aside>
  );
}
