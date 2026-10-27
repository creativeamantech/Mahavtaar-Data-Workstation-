import { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { User, Role, DEFAULT_PERMISSIONS } from '../constants/permissions';
import { db } from '../lib/db';
import { derivePasswordHash, verifyPassword } from '../lib/authCrypto';

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

const MOCK_USERS: User[] = [
  { id: '1', name: 'Admin User', email: 'admin@company.com', role: 'ADMIN', permissions: { views: DEFAULT_PERMISSIONS.ADMIN } },
];

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<User[]>([]);

  useEffect(() => {
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

  const login = async (identifier: string, password: string): Promise<User> => {
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

  const logout = () => setUser(null);

  const hasPermission = (view: string) => {
    if (!user) return false;
    if (user.role === 'ADMIN' || view === 'connectivity_hub') return true;
    return user.permissions?.views?.includes(view) ?? false;
  };

  const isExecutive = () => user?.role === 'EXECUTIVE';

  const addUser = async (u: Omit<User, 'id'> & { password?: string }) => {
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
