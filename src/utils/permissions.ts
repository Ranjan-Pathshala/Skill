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
