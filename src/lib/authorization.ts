/**
 * Mahavtaar Ledger - Centralized Authorization Engine
 * Enforces Role-Based Access Control & Action Scopes (Section 21 & Section 22)
 */

import { User, Role } from '../constants/permissions';

export type AuthResource =
  | 'loan'
  | 'user'
  | 'target'
  | 'audit'
  | 'assignment'
  | 'attendance'
  | 'feedback'
  | 'sync'
  | 'backup'
  | 'export'
  | 'settings';

export type AuthAction =
  | 'VIEW'
  | 'CREATE'
  | 'UPDATE'
  | 'DELETE'
  | 'EXPORT'
  | 'RESTORE'
  | 'ASSIGN'
  | 'SUBMIT'
  | 'MODIFY';

/**
 * Matrix of default permissions per role and resource action.
 */
const ROLE_PERMISSIONS: Record<Role, Record<AuthResource, AuthAction[]>> = {
  ADMIN: {
    loan: ['VIEW', 'CREATE', 'UPDATE', 'DELETE', 'EXPORT', 'ASSIGN'],
    user: ['VIEW', 'CREATE', 'UPDATE', 'DELETE'],
    target: ['VIEW', 'CREATE', 'UPDATE', 'DELETE', 'MODIFY'],
    audit: ['VIEW', 'EXPORT'],
    assignment: ['VIEW', 'ASSIGN', 'UPDATE'],
    attendance: ['VIEW', 'SUBMIT', 'UPDATE', 'EXPORT'],
    feedback: ['VIEW', 'SUBMIT', 'UPDATE', 'EXPORT'],
    sync: ['VIEW', 'CREATE', 'UPDATE', 'DELETE', 'MODIFY'],
    backup: ['VIEW', 'CREATE', 'RESTORE'],
    export: ['VIEW', 'EXPORT'],
    settings: ['VIEW', 'UPDATE', 'MODIFY'],
  },
  MANAGER: {
    loan: ['VIEW', 'CREATE', 'UPDATE', 'EXPORT', 'ASSIGN'],
    user: ['VIEW'],
    target: ['VIEW', 'UPDATE', 'MODIFY'],
    audit: ['VIEW'],
    assignment: ['VIEW', 'ASSIGN', 'UPDATE'],
    attendance: ['VIEW', 'SUBMIT', 'EXPORT'],
    feedback: ['VIEW', 'SUBMIT', 'EXPORT'],
    sync: ['VIEW', 'UPDATE'],
    backup: ['VIEW', 'CREATE'],
    export: ['VIEW', 'EXPORT'],
    settings: ['VIEW'],
  },
  EXECUTIVE: {
    loan: ['VIEW', 'UPDATE', 'EXPORT'], // strictly scoped to assigned cases
    user: [],
    target: ['VIEW'],
    audit: [],
    assignment: [],
    attendance: ['VIEW', 'SUBMIT'],
    feedback: ['VIEW', 'SUBMIT'],
    sync: ['VIEW'],
    backup: [],
    export: ['VIEW'],
    settings: [],
  },
  VIEWER: {
    loan: ['VIEW'],
    user: [],
    target: ['VIEW'],
    audit: [],
    assignment: [],
    attendance: ['VIEW'],
    feedback: ['VIEW'],
    sync: ['VIEW'],
    backup: [],
    export: [],
    settings: [],
  },
};

/**
 * Centralized authorization evaluation.
 * Returns true if the user is authorized to perform the action on the resource.
 *
 * @param user The current authenticated user
 * @param resource The target domain resource
 * @param action The requested operational action
 */
export function can(
  user: User | null | undefined,
  resource: AuthResource,
  action: AuthAction
): boolean {
  if (!user || !user.role) {
    return false;
  }

  const role = user.role as Role;
  const allowedActions = ROLE_PERMISSIONS[role]?.[resource] || [];

  return allowedActions.includes(action);
}

/**
 * Throws an AuthorizationError if the user is not permitted.
 */
export function requirePermission(
  user: User | null | undefined,
  resource: AuthResource,
  action: AuthAction
): void {
  if (!can(user, resource, action)) {
    throw new Error(`Unauthorized: User with role '${user?.role || 'ANONYMOUS'}' cannot perform '${action}' on resource '${resource}'`);
  }
}
