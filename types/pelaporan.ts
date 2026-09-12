// types/pelaporan.ts

export type UserRole = 'supervisor' | 'juru' | 'pob' | 'tpop' | 'reporter';

export const HOURS: string[] = Array.from({ length: 24 }, (_, i) =>
  String(i + 1).padStart(2, '0') + '.00'
); // ['01.00', '02.00', ..., '24.00']

export interface DebitHourlyRow {
  jam: string;               // '01.00' ... '24.00'
  tma: string;               // "+131." (bebas string)
  limpasan: string;          // m3/detik
  intakeKiri: string;        // m3/detik
  intakeKanan: string;       // m3/detik
  jumlah: string;            // m3/detik (auto = intakeKiri + intakeKanan)
  kaliCipamingkis: string;   // m3/detik
  hujan: string;             // mm
  keterangan: string;
}

export interface DebitDailyReport {
  id: string;
  buildingId: string;
  buildingName?: string;
  tanggal: string;           // YYYY-MM-DD
  rows: DebitHourlyRow[];
  reportedBy?: string;
  reportedAt?: string;
}

export function emptyDebitRow(jam: string): DebitHourlyRow {
  return {
    jam,
    tma: '',
    limpasan: '',
    intakeKiri: '',
    intakeKanan: '',
    jumlah: '',
    kaliCipamingkis: '',
    hujan: '',
    keterangan: '',
  };
}

// ===== ROLE PERMISSIONS =====
export interface RolePermission {
  debit: boolean;
  curahHujan: boolean;       // HANYA reporter
  media: boolean;
  polygon: 'any' | 'wide' | 'bendung' | 'fixed' | 'point';
  label: string;
}

export const ROLE_PERMISSIONS: Record<UserRole, RolePermission> = {
  supervisor: { debit: true,  curahHujan: false, media: true,  polygon: 'any',     label: 'Supervisor' },
  juru:       { debit: false, curahHujan: false, media: true,  polygon: 'wide',    label: 'Juru'       },
  pob:        { debit: true,  curahHujan: false, media: true,  polygon: 'bendung', label: 'POB'        },
  tpop:       { debit: false, curahHujan: false, media: false, polygon: 'fixed',   label: 'TPOP'       },
  reporter:   { debit: false, curahHujan: true,  media: false, polygon: 'point',   label: 'Pelapor'    },
};

// ===== HELPERS =====
export function normalizeRole(role?: string | null): UserRole | null {
  if (!role) return null;
  const r = role.toLowerCase();
  return r in ROLE_PERMISSIONS ? (r as UserRole) : null;
}

export function canReportDebit(role?: string | null): boolean {
  const r = normalizeRole(role);
  return r ? ROLE_PERMISSIONS[r].debit : false;
}

export function canReportCurahHujan(role?: string | null): boolean {
  const r = normalizeRole(role);
  return r ? ROLE_PERMISSIONS[r].curahHujan : false;
}

export function canReportMedia(role?: string | null): boolean {
  const r = normalizeRole(role);
  return r ? ROLE_PERMISSIONS[r].media : false;
}

export function getRoleLabel(role?: string | null): string {
  const r = normalizeRole(role);
  return r ? ROLE_PERMISSIONS[r].label : (role ?? 'Guest');
}

export function isBendungCategory(category?: string | null): boolean {
  if (!category) return false;
  const c = category.toUpperCase();
  return c === 'BENDUNG' || c.includes('BENDUNG');
}