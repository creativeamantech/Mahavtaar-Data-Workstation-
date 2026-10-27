import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { Compass } from 'lucide-react';

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background relative overflow-hidden">
      {/* Ambient glows */}
      <div className="pointer-events-none absolute left-[-10%] top-[-10%] h-[500px] w-[500px] rounded-full bg-primary/5 blur-[120px]" />
      <div className="pointer-events-none absolute bottom-[-10%] right-[-10%] h-[400px] w-[400px] rounded-full bg-info/5 blur-[100px]" />
      
      <div className="z-10 text-center glass-panel p-12 rounded-2xl max-w-lg w-[90%] flex flex-col items-center">
        <div className="relative mb-6">
          <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full" />
          <div className="relative h-20 w-20 bg-surface-1 border border-[rgba(255,255,255,0.1)] rounded-full flex items-center justify-center">
            <Compass className="h-10 w-10 text-primary animate-pulse" />
          </div>
        </div>
        
        <h1 className="mb-2 font-heading text-[120px] font-black leading-none text-transparent bg-clip-text bg-gradient-to-b from-white to-white/20">
          404
        </h1>
        <p className="mb-8 font-heading text-lg font-bold uppercase tracking-widest text-muted-foreground">
          Sector Not Found
        </p>
        <p className="mb-10 font-data text-sm text-muted-foreground/70 leading-relaxed max-w-sm">
          The trajectory "{location.pathname}" does not exist in the current allocation matrix. Please return to a valid sector.
        </p>
        
        <Link 
          to="/" 
          className="rounded-md bg-primary px-8 py-3 font-heading text-sm font-bold text-primary-foreground shadow-[0_4px_14px_rgba(245,158,11,0.2)] transition-all hover:scale-105 hover:shadow-[0_8px_32px_rgba(245,158,11,0.3)]"
        >
          Return to Dashboard
        </Link>
      </div>
    </div>
  );
};

export default NotFound;
