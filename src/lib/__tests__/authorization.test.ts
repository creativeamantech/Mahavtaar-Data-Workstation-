import { describe, it, expect } from 'vitest';
import { can, requirePermission } from '../authorization';
import { User } from '../../constants/permissions';

describe('Centralized Authorization Engine (Section 21)', () => {
  const adminUser: User = {
    id: 'u-1',
    name: 'Super Admin',
    role: 'ADMIN',
    permissions: { views: [] }
  };

  const managerUser: User = {
    id: 'u-2',
    name: 'City Manager',
    role: 'MANAGER',
    permissions: { views: [] }
  };

  const executiveUser: User = {
    id: 'u-3',
    name: 'Field Executive',
    role: 'EXECUTIVE',
    assignedExecutiveName: 'Field Executive',
    permissions: { views: [] }
  };

  const viewerUser: User = {
    id: 'u-4',
    name: 'Guest Auditor',
    role: 'VIEWER',
    permissions: { views: [] }
  };

  it('allows ADMIN full access to loan, user, target, and audit resources', () => {
    expect(can(adminUser, 'loan', 'CREATE')).toBe(true);
    expect(can(adminUser, 'loan', 'DELETE')).toBe(true);
    expect(can(adminUser, 'user', 'CREATE')).toBe(true);
    expect(can(adminUser, 'user', 'DELETE')).toBe(true);
    expect(can(adminUser, 'audit', 'VIEW')).toBe(true);
    expect(can(adminUser, 'target', 'MODIFY')).toBe(true);
  });

  it('allows MANAGER operational access but restricts user deletions and audit modifications', () => {
    expect(can(managerUser, 'loan', 'CREATE')).toBe(true);
    expect(can(managerUser, 'loan', 'UPDATE')).toBe(true);
    expect(can(managerUser, 'loan', 'DELETE')).toBe(false);
    expect(can(managerUser, 'user', 'DELETE')).toBe(false);
    expect(can(managerUser, 'user', 'CREATE')).toBe(false);
  });

  it('strictly restricts EXECUTIVE from admin operations and user management', () => {
    expect(can(executiveUser, 'loan', 'VIEW')).toBe(true);
    expect(can(executiveUser, 'feedback', 'SUBMIT')).toBe(true);
    expect(can(executiveUser, 'attendance', 'SUBMIT')).toBe(true);
    expect(can(executiveUser, 'user', 'VIEW')).toBe(false);
    expect(can(executiveUser, 'user', 'CREATE')).toBe(false);
    expect(can(executiveUser, 'target', 'MODIFY')).toBe(false);
  });

  it('enforces read-only limits for VIEWER', () => {
    expect(can(viewerUser, 'loan', 'VIEW')).toBe(true);
    expect(can(viewerUser, 'loan', 'CREATE')).toBe(false);
    expect(can(viewerUser, 'feedback', 'SUBMIT')).toBe(false);
    expect(can(viewerUser, 'target', 'MODIFY')).toBe(false);
  });

  it('requirePermission throws descriptive error for unauthorized actions', () => {
    expect(() => requirePermission(executiveUser, 'user', 'DELETE')).toThrow(/Unauthorized/);
    expect(() => requirePermission(null, 'loan', 'VIEW')).toThrow(/Unauthorized/);
    expect(() => requirePermission(adminUser, 'loan', 'VIEW')).not.toThrow();
  });
});
