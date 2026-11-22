/**
 * Pure Fee, Coupon Discount, Installment Scheduling, Expiry & UPI URI Math.
 */

export interface CouponRule {
  code: string;
  type: 'percent' | 'flat';
  value: number;
  minAmount?: number;
  maxDiscount?: number;
  expiresAt?: string;
  active?: boolean;
}

export interface DiscountBreakdown {
  baseAmount: number;
  discountAmount: number;
  finalAmount: number;
  appliedCode: string | null;
  error?: string;
}

export function computeDiscountedFee(
  baseAmount: number,
  coupon: CouponRule | null | undefined,
  nowMs: number = Date.now(),
): DiscountBreakdown {
  const safeBase = Math.max(0, Math.round(baseAmount));
  if (!coupon) {
    return { baseAmount: safeBase, discountAmount: 0, finalAmount: safeBase, appliedCode: null };
  }
  if (coupon.active === false) {
    return {
      baseAmount: safeBase,
      discountAmount: 0,
      finalAmount: safeBase,
      appliedCode: null,
      error: 'Coupon is inactive.',
    };
  }
  if (coupon.expiresAt) {
    const exp = Date.parse(coupon.expiresAt);
    if (!Number.isNaN(exp) && nowMs > exp) {
      return {
        baseAmount: safeBase,
        discountAmount: 0,
        finalAmount: safeBase,
        appliedCode: null,
        error: 'Coupon has expired.',
      };
    }
  }
  if (coupon.minAmount && safeBase < coupon.minAmount) {
    return {
      baseAmount: safeBase,
      discountAmount: 0,
      finalAmount: safeBase,
      appliedCode: null,
      error: `Minimum order amount ₹${coupon.minAmount} required.`,
    };
  }

  let discount =
    coupon.type === 'percent'
      ? Math.round((safeBase * Math.max(0, Math.min(100, coupon.value))) / 100)
      : Math.round(Math.max(0, coupon.value));

  if (coupon.maxDiscount !== undefined && coupon.maxDiscount > 0) {
    discount = Math.min(discount, Math.round(coupon.maxDiscount));
  }
  discount = Math.min(discount, safeBase);

  return {
    baseAmount: safeBase,
    discountAmount: discount,
    finalAmount: Math.max(0, safeBase - discount),
    appliedCode: coupon.code.toUpperCase(),
  };
}

export function computeInstallmentSchedule(totalAmount: number, parts: number): number[] {
  const safeTotal = Math.max(0, Math.round(totalAmount));
  const count = Math.max(1, Math.min(12, Math.floor(parts)));
  const base = Math.floor(safeTotal / count);
  const remainder = safeTotal - base * count;
  const schedule: number[] = [];
  for (let i = 0; i < count; i++) {
    schedule.push(i === 0 ? base + remainder : base);
  }
  return schedule;
}

export function buildUpiPaymentUri(params: {
  upiId: string;
  payeeName: string;
  amount: number;
  note?: string;
}): string {
  const pa = encodeURIComponent(params.upiId.trim());
  const pn = encodeURIComponent(params.payeeName.trim());
  const am = Math.max(0, Number(params.amount) || 0).toFixed(2);
  const tn = encodeURIComponent((params.note || 'RP Skill Portal Fee').trim());
  return `upi://pay?pa=${pa}&pn=${pn}&am=${am}&cu=INR&tn=${tn}`;
}

export function daysUntilExpiry(expiryIso: string | null | undefined, nowMs: number = Date.now()): number | null {
  if (!expiryIso) return null;
  const target = Date.parse(expiryIso);
  if (Number.isNaN(target)) return null;
  return Math.ceil((target - nowMs) / (1000 * 60 * 60 * 24));
}
