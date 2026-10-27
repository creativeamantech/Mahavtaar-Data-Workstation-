import React from 'react';
import { DeviceSession } from '../../lib/sync/types';
import { Users, Monitor, Smartphone, Laptop, Clock, ShieldCheck, Activity } from 'lucide-react';
import { StatusBadge } from '../ui/StatusBadge';

interface WhoIsLoggedInTableProps {
  sessions: DeviceSession[];
}

export function WhoIsLoggedInTable({ sessions }: WhoIsLoggedInTableProps) {
  const getDeviceIcon = (os?: string) => {
    if (!os) return <Monitor className="w-4 h-4" />;
    if (os.toLowerCase().includes('android') || os.toLowerCase().includes('ios')) {
      return <Smartphone className="w-4 h-4" />;
    }
    if (os.toLowerCase().includes('mac') || os.toLowerCase().includes('laptop')) {
      return <Laptop className="w-4 h-4" />;
    }
    return <Monitor className="w-4 h-4" />;
  };

  return (
    <div className="bg-card rounded-2xl border border-border overflow-hidden shadow-sm">
      <div className="p-4 border-b border-border flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-primary/10 text-primary border border-primary/20">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-foreground">Who Is Logged In Where</h3>
            <p className="text-xs text-muted-foreground">Admin-only live session visibility across all active CRM terminals</p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs font-semibold px-3 py-1 rounded-full bg-muted border border-border">
          <Activity className="w-3.5 h-3.5 text-primary animate-pulse" />
          <span>{sessions.length} Active System Sessions</span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-muted/40 text-muted-foreground uppercase font-bold tracking-wider text-[10px] border-b border-border">
            <tr>
              <th className="py-3 px-4">Terminal / Device</th>
              <th className="py-3 px-4">Logged-In User</th>
              <th className="py-3 px-4">Role</th>
              <th className="py-3 px-4">Operating System</th>
              <th className="py-3 px-4">Connection</th>
              <th className="py-3 px-4">Last Active</th>
              <th className="py-3 px-4 text-right">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {sessions.map((s, idx) => (
              <tr key={s.peerId || idx} className="hover:bg-muted/30 transition-colors">
                <td className="py-3.5 px-4">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-lg bg-muted text-foreground">
                      {getDeviceIcon(s.os)}
                    </div>
                    <div>
                      <div className="font-bold text-foreground text-sm flex items-center gap-1.5">
                        {s.deviceName}
                      </div>
                      <div className="text-[10px] text-muted-foreground font-mono">
                        {s.deviceId}
                      </div>
                    </div>
                  </div>
                </td>

                <td className="py-3.5 px-4">
                  <div className="flex items-center gap-2">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/20 text-primary text-xs font-bold shadow-xs">
                      {s.userName ? s.userName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() : 'U'}
                    </div>
                    <div>
                      <div className="font-bold text-foreground">{s.userName || 'Local Administrator'}</div>
                      <div className="text-[10px] text-muted-foreground">{s.userEmail || 'admin@mahavtaar.crm'}</div>
                    </div>
                  </div>
                </td>

                <td className="py-3.5 px-4">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                    s.userRole === 'ADMIN' ? 'bg-purple-500/10 text-purple-600 border border-purple-500/20' :
                    s.userRole === 'MANAGER' ? 'bg-blue-500/10 text-blue-600 border border-blue-500/20' :
                    'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                  }`}>
                    {s.userRole || 'ADMIN'}
                  </span>
                </td>

                <td className="py-3.5 px-4 text-foreground font-medium">
                  {s.os || 'Windows 11'}
                </td>

                <td className="py-3.5 px-4 text-muted-foreground font-semibold text-xs">
                  {s.connectionType === 'LOCAL_LAN' ? 'Local Wi-Fi' : s.connectionType === 'INTERNET_P2P' ? 'Internet P2P' : 'Relay'}
                </td>

                <td className="py-3.5 px-4 text-muted-foreground">
                  <div className="flex items-center gap-1.5 font-medium">
                    <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                    <span>{new Date(s.lastActive).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                </td>

                <td className="py-3.5 px-4 text-right">
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Online
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
