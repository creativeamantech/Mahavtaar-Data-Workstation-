
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, FileText, Building2, Users, MoreHorizontal, Database, Activity, Settings, ClipboardList, Wifi } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { VIEWS } from '../../constants/permissions';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '../ui/sheet';


const BOTTOM_TABS = [
  { label: 'Home', icon: LayoutDashboard, path: '/dashboard', view: VIEWS.DASHBOARD },
  { label: 'Exec Home', icon: LayoutDashboard, path: '/exec-dashboard', view: VIEWS.EXEC_DASHBOARD },
  { label: 'Data', icon: FileText, path: '/data-entry', view: VIEWS.DATA_ENTRY },
  { label: 'City', icon: Building2, path: '/city-pivot', view: VIEWS.CITY_PIVOT },
  { label: 'Team', icon: Users, path: '/team-pivot', view: VIEWS.TEAM_PIVOT },
];

const MORE_TABS = [
  { label: 'Connectivity Hub', icon: Wifi, path: '/connectivity', view: VIEWS.CONNECTIVITY_HUB },
  { label: 'Assignment', icon: Users, path: '/assignment', view: VIEWS.ASSIGNMENT },
  { label: 'Team Perf', icon: Activity, path: '/exec-team-perf', view: VIEWS.EXEC_TEAM_PERF },
  { label: 'Data Explorer', icon: Database, path: '/explorer', view: VIEWS.DATA_EXPLORER },
  { label: 'Band Analysis', icon: Activity, path: '/band-explorer', view: VIEWS.CITY_TEAM_MATRIX },
  { label: 'Live Monitoring', icon: Activity, path: '/live-monitoring', view: VIEWS.LIVE_MONITORING },
  { label: 'All Feedback', icon: ClipboardList, path: '/feedbacks', view: VIEWS.FEEDBACKS },
  { label: 'Attendance', icon: Activity, path: '/attendance', view: VIEWS.ATTENDANCE },
  { label: 'Settings', icon: Settings, path: '/settings', view: VIEWS.SETTINGS },
  { label: 'Audit Log', icon: ClipboardList, path: '/audit', view: VIEWS.AUDIT_LOG },
];

export function BottomNav() {
  const location = useLocation();
  const { hasPermission, logout, user } = useAuth();

  const isExecView = (view: string) => view === VIEWS.EXEC_DASHBOARD || view === VIEWS.EXEC_TEAM_PERF;
  const isExec = user?.role === 'EXECUTIVE';

  const visibleTabs = BOTTOM_TABS.filter(t => hasPermission(t.view) && (!isExecView(t.view) || isExec));
  const visibleMore = MORE_TABS.filter(t => hasPermission(t.view) && (!isExecView(t.view) || isExec));

  return (
    <div className="bottom-nav fixed bottom-0 left-0 right-0 z-50 flex border-t border-[rgba(255,255,255,0.08)] bg-sidebar md:hidden">
      {visibleTabs.map(tab => {
        const active = location.pathname === tab.path;
        return (
          <Link key={tab.path} to={tab.path} className="flex flex-1 flex-col items-center justify-center gap-1 py-2">
            <tab.icon className={`h-5 w-5 ${active ? 'text-accent' : 'text-sidebar-foreground/50'}`} />
            <span className={`font-sans text-[10px] font-medium ${active ? 'text-accent' : 'text-sidebar-foreground/50'}`}>{tab.label}</span>
          </Link>
        );
      })}
      
      {visibleMore.length > 0 && (
        <Sheet>
          <SheetTrigger asChild>
            <button className="flex flex-1 flex-col items-center justify-center gap-1 py-2">
              <MoreHorizontal className="h-5 w-5 text-sidebar-foreground/50" />
              <span className="font-sans text-[10px] font-medium text-sidebar-foreground/50">More</span>
            </button>
          </SheetTrigger>
          <SheetContent side="bottom" className="bg-sidebar border-t border-[rgba(255,255,255,0.08)] text-sidebar-foreground">
            <SheetHeader>
              <SheetTitle className="text-left text-sidebar-foreground">More Options</SheetTitle>
            </SheetHeader>
            <div className="mt-4 flex flex-col gap-2 pb-8 max-h-[70vh] overflow-y-auto scrollbar-thin">
              {visibleMore.map(tab => {
                const active = location.pathname === tab.path;
                return (
                  <Link key={tab.path} to={tab.path} className={`flex items-center gap-3 rounded-md px-4 py-3 text-sm font-medium ${active ? 'bg-accent/10 text-accent' : 'text-sidebar-foreground hover:bg-sidebar-accent'}`}>
                    <tab.icon className="h-5 w-5" />
                    {tab.label}
                  </Link>
                );
              })}
              <button onClick={logout} className="flex items-center gap-3 rounded-md px-4 py-3 text-sm font-medium text-destructive hover:bg-destructive/10">
                Logout
              </button>
            </div>
          </SheetContent>
        </Sheet>
      )}
    </div>
  );
}
