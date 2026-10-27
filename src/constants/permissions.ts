export const VIEWS = {
  DATA_EXPLORER: 'data_explorer',
  DASHBOARD: 'dashboard',
  EXEC_DASHBOARD: 'exec_dashboard',
  EXEC_TEAM_PERF: 'exec_team_perf',
  DATA_ENTRY: 'data_entry',
  CITY_PIVOT: 'city_pivot',
  TEAM_PIVOT: 'team_pivot',
  CITY_TEAM_MATRIX: 'city_team_matrix',
  SETTINGS: 'settings',
  AUDIT_LOG: 'audit_log',
  ASSIGNMENT: 'assignment',
  EXPORT: 'export',
  FEEDBACKS: 'feedbacks',
  LIVE_MONITORING: 'live_monitoring',
  ATTENDANCE: 'attendance',
  CONNECTIVITY_HUB: 'connectivity_hub',
} as const;

export type ViewKey = typeof VIEWS[keyof typeof VIEWS];

export const VIEW_CONFIG: { key: ViewKey; label: string; group: string; description: string }[] = [
  { key: VIEWS.EXEC_DASHBOARD, label: 'Executive Dashboard', group: 'Executive Hub', description: 'Personal KPI overview, live punch-in attendance, and assigned portfolio' },
  { key: VIEWS.EXEC_TEAM_PERF, label: 'Executive Team Performance', group: 'Executive Hub', description: 'City and bucket breakdown of executive recoveries' },
  { key: VIEWS.DASHBOARD, label: 'Admin Dashboard', group: 'Admin Hub', description: 'Company-wide high-level portfolio overview and collection metrics' },
  { key: VIEWS.DATA_ENTRY, label: 'Data Upload & Entry', group: 'Admin Hub', description: 'Import Main base, Paid files, Additional files, and corrections' },
  { key: VIEWS.ASSIGNMENT, label: 'Case Assignment', group: 'Admin Hub', description: 'Assign unallocated accounts and balance portfolio across executives' },
  { key: VIEWS.DATA_EXPLORER, label: 'Data Explorer', group: 'Data & Reports', description: 'Comprehensive tabular view with multi-dimensional filtering & exports' },
  { key: VIEWS.CITY_PIVOT, label: 'City Pivot', group: 'Data & Reports', description: 'Geographical analysis and target tracking across cities and states' },
  { key: VIEWS.TEAM_PIVOT, label: 'Team Pivot', group: 'Data & Reports', description: 'Agent vs bucket matrix and team performance reports' },
  { key: VIEWS.CITY_TEAM_MATRIX, label: 'Band Analysis', group: 'Data & Reports', description: 'Ticket-size POS band distribution and cross-tab analysis' },
  { key: VIEWS.LIVE_MONITORING, label: 'Live Monitoring', group: 'Monitoring & QA', description: 'Real-time feed of logged customer feedback and disposition updates' },
  { key: VIEWS.FEEDBACKS, label: 'Customer Feedbacks', group: 'Monitoring & QA', description: 'Audit and export history of all customer interactions' },
  { key: VIEWS.ATTENDANCE, label: 'Attendance Management', group: 'Monitoring & QA', description: 'Track executive login/logout times, breaks, and daily work logs' },
  { key: VIEWS.CONNECTIVITY_HUB, label: 'Connectivity & P2P Sync', group: 'Administration', description: 'Multi-system P2P sync, mesh topology, peer approvals, conflict management, and live device visibility' },
  { key: VIEWS.SETTINGS, label: 'System Configuration', group: 'Administration', description: 'User management, target setting, and system backups' },
  { key: VIEWS.AUDIT_LOG, label: 'Audit Trail', group: 'Administration', description: 'Historical log of all modifications and data changes' },
];

export const DEFAULT_PERMISSIONS: Record<string, string[]> = {
  ADMIN: [VIEWS.DASHBOARD, VIEWS.DATA_EXPLORER, VIEWS.DATA_ENTRY, VIEWS.CITY_PIVOT, VIEWS.TEAM_PIVOT, VIEWS.CITY_TEAM_MATRIX, VIEWS.ASSIGNMENT, VIEWS.SETTINGS, VIEWS.AUDIT_LOG, VIEWS.EXPORT, VIEWS.FEEDBACKS, VIEWS.LIVE_MONITORING, VIEWS.ATTENDANCE, VIEWS.CONNECTIVITY_HUB],
  MANAGER: [VIEWS.DASHBOARD, VIEWS.DATA_EXPLORER, VIEWS.DATA_ENTRY, VIEWS.CITY_PIVOT, VIEWS.TEAM_PIVOT, VIEWS.CITY_TEAM_MATRIX, VIEWS.ASSIGNMENT, VIEWS.EXPORT, VIEWS.FEEDBACKS, VIEWS.LIVE_MONITORING, VIEWS.ATTENDANCE, VIEWS.CONNECTIVITY_HUB],
  EXECUTIVE: [VIEWS.EXEC_DASHBOARD, VIEWS.EXEC_TEAM_PERF, VIEWS.DATA_EXPLORER, VIEWS.FEEDBACKS, VIEWS.ATTENDANCE, VIEWS.CONNECTIVITY_HUB],
  VIEWER: [VIEWS.DASHBOARD, VIEWS.DATA_EXPLORER, VIEWS.CITY_PIVOT, VIEWS.FEEDBACKS, VIEWS.CONNECTIVITY_HUB],
};

export type Role = 'ADMIN' | 'MANAGER' | 'EXECUTIVE' | 'VIEWER';

export interface User {
  id: string;
  name: string;
  email?: string;
  role: Role;
  permissions: { views: string[] };
  password?: string;
  assignedExecutiveName?: string;
  maintenanceMode?: boolean;
}
