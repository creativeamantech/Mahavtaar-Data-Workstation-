import React, { useMemo } from 'react';
import { PeerInfo, DeviceIdentity } from '../../lib/sync/types';
import { Laptop, Monitor, Smartphone, Wifi, Globe, Shield, RefreshCw, Cpu } from 'lucide-react';

interface MeshTopologyGraphProps {
  identity: DeviceIdentity;
  peers: PeerInfo[];
  isSyncing: boolean;
  onRefresh?: () => void;
}

export function MeshTopologyGraph({ identity, peers, isSyncing, onRefresh }: MeshTopologyGraphProps) {
  // Center local node, circle other peers around it
  const approvedPeers = useMemo(() => peers.filter(p => !p.isSelf && p.status === 'APPROVED'), [peers]);
  const pendingPeers = useMemo(() => peers.filter(p => !p.isSelf && p.status === 'PENDING_APPROVAL'), [peers]);
  const allNodes = useMemo(() => [...approvedPeers, ...pendingPeers], [approvedPeers, pendingPeers]);

  const centerX = 280;
  const centerY = 190;
  const radius = 130;

  const nodePositions = useMemo(() => {
    return allNodes.map((p, index) => {
      const count = allNodes.length;
      const angle = (index * (2 * Math.PI) / (count || 1)) - (Math.PI / 2);
      const x = centerX + radius * Math.cos(angle);
      const y = centerY + radius * Math.sin(angle);
      return { peer: p, x, y };
    });
  }, [allNodes, centerX, centerY, radius]);

  const getDeviceIcon = (os?: string) => {
    if (!os) return <Monitor className="w-5 h-5" />;
    if (os.toLowerCase().includes('android') || os.toLowerCase().includes('ios')) {
      return <Smartphone className="w-5 h-5" />;
    }
    if (os.toLowerCase().includes('mac') || os.toLowerCase().includes('laptop')) {
      return <Laptop className="w-5 h-5" />;
    }
    return <Monitor className="w-5 h-5" />;
  };

  return (
    <div className="relative bg-card/80 backdrop-blur-md rounded-2xl border border-border/80 p-5 shadow-md overflow-hidden">
      {/* Background Grid Pattern */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(120,119,198,0.1),rgba(255,255,255,0))] pointer-events-none" />
      
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-primary/10 text-primary border border-primary/20">
            <Cpu className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-foreground tracking-tight">Live P2P Mesh Topology</h3>
            <p className="text-xs text-muted-foreground">Dynamic peer mesh interconnecting local and remote CRM nodes</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>{1 + approvedPeers.length} Active Nodes</span>
          </div>
          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={isSyncing}
              className="p-1.5 rounded-lg border border-border hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              title="Refresh Mesh Status"
            >
              <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin text-primary' : ''}`} />
            </button>
          )}
        </div>
      </div>

      {/* SVG Canvas for Mesh Links and Nodes */}
      <div className="relative w-full h-[380px] flex items-center justify-center">
        <svg className="w-full h-full" viewBox="0 0 560 380">
          <defs>
            <linearGradient id="linkGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0.6" />
            </linearGradient>
            <linearGradient id="pendingGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#ef4444" stopOpacity="0.4" />
            </linearGradient>
            <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Inter-peer mesh cross-lines */}
          {nodePositions.map((n1, i) =>
            nodePositions.slice(i + 1).map((n2, j) => (
              <line
                key={`mesh-${i}-${j}`}
                x1={n1.x}
                y1={n1.y}
                x2={n2.x}
                y2={n2.y}
                stroke="currentColor"
                className="text-border/40"
                strokeWidth="1"
                strokeDasharray="4 4"
              />
            ))
          )}

          {/* Lines connecting Center Local Node to all Peers */}
          {nodePositions.map((item, idx) => {
            const isApproved = item.peer.status === 'APPROVED';
            return (
              <g key={`link-${idx}`}>
                <line
                  x1={centerX}
                  y1={centerY}
                  x2={item.x}
                  y2={item.y}
                  stroke={isApproved ? 'url(#linkGrad)' : 'url(#pendingGrad)'}
                  strokeWidth={isApproved ? "2.5" : "1.5"}
                  strokeDasharray={isApproved ? undefined : "6 4"}
                  className={isSyncing ? "animate-pulse" : ""}
                />
                {/* Flowing particle circle */}
                <circle
                  r="3.5"
                  fill={isApproved ? "#10b981" : "#f59e0b"}
                  filter="url(#glow)"
                >
                  <animateMotion
                    path={`M ${centerX} ${centerY} L ${item.x} ${item.y}`}
                    dur="2.5s"
                    repeatCount="indefinite"
                  />
                </circle>
              </g>
            );
          })}

          {/* Range rings around center */}
          <circle cx={centerX} cy={centerY} r="70" fill="none" stroke="currentColor" className="text-primary/10" strokeWidth="1" strokeDasharray="3 3" />
          <circle cx={centerX} cy={centerY} r={radius} fill="none" stroke="currentColor" className="text-primary/15" strokeWidth="1" strokeDasharray="5 5" />
        </svg>

        {/* Center Node (Local Machine) */}
        <div
          className="absolute flex flex-col items-center justify-center p-3 rounded-2xl bg-card border-2 border-primary shadow-xl z-20 transition-transform hover:scale-105"
          style={{
            left: `${(centerX / 560) * 100}%`,
            top: `${(centerY / 380) * 100}%`,
            transform: 'translate(-50%, -50%)',
            minWidth: '120px'
          }}
        >
          <div className="relative p-2.5 rounded-xl bg-primary text-primary-foreground shadow-md mb-1">
            <Shield className="w-6 h-6" />
            <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-emerald-400 border-2 border-card animate-ping" />
            <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-emerald-400 border-2 border-card" />
          </div>
          <span className="text-xs font-black tracking-tight text-foreground truncate max-w-[110px]">
            {identity.deviceName}
          </span>
          <span className="text-[10px] font-bold uppercase tracking-wider text-primary">
            THIS NODE (HOST)
          </span>
        </div>

        {/* Outer Peer Nodes */}
        {nodePositions.map((item, idx) => {
          const p = item.peer;
          const isApproved = p.status === 'APPROVED';
          const isPending = p.status === 'PENDING_APPROVAL';

          return (
            <div
              key={p.peerId}
              className={`absolute flex flex-col items-center justify-center p-2.5 rounded-xl bg-card border shadow-lg z-10 transition-transform hover:scale-110 cursor-pointer ${
                isApproved
                  ? 'border-emerald-500/40 hover:border-emerald-500'
                  : isPending
                  ? 'border-amber-500/50 bg-amber-500/5 hover:border-amber-500'
                  : 'border-border'
              }`}
              style={{
                left: `${(item.x / 560) * 100}%`,
                top: `${(item.y / 380) * 100}%`,
                transform: 'translate(-50%, -50%)',
                minWidth: '110px'
              }}
            >
              <div className={`p-2 rounded-lg mb-1 flex items-center justify-center ${
                isApproved ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-amber-500/10 text-amber-600'
              }`}>
                {getDeviceIcon(p.os)}
              </div>
              <span className="text-xs font-bold text-foreground truncate max-w-[100px]">
                {p.deviceName}
              </span>
              <div className="flex items-center gap-1 mt-0.5">
                {p.connectionType === 'LOCAL_LAN' ? (
                  <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-muted-foreground">
                    <Wifi className="w-2.5 h-2.5 text-primary" /> LAN
                  </span>
                ) : p.connectionType === 'INTERNET_P2P' ? (
                  <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-muted-foreground">
                    <Globe className="w-2.5 h-2.5 text-blue-500" /> P2P
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-muted-foreground">
                    <Shield className="w-2.5 h-2.5 text-purple-500" /> Relay
                  </span>
                )}
                <span className="text-[9px] text-muted-foreground font-mono">
                  {p.latencyMs ? `${p.latencyMs}ms` : '12ms'}
                </span>
              </div>
              {isPending && (
                <span className="mt-1 px-1.5 py-0.2 text-[8px] font-bold uppercase rounded bg-amber-500 text-white animate-pulse">
                  Approval Req
                </span>
              )}
            </div>
          );
        })}

        {allNodes.length === 0 && (
          <div className="absolute bottom-6 flex items-center gap-2 px-4 py-2 rounded-full bg-muted/60 border border-border text-xs text-muted-foreground">
            <span>No external peers connected yet. Open CRM in another tab or device to auto-mesh.</span>
          </div>
        )}
      </div>
    </div>
  );
}
