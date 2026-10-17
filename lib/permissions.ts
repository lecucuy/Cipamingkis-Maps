// ===== TYPES =====
export type Role = 'admin' | 'supervisor' | 'tpop' | 'pob' | 'juru' | 'reporter';
export type SectionKey =
  | 'info'
  | 'uploads'
  | 'progress'
  | 'finance'
  | 'activity'
  | 'security'
  | 'live';

export type FinanceLevel = 'full' | 'approve' | 'request' | null;
export type ProgressLevel = 'full' | 'update' | 'submit' | null;

export interface Permissions {
  finance: FinanceLevel;
  progress: ProgressLevel;
  manageTeam: boolean;
  auditLog: boolean;
}

// ===== MATRIX =====
export const ROLE_PERMISSIONS: Record<Role, Permissions> = {
  admin:      { finance: 'full',    progress: 'full',   manageTeam: true,  auditLog: true  },
  supervisor: { finance: 'approve', progress: 'full',   manageTeam: true,  auditLog: true  },
  tpop:       { finance: 'request', progress: 'update', manageTeam: false, auditLog: false },
  pob:        { finance: 'request', progress: 'update', manageTeam: false, auditLog: false },
  juru:       { finance: null,      progress: 'submit', manageTeam: false, auditLog: false },
  reporter:   { finance: null,      progress: null,     manageTeam: false, auditLog: false },
};

// ===== CORE HELPERS =====
export function normalizeRole(r?: string | null): Role {
  const n = (r || '').toLowerCase() as Role;
  return ROLE_PERMISSIONS[n] ? n : 'reporter';
}

export function getPermissions(role?: string | null): Permissions {
  return ROLE_PERMISSIONS[normalizeRole(role)];
}

// ===== NAVIGATION =====
export function visibleSections(role?: string | null): SectionKey[] {
  const r = normalizeRole(role);
  const p = getPermissions(role);
  const base: SectionKey[] = ['info', 'uploads'];

  if (p.progress) base.push('progress');
  if (p.finance) base.push('finance');

  // 🔥 Live streaming — KHUSUS TPOP saja
  if (r === 'tpop') base.push('live');

  base.push('activity', 'security');
  return base;
}

// ===== ROLE SHORTCUTS (biar nggak nulis string manual) =====
export const isAdmin       = (r?: string | null) => normalizeRole(r) === 'admin';
export const isSupervisor  = (r?: string | null) => normalizeRole(r) === 'supervisor';
export const isTpop        = (r?: string | null) => normalizeRole(r) === 'tpop';
export const isPob         = (r?: string | null) => normalizeRole(r) === 'pob';
export const isJuru        = (r?: string | null) => normalizeRole(r) === 'juru';
export const isReporter    = (r?: string | null) => normalizeRole(r) === 'reporter';

// ===== FEATURE CHECKS (dipakai di komponen) =====
export const canSeeFinance        = (r?: string | null) => getPermissions(r).finance !== null;
export const canApproveFinance    = (r?: string | null) => {
  const f = getPermissions(r).finance;
  return f === 'approve' || f === 'full';
};
export const canRequestFinance    = (r?: string | null) => {
  const f = getPermissions(r).finance;
  return f === 'request' || f === 'full';
};
export const canSeeProgress       = (r?: string | null) => getPermissions(r).progress !== null;
export const canUpdateProgress    = (r?: string | null) => {
  const p = getPermissions(r).progress;
  return p === 'update' || p === 'full';
};
export const canSubmitProgress    = (r?: string | null) => getPermissions(r).progress !== null;
export const canManageTeam        = (r?: string | null) => getPermissions(r).manageTeam;
export const canViewAuditLog      = (r?: string | null) => getPermissions(r).auditLog;

// 🔥 Live streaming — hanya TPOP
export const canGoLive            = (r?: string | null) => normalizeRole(r) === 'tpop';

// ===== LABEL & COLOR (untuk UI badge) =====
export const ROLE_META: Record<Role, { label: string; color: string; icon: string }> = {
  admin:      { label: 'Administrator',   color: '#ef4444', icon: 'fa-shield-halved' },
  supervisor: { label: 'Supervisor',      color: '#8b5cf6', icon: 'fa-user-tie' },
  tpop:       { label: 'TPOP',            color: '#00c8ff', icon: 'fa-user-gear' },
  pob:        { label: 'POB',             color: '#06b6d4', icon: 'fa-user-cog' },
  juru:       { label: 'Juru',            color: '#10b981', icon: 'fa-user' },
  reporter:   { label: 'Reporter',        color: '#f59e0b', icon: 'fa-user-pen' },
};

export function getRoleMeta(role?: string | null) {
  return ROLE_META[normalizeRole(role)];
}

// ===== FINANCE LEVEL LABEL (untuk UI info) =====
export const FINANCE_LEVEL_LABEL: Record<Exclude<FinanceLevel, null>, string> = {
  full:    'Akses penuh (lihat, buat, approve, edit)',
  approve: 'Bisa approve & reject pengajuan',
  request: 'Bisa ajukan & lihat transaksi sendiri',
};

export const PROGRESS_LEVEL_LABEL: Record<Exclude<ProgressLevel, null>, string> = {
  full:   'Akses penuh (lihat semua, assign, update, hapus)',
  update: 'Bisa update progress pekerjaan',
  submit: 'Bisa submit & lihat pekerjaan sendiri',
};