import { ReactNode, useState, useEffect, useRef } from 'react';
import { AppSidebar } from './AppSidebar';
import { MobileHeader } from './MobileHeader';
import { DesktopHeader } from './DesktopHeader';
import { BottomNav } from './BottomNav';
import { GlobalCommandBar } from './GlobalCommandBar';
import { useMediaQuery } from '../../hooks/use-media-query';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from 'sonner';

export function AppLayout({ children }: { children: ReactNode }) {
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const [collapsed, setCollapsed] = useState(!isDesktop);
  const { logout, user } = useAuth();
  const inactivityTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  useEffect(() => {
    setCollapsed(!isDesktop);
  }, [isDesktop]);

  // Session Inactivity Lock (15 Minutes)
  useEffect(() => {
    if (!user) return;

    const INACTIVITY_LIMIT_MS = 15 * 60 * 1000;

    const resetTimer = () => {
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
      inactivityTimerRef.current = setTimeout(() => {
        toast.error('Session expired due to inactivity.', { duration: 5000 });
        logout();
      }, INACTIVITY_LIMIT_MS);
    };

    const handleUserActivity = () => {
      resetTimer();
    };

    // Attach activity listeners
    window.addEventListener('mousemove', handleUserActivity);
    window.addEventListener('keydown', handleUserActivity);
    window.addEventListener('click', handleUserActivity);
    window.addEventListener('scroll', handleUserActivity);
    window.addEventListener('touchstart', handleUserActivity);

    resetTimer(); // Start the timer initially

    return () => {
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
      window.removeEventListener('mousemove', handleUserActivity);
      window.removeEventListener('keydown', handleUserActivity);
      window.removeEventListener('click', handleUserActivity);
      window.removeEventListener('scroll', handleUserActivity);
      window.removeEventListener('touchstart', handleUserActivity);
    };
  }, [user, logout]);

  const [mobileOpen, setMobileOpen] = useState(false);
  
  return (
    <div className="min-h-screen bg-background w-full overflow-clip">
      <GlobalCommandBar />
      <div className="hidden md:block">
        <AppSidebar 
          collapsed={collapsed} 
          setCollapsed={setCollapsed} 
          mobileOpen={mobileOpen} 
          setMobileOpen={setMobileOpen} 
        />
      </div>
      <div className={`flex flex-col min-w-0 min-h-screen transition-all duration-300 ease-out md:pl-[72px] ${collapsed ? 'lg:pl-[72px]' : 'lg:pl-[260px]'}`}>
        <MobileHeader />
        <DesktopHeader collapsed={collapsed} setCollapsed={setCollapsed} />
        <main className="mobile-main-content flex-1 pb-16 md:pb-0 animate-in fade-in slide-in-from-bottom-2 duration-700 ease-out fill-mode-both">
          <div className="mx-auto max-w-[1600px] p-4 sm:p-5 lg:p-8">
            {children}
          </div>
        </main>
      </div>
      <BottomNav />
    </div>
  );
}
