import React from 'react';
import { useSync } from '../../contexts/SyncContext';
import { RefreshCw, Wifi, WifiOff, Users, AlertCircle, ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router-dom';

export function SyncStatusIndicator() {
  const { stats, isSyncing, triggerManualSync, conflicts } = useSync();

  const isOnline = stats.onlinePeers > 0;
  const hasPending = stats.pendingApproval > 0;
  const hasConflicts = conflicts.length > 0;

  return (
    <div className="flex items-center gap-2">
      {/* Pending approval badge if any */}
      {hasPending && (
        <Link
          to="/connectivity"
          className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30 text-xs font-bold hover:bg-amber-500/20 transition-colors animate-pulse"
          title="New device waiting for pairing authorization"
        >
          <AlertCircle className="w-3.5 h-3.5" />
          <span>{stats.pendingApproval} New Peer</span>
        </Link>
      )}

      {/* Conflict badge if any */}
      {hasConflicts && (
        <Link
          to="/connectivity?tab=conflicts"
          className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-destructive/10 text-destructive border border-destructive/30 text-xs font-bold hover:bg-destructive/20 transition-colors"
          title="Data conflicts need resolution"
        >
          <AlertCircle className="w-3.5 h-3.5" />
          <span>{conflicts.length} Conflict{conflicts.length > 1 ? 's' : ''}</span>
        </Link>
      )}

      {/* Connectivity Hub Pill */}
      <Link
        to="/connectivity"
        className="flex items-center gap-2 px-2.5 py-1 rounded-xl bg-card border border-border/80 hover:border-primary/50 text-xs text-foreground font-semibold shadow-2xs transition-all hover:bg-muted/40"
        title="Open P2P Connectivity Hub"
      >
        <span className="flex h-2 w-2 relative">
          {isOnline ? (
            <>
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </>
          ) : (
            <span className="relative inline-flex rounded-full h-2 w-2 bg-muted-foreground"></span>
          )}
        </span>

        <span className="hidden sm:inline">
          {stats.onlinePeers > 1 ? `${stats.onlinePeers} Mesh Nodes` : 'Mesh Host'}
        </span>

        <Wifi className={`w-3.5 h-3.5 ${isOnline ? 'text-primary' : 'text-muted-foreground'}`} />
      </Link>

      {/* Quick Sync Button */}
      <button
        onClick={() => triggerManualSync()}
        disabled={isSyncing}
        className="p-1.5 rounded-lg border border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
        title="Trigger Immediate Mesh Sync"
      >
        <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-primary' : ''}`} />
      </button>
    </div>
  );
}
