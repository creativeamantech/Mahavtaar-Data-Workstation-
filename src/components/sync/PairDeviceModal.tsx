import React, { useState } from 'react';
import { DeviceIdentity } from '../../lib/sync/types';
import { 
  Copy, Check, KeyRound, Wifi, 
  ShieldCheck, X, Network,
  Terminal, ArrowRight, ChevronDown, ChevronUp, Laptop
} from 'lucide-react';
import { Button } from '../ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '../ui/dialog';
import { toast } from 'sonner';

interface PairDeviceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  identity: DeviceIdentity;
  onGenerateOffer: (peerId: string) => Promise<string>;
  onAcceptOffer: (offerBase64: string) => Promise<string>;
  onAcceptAnswer: (answerBase64: string) => Promise<void>;
  onRequestPairingFromPayload: (payload: string) => Promise<void>;
}

export function PairDeviceModal({
  open,
  onOpenChange,
  identity,
  onGenerateOffer,
  onAcceptOffer,
  onAcceptAnswer,
  onRequestPairingFromPayload,
}: PairDeviceModalProps) {
  const [activeTab, setActiveTab] = useState<'code' | 'webrtc'>('code');
  const [codeCopied, setCodeCopied] = useState(false);
  const [jsonCopied, setJsonCopied] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [pairingCode] = useState(() => `${Math.floor(100 + Math.random() * 900)}-${Math.floor(100 + Math.random() * 900)}`);
  
  // WebRTC manual state
  const [targetPeerId, setTargetPeerId] = useState('');
  const [generatedOffer, setGeneratedOffer] = useState('');
  const [incomingOffer, setIncomingOffer] = useState('');
  const [generatedAnswer, setGeneratedAnswer] = useState('');
  const [incomingAnswer, setIncomingAnswer] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [receivedPayload, setReceivedPayload] = useState('');

  const pairingPayload = JSON.stringify({
    peerId: identity.peerId,
    deviceId: identity.deviceId,
    deviceName: identity.deviceName,
    code: pairingCode,
    created: new Date().toISOString()
  });

  const handleCopyCode = () => {
    navigator.clipboard.writeText(pairingCode);
    setCodeCopied(true);
    toast.success('Authorization code copied!');
    setTimeout(() => setCodeCopied(false), 2000);
  };

  const handleCopyJson = () => {
    navigator.clipboard.writeText(pairingPayload);
    setJsonCopied(true);
    toast.success('Pairing JSON token copied!');
    setTimeout(() => setJsonCopied(false), 2000);
  };

  const handleCreateOffer = async () => {
    if (!targetPeerId.trim()) return toast.error('Enter target Peer ID');
    try {
      setIsProcessing(true);
      const offer = await onGenerateOffer(targetPeerId.trim());
      setGeneratedOffer(offer);
      toast.success('WebRTC Offer Generated');
    } catch (e: any) {
      toast.error('Offer failed: ' + e.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCreateAnswer = async () => {
    if (!incomingOffer.trim()) return toast.error('Paste incoming offer first');
    try {
      setIsProcessing(true);
      const answer = await onAcceptOffer(incomingOffer.trim());
      setGeneratedAnswer(answer);
      toast.success('WebRTC Answer Generated');
    } catch (e: any) {
      toast.error('Answer failed: ' + e.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCompletePairing = async () => {
    if (!incomingAnswer.trim()) return toast.error('Paste incoming answer first');
    try {
      setIsProcessing(true);
      await onAcceptAnswer(incomingAnswer.trim());
      toast.success('Direct P2P DataChannel established successfully!');
      onOpenChange(false);
    } catch (e: any) {
      toast.error('Pairing failed: ' + e.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleJoinNetwork = async () => {
    if (!receivedPayload.trim()) return toast.error('Enter a 6-digit code or JSON payload');
    try {
      setIsProcessing(true);
      await onRequestPairingFromPayload(receivedPayload.trim());
      toast.success('Pairing Request Sent! Waiting for approval.');
      onOpenChange(false);
    } catch (e: any) {
      toast.error('Failed to request pairing: ' + e.message);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg w-[95vw] sm:w-full max-h-[90vh] flex flex-col bg-card border border-border shadow-2xl p-0 overflow-hidden rounded-2xl sm:rounded-3xl">
        {/* Header */}
        <div className="px-6 pt-5 pb-4 border-b border-border bg-muted/20 flex items-start justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
              <Network className="w-6 h-6" />
            </div>
            <div>
              <DialogTitle className="text-lg sm:text-xl font-black text-foreground tracking-tight">
                Pair Terminal
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Connect and sync terminals over your local network mesh.
              </DialogDescription>
            </div>
          </div>
        </div>

        {/* Mode Selector Tabs */}
        <div className="px-5 pt-3 shrink-0">
          <div className="flex gap-1.5 p-1 bg-muted/60 rounded-xl border border-border/50">
            <button
              onClick={() => setActiveTab('code')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'code' 
                  ? 'bg-background shadow text-foreground' 
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <KeyRound className="w-3.5 h-3.5" />
              6-Digit Code (Auto-Sync)
            </button>
            <button
              onClick={() => setActiveTab('webrtc')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'webrtc' 
                  ? 'bg-background shadow text-foreground' 
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Terminal className="w-3.5 h-3.5" />
              Manual WebRTC
            </button>
          </div>
        </div>

        {/* Scrollable Modal Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 scrollbar-thin">
          {activeTab === 'code' ? (
            <div className="space-y-4 animate-in fade-in duration-200">
              {/* Card 1: Your Code */}
              <div className="p-4 rounded-2xl bg-muted/40 border border-border flex flex-col items-center text-center space-y-2.5">
                <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  <ShieldCheck className="w-3.5 h-3.5 text-primary" />
                  Your Terminal Code
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse ml-1" />
                </div>
                
                <div className="flex items-center justify-center gap-3">
                  <div className="text-3xl sm:text-4xl font-black font-mono tracking-widest text-foreground px-5 py-2 rounded-xl bg-background border border-border/80 shadow-inner">
                    {pairingCode}
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={handleCopyCode}
                    className="h-10 px-3 rounded-xl text-xs font-bold shrink-0 border-border"
                  >
                    {codeCopied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                    <span className="ml-1.5 hidden sm:inline">{codeCopied ? 'Copied' : 'Copy'}</span>
                  </Button>
                </div>
                
                <p className="text-[11px] text-muted-foreground">
                  Type this code on another system's Connectivity Hub to connect.
                </p>
              </div>

              {/* Card 2: Connect to Remote */}
              <div className="p-4 rounded-2xl bg-muted/20 border border-border space-y-2.5">
                <div className="flex items-center gap-1.5">
                  <Laptop className="w-4 h-4 text-primary" />
                  <h4 className="text-xs font-bold text-foreground">Connect to Another Terminal</h4>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Enter the 6-digit authorization code displayed on the other system:
                </p>
                
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="e.g. 250-884"
                    value={receivedPayload}
                    onChange={(e) => setReceivedPayload(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleJoinNetwork();
                    }}
                    className="flex-1 px-3.5 py-2 rounded-xl border border-border bg-background text-sm font-mono focus:ring-2 focus:ring-primary/20 outline-none transition-all placeholder:text-muted-foreground/50"
                  />
                  <Button 
                    onClick={handleJoinNetwork} 
                    disabled={isProcessing || !receivedPayload.trim()}
                    className="rounded-xl px-4 text-xs font-bold shrink-0 shadow-sm"
                  >
                    {isProcessing ? 'Connecting...' : 'Send Request'}
                  </Button>
                </div>
              </div>

              {/* Collapsible Advanced Payload */}
              <div className="pt-1 border-t border-border/60">
                <button
                  type="button"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="flex items-center justify-between w-full py-1 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
                >
                  <span className="flex items-center gap-1.5">
                    Advanced Pairing Payload (JSON)
                  </span>
                  {showAdvanced ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>

                {showAdvanced && (
                  <div className="mt-2 p-3 rounded-xl bg-muted/40 border border-border space-y-2 animate-in fade-in zoom-in-95 duration-150">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] uppercase font-bold text-muted-foreground">Full Token</span>
                      <button
                        onClick={handleCopyJson}
                        className="flex items-center gap-1 text-[10px] font-bold text-primary hover:underline"
                      >
                        {jsonCopied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                        {jsonCopied ? 'Copied Token' : 'Copy JSON'}
                      </button>
                    </div>
                    <div className="p-2 bg-background rounded-lg border border-border/80 font-mono text-[10px] text-muted-foreground break-all max-h-20 overflow-y-auto select-all">
                      {pairingPayload}
                    </div>
                  </div>
                )}
              </div>

              {/* Footer info note */}
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-muted/30 border border-border/40 text-[11px] text-muted-foreground">
                <Wifi className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <span className="truncate">Encrypted local P2P broadcast discovery active</span>
              </div>
            </div>
          ) : (
            <div className="space-y-4 animate-in fade-in duration-200">
              {/* Step 1 */}
              <div className="p-3.5 rounded-xl bg-muted/30 border border-border space-y-2">
                <label className="flex items-center gap-2 text-xs font-bold text-foreground">
                  <span className="flex items-center justify-center w-5 h-5 rounded-full bg-primary/10 text-primary text-[10px] font-black">1</span> 
                  Generate Offer for Target Peer ID
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="e.g. PEER-84A91B"
                    value={targetPeerId}
                    onChange={(e) => setTargetPeerId(e.target.value)}
                    className="flex-1 px-3 py-1.5 rounded-lg border border-border bg-background text-xs font-mono focus:ring-2 focus:ring-primary/20 outline-none"
                  />
                  <Button size="sm" onClick={handleCreateOffer} disabled={isProcessing || !targetPeerId.trim()} className="rounded-lg px-3 text-xs font-bold">
                    {isProcessing ? '...' : 'Offer'}
                  </Button>
                </div>
                {generatedOffer && (
                  <div className="p-2 rounded-lg bg-background border border-border">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-[10px] font-bold text-muted-foreground">Generated Offer:</span>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(generatedOffer);
                          toast.success('Offer copied');
                        }}
                        className="text-[10px] font-bold text-primary hover:underline flex items-center gap-1"
                      >
                        <Copy className="w-3 h-3" /> Copy
                      </button>
                    </div>
                    <div className="max-h-16 overflow-y-auto font-mono text-[9px] text-muted-foreground break-all">
                      {generatedOffer}
                    </div>
                  </div>
                )}
              </div>

              {/* Step 2 */}
              <div className="p-3.5 rounded-xl bg-muted/30 border border-border space-y-2">
                <label className="flex items-center gap-2 text-xs font-bold text-foreground">
                  <span className="flex items-center justify-center w-5 h-5 rounded-full bg-primary/10 text-primary text-[10px] font-black">2</span> 
                  Accept Offer & Generate Answer
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Paste base64 Offer here..."
                    value={incomingOffer}
                    onChange={(e) => setIncomingOffer(e.target.value)}
                    className="flex-1 px-3 py-1.5 rounded-lg border border-border bg-background text-xs font-mono focus:ring-2 focus:ring-primary/20 outline-none"
                  />
                  <Button size="sm" variant="outline" onClick={handleCreateAnswer} disabled={isProcessing || !incomingOffer.trim()} className="rounded-lg px-3 text-xs font-bold">
                    {isProcessing ? '...' : 'Answer'}
                  </Button>
                </div>
                {generatedAnswer && (
                  <div className="p-2 rounded-lg bg-background border border-border">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-[10px] font-bold text-muted-foreground">Generated Answer:</span>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(generatedAnswer);
                          toast.success('Answer copied');
                        }}
                        className="text-[10px] font-bold text-primary hover:underline flex items-center gap-1"
                      >
                        <Copy className="w-3 h-3" /> Copy
                      </button>
                    </div>
                    <div className="max-h-16 overflow-y-auto font-mono text-[9px] text-muted-foreground break-all">
                      {generatedAnswer}
                    </div>
                  </div>
                )}
              </div>

              {/* Step 3 */}
              <div className="p-3.5 rounded-xl bg-muted/30 border border-border space-y-2">
                <label className="flex items-center gap-2 text-xs font-bold text-foreground">
                  <span className="flex items-center justify-center w-5 h-5 rounded-full bg-primary/10 text-primary text-[10px] font-black">3</span> 
                  Complete Handshake
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Paste base64 Answer here..."
                    value={incomingAnswer}
                    onChange={(e) => setIncomingAnswer(e.target.value)}
                    className="flex-1 px-3 py-1.5 rounded-lg border border-border bg-background text-xs font-mono focus:ring-2 focus:ring-primary/20 outline-none"
                  />
                  <Button size="sm" onClick={handleCompletePairing} disabled={isProcessing || !incomingAnswer.trim()} className="rounded-lg px-3 text-xs font-bold">
                    {isProcessing ? '...' : 'Connect'}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
