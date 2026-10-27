import React, { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Role, User, VIEW_CONFIG, DEFAULT_PERMISSIONS, ViewKey } from "@/constants/permissions";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useData } from "@/contexts/DataContext";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Shield, UserCheck, Link2, Sparkles, AlertCircle } from "lucide-react";
import { fmtCur } from "@/lib/formatters";

interface UserFormSheetProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    user?: User;
    onSave: (data: Partial<User>) => void;
}

export function UserFormSheet({ open, onOpenChange, user, onSave }: UserFormSheetProps) {
    const { records } = useData();
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [role, setRole] = useState<Role>("EXECUTIVE");
    const [assignedExecutiveName, setAssignedExecutiveName] = useState("");
    const [maintenanceMode, setMaintenanceMode] = useState(false);
    const [password, setPassword] = useState("");
    const [selectedViews, setSelectedViews] = useState<string[]>([]);

    // Extract all unique executive / FOS names present in the current dataset
    const detectedExecutives = useMemo(() => {
        const statsMap = new Map<string, { count: number; totalPos: number }>();
        
        records.forEach(r => {
            const raw = String(
                r.executive_name || 
                r['Executive Name'] || 
                r.EXECUTIVE_NAME || 
                r.FOS_Name || 
                r['FOS Name'] || 
                r.fos || 
                r.FOS || 
                r.executive || 
                ''
            ).trim();

            if (raw) {
                const existing = statsMap.get(raw) || { count: 0, totalPos: 0 };
                const pos = Number(r.pos || r.POS || r.pos_amt || 0) || 0;
                statsMap.set(raw, { count: existing.count + 1, totalPos: existing.totalPos + pos });
            }
        });

        return Array.from(statsMap.entries()).map(([execName, data]) => ({
            name: execName,
            count: data.count,
            totalPos: data.totalPos
        })).sort((a, b) => b.count - a.count);
    }, [records]);

    // Calculate connectivity status for current mapping
    const connectivityStatus = useMemo(() => {
        const target = (assignedExecutiveName || name).trim().toLowerCase();
        if (!target) return { connected: false, count: 0, pos: 0 };

        const matched = detectedExecutives.find(e => 
            e.name.toLowerCase() === target || 
            e.name.toLowerCase().includes(target) || 
            target.includes(e.name.toLowerCase())
        );

        if (matched) {
            return { connected: true, matchedName: matched.name, count: matched.count, pos: matched.totalPos };
        }
        return { connected: false, count: 0, pos: 0 };
    }, [assignedExecutiveName, name, detectedExecutives]);

    useEffect(() => {
        if (user) {
            setName(user.name || "");
            setEmail(user.email || "");
            setRole(user.role || "EXECUTIVE");
            setAssignedExecutiveName(user.assignedExecutiveName || "");
            setMaintenanceMode(user.maintenanceMode || false);
            setPassword("");
            setSelectedViews(user.permissions?.views || DEFAULT_PERMISSIONS[user.role || 'EXECUTIVE'] || []);
        } else {
            setName("");
            setEmail("");
            setRole("EXECUTIVE");
            setAssignedExecutiveName("");
            setMaintenanceMode(false);
            setPassword("");
            setSelectedViews(DEFAULT_PERMISSIONS["EXECUTIVE"] || []);
        }
    }, [user, open]);

    const handleRoleChange = (newRole: Role) => {
        setRole(newRole);
        setSelectedViews(DEFAULT_PERMISSIONS[newRole] || []);
    };

    const toggleView = (viewKey: string) => {
        setSelectedViews(prev => 
            prev.includes(viewKey) 
                ? prev.filter(k => k !== viewKey) 
                : [...prev, viewKey]
        );
    };

    const applyPreset = (presetRole: Role) => {
        setSelectedViews(DEFAULT_PERMISSIONS[presetRole] || []);
    };

    const selectAllViews = () => {
        setSelectedViews(VIEW_CONFIG.map(v => v.key));
    };

    const clearAllViews = () => {
        setSelectedViews([]);
    };

    // Group views by category
    const groupedViews = useMemo(() => {
        const groups: Record<string, typeof VIEW_CONFIG> = {};
        VIEW_CONFIG.forEach(item => {
            if (!groups[item.group]) groups[item.group] = [];
            groups[item.group].push(item);
        });
        return groups;
    }, []);

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        onSave({
            name,
            email,
            role,
            assignedExecutiveName: assignedExecutiveName.trim() || undefined,
            permissions: { views: selectedViews },
            password: password || undefined,
            maintenanceMode
        });
        onOpenChange(false);
    }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto max-h-screen">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2 text-xl font-bold">
            <Shield className="h-5 w-5 text-primary" />
            {user ? "Edit User Account & Permissions" : "Create New User & Configure Permissions"}
          </SheetTitle>
          <SheetDescription>
            Configure user credentials, data connectivity mappings, and exact page display permissions.
          </SheetDescription>
        </SheetHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6 mt-6 pb-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Full Name *</Label>
                    <Input 
                        value={name} 
                        onChange={e => setName(e.target.value)} 
                        required 
                        placeholder="e.g. Ravi Sharma" 
                    />
                </div>

                <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Email Address *</Label>
                    <Input 
                        value={email} 
                        onChange={e => setEmail(e.target.value)} 
                        required 
                        type="email" 
                        placeholder="ravi@company.com" 
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        {user ? 'Change Password (leave empty to keep)' : 'Password *'}
                    </Label>
                    <Input 
                        value={password} 
                        onChange={e => setPassword(e.target.value)} 
                        type="password" 
                        placeholder={user ? "••••••••" : "Enter password"}
                        required={!user} 
                    />
                </div>

                <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">User Role *</Label>
                    <Select value={role} onValueChange={(v: Role) => handleRoleChange(v)}>
                        <SelectTrigger>
                            <SelectValue placeholder="Select a role" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="EXECUTIVE">EXECUTIVE (Field / Tele-caller)</SelectItem>
                            <SelectItem value="MANAGER">MANAGER (Team Lead / Operations)</SelectItem>
                            <SelectItem value="ADMIN">ADMIN (Full Access)</SelectItem>
                            <SelectItem value="VIEWER">VIEWER (Read Only)</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* DATA CONNECTIVITY & EXECUTIVE MAPPING */}
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 font-semibold text-sm text-foreground">
                        <Link2 className="h-4 w-4 text-primary" />
                        Executive Data Connectivity & Loan Mapping
                    </div>
                    {connectivityStatus.connected ? (
                        <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-xs gap-1">
                            <CheckCircle2 className="h-3 w-3" /> Connected ({connectivityStatus.count} cases)
                        </Badge>
                    ) : (
                        <Badge variant="outline" className="text-xs text-muted-foreground gap-1">
                            <AlertCircle className="h-3 w-3" /> No direct data match
                        </Badge>
                    )}
                </div>
                
                <p className="text-xs text-muted-foreground">
                    Connects this user account to corresponding loan cases in the uploaded database. When logged in, the executive will automatically see their assigned portfolio.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">Select Detected FOS / Executive Name in Database</Label>
                        <Select 
                            value={assignedExecutiveName} 
                            onValueChange={v => setAssignedExecutiveName(v === '__CLEAR__' ? '' : v)}
                        >
                            <SelectTrigger className="bg-card">
                                <SelectValue placeholder={detectedExecutives.length > 0 ? "Select detected name in data..." : "No data uploaded yet"} />
                            </SelectTrigger>
                            <SelectContent className="max-h-60">
                                <SelectItem value="__CLEAR__">-- Use Full Name ({name || 'User Name'}) --</SelectItem>
                                {detectedExecutives.map(e => (
                                    <SelectItem key={e.name} value={e.name}>
                                        {e.name} ({e.count} cases • {fmtCur(e.totalPos)})
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">Or Custom Data Identifier / Alias</Label>
                        <Input 
                            value={assignedExecutiveName} 
                            onChange={e => setAssignedExecutiveName(e.target.value)} 
                            placeholder="e.g. RAVI or EMP001" 
                            className="bg-card"
                        />
                    </div>
                </div>

                {connectivityStatus.connected && (
                    <div className="text-xs text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-md p-2 flex items-center justify-between">
                        <span>Matched with <strong>{connectivityStatus.matchedName}</strong> in database</span>
                        <span className="font-semibold">{connectivityStatus.count} cases • Total POS: {fmtCur(connectivityStatus.pos)}</span>
                    </div>
                )}
            </div>

            {/* PAGE DISPLAY & PERMISSIONS MATRIX */}
            <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-2">
                    <div>
                        <Label className="text-sm font-bold flex items-center gap-1.5">
                            <Sparkles className="h-4 w-4 text-primary" />
                            Page Access & View Permissions ({selectedViews.length} pages enabled)
                        </Label>
                        <p className="text-xs text-muted-foreground mt-0.5">
                            Check which pages and features will be displayed in the sidebar, navigation, and accessible to this user.
                        </p>
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap">
                        <Button type="button" variant="outline" size="sm" className="h-7 text-xs px-2" onClick={() => applyPreset('EXECUTIVE')}>
                            Exec Preset
                        </Button>
                        <Button type="button" variant="outline" size="sm" className="h-7 text-xs px-2" onClick={() => applyPreset('MANAGER')}>
                            Manager Preset
                        </Button>
                        <Button type="button" variant="outline" size="sm" className="h-7 text-xs px-2" onClick={selectAllViews}>
                            Select All
                        </Button>
                        <Button type="button" variant="ghost" size="sm" className="h-7 text-xs px-2 text-muted-foreground" onClick={clearAllViews}>
                            Clear
                        </Button>
                    </div>
                </div>

                <div className="space-y-4 max-h-[320px] overflow-y-auto pr-1">
                    {Object.entries(groupedViews).map(([groupName, items]) => (
                        <div key={groupName} className="space-y-2">
                            <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground bg-muted/40 px-2 py-1 rounded">
                                {groupName}
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {items.map(item => {
                                    const isChecked = selectedViews.includes(item.key);
                                    return (
                                        <div 
                                            key={item.key} 
                                            onClick={() => toggleView(item.key)}
                                            className={`flex items-start gap-2.5 p-2.5 rounded-lg border transition-all cursor-pointer select-none ${
                                                isChecked 
                                                    ? 'border-primary/40 bg-primary/5 text-foreground' 
                                                    : 'border-border/60 bg-card hover:bg-muted/30 text-muted-foreground'
                                            }`}
                                        >
                                            <Checkbox 
                                                id={`chk-${item.key}`} 
                                                checked={isChecked} 
                                                onCheckedChange={() => toggleView(item.key)}
                                                className="mt-0.5"
                                            />
                                            <div className="space-y-0.5 text-left flex-1 min-w-0">
                                                <label 
                                                    htmlFor={`chk-${item.key}`}
                                                    className="text-xs font-semibold block cursor-pointer text-foreground"
                                                >
                                                    {item.label}
                                                </label>
                                                <p className="text-[11px] text-muted-foreground leading-tight line-clamp-1">
                                                    {item.description}
                                                </p>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* MAINTENANCE MODE */}
            <div className="flex flex-row items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                    <Label className="text-sm font-semibold">Maintenance Mode</Label>
                    <div className="text-xs text-muted-foreground">Temporarily restrict this user from performing updates.</div>
                </div>
                <Switch checked={maintenanceMode} onCheckedChange={setMaintenanceMode} />
            </div>

            <SheetFooter className="pt-2">
                <SheetClose asChild>
                    <Button type="button" variant="outline">Cancel</Button>
                </SheetClose>
                <Button type="submit" className="gap-2">
                    <UserCheck className="h-4 w-4" />
                    {user ? "Update User" : "Create User"}
                </Button>
            </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
