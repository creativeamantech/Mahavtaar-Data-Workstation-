import { AdvancedTargetsTab } from '../components/AdvancedTargetsTab';
import { useState, useMemo, useEffect } from 'react';
import { AppLayout } from '../components/layout/AppLayout';
import { DataTable } from '../components/ui/DataTable';
import { StatusBadge } from '../components/ui/StatusBadge';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';
import { DEFAULT_PERMISSIONS, VIEWS, Role, User } from '../constants/permissions';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Check, ChevronsUpDown, Network, ArrowRight, Database } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { UserFormSheet } from '../components/settings/UserFormSheet';
import { db, backupSystemData, resetSystemData, restoreSystemData } from '../lib/db';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '../components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '../components/ui/popover';
import { cn } from '../lib/utils';
import { TargetInput } from '../components/TargetInput';
import { SystemHealthDiagnostics } from '../components/settings/SystemHealthDiagnostics';
import { SupabaseDatabaseSection } from '../components/sync/SupabaseDatabaseSection';
import { isCloudFirstEnabled } from '../lib/cloudRepository';


function SystemTab() {
  const [isResetting, setIsResetting] = useState(false);
  
  const handleBackup = async () => {
    if (isCloudFirstEnabled()) {
      toast.error('This backup tool only exports local device data. Use the approved Supabase backup process for cloud data.');
      return;
    }
    try {
      await backupSystemData();
      toast.success('System backup downloaded successfully');
    } catch (e) {
      toast.error('Failed to create backup');
    }
  };

  const handleRestore = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isCloudFirstEnabled()) {
      toast.error('Local restore is disabled in cloud-first mode to prevent misleading or destructive restores.');
      e.target.value = '';
      return;
    }
    const file = e.target.files?.[0];
    if (!file) return;

    if (!confirm("WARNING: Restoring a backup will overwrite existing local data. Ensure you have made a backup first. Proceed?")) {
      e.target.value = '';
      return;
    }

    try {
      const buffer = await file.arrayBuffer();
      await restoreSystemData(buffer);
      toast.success('System restored successfully. Reloading...');
      setTimeout(() => window.location.reload(), 1500);
    } catch (err: any) {
      toast.error(err.message || 'Failed to restore backup');
      e.target.value = '';
    }
  };

  const handleReset = async () => {
    if (isCloudFirstEnabled()) {
      toast.error('Factory reset is disabled in cloud-first mode. It must not be used as a cloud data deletion tool.');
      return;
    }
    if (!confirm("WARNING: This will delete ALL data (users, feedback, records). Type 'RESET' to confirm.")) return;
    try {
      setIsResetting(true);
      await resetSystemData();
      toast.success('System reset successfully');
      setTimeout(() => window.location.reload(), 1000);
    } catch (e) {
      toast.error('Failed to reset system');
      setIsResetting(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div className="bg-card border rounded-lg p-6 space-y-4">
        <div>
          <h3 className="text-lg font-semibold">Data Backup & Restore</h3>
          <p className="text-sm text-muted-foreground mb-4">{isCloudFirstEnabled() ? 'Cloud-first mode is active. The local JSON backup and restore tools do not back up or restore Supabase data and are disabled for safety.' : 'Download a complete JSON backup of all system data or restore from an existing backup file.'}</p>
          <div className="flex items-center gap-4">
            <Button onClick={handleBackup} disabled={isCloudFirstEnabled()}>Download Full Backup</Button>
            <div className="relative">
              <input
                type="file"
                accept=".json"
                onChange={handleRestore}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                title="Restore from JSON Backup"
                disabled={isCloudFirstEnabled()}
              />
              <Button variant="outline" disabled={isCloudFirstEnabled()}>Restore Backup</Button>
            </div>
          </div>
        </div>
      </div>
      <div className="bg-red-50 dark:bg-red-950/10 border border-red-200 dark:border-red-900 rounded-lg p-6 space-y-4">
        <div>
          <h3 className="text-lg font-semibold text-red-600 dark:text-red-400">Danger Zone</h3>
          <p className="text-sm text-muted-foreground mb-4">Permanently wipe all data from this device. This cannot be undone.</p>
          <Button variant="destructive" onClick={handleReset} disabled={isResetting || isCloudFirstEnabled()}>
            {isResetting ? 'Resetting...' : 'Factory Reset System'}
          </Button>
        </div>
      </div>
    </div>
  );
}

function UserManagementTab() {
  const { users, user: currentUser, addUser, updateUser, deleteUser } = useAuth();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | undefined>(undefined);

  const [confirmWipe, setConfirmWipe] = useState(false);
  
  const handleWipeDatabase = async () => {
    if (isCloudFirstEnabled()) {
      toast.error('Local database wipe is disabled in cloud-first mode.');
      return;
    }
    if (!confirmWipe) {
      setConfirmWipe(true);
      toast('Click CONFIRM WIPE again to confirm deletion', { duration: 4000 });
      return;
    }
    try {
      await db.delete();
      localStorage.clear();
      window.location.reload();
    } catch (err) {
      toast.error("Failed to wipe database");
      console.error(err);
    }
  };

  const openCreate = () => {
    setEditingUser(undefined);
    setSheetOpen(true);
  };

  const openEdit = (u: any) => {
    setEditingUser(u);
    setSheetOpen(true);
  };

  const handleSave = async (data: Partial<User>) => {
    const role = (data.role || 'VIEWER') as Role;
    const views = data.permissions?.views && data.permissions.views.length > 0
      ? data.permissions.views
      : (DEFAULT_PERMISSIONS[role] || []);

    try {
      if (editingUser) {
        await updateUser(editingUser.id, {
          name: data.name,
          email: data.email,
          role,
          permissions: { views },
          assignedExecutiveName: data.assignedExecutiveName,
          maintenanceMode: (data as any).maintenanceMode,
          password: data.password || undefined,
        });
        toast.success(isCloudFirstEnabled() ? 'Cloud user updated successfully' : 'User updated successfully');
      } else {
        await addUser({
          name: data.name!,
          email: data.email!,
          role,
          password: data.password || undefined,
          permissions: { views },
          assignedExecutiveName: data.assignedExecutiveName,
        });
        toast.success(isCloudFirstEnabled() ? 'Cloud user created successfully' : 'User created successfully');
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to save user');
      throw error;
    }
  };

  const handleDelete = async (id: string) => {
    if (id === currentUser?.id) return toast.error("Cannot delete yourself");
    if (!confirm(isCloudFirstEnabled() ? 'Permanently delete this Supabase Auth account?' : 'Delete user?')) return;
    try {
      await deleteUser(id);
      toast.success(isCloudFirstEnabled() ? 'Cloud user deleted' : 'User deleted');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to delete user');
    }
  };

  const columns = [
    { key: 'name', label: 'Name' },
    { key: 'email', label: 'Email' },
    { key: 'role', label: 'Role', render: (val: Role) => <StatusBadge status={val} /> },
    { 
      key: 'assignedExecutiveName', 
      label: 'Data Mapping (FOS)', 
      render: (val: string, row: any) => val ? (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-primary/10 text-primary border border-primary/20">
          {val}
        </span>
      ) : (
        <span className="text-xs text-muted-foreground italic">Auto-match ({row.name})</span>
      )
    },
    {
      key: 'permissions',
      label: 'Authorized Pages',
      render: (val: any) => (
        <span className="text-xs font-semibold px-2 py-0.5 rounded bg-muted text-muted-foreground">
          {val?.views?.length || 0} pages
        </span>
      )
    },
    { key: 'actions', label: 'Actions', render: (_: any, row: any) => (
      <div className="flex gap-2">
        <Button variant="ghost" size="sm" onClick={() => openEdit(row)}><Pencil className="w-4 h-4" /></Button>
        <Button variant="ghost" size="sm" onClick={() => handleDelete(row.id)} disabled={row.id === currentUser?.id}>
          <Trash2 className="w-4 h-4 text-destructive" />
        </Button>
      </div>
    )},
  ];

  return (
    <div className="space-y-4">
      <div className="flex justify-between">
        <h2 className="text-lg font-semibold">User Management</h2>
        <div className="flex gap-2">
          {!isCloudFirstEnabled() && <Button variant="destructive" onClick={handleWipeDatabase}>
            {confirmWipe ? 'CONFIRM WIPE' : 'Wipe Database'}
          </Button>}
          <Button onClick={openCreate}><Plus className="w-4 h-4 mr-2" /> Add User</Button>
        </div>
      </div>
      {isCloudFirstEnabled() && <div className="rounded-lg border border-sky-500/40 bg-sky-500/5 p-4 text-sm">
        <strong>Supabase cloud user management</strong>
        <p className="mt-1 text-muted-foreground">Changes are sent to the secured admin-users Edge Function. The function must be deployed and configured for these actions to work.</p>
      </div>}
      <DataTable columns={columns} data={users} pageSize={20} />
      
      <UserFormSheet 
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        user={editingUser}
        onSave={handleSave}
      />
    </div>
  );
}

export default function Settings() {
  const [activeTab, setActiveTab] = useState<'users' | 'database' | 'targets' | 'diagnostics' | 'connectivity' | 'system'>('users');
  const { user } = useAuth();
  
  if (user?.role !== 'ADMIN') {
    return (
      <AppLayout title="Settings">
        <div className="p-8 text-center text-muted-foreground">Access denied. Administrator privileges required.</div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Settings">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-headline font-bold tracking-tight mb-2">Settings</h1>
          <p className="text-muted-foreground">Manage database connection, users, system configurations, connectivity, diagnostics, and targets.</p>
        </div>

        <div className="flex gap-2 border-b overflow-x-auto">
          <button
            onClick={() => setActiveTab('users')}
            className={`px-4 py-2 font-medium border-b-2 whitespace-nowrap transition-colors ${activeTab === 'users' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
          >
            Users
          </button>
          <button
            onClick={() => setActiveTab('database')}
            className={`px-4 py-2 font-medium border-b-2 whitespace-nowrap transition-colors flex items-center gap-1.5 ${activeTab === 'database' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
          >
            <Database className="w-4 h-4" />
            Supabase Database
          </button>
          <button
            onClick={() => setActiveTab('targets')}
            className={`px-4 py-2 font-medium border-b-2 whitespace-nowrap transition-colors ${activeTab === 'targets' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
          >
            Global Targets
          </button>
          <button
            onClick={() => setActiveTab('diagnostics')}
            className={`px-4 py-2 font-medium border-b-2 whitespace-nowrap transition-colors ${activeTab === 'diagnostics' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
          >
            Diagnostics & Health
          </button>
          <button
            onClick={() => setActiveTab('connectivity')}
            className={`px-4 py-2 font-medium border-b-2 whitespace-nowrap transition-colors ${activeTab === 'connectivity' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
          >
            Connectivity & Mesh
          </button>
          <button
            onClick={() => setActiveTab('system')}
            className={`px-4 py-2 font-medium border-b-2 whitespace-nowrap transition-colors ${activeTab === 'system' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
          >
            System & Backups
          </button>
        </div>

        <div className="pt-4">
          {activeTab === 'users' && <UserManagementTab />}
          {activeTab === 'database' && <SupabaseDatabaseSection />}
          {activeTab === 'targets' && <AdvancedTargetsTab />}
          {activeTab === 'diagnostics' && <SystemHealthDiagnostics />}
          {activeTab === 'connectivity' && (
            <div className="max-w-2xl bg-card border rounded-2xl p-6 space-y-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-primary/10 text-primary">
                  <Network className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground">Multi-System Connectivity Hub</h3>
                  <p className="text-xs text-muted-foreground">Configure decentralized P2P synchronization, device pairing, and live sessions.</p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Connect multiple office PCs and mobile terminals without a centralized server. Manage peer approvals, view who is logged in where, resolve concurrent edit conflicts, and manage disaster recovery backups.
              </p>
              <Link to="/connectivity">
                <Button className="font-bold text-xs">
                  Open Dedicated Connectivity Hub <ArrowRight className="w-4 h-4 ml-1.5" />
                </Button>
              </Link>
            </div>
          )}
          {activeTab === 'system' && <SystemTab />}
        </div>
      </div>
    </AppLayout>
  );
}
