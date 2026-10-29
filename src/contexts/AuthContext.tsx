import { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { User, Role, DEFAULT_PERMISSIONS } from '../constants/permissions';
import { db } from '../lib/db';
import { derivePasswordHash, verifyPassword } from '../lib/authCrypto';
import { getSupabaseClient, isSupabaseConfigured } from '../lib/supabase';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (identifier: string, password: string) => Promise<User>;
  logout: () => void;
  hasPermission: (view: string) => boolean;
  isExecutive: () => boolean;
  users: User[];
  addUser: (u: Omit<User, 'id'> & { password?: string }) => Promise<void>;
  updateUser: (id: string, data: Partial<User>) => Promise<void>;
  deleteUser: (id: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

// Opt-in during migration so the production login is not switched before Supabase users are provisioned.
const CLOUD_FIRST_AUTH = import.meta.env.VITE_CLOUD_FIRST_AUTH === 'true';

function mapSupabaseUser(authUser: { id: string; email?: string; app_metadata?: Record<string, unknown>; user_metadata?: Record<string, unknown> }): User {
  const metadata = authUser.app_metadata ?? {};
  const roleValue = metadata.role;
  if (typeof roleValue !== 'string' || !['ADMIN', 'MANAGER', 'EXECUTIVE', 'VIEWER'].includes(roleValue)) {
    throw new Error('Your Supabase account has no valid administrator-assigned role. Contact your system administrator.');
  }
  const role = roleValue as Role;
  const configuredViews = (metadata.permissions as { views?: unknown } | undefined)?.views;
  const views = Array.isArray(configuredViews) ? configuredViews.filter((view): view is string => typeof view === 'string') : DEFAULT_PERMISSIONS[role] || [];
  const name = typeof metadata.name === 'string' ? metadata.name : typeof authUser.user_metadata?.name === 'string' ? authUser.user_metadata.name : authUser.email || 'User';
  return {
    id: authUser.id,
    name,
    email: authUser.email,
    role,
    permissions: { views },
    assignedExecutiveName: typeof metadata.assignedExecutiveName === 'string' ? metadata.assignedExecutiveName : undefined,
    maintenanceMode: metadata.maintenanceMode === true,
  };
}

const MOCK_USERS: User[] = [
  { id: '1', name: 'Admin User', email: 'admin@company.com', role: 'ADMIN', permissions: { views: DEFAULT_PERMISSIONS.ADMIN } },
];

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<User[]>([]);

  useEffect(() => {
    if (CLOUD_FIRST_AUTH) {
      const client = getSupabaseClient();
      if (!client || !isSupabaseConfigured()) {
        setLoading(false);
        return;
      }
      let active = true;
      const loadStaffDirectory = async (cloudUser: User) => {
        if (!['ADMIN', 'MANAGER'].includes(cloudUser.role)) {
          if (active) setUsers([]);
          return;
        }
        try {
          if (cloudUser.role === 'ADMIN') {
            const { data, error } = await client.functions.invoke('admin-users', { body: { action: 'list' } });
            if (error) throw error;
            const cloudUsers = Array.isArray(data?.users) ? data.users.map((entry: any): User => {
              const role = (['ADMIN', 'MANAGER', 'EXECUTIVE', 'VIEWER'].includes(entry.role) ? entry.role : 'VIEWER') as Role;
              return {
                id: String(entry.id),
                name: String(entry.name || entry.email || 'User'),
                email: String(entry.email || ''),
                role,
                assignedExecutiveName: typeof entry.assignedExecutiveName === 'string' ? entry.assignedExecutiveName : undefined,
                permissions: entry.permissions && Array.isArray(entry.permissions.views)
                  ? { views: entry.permissions.views.filter((view: unknown): view is string => typeof view === 'string') }
                  : { views: DEFAULT_PERMISSIONS[role] || [] },
              };
            }) : [];
            if (active) setUsers(cloudUsers);
          } else {
            const { data, error } = await client.functions.invoke('staff-directory', { body: {} });
            if (error) throw error;
            const staff = Array.isArray(data?.staff) ? data.staff : [];
            if (active) {
              setUsers(staff.map((entry: { id: string; name: string; role: Role; assignedExecutiveName?: string }) => ({
                id: entry.id,
                name: entry.name,
                role: entry.role,
                assignedExecutiveName: entry.assignedExecutiveName,
                permissions: { views: DEFAULT_PERMISSIONS[entry.role] || [] },
              })));
            }
          }
        } catch (directoryError) {
          console.warn('[Auth] Cloud user/staff directory unavailable; selectors may be incomplete until the required Edge Function is deployed.', directoryError);
          if (active) setUsers([]);
        }
      };
      const restoreSession = async () => {
        try {
          const { data, error } = await client.auth.getSession();
          if (error) throw error;
          if (data.session?.user && active) {
            try {
              const cloudUser = mapSupabaseUser(data.session.user);
              setUser(cloudUser);
              await loadStaffDirectory(cloudUser);
            } catch (roleError) {
              await client.auth.signOut();
              throw roleError;
            }
          }
        } catch (error) {
          console.error('[Auth] Supabase session restore failed', error);
        } finally {
          if (active) setLoading(false);
        }
      };
      void restoreSession();
      const { data: listener } = client.auth.onAuthStateChange((_event, session) => {
        if (!active) return;
        if (!session?.user) {
          setUser(null);
          return;
        }
        try {
          const cloudUser = mapSupabaseUser(session.user);
          setUser(cloudUser);
          void loadStaffDirectory(cloudUser);
        } catch (error) {
          console.error('[Auth] Invalid Supabase role claims', error);
          setUser(null);
          void client.auth.signOut();
        }
      });
      return () => {
        active = false;
        listener.subscription.unsubscribe();
      };
    }

    async function initDb() {
      try {
        const count = await db.users.count();
        if (count === 0) {
          const derived = await derivePasswordHash('Admin@123');
          const seedUsers = MOCK_USERS.map(u => ({
            ...u,
            passwordHash: derived.hash,
            salt: derived.salt,
            iterations: derived.iterations,
          }));
          await db.users.bulkPut(seedUsers as any);
        } else {
          // Cleanup legacy mock users if they still exist
          const legacyIds = ['2', '3', '4'];
          for (const id of legacyIds) {
             const u = await db.users.get(id);
             if (u && ['ravi@company.com', 'aarti@company.com', 'viewer@company.com'].includes(u.email)) {
                 await db.users.delete(id);
             }
          }
        }
        const dbUsers = await db.users.toArray();
        
        // Ensure default permissions only if none are configured
        const updatedUsers: User[] = [];
        for (const u of dbUsers) {
          if (!u.permissions || !u.permissions.views || u.permissions.views.length === 0) {
            u.permissions = { views: DEFAULT_PERMISSIONS[u.role] || [] };
            await db.users.put(u);
          }
          updatedUsers.push({ 
            id: u.id, 
            name: u.name, 
            email: u.email, 
            role: u.role as Role, 
            permissions: u.permissions, 
            assignedExecutiveName: u.assignedExecutiveName,
            maintenanceMode: u.maintenanceMode,
          });
        }
        setUsers(updatedUsers);

      } catch (err) {
        console.error("Failed to init users DB", err);
      } finally {
        setLoading(false);
      }
    }
    initDb();
  }, []);

  const refreshCloudUsers = async (): Promise<User[]> => {
    if (!CLOUD_FIRST_AUTH) return users;
    const client = getSupabaseClient();
    if (!client || user?.role !== 'ADMIN') return [];
    const { data, error } = await client.functions.invoke('admin-users', { body: { action: 'list' } });
    if (error) throw new Error('Unable to load cloud users. Confirm the admin-users function is deployed and configured.');
    const cloudUsers = Array.isArray(data?.users) ? data.users.map((entry: any): User => {
      const role = (['ADMIN', 'MANAGER', 'EXECUTIVE', 'VIEWER'].includes(entry.role) ? entry.role : 'VIEWER') as Role;
      return {
        id: String(entry.id),
        name: String(entry.name || entry.email || 'User'),
        email: String(entry.email || ''),
        role,
        assignedExecutiveName: typeof entry.assignedExecutiveName === 'string' ? entry.assignedExecutiveName : undefined,
        permissions: entry.permissions && Array.isArray(entry.permissions.views)
          ? { views: entry.permissions.views.filter((view: unknown): view is string => typeof view === 'string') }
          : { views: DEFAULT_PERMISSIONS[role] || [] },
      };
    }) : [];
    setUsers(cloudUsers);
    return cloudUsers;
  };

  const login = async (identifier: string, password: string): Promise<User> => {
    if (CLOUD_FIRST_AUTH) {
      const client = getSupabaseClient();
      if (!client) throw new Error('Cloud login is enabled but Supabase is not configured.');
      const email = identifier.trim().toLowerCase();
      if (!email.includes('@')) throw new Error('Use the email address registered in Supabase Auth.');
      const { data, error } = await client.auth.signInWithPassword({ email, password });
      if (error || !data.user) throw new Error(error?.message || 'Supabase sign-in failed.');
      const cloudUser = mapSupabaseUser(data.user);
      setUser(cloudUser);
      return cloudUser;
    }

    const searchStr = identifier.trim().toLowerCase();
    const found: any = await db.users.filter(u => 
      u.name.trim().toLowerCase() === searchStr || (!!u.email && u.email.trim().toLowerCase() === searchStr)
    ).first();

    if (!found) {
      throw new Error('Invalid credentials');
    }

    // Check account lockout
    if (found.lockoutUntil && new Date(found.lockoutUntil) > new Date()) {
      const waitSeconds = Math.ceil((new Date(found.lockoutUntil).getTime() - Date.now()) / 1000);
      throw new Error(`Account temporarily locked due to failed attempts. Please try again in ${waitSeconds}s.`);
    }

    const { isValid, needsRehash } = await verifyPassword(
      password,
      found.passwordHash,
      found.salt,
      found.iterations
    );

    if (!isValid) {
      const attempts = (found.failedLoginAttempts || 0) + 1;
      const updates: any = { failedLoginAttempts: attempts };
      if (attempts >= 5) {
        // Lock for 60 seconds
        updates.lockoutUntil = new Date(Date.now() + 60000).toISOString();
      }
      await db.users.update(found.id, updates);
      throw new Error('Invalid credentials');
    }

    // Reset failed attempts & upgrade legacy hash to PBKDF2 if needed
    const updates: any = {
      failedLoginAttempts: 0,
      lockoutUntil: null,
      lastLogin: new Date().toISOString(),
    };

    if (needsRehash) {
      const derived = await derivePasswordHash(password);
      updates.passwordHash = derived.hash;
      updates.salt = derived.salt;
      updates.iterations = derived.iterations;
    }

    await db.users.update(found.id, updates);
    
    const safeUser: User = { 
      id: found.id, 
      name: found.name, 
      email: found.email, 
      role: found.role as Role, 
      permissions: found.permissions || { views: DEFAULT_PERMISSIONS[found.role] || [] }, 
      assignedExecutiveName: found.assignedExecutiveName,
      maintenanceMode: found.maintenanceMode,
    };

    setUser(safeUser);
    return safeUser;
  };

  const logout = () => {
    if (CLOUD_FIRST_AUTH) {
      const client = getSupabaseClient();
      if (client) void client.auth.signOut();
    }
    setUser(null);
  };

  const hasPermission = (view: string) => {
    if (!user) return false;
    if (user.role === 'ADMIN' || view === 'connectivity_hub') return true;
    return user.permissions?.views?.includes(view) ?? false;
  };

  const isExecutive = () => user?.role === 'EXECUTIVE';

  const addUser = async (u: Omit<User, 'id'> & { password?: string }) => {
    if (CLOUD_FIRST_AUTH) {
      const client = getSupabaseClient();
      if (!client || user?.role !== 'ADMIN') throw new Error('Administrator access is required.');
      const { error } = await client.functions.invoke('admin-users', {
        body: { action: 'create', name: u.name, email: u.email, role: u.role, password: u.password, assignedExecutiveName: u.assignedExecutiveName, permissions: u.permissions },
      });
      if (error) throw new Error('Cloud account creation failed. Check the admin-users function and its logs.');
      await refreshCloudUsers();
      return;
    }
    const id = crypto.randomUUID();
    const pw = u.password || 'Admin@123';
    const derived = await derivePasswordHash(pw);
    const { password, ...userWithoutPassword } = u;
    
    const newUser = { 
      ...userWithoutPassword, 
      id, 
      passwordHash: derived.hash,
      salt: derived.salt,
      iterations: derived.iterations,
      createdAt: new Date().toISOString(),
    };
    
    setUsers(prev => [...prev, { ...userWithoutPassword, id }]);
    await db.users.put(newUser as any);
  };

  const updateUser = async (id: string, data: Partial<User> & { password?: string }) => {
    if (CLOUD_FIRST_AUTH) {
      const client = getSupabaseClient();
      if (!client || user?.role !== 'ADMIN') throw new Error('Administrator access is required.');
      const { error } = await client.functions.invoke('admin-users', {
        body: { action: 'update', id, name: data.name, email: data.email, role: data.role, password: data.password, assignedExecutiveName: data.assignedExecutiveName, permissions: data.permissions },
      });
      if (error) throw new Error('Cloud account update failed. Check the admin-users function and its logs.');
      await refreshCloudUsers();
      return;
    }
    setUsers(prev => prev.map(u => u.id === id ? { ...u, ...data } : u));
    const existing = await db.users.get(id);
    if (existing) {
      const updatePayload: any = { ...existing, ...data };
      if (data.password) {
        const derived = await derivePasswordHash(data.password);
        updatePayload.passwordHash = derived.hash;
        updatePayload.salt = derived.salt;
        updatePayload.iterations = derived.iterations;
        delete updatePayload.password;
      }
      
      await db.users.update(id, updatePayload);

      // If name changed, ripple it through the database
      if (data.name && data.name !== existing.name) {
          const oldName = existing.name;
          const newName = data.name;

          // 1. Update loan_records
          const recordsToUpdate = await db.loan_records.filter(r => r.executive_name === oldName || r['Executive Name'] === oldName).toArray();
          if (recordsToUpdate.length > 0) {
              const updatedRecords = recordsToUpdate.map(r => ({ ...r, executive_name: newName, ['Executive Name']: newName }));
              await db.loan_records.bulkPut(updatedRecords);
          }

          // 2. Update customer_feedbacks
          const feedbacksToUpdate = await db.customer_feedbacks.where('agentId').equals(id).toArray();
          if (feedbacksToUpdate.length > 0) {
              const updatedFeedbacks = feedbacksToUpdate.map(f => ({ ...f, agentName: newName }));
              await db.customer_feedbacks.bulkPut(updatedFeedbacks);
          }

          // 3. Update attendance_logs
          const attendanceToUpdate = await db.attendance_logs.where('userId').equals(id).toArray();
          if (attendanceToUpdate.length > 0) {
              const updatedAttendance = attendanceToUpdate.map(a => ({ ...a, userName: newName }));
              await db.attendance_logs.bulkPut(updatedAttendance);
          }
      }
    }
  };

  const deleteUser = async (id: string) => {
    if (CLOUD_FIRST_AUTH) {
      const client = getSupabaseClient();
      if (!client || user?.role !== 'ADMIN') throw new Error('Administrator access is required.');
      const { error } = await client.functions.invoke('admin-users', { body: { action: 'delete', id } });
      if (error) throw new Error('Cloud account deletion failed. Check the admin-users function and its logs.');
      await refreshCloudUsers();
      return;
    }
    setUsers(prev => prev.filter(u => u.id !== id));
    await db.users.delete(id);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, hasPermission, isExecutive, users, addUser, updateUser, deleteUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
};
