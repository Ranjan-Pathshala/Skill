/**
 * Pure Batch Normalization, Access Control, Evaluation Rule Matching & Maintenance Logic.
 */

export function normalizeBatchList(rawBatch: unknown): string[] {
  if (!rawBatch) return [];
  const items = Array.isArray(rawBatch)
    ? rawBatch
    : String(rawBatch)
        .split(/[,;|]+/)
        .map((s) => s.trim());

  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of items) {
    const clean = String(item || '').trim();
    if (!clean) continue;
    const key = clean.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      out.push(clean);
    }
  }
  return out;
}

export interface MemberBatchAccessInput {
  userRole?: string;
  userBatches?: unknown;
  materialBatch?: unknown;
  memberAccessScope?: 'all' | 'batch_only' | 'restricted';
  allowedBatchNames?: unknown;
}

export function evaluateMemberBatchAccess(input: MemberBatchAccessInput): boolean {
  const role = String(input.userRole || '').toLowerCase();
  if (role === 'admin' || role === 'superadmin') return true;

  const targetBatches = normalizeBatchList(input.materialBatch);
  // Public / All-batch content
  if (
    targetBatches.length === 0 ||
    targetBatches.some((b) => ['all', 'public', 'everyone', 'global'].includes(b.toLowerCase()))
  ) {
    return true;
  }

  const scope = input.memberAccessScope ?? 'batch_only';
  if (scope === 'all') return true;

  const userBatchSet = new Set(
    [
      ...normalizeBatchList(input.userBatches),
      ...normalizeBatchList(input.allowedBatchNames),
    ].map((b) => b.toLowerCase()),
  );

  return targetBatches.some((tb) => userBatchSet.has(tb.toLowerCase()));
}

export interface MaintenanceConfig {
  enabled?: boolean;
  siteWide?: boolean;
  lockedTabs?: string[];
  startIso?: string;
  endIso?: string;
  message?: string;
}

export function evaluateMaintenanceWindow(
  config: MaintenanceConfig | null | undefined,
  tabId: string,
  userRole: string,
  nowMs: number = Date.now(),
): { blocked: boolean; reason: string } {
  if (!config || !config.enabled) return { blocked: false, reason: '' };
  const role = String(userRole || '').toLowerCase();
  if (role === 'admin' || role === 'superadmin') return { blocked: false, reason: '' };

  if (config.startIso) {
    const start = Date.parse(config.startIso);
    if (!Number.isNaN(start) && nowMs < start) return { blocked: false, reason: '' };
  }
  if (config.endIso) {
    const end = Date.parse(config.endIso);
    if (!Number.isNaN(end) && nowMs > end) return { blocked: false, reason: '' };
  }

  const msg = config.message || 'Scheduled maintenance is in progress. Please check back shortly.';
  if (config.siteWide) return { blocked: true, reason: msg };

  const locked = Array.isArray(config.lockedTabs)
    ? config.lockedTabs.map((t) => String(t).toLowerCase())
    : [];
  if (locked.includes(String(tabId || '').toLowerCase())) {
    return { blocked: true, reason: msg };
  }
  return { blocked: false, reason: '' };
}

export function parseBooleanFlag(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0 && !Number.isNaN(value);
  if (typeof value === 'string') {
    const norm = value.trim().toLowerCase();
    if (!norm || norm === 'false' || norm === '0' || norm === 'no' || norm === 'off' || norm === 'null' || norm === 'undefined') {
      return false;
    }
    if (norm === 'true' || norm === '1' || norm === 'yes' || norm === 'on') {
      return true;
    }
  }
  return false;
}

export interface StudentTabPermissionUser {
  role?: unknown;
  Role?: unknown;
  studentTabPermissions?: unknown;
  StudentTabPermissions?: unknown;
  allowedTabs?: unknown;
  preferences?: {
    allowedPortalTabs?: unknown;
    [key: string]: unknown;
  } | null;
  [key: string]: unknown;
}

export function resolveAllowedStudentPortalTabs(
  userObj: StudentTabPermissionUser | null | undefined,
  allTabs: readonly string[],
): string[] {
  const allList = Array.from(allTabs);
  if (!userObj) return allList;

  const roleStr = String(userObj.role ?? userObj.Role ?? 'user').toLowerCase().trim();
  if (roleStr === 'superadmin') return allList;

  const rawPerms =
    userObj.studentTabPermissions ??
    userObj.StudentTabPermissions ??
    userObj.preferences?.allowedPortalTabs ??
    userObj.allowedTabs ??
    '';

  if (rawPerms === null || rawPerms === undefined || rawPerms === '') {
    return allList;
  }

  const parsed = Array.isArray(rawPerms)
    ? rawPerms.map((s) => String(s ?? '').trim().toLowerCase()).filter(Boolean)
    : String(rawPerms)
        .split(/[,;|]+/)
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean);

  if (
    parsed.length === 0 ||
    parsed.includes('all') ||
    parsed.includes('*') ||
    parsed.includes('all_tabs')
  ) {
    return allList;
  }

  const allowed = new Set<string>(parsed);
  allowed.add('dashboard');
  allowed.add('profile');
  allowed.add('buy-plans');

  // Keep companion dedicated views accessible when their parent feature tab is allowed
  if (allowed.has('words')) allowed.add('weak-vault');
  if (allowed.has('cbttest')) allowed.add('cbt-revision');
  if (allowed.has('batch-leaderboard')) allowed.add('batchhub');
  if (allowed.has('test') || allowed.has('dashboard')) allowed.add('attendance-matrix');

  return Array.from(allowed);
}

