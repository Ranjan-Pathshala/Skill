// @ts-nocheck
/**
 * RP Skill Portal — Buy Batches & Member Plans, UPI Checkout, Coupons, Receipts & Ledgers
 * Clean Vite ES module (zero layered monkey-patch conflicts).
 */

import { portalState } from '../core/state.ts';
import { onDomReady } from '../core/domReady.ts';
import { escapeHtml } from '../utils/formatting.ts';
import { getInstituteBatchesList, getUserAssignedBatchesList, loadAdminData, safeNotify, userHasBatchAssigned } from './adminPanel.js';
import { closeAllDeviceNavMenu, navigateTo } from './authAndNavigation.js';
import { apiCall, mountServerPaginationToolbar, showToast, syncPublicHeaderThemeToggle } from './apiAndCore.js';


export let _selectedStudentFeePlan = null;

export let _activeBuyPlansSubtab = 'plans';

export let _studentHistoryFilter = 'ALL';

export let _adminFeeBuilderState = null;

export let _activePrintableReceiptRecord = null;

export const MEMBER_SCOPE_LABELS = {
    'ALL_PAST_CURRENT_UPCOMING': 'All Batches (Past + Current + Upcoming)',
    'ALL_EXISTING_ONLY': 'All Existing Batches Only (Excludes Future)',
    'CURRENT_AND_UPCOMING': 'Current & All Upcoming Batches',
    'CUSTOM_SELECTED': 'Specific Selected Batches'
  };

export function normalizeFeeStatusDisplay(rawStatus) {
    const s = String(rawStatus || 'Pending').trim().toLowerCase();
    if (s === 'approved' || s === 'verified' || s === 'paid') return 'Approved';
    if (s === 'rejected' || s === 'declined' || s === 'failed') return 'Rejected';
    return 'Pending';
  }

export function renderFeeStatusBadgeHtml(rawStatus) {
    const st = normalizeFeeStatusDisplay(rawStatus);
    const cls = st === 'Approved' ? 'is-approved' : (st === 'Rejected' ? 'is-rejected' : 'is-pending');
    const icon = st === 'Approved' ? 'fa-circle-check' : (st === 'Rejected' ? 'fa-circle-xmark' : 'fa-clock');
    return `<span class="rp-fee-status-badge ${cls}"><i class="fa-solid ${icon}"></i> ${st}</span>`;
  }

export function formatScopeSummary(scope, includedBatches, includeUpcoming) {
    const sc = String(scope || 'ALL_PAST_CURRENT_UPCOMING').toUpperCase();
    if (sc === 'CUSTOM_SELECTED') {
      const list = Array.isArray(includedBatches)
        ? includedBatches.join(', ')
        : String(includedBatches || '').trim();
      const base = list ? `Batches: ${list}` : 'Custom Batches';
      return includeUpcoming ? `${base} + All Upcoming` : base;
    }
    return MEMBER_SCOPE_LABELS[sc] || sc;
  }

export function formatReadableFeeDate(rawVal) {
    const s = String(rawVal || '').trim();
    if (!s || s === '-') return '-';
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    const d = new Date(s);
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    }
    return s;
  }

export function getResolvedFeeConfig() {
    const raw = (typeof portalState.adminData !== 'undefined' && portalState.adminData && portalState.adminData.feeConfig)
      || (typeof portalState.globalData !== 'undefined' && portalState.globalData && portalState.globalData.feeConfig)
      || {};

    const upiId = String(raw.upiId || '').trim();
    const payeeName = String(raw.payeeName || 'Ranjan Pathshala').trim();
    const qrImageUrl = String(raw.qrImageUrl || '').trim();
    const paymentInstructions = String(raw.paymentInstructions || raw.instructions || 'Pay via any UPI app (GPay / PhonePe / Paytm), then enter your 12-digit UTR / Transaction Reference ID below for verification.').trim();

    // Resolve multi-plan Member Tiers
    let memberPlans = [];
    if (Array.isArray(raw.memberPlans) && raw.memberPlans.length > 0) {
      memberPlans = raw.memberPlans.map((p, idx) => ({
        id: String(p.id || ('MP-' + (idx + 1))),
        name: String(p.name || 'Member Plan').trim(),
        amount: Math.max(0, Number(p.amount || 0) || 0),
        validityDays: Math.max(1, Number(p.validityDays || 365) || 365),
        accessScope: String(p.accessScope || 'ALL_PAST_CURRENT_UPCOMING').trim().toUpperCase(),
        includedBatches: Array.isArray(p.includedBatches) ? p.includedBatches.join(', ') : String(p.includedBatches || '').trim(),
        includeUpcoming: Boolean(p.includeUpcoming || p.accessScope === 'ALL_PAST_CURRENT_UPCOMING' || p.accessScope === 'CURRENT_AND_UPCOMING'),
        description: String(p.description || '').trim()
      })).filter(p => p.name);
    } else {
      const legacyAmt = Math.max(0, Number(raw.memberFee || raw.memberFeeAmount || 0) || 0);
      if (legacyAmt > 0) {
        memberPlans = [{
          id: 'MP-1',
          name: String(raw.memberPlanTitle || 'Member All-Access Pass').trim(),
          amount: legacyAmt,
          validityDays: Math.max(1, Number(raw.memberValidityDays || 365) || 365),
          accessScope: 'ALL_PAST_CURRENT_UPCOMING',
          includedBatches: '',
          includeUpcoming: true,
          description: String(raw.memberDescription || raw.memberPlanDescription || 'Unlocks all past, current, and upcoming batches.').trim()
        }];
      }
    }

    // Resolve multi-plan per-Batch pricing (with Installment support)
    const batchPlans = {};
    if (raw.batchPlans && typeof raw.batchPlans === 'object') {
      Object.keys(raw.batchPlans).forEach((bName) => {
        const cleanB = String(bName || '').trim();
        if (!cleanB || cleanB.toLowerCase() === 'rp-trail') return;
        const arr = Array.isArray(raw.batchPlans[bName]) ? raw.batchPlans[bName] : [];
        batchPlans[cleanB] = arr.map((p, idx) => ({
          id: String(p.id || ('BP-' + (idx + 1))),
          name: String(p.name || 'Standard Plan').trim(),
          amount: Math.max(0, Number(p.amount || 0) || 0),
          validityDays: Math.max(1, Number(p.validityDays || 90) || 90),
          note: String(p.note || p.description || '').trim(),
          allowInstallments: Boolean(p.allowInstallments),
          installmentCount: Math.max(2, Math.min(4, Number(p.installmentCount || 2) || 2)),
          firstInstallmentPercent: Math.max(20, Math.min(80, Number(p.firstInstallmentPercent || 50) || 50))
        }));
      });
    }
    // Mirror any legacy batchFees not present in batchPlans
    if (raw.batchFees && typeof raw.batchFees === 'object') {
      Object.keys(raw.batchFees).forEach((bName) => {
        const cleanB = String(bName || '').trim();
        if (!cleanB || cleanB.toLowerCase() === 'rp-trail') return;
        if (!batchPlans[cleanB] || batchPlans[cleanB].length === 0) {
          const entry = raw.batchFees[bName];
          const amt = typeof entry === 'object' ? Math.max(0, Number(entry.amount || 0) || 0) : Math.max(0, Number(entry || 0) || 0);
          const days = typeof entry === 'object' ? Math.max(1, Number(entry.validityDays || 90) || 90) : 90;
          const note = typeof entry === 'object' ? String(entry.note || entry.description || '').trim() : '';
          const allowInst = typeof entry === 'object' ? Boolean(entry.allowInstallments) : false;
          if (amt > 0 || note) {
            batchPlans[cleanB] = [{
              id: 'BP-1',
              name: 'Full Batch Plan',
              amount: amt,
              validityDays: days,
              note,
              allowInstallments: allowInst,
              installmentCount: 2,
              firstInstallmentPercent: 50
            }];
          }
        }
      });
    }

    // Resolve Promo / Discount Coupons
    const coupons = Array.isArray(raw.coupons)
      ? raw.coupons.map((c) => ({
          code: String(c.code || '').trim().toUpperCase().replace(/[^A-Z0-9_-]/g, ''),
          discountType: String(c.discountType || 'FLAT').toUpperCase() === 'PERCENT' ? 'PERCENT' : 'FLAT',
          value: Math.max(0, Number(c.value || 0) || 0),
          appliesTo: ['BATCH', 'MEMBER'].includes(String(c.appliesTo || 'ALL').toUpperCase())
            ? String(c.appliesTo).toUpperCase()
            : 'ALL',
          minAmount: Math.max(0, Number(c.minAmount || 0) || 0),
          maxUses: Math.max(0, parseInt(c.maxUses || 0, 10) || 0),
          usedCount: Math.max(0, parseInt(c.usedCount || 0, 10) || 0),
          validUntil: String(c.validUntil || '').trim().slice(0, 10),
          active: c.active !== false,
          note: String(c.note || '').trim()
        })).filter(c => c.code)
      : [];

    return {
      upiId,
      payeeName,
      qrImageUrl,
      paymentInstructions,
      instructions: paymentInstructions,
      memberPlans,
      batchPlans,
      coupons,
      memberFeeAmount: memberPlans[0] ? memberPlans[0].amount : Math.max(0, Number(raw.memberFee || raw.memberFeeAmount || 0) || 0),
      memberValidityDays: memberPlans[0] ? memberPlans[0].validityDays : Math.max(1, Number(raw.memberValidityDays || 365) || 365),
      memberPlanTitle: memberPlans[0] ? memberPlans[0].name : String(raw.memberPlanTitle || 'Member All-Access Pass').trim(),
      memberPlanDescription: memberPlans[0] ? memberPlans[0].description : String(raw.memberDescription || '').trim()
    };
  }

window.getResolvedFeeConfig = getResolvedFeeConfig;

export function evaluateFeeCouponLocally(cfg, rawCode, feeType, baseAmount) {
    const code = String(rawCode || '').trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');
    const amt = Math.max(0, Number(baseAmount || 0) || 0);
    if (!code) return { valid: false, message: 'Enter a promo coupon code first.' };
    const found = (cfg.coupons || []).find(c => String(c.code || '').toUpperCase() === code);
    if (!found || !found.active) return { valid: false, message: `Coupon "${code}" is invalid or inactive.` };
    const normType = String(feeType || 'batch').toLowerCase().includes('member') ? 'MEMBER' : 'BATCH';
    if (found.appliesTo !== 'ALL' && found.appliesTo !== normType) {
      return { valid: false, message: `Coupon "${code}" applies only to ${found.appliesTo === 'MEMBER' ? 'Member Plans' : 'Batch Plans'}.` };
    }
    if (found.validUntil) {
      const exp = new Date(found.validUntil + 'T23:59:59');
      if (!isNaN(exp.getTime()) && Date.now() > exp.getTime()) {
        return { valid: false, message: `Coupon "${code}" expired on ${found.validUntil}.` };
      }
    }
    if (found.maxUses > 0 && found.usedCount >= found.maxUses) {
      return { valid: false, message: `Coupon "${code}" has reached its redemption limit.` };
    }
    if (found.minAmount > 0 && amt < found.minAmount) {
      return { valid: false, message: `Minimum fee of ₹${found.minAmount.toLocaleString('en-IN')} required for "${code}".` };
    }
    let discount = found.discountType === 'PERCENT'
      ? Math.round((amt * Math.min(100, found.value)) / 100)
      : Math.round(found.value);
    discount = Math.max(0, Math.min(amt, discount));
    return {
      valid: true,
      code,
      discountAmount: discount,
      netAmount: Math.max(0, amt - discount),
      message: `Coupon "${code}" applied! You save ₹${discount.toLocaleString('en-IN')}.`
    };
  }

export function isZeroFeeLedgerRecord(rec) {
    if (!rec || typeof rec !== 'object') return false;
    const rawAmt = Number(rec.AmountPaid);
    if (!Number.isNaN(rawAmt) && rawAmt === 0) return true;
    const utr = String(rec.UTR || '').trim().toUpperCase();
    const mode = String(rec.PaymentMode || '').trim();
    const remarks = String(rec.Remarks || '').trim();
    const inst = String(rec.InstallmentLabel || rec.InstallmentNo || '').trim();
    if (remarks.includes('[₹0_FREE]') || remarks.includes('[ZERO_FEE]')) return true;
    if (utr.startsWith('FREE-')) return true;
    if (mode.includes('₹0') || inst.includes('₹0')) return true;
    const totalFee = Number(rec.TotalPlanFee || 0) || 0;
    const discAmt = Number(rec.DiscountAmount || 0) || 0;
    if (totalFee > 0 && discAmt >= totalFee) return true;
    return false;
  }

export function getEffectiveFeeAmountPaid(rec) {
    if (isZeroFeeLedgerRecord(rec)) return 0;
    return Math.max(0, Number(rec && rec.AmountPaid ? rec.AmountPaid : 0) || 0);
  }

export function getEffectiveFeeRemainingBalance(rec) {
    if (isZeroFeeLedgerRecord(rec)) return 0;
    if (!rec || typeof rec !== 'object') return 0;
    return Math.max(0, Number(rec.RemainingBalance !== undefined && rec.RemainingBalance !== '' && rec.RemainingBalance !== '-' ? rec.RemainingBalance : (rec.DueAmount || 0)) || 0);
  }

export function cleanFeeRemarksForDisplay(rawRemarks) {
    const s = String(rawRemarks || '')
      .replace(/\[₹0_FREE\]/g, '')
      .replace(/\[ZERO_FEE\]/g, '')
      .trim();
    return s === '-' ? '' : s;
  }

export function computeStudentBatchInstallmentLedger(userId) {
    const map = {};
    const rows = (portalState.globalData && Array.isArray(portalState.globalData.userFeeReceipts)) ? portalState.globalData.userFeeReceipts : [];
    rows.forEach((r) => {
      if (userId && r.UserID && String(r.UserID) !== String(userId)) return;
      const isMem = String(r.FeeType || '').toLowerCase().includes('member');
      if (isMem) return;
      const st = normalizeFeeStatusDisplay(r.Status);
      if (st !== 'Approved') return;
      const bName = String(r.Batch || '').trim();
      if (!bName || bName.toLowerCase() === 'rp-trail') return;
      const isZeroRec = isZeroFeeLedgerRecord(r);
      const paid = getEffectiveFeeAmountPaid(r);
      const total = isZeroRec ? 0 : Math.max(paid, Number(r.TotalPlanFee || 0) || 0);
      const rem = getEffectiveFeeRemainingBalance(r);
      if (!map[bName]) {
        map[bName] = {
          batchName: bName,
          planName: r.PlanName || 'Batch Plan',
          validityDays: Number(r.ValidityDays || 90) || 90,
          totalPlanFee: total,
          totalPaid: 0,
          remainingBalance: 0,
          installmentsPaidCount: 0,
          lastReceiptNo: r.ReceiptNo || r.ReceiptID || ''
        };
      }
      map[bName].totalPaid += paid;
      if (total > map[bName].totalPlanFee) map[bName].totalPlanFee = total;
      map[bName].installmentsPaidCount += 1;
      if (r.PlanName) map[bName].planName = r.PlanName;
      map[bName].lastReceiptNo = r.ReceiptNo || r.ReceiptID || map[bName].lastReceiptNo;
      if (isZeroRec) {
        map[bName].remainingBalance = 0;
      } else {
        map[bName].remainingBalance = Math.max(0, Math.min(rem > 0 ? rem : Math.max(0, map[bName].totalPlanFee - map[bName].totalPaid), Math.max(0, map[bName].totalPlanFee - map[bName].totalPaid)));
      }
    });
    return map;
  }

export function buildUpiPaymentLink(upiId, payeeName, amount, note) {
    if (!upiId) return '';
    const params = [
      `pa=${encodeURIComponent(upiId)}`,
      `pn=${encodeURIComponent(payeeName || 'Ranjan Pathshala')}`,
      `cu=INR`,
      `tn=${encodeURIComponent(note || 'RP Skill Fee')}`
    ];
    if (Number(amount) > 0) params.push(`am=${encodeURIComponent(String(Number(amount)))}`);
    return `upi://pay?${params.join('&')}`;
  }

export function buildQrCodeImgSrc(cfg, upiLink) {
    if (cfg && cfg.qrImageUrl && /^https?:\/\//i.test(cfg.qrImageUrl)) {
      return cfg.qrImageUrl;
    }
    if (!upiLink) return '';
    return `https://api.qrserver.com/v1/create-qr-code/?size=210x210&margin=6&data=${encodeURIComponent(upiLink)}`;
  }

export function parseLocalExpiryDate(rawDateStr) {
    const s = String(rawDateStr || '').trim();
    if (!s || s === '-' || s.toLowerCase() === 'pending approval' || s.toLowerCase() === 'lifetime') return null;
    const ymd = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (ymd) {
      return new Date(Number(ymd[1]), Number(ymd[2]) - 1, Number(ymd[3]), 23, 59, 59);
    }
    const parsed = new Date(s);
    return isNaN(parsed.getTime()) ? null : parsed;
  }

window.renderDashboardExpiryRenewalAlert = function () {
    const banner = document.getElementById('dashboard-plan-expiry-alert-banner');
    if (!banner) return;
    const cu = typeof portalState.currentUser !== 'undefined' ? portalState.currentUser : null;
    if (!cu || !cu.userId) {
      banner.style.display = 'none';
      banner.innerHTML = '';
      return;
    }
    const roleLow = String(cu.role || '').toLowerCase();
    if (roleLow === 'admin' || roleLow === 'superadmin') {
      banner.style.display = 'none';
      banner.innerHTML = '';
      return;
    }

    const now = new Date();
    const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const alerts = [];

    const isMember = roleLow === 'member' || Boolean(cu.isMemberAllAccess) || Boolean(cu.membershipValidUntil);
    if (isMember && cu.membershipValidUntil) {
      const exp = parseLocalExpiryDate(cu.membershipValidUntil);
      if (exp) {
        const expMidnight = new Date(exp.getFullYear(), exp.getMonth(), exp.getDate()).getTime();
        const daysLeft = Math.round((expMidnight - todayMidnight) / 86400000);
        if (daysLeft <= 7) {
          alerts.push({
            feeType: 'member',
            batchName: 'ALL_BATCHES',
            planName: cu.membershipPlan || 'Member All-Access Pass',
            validUntil: String(cu.membershipValidUntil).slice(0, 10),
            daysLeft
          });
        }
      }
    }

    if (cu.enrollmentValidUntil) {
      const userBatches = typeof getUserAssignedBatchesList === 'function'
        ? getUserAssignedBatchesList(cu.userId, cu.batch || cu.Batch || '')
        : [cu.batch || 'RP-Trail'];
      const paidBatch = userBatches.find(b => b && b.toLowerCase() !== 'rp-trail');
      const exp = parseLocalExpiryDate(cu.enrollmentValidUntil);
      if (paidBatch && exp) {
        const expMidnight = new Date(exp.getFullYear(), exp.getMonth(), exp.getDate()).getTime();
        const daysLeft = Math.round((expMidnight - todayMidnight) / 86400000);
        if (daysLeft <= 7) {
          alerts.push({
            feeType: 'batch',
            batchName: paidBatch,
            planName: paidBatch,
            validUntil: String(cu.enrollmentValidUntil).slice(0, 10),
            daysLeft
          });
        }
      }
    }

    if (alerts.length === 0) {
      banner.style.display = 'none';
      banner.innerHTML = '';
      return;
    }

    // Show the most urgent expiring plan first
    alerts.sort((a, b) => a.daysLeft - b.daysLeft);
    const primary = alerts[0];
    const isExpired = primary.daysLeft < 0;
    const isToday = primary.daysLeft === 0;
    const urgencyText = isExpired
      ? `Expired ${Math.abs(primary.daysLeft)} day${Math.abs(primary.daysLeft) === 1 ? '' : 's'} ago (${primary.validUntil})`
      : isToday
        ? `Expires Today (${primary.validUntil})`
        : `Expires in ${primary.daysLeft} day${primary.daysLeft === 1 ? '' : 's'} (${primary.validUntil})`;

    const safeType = escapeHtml(primary.feeType).replace(/'/g, "\\'");
    const safeBatch = escapeHtml(primary.batchName).replace(/'/g, "\\'");
    const safePlan = escapeHtml(primary.planName).replace(/'/g, "\\'");

    banner.style.display = 'block';
    banner.innerHTML = `
      <div class="rp-expiry-renewal-banner ${isExpired ? 'is-expired' : 'is-expiring'}">
        <div style="display:flex; align-items:flex-start; gap:12px; min-width:0;">
          <div class="rp-expiry-icon-wrap">
            <i class="fa-solid ${isExpired ? 'fa-triangle-exclamation' : 'fa-hourglass-half'}"></i>
          </div>
          <div style="min-width:0;">
            <div style="font-size:13px; font-weight:800; color:var(--secondary);">
              ${primary.feeType === 'member' ? 'Member Plan' : 'Batch Plan'} Renewal Notice: <span style="color:${isExpired ? '#b91c1c' : '#b45309'};">${escapeHtml(primary.planName)}</span>
            </div>
            <div style="font-size:12px; color:var(--text-muted); margin-top:2px;">
              <strong>${escapeHtml(urgencyText)}</strong> — Renew now to keep uninterrupted access to dictations, mocks, and batch materials.
            </div>
          </div>
        </div>
        <div style="display:flex; align-items:center; gap:8px; flex-shrink:0;">
          <button type="button" class="btn btn-sm ${isExpired ? 'btn-danger' : 'btn-primary'}" onclick="window.triggerOneClickPlanRenewal('${safeType}', '${safeBatch}', '${safePlan}')">
            <i class="fa-solid fa-rotate"></i> Renew Plan
          </button>
        </div>
      </div>
    `;
  };

window.triggerOneClickPlanRenewal = async function (feeType, batchName, planName) {
    if (typeof navigateTo === 'function') {
      navigateTo('buy-plans');
    }
    _activeBuyPlansSubtab = 'plans';
    if (typeof window.switchBuyPlansSubtab === 'function') {
      window.switchBuyPlansSubtab('plans');
    }
    const cfg = getResolvedFeeConfig();
    const isMem = String(feeType || '').toLowerCase().includes('member');
    if (isMem) {
      const matched = (cfg.memberPlans || []).find(p => String(p.name || '').toLowerCase() === String(planName || '').toLowerCase()) || (cfg.memberPlans || [])[0];
      if (matched && matched.amount > 0) {
        setTimeout(() => {
          window.openStudentUpiFeeCheckout('member', 'ALL_BATCHES', matched.amount, matched.name, matched.validityDays, matched.name, 'buy-plans-upi-checkout-panel', { isRenewal: true });
        }, 120);
      } else {
        safeNotify('Please choose a Member Plan below to renew your membership.');
      }
    } else {
      const plans = (cfg.batchPlans && cfg.batchPlans[batchName]) ? cfg.batchPlans[batchName] : [];
      const matched = plans.find(p => String(p.name || '').toLowerCase() === String(planName || '').toLowerCase()) || plans[0];
      if (matched && matched.amount > 0) {
        setTimeout(() => {
          window.openStudentUpiFeeCheckout('batch', batchName, matched.amount, `${batchName} — ${matched.name}`, matched.validityDays, matched.name, 'buy-plans-upi-checkout-panel', {
            allowInstallments: Boolean(matched.allowInstallments),
            firstInstallmentPercent: matched.firstInstallmentPercent || 50,
            isRenewal: true
          });
        }, 120);
      } else {
        safeNotify(`Please select a pricing plan for ${batchName} below to renew.`);
      }
    }
  };

window.switchBuyPlansSubtab = function (subtab, btnEl) {
    _activeBuyPlansSubtab = (subtab === 'history') ? 'history' : 'plans';
    const plansWrap = document.getElementById('buy-plans-subtab-plans');
    const histWrap = document.getElementById('view-fee-payment-history');
    const plansPanel = document.getElementById('buy-plans-catalog-mount');
    const histPanel = document.getElementById('buy-plans-history-mount');

    if (plansWrap) plansWrap.style.display = 'flex';
    if (histWrap) histWrap.style.display = 'flex';
    if (plansPanel) plansPanel.style.display = 'block';
    if (histPanel) histPanel.style.display = 'block';

    if (typeof window.switchProfileSubtab === 'function') {
      window.switchProfileSubtab(_activeBuyPlansSubtab === 'history' ? 'history' : 'buy-plans');
    } else if (_activeBuyPlansSubtab === 'plans') {
      window.renderBuyPlansCatalog('buy-plans-catalog-mount', false);
    } else {
      window.renderFeePaymentHistorySubtab('buy-plans-history-mount', true);
    }
  };

window.refreshBuyPlansView = async function (forceFetch = false) {
    if (forceFetch && typeof apiCall === 'function') {
      const cfgRes = await apiCall('getFeeConfig', {}, true);
      if (cfgRes && cfgRes.success && cfgRes.feeConfig) {
        portalState.globalData = portalState.globalData || {};
        portalState.globalData.feeConfig = cfgRes.feeConfig;
      }
    }
    if (_activeBuyPlansSubtab === 'history') {
      await window.renderFeePaymentHistorySubtab('buy-plans-history-mount', true);
    } else {
      await window.renderBuyPlansCatalog('buy-plans-catalog-mount', forceFetch);
    }
  };

window.selectBatchPlanChip = function (batchIdx, planIdx) {
    const card = document.querySelector(`[data-buy-batch-card="${batchIdx}"]`);
    if (!card) return;
    card.querySelectorAll('.rp-plan-chip-btn').forEach((b) => {
      b.classList.toggle('is-selected', b.getAttribute('data-plan-idx') === String(planIdx));
    });
    const activeChip = card.querySelector(`.rp-plan-chip-btn[data-plan-idx="${planIdx}"]`);
    if (!activeChip) return;
    const amt = Number(activeChip.getAttribute('data-amt') || 0);
    const days = Number(activeChip.getAttribute('data-days') || 90);
    const planName = activeChip.getAttribute('data-plan-name') || 'Standard Plan';
    const note = activeChip.getAttribute('data-note') || '';
    const allowInst = activeChip.getAttribute('data-inst') === '1';
    const firstPct = Number(activeChip.getAttribute('data-inst-pct') || 50) || 50;
    const bName = card.getAttribute('data-batch-name') || '';

    const priceEl = card.querySelector('.rp-batch-active-price');
    const daysEl = card.querySelector('.rp-batch-active-days');
    const noteEl = card.querySelector('.rp-batch-active-note');
    const instBadgeEl = card.querySelector('.rp-batch-inst-badge');
    const payBtn = card.querySelector('.rp-batch-pay-cta');
    const isZeroFreePlan = amt <= 0;
    if (priceEl) priceEl.textContent = isZeroFreePlan ? '₹0 (Free)' : ('₹' + amt.toLocaleString('en-IN'));
    if (daysEl) daysEl.textContent = `${planName} · ${days} days validity`;
    if (noteEl && note) noteEl.textContent = note;
    if (instBadgeEl) {
      instBadgeEl.style.display = allowInst && amt > 0 ? 'inline-flex' : 'none';
    }
    if (payBtn) {
      payBtn.disabled = false;
      const alreadyEnrolled = card.classList.contains('is-enrolled');
      payBtn.innerHTML = isZeroFreePlan
        ? `<i class="fa-solid fa-paper-plane"></i> Request Free (₹0)`
        : `<i class="fa-solid fa-indian-rupee-sign"></i> ${alreadyEnrolled ? 'Renew Plan' : 'Buy Batch'}`;
      payBtn.onclick = () => window.openStudentUpiFeeCheckout('batch', bName, amt, `${bName} — ${planName}`, days, planName, 'buy-plans-upi-checkout-panel', {
        allowInstallments: allowInst && !isZeroFreePlan,
        firstInstallmentPercent: firstPct
      });
    }
  };

window.renderBuyPlansCatalog = async function (mountId = 'buy-plans-catalog-mount', forceFetch = false) {
    const mount = document.getElementById(mountId);
    if (!mount) return;
    const cu = typeof portalState.currentUser !== 'undefined' ? portalState.currentUser : null;
    if (!cu || !cu.userId) {
      mount.innerHTML = '<div class="card"><div style="font-size:13px; color:var(--text-muted);">Please log in to view available Batch Plans and Member Passes.</div></div>';
      return;
    }

    if (forceFetch && typeof apiCall === 'function') {
      mount.innerHTML = '<div class="card" style="text-align:center; padding:26px;"><span class="mini-spin"></span> <span style="font-size:13px; font-weight:700; color:var(--primary); margin-left:6px;">Loading latest Batch &amp; Member Plans...</span></div>';
      const [cfgRes, ledRes] = await Promise.all([
        apiCall('getFeeConfig', {}, true),
        apiCall('getFeeLedger', { userId: cu.userId }, true)
      ]);
      portalState.globalData = portalState.globalData || {};
      if (cfgRes && cfgRes.success && cfgRes.feeConfig) portalState.globalData.feeConfig = cfgRes.feeConfig;
      if (ledRes && ledRes.success && Array.isArray(ledRes.ledger || ledRes.rows)) {
        portalState.globalData.userFeeReceipts = ledRes.ledger || ledRes.rows;
      }
    }

    const cfg = getResolvedFeeConfig();
    const userBatches = typeof getUserAssignedBatchesList === 'function'
      ? getUserAssignedBatchesList(cu.userId, cu.batch || cu.Batch || '')
      : ['RP-Trail'];
    const customBatches = typeof getInstituteBatchesList === 'function'
      ? getInstituteBatchesList().filter((b) => b && b.toLowerCase() !== 'rp-trail' && b.toLowerCase() !== 'general batch' && b.toLowerCase() !== 'free tier')
      : [];
    const allBatchNames = Array.from(new Set([...customBatches, ...Object.keys(cfg.batchPlans || {})])).filter((b) => b && b.toLowerCase() !== 'rp-trail');
    const installmentMap = computeStudentBatchInstallmentLedger(cu.userId);

    const roleLow = String(cu.role || '').toLowerCase();
    const isActiveMember = roleLow === 'member' || Boolean(cu.isMemberAllAccess);
    const memberScopeText = isActiveMember
      ? formatScopeSummary(cu.memberAccessScope, cu.memberIncludedBatches, cu.memberIncludeUpcoming)
      : '';

    const activeCouponsCount = (cfg.coupons || []).filter((c) => {
      if (!c.active) return false;
      if (c.validUntil && Date.now() > new Date(c.validUntil + 'T23:59:59').getTime()) return false;
      if (c.maxUses > 0 && c.usedCount >= c.maxUses) return false;
      return true;
    }).length;

    const statusBannerHtml = `
      <div class="card" style="margin-bottom:16px; border-left:4px solid ${isActiveMember ? '#10b981' : 'var(--primary)'}; padding:14px 18px;">
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
          <div>
            ${isActiveMember
              ? `<div style="font-size:13.5px; font-weight:800; color:#047857;"><i class="fa-solid fa-crown"></i> Active Member: ${escapeHtml(cu.membershipPlan || 'Member Pass')}${cu.membershipValidUntil ? ` · Valid till ${escapeHtml(cu.membershipValidUntil)}` : ''}</div>
                 <div style="font-size:12px; color:var(--text-muted); margin-top:2px;">Batch Access Scope: <strong style="color:var(--secondary);">${escapeHtml(memberScopeText)}</strong></div>`
              : `<div style="font-size:13.5px; font-weight:800; color:var(--secondary);">Your Current Batches: <span style="color:var(--primary);">${escapeHtml(userBatches.join(', '))}</span>${cu.enrollmentValidUntil ? ` · Valid till ${escapeHtml(cu.enrollmentValidUntil)}` : ''}</div>
                 <div style="font-size:12px; color:var(--text-muted); margin-top:2px;">Permanent Free Batch <strong>RP-Trail (₹0)</strong> always stays active alongside any paid batch or membership.${activeCouponsCount > 0 ? ` · <strong style="color:#047857;"><i class="fa-solid fa-tag"></i> Promo coupons available at checkout!</strong>` : ''}</div>`
            }
          </div>
          <button type="button" class="btn btn-secondary btn-sm" onclick="window.switchBuyPlansSubtab('history')">
            <i class="fa-solid fa-receipt"></i> View Fee Payment History
          </button>
        </div>
      </div>
    `;

    const batchColorThemes = [
      {
        accent: '#2563eb',
        border: 'rgba(37, 99, 235, 0.32)',
        gradient: 'linear-gradient(135deg, #2563eb 0%, #06b6d4 100%)',
        bg: 'linear-gradient(165deg, rgba(37, 99, 235, 0.08) 0%, rgba(6, 182, 212, 0.04) 48%, var(--surface) 100%)',
        icon: 'fa-graduation-cap'
      },
      {
        accent: '#059669',
        border: 'rgba(5, 150, 105, 0.32)',
        gradient: 'linear-gradient(135deg, #059669 0%, #14b8a6 100%)',
        bg: 'linear-gradient(165deg, rgba(5, 150, 105, 0.08) 0%, rgba(20, 184, 166, 0.04) 48%, var(--surface) 100%)',
        icon: 'fa-bolt'
      },
      {
        accent: '#ea580c',
        border: 'rgba(234, 88, 12, 0.32)',
        gradient: 'linear-gradient(135deg, #ea580c 0%, #f59e0b 100%)',
        bg: 'linear-gradient(165deg, rgba(234, 88, 12, 0.08) 0%, rgba(245, 158, 11, 0.04) 48%, var(--surface) 100%)',
        icon: 'fa-fire'
      },
      {
        accent: '#e11d48',
        border: 'rgba(225, 29, 72, 0.3)',
        gradient: 'linear-gradient(135deg, #e11d48 0%, #f43f5e 55%, #fb7185 100%)',
        bg: 'linear-gradient(165deg, rgba(225, 29, 72, 0.08) 0%, rgba(251, 113, 133, 0.04) 48%, var(--surface) 100%)',
        icon: 'fa-award'
      },
      {
        accent: '#4f46e5',
        border: 'rgba(79, 70, 229, 0.32)',
        gradient: 'linear-gradient(135deg, #4f46e5 0%, #8b5cf6 100%)',
        bg: 'linear-gradient(165deg, rgba(79, 70, 229, 0.08) 0%, rgba(139, 92, 246, 0.04) 48%, var(--surface) 100%)',
        icon: 'fa-book-open'
      }
    ];

    const memberTierThemes = [
      'linear-gradient(135deg, #7c3aed 0%, #db2777 65%, #f59e0b 100%)',
      'linear-gradient(135deg, #6d28d9 0%, #2563eb 55%, #06b6d4 100%)',
      'linear-gradient(135deg, #be185d 0%, #7c3aed 60%, #4f46e5 100%)'
    ];

    // Merged Member Tier Plan Cards
    const memberCardsHtml = (cfg.memberPlans || []).map((mp, mIdx) => {
      const scopeLabel = formatScopeSummary(mp.accessScope, mp.includedBatches, mp.includeUpcoming);
      const safeTitle = escapeHtml(mp.name).replace(/'/g, "\\'");
      const tierGrad = memberTierThemes[mIdx % memberTierThemes.length];
      return `
        <div class="rp-plan-card is-member-tier" data-plan-category="member" style="--plan-gradient:${tierGrad};">
          <div>
            <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; margin-bottom:10px; flex-wrap:wrap;">
              <span class="rp-plan-type-badge"><i class="fa-solid fa-crown"></i> Member Tier</span>
              <span style="font-size:11px; font-weight:800; color:#7c3aed; background:rgba(124,58,237,0.12); padding:3px 9px; border-radius:999px;"><i class="fa-solid fa-sparkles"></i> All-Access</span>
            </div>
            <div style="font-size:17px; font-weight:900; color:var(--secondary); line-height:1.25;">${escapeHtml(mp.name)}</div>
            <div style="margin-top:8px; font-size:11.5px; font-weight:700; color:#4f46e5; background:rgba(79,70,229,0.1); border:1px solid rgba(79,70,229,0.2); padding:6px 10px; border-radius:9px; display:inline-flex; align-items:center; gap:6px;">
              <i class="fa-solid fa-layer-group"></i> ${escapeHtml(scopeLabel)}
            </div>
            ${mp.description ? `<p style="margin:10px 0 0 0; font-size:12.5px; color:var(--text-muted); line-height:1.5;">${escapeHtml(mp.description)}</p>` : ''}
          </div>
          <div style="display:flex; justify-content:space-between; align-items:flex-end; gap:10px; padding-top:14px; margin-top:14px; border-top:1px dashed rgba(124,58,237,0.25); flex-wrap:wrap;">
            <div>
              <div class="mono-num rp-plan-price-highlight">${mp.amount > 0 ? '₹' + mp.amount.toLocaleString('en-IN') : '₹0 (Free)'}</div>
              <div style="font-size:11.5px; color:var(--text-muted); font-weight:700; margin-top:2px;"><i class="fa-regular fa-clock"></i> ${mp.validityDays} Days Validity</div>
            </div>
            <button type="button" class="btn btn-sm rp-plan-cta-vibrant" onclick="window.openStudentUpiFeeCheckout('member', 'ALL_BATCHES', ${Math.max(0, Number(mp.amount || 0))}, '${safeTitle}', ${mp.validityDays}, '${safeTitle}', 'buy-plans-upi-checkout-panel')">
              ${mp.amount > 0 ? '<i class="fa-solid fa-qrcode"></i> Buy Member Plan' : '<i class="fa-solid fa-paper-plane"></i> Request Free (₹0)'}
            </button>
          </div>
        </div>
      `;
    }).join('');

    // Merged Individual Batch Multi-Plan Cards
    const batchCardsHtml = allBatchNames.map((bName, bIdx) => {
      const plans = (cfg.batchPlans[bName] && cfg.batchPlans[bName].length > 0)
        ? cfg.batchPlans[bName]
        : [];
      const firstPlan = plans[0] || { name: 'Standard Plan', amount: 0, validityDays: 90, note: 'Contact Admin for pricing.', allowInstallments: false, firstInstallmentPercent: 50 };
      const alreadyEnrolled = (typeof userHasBatchAssigned === 'function')
        ? userHasBatchAssigned(cu.userId, bName, cu.batch || cu.Batch || '')
        : userBatches.some((ub) => ub.toLowerCase() === bName.toLowerCase());
      const balInfo = installmentMap[bName];
      const hasPendingBalance = Boolean(balInfo && balInfo.remainingBalance > 0);
      const safeB = escapeHtml(bName).replace(/'/g, "\\'");
      const safeFirstPlan = escapeHtml(firstPlan.name).replace(/'/g, "\\'");
      const safeBalPlan = escapeHtml((balInfo && balInfo.planName) || firstPlan.name).replace(/'/g, "\\'");
      const theme = batchColorThemes[bIdx % batchColorThemes.length];

      return `
        <div class="rp-plan-card ${alreadyEnrolled ? 'is-enrolled' : ''}" data-plan-category="batch" data-buy-batch-card="${bIdx}" data-batch-name="${escapeHtml(bName)}" style="--plan-accent:${theme.accent}; --plan-border:${alreadyEnrolled ? 'rgba(16, 185, 129, 0.5)' : theme.border}; --plan-gradient:${theme.gradient}; --plan-bg:${theme.bg};">
          <div>
            <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; margin-bottom:10px; flex-wrap:wrap;">
              <span class="rp-plan-type-badge"><i class="fa-solid ${theme.icon}"></i> Batch Plan</span>
              ${alreadyEnrolled
                ? '<span style="font-size:11px; font-weight:800; color:#047857; background:rgba(16,185,129,0.14); border:1px solid rgba(16,185,129,0.35); padding:3px 9px; border-radius:999px;"><i class="fa-solid fa-circle-check"></i> Unlocked</span>'
                : ''}
            </div>
            <div style="font-size:16.5px; font-weight:900; color:var(--secondary); line-height:1.25;">${escapeHtml(bName)}</div>
            ${plans.length > 1 ? `
              <div class="rp-plan-chip-selector" style="margin-top:10px;">
                ${plans.map((pl, pIdx) => `
                  <button type="button" class="rp-plan-chip-btn ${pIdx === 0 ? 'is-selected' : ''}" data-plan-idx="${pIdx}" data-amt="${pl.amount}" data-days="${pl.validityDays}" data-plan-name="${escapeHtml(pl.name)}" data-note="${escapeHtml(pl.note || '')}" data-inst="${pl.allowInstallments ? '1' : '0'}" data-inst-pct="${pl.firstInstallmentPercent || 50}" onclick="window.selectBatchPlanChip(${bIdx}, ${pIdx})">
                    ${escapeHtml(pl.name)} · ₹${pl.amount.toLocaleString('en-IN')}
                  </button>
                `).join('')}
              </div>
            ` : ''}
            <div class="rp-batch-inst-badge" style="display:${firstPlan.allowInstallments && firstPlan.amount > 0 ? 'inline-flex' : 'none'}; align-items:center; gap:5px; margin-top:9px; font-size:11px; font-weight:800; color:#0369a1; background:rgba(14,165,233,0.12); border:1px solid rgba(14,165,233,0.28); padding:4px 9px; border-radius:8px;">
              <i class="fa-solid fa-layer-group"></i> 2-Part Installments Available
            </div>
            ${hasPendingBalance ? `
              <div style="margin-top:9px; padding:8px 10px; border-radius:9px; background:rgba(245,158,11,0.12); border:1px solid rgba(245,158,11,0.36); font-size:11.5px; color:#92400e;">
                <strong>Installment Balance Due:</strong> Paid ₹${balInfo.totalPaid.toLocaleString('en-IN')} of ₹${balInfo.totalPlanFee.toLocaleString('en-IN')} · <strong class="mono-num">Balance ₹${balInfo.remainingBalance.toLocaleString('en-IN')}</strong>
              </div>
            ` : ''}
            <div class="rp-batch-active-note" style="font-size:12.5px; color:var(--text-muted); margin-top:10px; line-height:1.5;">
              ${escapeHtml(firstPlan.note || 'Dedicated batch study material, dictations & tests + permanent RP-Trail free access.')}
            </div>
          </div>
          <div style="display:flex; justify-content:space-between; align-items:flex-end; gap:8px; padding-top:14px; margin-top:14px; border-top:1px dashed var(--plan-border, var(--border)); flex-wrap:wrap;">
            <div>
              <div class="mono-num rp-batch-active-price rp-plan-price-highlight">${plans.length > 0 ? (firstPlan.amount > 0 ? '₹' + firstPlan.amount.toLocaleString('en-IN') : '₹0 (Free)') : 'Contact Admin'}</div>
              <div class="rp-batch-active-days" style="font-size:11.5px; color:var(--text-muted); font-weight:700; margin-top:2px;">${escapeHtml(firstPlan.name)} · ${firstPlan.validityDays} days validity</div>
            </div>
            <div style="display:flex; gap:6px; flex-wrap:wrap;">
              ${hasPendingBalance
                ? `<button type="button" class="btn btn-sm btn-warning" style="background:linear-gradient(135deg,#f59e0b,#ea580c); color:#fff; border:none; border-radius:10px; font-weight:800;" onclick="window.openStudentUpiFeeCheckout('batch', '${safeB}', ${balInfo.totalPlanFee}, '${safeB} — Installment 2 / Balance', ${balInfo.validityDays}, '${safeBalPlan}', 'buy-plans-upi-checkout-panel', { mode: 'balance', remainingBalance: ${balInfo.remainingBalance}, priorPaid: ${balInfo.totalPaid}, totalPlanFee: ${balInfo.totalPlanFee} })"><i class="fa-solid fa-wallet"></i> Pay Balance ₹${balInfo.remainingBalance.toLocaleString('en-IN')}</button>`
                : ''}
              ${plans.length > 0
                ? `<button type="button" class="btn btn-sm rp-plan-cta-vibrant rp-batch-pay-cta" onclick="window.openStudentUpiFeeCheckout('batch', '${safeB}', ${Math.max(0, Number(firstPlan.amount || 0))}, '${safeB} — ${safeFirstPlan}', ${firstPlan.validityDays}, '${safeFirstPlan}', 'buy-plans-upi-checkout-panel', { allowInstallments: ${firstPlan.allowInstallments && firstPlan.amount > 0 ? 'true' : 'false'}, firstInstallmentPercent: ${firstPlan.firstInstallmentPercent || 50} })">${firstPlan.amount > 0 ? `<i class="fa-solid fa-indian-rupee-sign"></i> ${alreadyEnrolled ? 'Renew Plan' : 'Buy Batch'}` : `<i class="fa-solid fa-paper-plane"></i> Request Free (₹0)`}</button>`
                : `<span style="font-size:11px; color:var(--text-muted); font-weight:700;">Not Priced Yet</span>`}
            </div>
          </div>
        </div>
      `;
    }).join('');

    const totalMemberCount = (cfg.memberPlans || []).length;
    const totalBatchCount = allBatchNames.length;
    const hasAnyPlans = (totalMemberCount + totalBatchCount) > 0;

    window.filterMergedBuyPlansGrid = function (category) {
      const container = document.getElementById('rp-merged-plans-hub-container');
      if (!container) return;
      container.querySelectorAll('.rp-merged-plan-filter-btn').forEach((btn) => {
        btn.classList.toggle('is-active', btn.getAttribute('data-filter') === category);
      });
      let visibleCount = 0;
      container.querySelectorAll('.rp-plan-card[data-plan-category]').forEach((card) => {
        const show = category === 'all' || card.getAttribute('data-plan-category') === category;
        card.style.display = show ? 'flex' : 'none';
        if (show) visibleCount++;
      });
      const emptyBox = document.getElementById('rp-merged-plans-empty-state');
      if (emptyBox) {
        emptyBox.style.display = visibleCount === 0 ? 'block' : 'none';
      }
    };

    const mergedPlansShowcaseHtml = `
      <div id="rp-merged-plans-hub-container" class="rp-merged-plans-hub">
        <div class="rp-merged-plans-hero">
          <div style="position:relative; z-index:1;">
            <div style="display:inline-flex; align-items:center; gap:6px; font-size:11px; font-weight:800; letter-spacing:0.06em; text-transform:uppercase; background:rgba(255,255,255,0.18); padding:4px 10px; border-radius:999px; margin-bottom:7px;">
              <i class="fa-solid fa-crown"></i> Membership Passes &amp; Dedicated Batches
            </div>
            <h3 style="margin:0; font-size:19px; font-weight:900; color:#ffffff; letter-spacing:-0.01em;">
              Explore All Member Tiers &amp; Batch Plans
            </h3>
            <p style="margin:4px 0 0 0; font-size:12.5px; color:rgba(255,255,255,0.88);">
              Unlock all-access multi-batch memberships or pick an individual batch plan with instant activation.
            </p>
          </div>
          <div class="rp-merged-plans-filter-bar" role="tablist" aria-label="Filter plans">
            <button type="button" class="rp-merged-plan-filter-btn is-active" data-filter="all" onclick="window.filterMergedBuyPlansGrid('all')">
              All (${totalMemberCount + totalBatchCount})
            </button>
            <button type="button" class="rp-merged-plan-filter-btn" data-filter="member" onclick="window.filterMergedBuyPlansGrid('member')">
              <i class="fa-solid fa-crown"></i> Member (${totalMemberCount})
            </button>
            <button type="button" class="rp-merged-plan-filter-btn" data-filter="batch" onclick="window.filterMergedBuyPlansGrid('batch')">
              <i class="fa-solid fa-graduation-cap"></i> Batches (${totalBatchCount})
            </button>
          </div>
        </div>
        <div class="rp-merged-plans-body">
          ${hasAnyPlans ? `
            <div class="rp-merged-plans-grid">
              ${memberCardsHtml}
              ${batchCardsHtml}
            </div>
            <div id="rp-merged-plans-empty-state" style="display:none; padding:20px; border-radius:12px; border:1.5px dashed rgba(124,58,237,0.3); background:rgba(124,58,237,0.04); text-align:center; font-size:13px; color:var(--text-muted); margin-top:8px;">
              No plans available in this category yet. Switch to <strong>All</strong> to view other published plans.
            </div>
          ` : `
            <div style="padding:22px; border-radius:12px; border:1.5px dashed rgba(124,58,237,0.32); background:rgba(124,58,237,0.04); text-align:center; font-size:13px; color:var(--text-muted);">
              No Member Plans or paid batches published yet. You currently have permanent free access to <strong>RP-Trail</strong>.
            </div>
          `}
        </div>
      </div>
    `;

    mount.innerHTML = `
      ${mergedPlansShowcaseHtml}
      <div id="buy-plans-upi-checkout-panel" class="card" style="display:none; border:2px solid var(--primary); margin-bottom:18px;"></div>
    `;
  };

window.setStudentFeeHistoryFilter = function (filterVal) {
    _studentHistoryFilter = filterVal || 'ALL';
    renderStudentFeeHistoryRowsOnly();
  };

export function renderStudentInstallmentTrackerBanner() {
    const mount = document.getElementById('student-installment-tracker-mount');
    if (!mount) return;
    const cu = typeof portalState.currentUser !== 'undefined' ? portalState.currentUser : null;
    const balMap = computeStudentBatchInstallmentLedger(cu ? cu.userId : '');
    const openBalances = Object.values(balMap).filter(b => b.remainingBalance > 0);
    if (openBalances.length === 0) {
      mount.innerHTML = '';
      mount.style.display = 'none';
      return;
    }
    mount.style.display = 'block';
    mount.innerHTML = `
      <div style="margin-bottom:14px; display:flex; flex-direction:column; gap:10px;">
        ${openBalances.map((b) => {
          const pct = b.totalPlanFee > 0 ? Math.min(100, Math.round((b.totalPaid / b.totalPlanFee) * 100)) : 50;
          const safeB = escapeHtml(b.batchName).replace(/'/g, "\\'");
          const safeP = escapeHtml(b.planName).replace(/'/g, "\\'");
          return `
            <div class="rp-installment-bar">
              <div style="flex:1; min-width:220px;">
                <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; flex-wrap:wrap;">
                  <strong style="font-size:13px; color:var(--secondary);"><i class="fa-solid fa-layer-group" style="color:#d97706;"></i> Installment Balance — ${escapeHtml(b.batchName)} (${escapeHtml(b.planName)})</strong>
                  <span class="mono-num" style="font-size:12px; font-weight:800; color:#b45309;">Balance Due: ₹${b.remainingBalance.toLocaleString('en-IN')}</span>
                </div>
                <div style="font-size:11.5px; color:var(--text-muted); margin-top:3px;">
                  Total Fee: <strong class="mono-num">₹${b.totalPlanFee.toLocaleString('en-IN')}</strong> · Paid: <strong class="mono-num" style="color:#047857;">₹${b.totalPaid.toLocaleString('en-IN')}</strong> (${pct}%)
                </div>
                <div style="height:6px; border-radius:999px; background:rgba(15,23,42,0.08); margin-top:6px; overflow:hidden;">
                  <div style="height:100%; width:${pct}%; background:linear-gradient(90deg, #10b981, #059669); border-radius:999px;"></div>
                </div>
              </div>
              <button type="button" class="btn btn-primary btn-sm" onclick="window.switchBuyPlansSubtab('plans'); setTimeout(()=>window.openStudentUpiFeeCheckout('batch', '${safeB}', ${b.totalPlanFee}, '${safeB} — Installment 2 / Balance', ${b.validityDays}, '${safeP}', 'buy-plans-upi-checkout-panel', { mode: 'balance', remainingBalance: ${b.remainingBalance}, priorPaid: ${b.totalPaid}, totalPlanFee: ${b.totalPlanFee} }), 100);">
                <i class="fa-solid fa-wallet"></i> Pay Installment 2 (₹${b.remainingBalance.toLocaleString('en-IN')})
              </button>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

export function renderStudentFeeHistoryRowsOnly() {
    renderStudentInstallmentTrackerBanner();
    const tbody = document.getElementById('student-fee-history-tbody');
    if (!tbody) return;
    const rows = (portalState.globalData && Array.isArray(portalState.globalData.userFeeReceipts)) ? portalState.globalData.userFeeReceipts : [];
    const filtered = rows.filter((r) => {
      if (_studentHistoryFilter === 'ALL') return true;
      const st = normalizeFeeStatusDisplay(r.Status);
      if (_studentHistoryFilter === 'Pending' || _studentHistoryFilter === 'Approved' || _studentHistoryFilter === 'Rejected') {
        return st === _studentHistoryFilter;
      }
      const ft = String(r.FeeType || '').toLowerCase();
      if (_studentHistoryFilter === 'Member') return ft.includes('member');
      if (_studentHistoryFilter === 'Batch') return !ft.includes('member');
      return true;
    });

    if (filtered.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:18px; color:var(--text-muted); font-size:12.5px;">No matching fee transactions found.</td></tr>`;
      return;
    }

    tbody.innerHTML = filtered.map((r) => {
      const receiptNo = String(r.ReceiptNo || r.ReceiptID || '-');
      const safeRid = escapeHtml(receiptNo).replace(/'/g, "\\'");
      const isMem = String(r.FeeType || '').toLowerCase().includes('member');
      const planTitle = r.PlanName || (isMem ? 'Member Pass' : (r.Batch || 'Batch Fee'));
      const batchSub = isMem ? 'Membership Tier' : (r.Batch || 'Batch');
      const amt = getEffectiveFeeAmountPaid(r);
      const totalFee = Number(r.TotalPlanFee || 0) || 0;
      const remBal = getEffectiveFeeRemainingBalance(r);
      const instLabel = String(r.InstallmentLabel || r.InstallmentNo || 'Full Payment').trim();
      const couponCode = String(r.CouponCode || '').trim();
      const discAmt = Number(r.DiscountAmount || 0) || 0;
      const utr = r.UTR || '-';
      const payDate = formatReadableFeeDate(r.Timestamp || r.PaymentDate || '-');
      const validTill = r.ValidityUntil || r.ValidUntil || '-';
      const remarks = cleanFeeRemarksForDisplay(r.Remarks);
      const normSt = normalizeFeeStatusDisplay(r.Status);

      return `
        <tr>
          <td class="mono-num" style="font-weight:700;">${escapeHtml(receiptNo)}</td>
          <td>
            <div style="font-weight:800; color:var(--secondary);">${escapeHtml(planTitle)}</div>
            <div style="font-size:11px; color:var(--text-muted);">${isMem ? '★ Member Fee' : 'Batch Fee'} · ${escapeHtml(batchSub)}</div>
            <div style="display:flex; gap:5px; flex-wrap:wrap; margin-top:3px;">
              ${instLabel && instLabel !== '-' ? `<span style="font-size:10px; font-weight:700; padding:1px 6px; border-radius:4px; background:rgba(37,99,235,0.09); color:var(--primary);">${escapeHtml(instLabel)}</span>` : ''}
              ${couponCode && couponCode !== '-' ? `<span style="font-size:10px; font-weight:700; padding:1px 6px; border-radius:4px; background:rgba(16,185,129,0.12); color:#047857;"><i class="fa-solid fa-tag"></i> ${escapeHtml(couponCode)}${discAmt > 0 ? ' (-₹' + discAmt.toLocaleString('en-IN') + ')' : ''}</span>` : ''}
            </div>
          </td>
          <td class="mono-num">
            <div style="font-weight:900; color:var(--secondary);">₹${amt.toLocaleString('en-IN')}</div>
            ${remBal > 0
              ? `<div style="font-size:10.5px; font-weight:700; color:#b45309;">Bal: ₹${remBal.toLocaleString('en-IN')}</div>`
              : (amt === 0
                  ? `<div style="font-size:10.5px; color:#047857; font-weight:700;">₹0 Paid (Free / Coupon)</div>`
                  : (totalFee > 0 ? `<div style="font-size:10.5px; color:#047857; font-weight:700;">Paid in Full</div>` : ''))}
          </td>
          <td class="mono-num"><strong>${escapeHtml(utr)}</strong><div style="font-size:10.5px; color:var(--text-muted);">${escapeHtml(r.PaymentMode || 'UPI')}</div></td>
          <td>${renderFeeStatusBadgeHtml(r.Status)}</td>
          <td class="mono-num" style="font-size:11.5px; color:var(--text-muted);">${escapeHtml(payDate)}</td>
          <td style="font-size:11.5px;">
            <div class="mono-num" style="font-weight:700; color:var(--secondary);">${escapeHtml(validTill)}</div>
            ${remarks ? `<div style="font-size:11px; color:var(--text-muted);">${escapeHtml(remarks)}</div>` : ''}
          </td>
          <td>
            ${normSt === 'Approved'
              ? `<button type="button" class="btn btn-secondary btn-sm" style="white-space:nowrap; font-size:11.5px;" onclick="window.openPrintableFeeReceipt('${safeRid}')"><i class="fa-solid fa-file-pdf"></i> Download Receipt</button>`
              : `<span style="font-size:11px; color:var(--text-muted);">${normSt === 'Pending' ? 'Awaiting Approval' : '—'}</span>`}
          </td>
        </tr>
      `;
    }).join('');
  }

window.renderFeePaymentHistorySubtab = async function (mountId = 'buy-plans-history-mount', forceStream = true) {
    const mount = document.getElementById(mountId);
    if (!mount) return;
    const cu = typeof portalState.currentUser !== 'undefined' ? portalState.currentUser : null;
    if (!cu || !cu.userId) {
      mount.innerHTML = '<div class="card"><div style="font-size:13px; color:var(--text-muted);">Please log in to view your Fee Payment History.</div></div>';
      return;
    }

    mount.innerHTML = `
      <div class="card" style="border-top:3px solid var(--primary);">
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; margin-bottom:14px;">
          <div>
            <h3 style="margin:0; font-size:16px; color:var(--secondary);"><i class="fa-solid fa-receipt" style="color:var(--primary);"></i> Fee Payment History Ledger</h3>
            <p style="margin:3px 0 0 0; font-size:12px; color:var(--text-muted);">Live record of all your Batch Fee and Member Plan UPI submissions, UTR references, installment balances, and printable receipts.</p>
          </div>
          <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
            <select class="form-control" style="width:auto; min-height:34px; font-size:12px; margin:0;" onchange="window.setStudentFeeHistoryFilter(this.value)">
              <option value="ALL" ${_studentHistoryFilter === 'ALL' ? 'selected' : ''}>All Transactions</option>
              <option value="Pending" ${_studentHistoryFilter === 'Pending' ? 'selected' : ''}>Pending</option>
              <option value="Approved" ${_studentHistoryFilter === 'Approved' ? 'selected' : ''}>Approved</option>
              <option value="Rejected" ${_studentHistoryFilter === 'Rejected' ? 'selected' : ''}>Rejected</option>
              <option value="Batch" ${_studentHistoryFilter === 'Batch' ? 'selected' : ''}>Batch Fees Only</option>
              <option value="Member" ${_studentHistoryFilter === 'Member' ? 'selected' : ''}>Member Plans Only</option>
            </select>
            <button type="button" class="btn btn-secondary btn-sm" onclick="window.renderFeePaymentHistorySubtab('buy-plans-history-mount', true)">
              <i class="fa-solid fa-arrows-rotate"></i> Refresh
            </button>
          </div>
        </div>
        <div id="student-installment-tracker-mount" style="display:none;"></div>
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>Receipt No</th>
                <th>Plan / Batch</th>
                <th>Amount / Balance</th>
                <th>UTR / Ref</th>
                <th>Status</th>
                <th>Payment Date</th>
                <th>Valid Until / Remarks</th>
                <th>Receipt</th>
              </tr>
            </thead>
            <tbody id="student-fee-history-tbody"></tbody>
          </table>
        </div>
      </div>
    `;

    renderStudentFeeHistoryRowsOnly();

    if (forceStream) {
      const streamedReceipts = [];
      await window.streamCollectionOneByOne({
        streamKey: 'student_fee_ledger_' + cu.userId,
        collection: 'fee_ledger',
        extraParams: { userId: cu.userId },
        anchorId: 'student-fee-history-tbody',
        labelSingular: 'payment record',
        fallbackAction: 'getFeeLedger',
        fallbackParams: { userId: cu.userId },
        extractFallbackItems: (res) => (res && Array.isArray(res.ledger || res.rows)) ? (res.ledger || res.rows) : [],
        onBatch: (records) => {
          if (!Array.isArray(records) || records.length === 0) return;
          for (let i = 0; i < records.length; i++) {
            if (records[i]) streamedReceipts.push(records[i]);
          }
          portalState.globalData = portalState.globalData || {};
          portalState.globalData.userFeeReceipts = streamedReceipts.slice();
          renderStudentFeeHistoryRowsOnly();
        },
        onDone: () => {
          portalState.globalData = portalState.globalData || {};
          portalState.globalData.userFeeReceipts = streamedReceipts.slice();
          renderStudentFeeHistoryRowsOnly();
        }
      });
    }
  };

export function findFeeReceiptRecordById(receiptNo) {
    const target = String(receiptNo || '').trim();
    if (!target) return null;
    const pools = [
      (portalState.globalData && Array.isArray(portalState.globalData.userFeeReceipts)) ? portalState.globalData.userFeeReceipts : [],
      (typeof portalState.adminData !== 'undefined' && portalState.adminData && Array.isArray(portalState.adminData.feeLedger)) ? portalState.adminData.feeLedger : []
    ];
    for (const pool of pools) {
      const hit = pool.find(r => String(r.ReceiptNo || r.ReceiptID || '').trim() === target);
      if (hit) return hit;
    }
    return null;
  }

export function buildPrintableFeeReceiptMarkup(rec) {
    const cu = typeof portalState.currentUser !== 'undefined' ? portalState.currentUser : null;
    const receiptNo = String(rec.ReceiptNo || rec.ReceiptID || '-');
    const studentName = rec.StudentName || rec.UserName || (cu ? cu.name : '') || rec.UserID || '-';
    const studentId = rec.UserID || (cu ? cu.userId : '-') || '-';
    const isMem = String(rec.FeeType || '').toLowerCase().includes('member');
    const planName = rec.PlanName || (isMem ? 'Member All-Access Pass' : (rec.Batch || 'Batch Fee'));
    const batchLabel = isMem ? 'Member Tier All-Access' : (rec.Batch || '-');
    const instLabel = String(rec.InstallmentLabel || rec.InstallmentNo || 'Full Payment').trim();
    const amountPaid = getEffectiveFeeAmountPaid(rec);
    const discAmt = Math.max(0, Number(rec.DiscountAmount || 0) || 0);
    const rawTotalPlanFee = Math.max(0, Number(rec.TotalPlanFee || 0) || 0);
    const originalPlanFee = rawTotalPlanFee > 0 ? Math.max(rawTotalPlanFee, amountPaid + discAmt) : (amountPaid + discAmt);
    const remBal = getEffectiveFeeRemainingBalance(rec);
    const couponCode = String(rec.CouponCode || '').trim();
    const isZeroPaid = amountPaid === 0;
    const utr = rec.UTR || (isZeroPaid ? 'FREE-ZERO-FEE' : '-');
    const payMode = rec.PaymentMode || (isZeroPaid ? (couponCode ? '100% Coupon (₹0 Paid)' : 'Free Batch (₹0 Fee)') : 'UPI / QR');
    const payDate = formatReadableFeeDate(rec.Timestamp || rec.PaymentDate || '-');
    const validUntil = rec.ValidityUntil || rec.ValidUntil || '-';
    const reviewedBy = rec.ReviewedBy && rec.ReviewedBy !== '-' ? rec.ReviewedBy : 'Institute Accounts Desk';
    const statusLabel = normalizeFeeStatusDisplay(rec.Status);

    return `
      <div class="rp-receipt-sheet">
        <div class="rp-receipt-header">
          <div>
            <div style="font-size:11px; font-weight:800; letter-spacing:0.1em; text-transform:uppercase; color:#2563eb;">OFFICIAL FEE RECEIPT</div>
            <h2 style="margin:3px 0 2px 0; font-size:21px; font-weight:900; color:#0f172a;">RP Skill | Ranjan Pathshala</h2>
            <div style="font-size:12px; color:#475569;">Stenography, Typing &amp; Skill Excellence Portal</div>
          </div>
          <div style="text-align:right;">
            <div style="display:inline-block; padding:4px 10px; border-radius:6px; background:#ecfdf5; border:1px solid #10b981; color:#047857; font-size:11px; font-weight:900; letter-spacing:0.06em;">
              <i class="fa-solid fa-circle-check"></i> ${escapeHtml(statusLabel.toUpperCase())}
            </div>
            <div class="mono-num" style="margin-top:6px; font-size:13px; font-weight:800; color:#0f172a;">Receipt #${escapeHtml(receiptNo)}</div>
            <div style="font-size:11.5px; color:#64748b;">Date: ${escapeHtml(payDate)}</div>
          </div>
        </div>

        <div class="rp-receipt-meta-grid">
          <div class="rp-receipt-meta-box">
            <div class="rp-receipt-meta-label">Student Details</div>
            <div style="font-size:14px; font-weight:800; color:#0f172a;">${escapeHtml(studentName)}</div>
            <div class="mono-num" style="font-size:12px; color:#475569; margin-top:2px;">Student ID: <strong>${escapeHtml(studentId)}</strong></div>
          </div>
          <div class="rp-receipt-meta-box">
            <div class="rp-receipt-meta-label">Enrollment &amp; Validity</div>
            <div style="font-size:14px; font-weight:800; color:#0f172a;">${escapeHtml(planName)}</div>
            <div style="font-size:12px; color:#475569; margin-top:2px;">${isMem ? 'Category: Member Tier' : 'Batch: ' + escapeHtml(batchLabel)}</div>
            <div class="mono-num" style="font-size:12px; font-weight:700; color:#047857; margin-top:3px;">Valid Until: ${escapeHtml(validUntil)}</div>
          </div>
        </div>

        <table class="rp-receipt-table">
          <thead>
            <tr>
              <th>Description</th>
              <th style="text-align:right;">Amount (INR)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <strong>${escapeHtml(planName)}</strong>
                <div style="font-size:11.5px; color:#64748b;">${escapeHtml(batchLabel)} · ${escapeHtml(instLabel)}</div>
              </td>
              <td class="mono-num" style="text-align:right; font-weight:700;">₹${originalPlanFee.toLocaleString('en-IN')}</td>
            </tr>
            ${discAmt > 0 ? `
              <tr>
                <td style="color:#047857;">Promo Coupon Discount ${couponCode && couponCode !== '-' ? `(<strong>${escapeHtml(couponCode)}</strong>)` : ''}</td>
                <td class="mono-num" style="text-align:right; font-weight:700; color:#047857;">- ₹${discAmt.toLocaleString('en-IN')}</td>
              </tr>
            ` : ''}
            <tr class="rp-receipt-total-row">
              <td><strong>Amount Paid (${escapeHtml(instLabel)})${isZeroPaid ? ' · <span style="color:#047857; font-size:11.5px;">Zero Fee / 100% Discount</span>' : ''}</strong></td>
              <td class="mono-num" style="text-align:right; font-size:17px; font-weight:900; color:#0f172a;">₹${amountPaid.toLocaleString('en-IN')}</td>
            </tr>
            <tr>
              <td style="font-size:12px; color:#475569;">Remaining Balance Due</td>
              <td class="mono-num" style="text-align:right; font-weight:800; color:${remBal > 0 ? '#b45309' : '#047857'};">${remBal > 0 ? '₹' + remBal.toLocaleString('en-IN') : '₹0 (Paid in Full)'}</td>
            </tr>
          </tbody>
        </table>

        <div class="rp-receipt-tx-strip">
          <div><span style="color:#64748b;">UTR / Transaction Ref:</span> <strong class="mono-num" style="color:#0f172a;">${escapeHtml(utr)}</strong></div>
          <div><span style="color:#64748b;">Payment Mode:</span> <strong style="color:#0f172a;">${escapeHtml(payMode)}</strong></div>
          <div><span style="color:#64748b;">Verified By:</span> <strong style="color:#0f172a;">${escapeHtml(reviewedBy)}</strong></div>
        </div>

        <div class="rp-receipt-footer">
          <div>
            This is a computer-generated official fee receipt issued by <strong>RP Skill | Ranjan Pathshala</strong>. No physical signature is required.
          </div>
          <div style="font-weight:800; color:#047857; white-space:nowrap;">VERIFIED DIGITAL RECEIPT</div>
        </div>
      </div>
    `;
  }

window.openPrintableFeeReceipt = function (receiptNo) {
    const rec = findFeeReceiptRecordById(receiptNo);
    if (!rec) {
      safeNotify('Could not locate receipt details. Please refresh the fee ledger.');
      return;
    }
    _activePrintableReceiptRecord = rec;
    const modal = document.getElementById('rp-fee-receipt-modal');
    const mount = document.getElementById('rp-fee-receipt-printable');
    if (!modal || !mount) return;
    mount.innerHTML = buildPrintableFeeReceiptMarkup(rec);
    modal.style.display = 'flex';
  };

window.closePrintableFeeReceipt = function () {
    const modal = document.getElementById('rp-fee-receipt-modal');
    if (modal) modal.style.display = 'none';
    document.body.classList.remove('rp-printing-receipt');
  };

window.printCurrentFeeReceiptPdf = function () {
    if (!_activePrintableReceiptRecord) return;
    document.body.classList.add('rp-printing-receipt');
    const cleanup = () => {
      document.body.classList.remove('rp-printing-receipt');
      window.removeEventListener('afterprint', cleanup);
    };
    window.addEventListener('afterprint', cleanup);
    setTimeout(() => {
      window.print();
      setTimeout(cleanup, 1200);
    }, 60);
  };

window.downloadCurrentFeeReceiptHtml = function () {
    if (!_activePrintableReceiptRecord) return;
    const rec = _activePrintableReceiptRecord;
    const receiptNo = String(rec.ReceiptNo || rec.ReceiptID || 'Receipt').replace(/[^A-Za-z0-9_-]/g, '');
    const innerHtml = buildPrintableFeeReceiptMarkup(rec);
    const fullDoc = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>Fee Receipt ${receiptNo} — RP Skill | Ranjan Pathshala</title><style>
      body{font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#f8fafc;margin:0;padding:28px;color:#0f172a;}
      .rp-receipt-sheet{max-width:700px;margin:0 auto;background:#fff;border:1px solid #cbd5e1;border-radius:12px;padding:28px;box-shadow:0 8px 24px rgba(15,23,42,0.06);}
      .rp-receipt-header{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;padding-bottom:16px;border-bottom:2px solid #e2e8f0;margin-bottom:18px;}
      .rp-receipt-meta-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:18px;}
      .rp-receipt-meta-box{padding:12px 14px;border-radius:8px;background:#f8fafc;border:1px solid #e2e8f0;}
      .rp-receipt-meta-label{font-size:10.5px;font-weight:800;text-transform:uppercase;letter-spacing:0.06em;color:#64748b;margin-bottom:4px;}
      .rp-receipt-table{width:100%;border-collapse:collapse;margin-bottom:16px;}
      .rp-receipt-table th{background:#f1f5f9;text-align:left;padding:10px 12px;font-size:11.5px;text-transform:uppercase;letter-spacing:0.04em;color:#475569;border-bottom:1px solid #cbd5e1;}
      .rp-receipt-table td{padding:11px 12px;border-bottom:1px solid #e2e8f0;font-size:13px;}
      .rp-receipt-total-row td{background:#f8fafc;border-top:2px solid #cbd5e1;border-bottom:2px solid #cbd5e1;}
      .rp-receipt-tx-strip{display:flex;justify-content:space-between;flex-wrap:wrap;gap:10px;padding:11px 14px;border-radius:8px;background:#f8fafc;border:1px dashed #cbd5e1;font-size:12px;margin-bottom:16px;}
      .rp-receipt-footer{display:flex;justify-content:space-between;align-items:center;gap:12px;font-size:11px;color:#64748b;padding-top:12px;border-top:1px solid #e2e8f0;}
      .mono-num{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;}
      @media print{body{background:#fff;padding:0;}.rp-receipt-sheet{border:none;box-shadow:none;}}
    </style></head><body>${innerHtml}</body></html>`;
    const blob = new Blob([fullDoc], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Fee-Receipt-${receiptNo}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1500);
    safeNotify(`✅ Receipt ${receiptNo} downloaded!`);
  };

window.renderProfileFeesSection = async function (forceRefresh = false) {
    const mount = document.getElementById('profile-fees-section-mount');
    if (!mount) return;
    const cu = typeof portalState.currentUser !== 'undefined' ? portalState.currentUser : null;
    if (!cu || !cu.userId) {
      mount.innerHTML = '<div style="font-size:12.5px; color:var(--text-muted);">Please log in to view Batch Fees and Membership Plans.</div>';
      return;
    }

    if (forceRefresh && typeof apiCall === 'function') {
      const [cfgRes, ledRes] = await Promise.all([
        apiCall('getFeeConfig', {}, true),
        apiCall('getFeeLedger', { userId: cu.userId }, true)
      ]);
      portalState.globalData = portalState.globalData || {};
      if (cfgRes && cfgRes.success && cfgRes.feeConfig) portalState.globalData.feeConfig = cfgRes.feeConfig;
      if (ledRes && ledRes.success && Array.isArray(ledRes.ledger || ledRes.rows)) {
        portalState.globalData.userFeeReceipts = ledRes.ledger || ledRes.rows;
      }
    }

    const cfg = getResolvedFeeConfig();
    const myReceipts = (portalState.globalData && Array.isArray(portalState.globalData.userFeeReceipts)) ? portalState.globalData.userFeeReceipts : [];
    const userBatches = typeof getUserAssignedBatchesList === 'function'
      ? getUserAssignedBatchesList(cu.userId, cu.batch || cu.Batch || '')
      : ['RP-Trail'];
    const isActiveMember = String(cu.role || '').toLowerCase() === 'member' || Boolean(cu.isMemberAllAccess);
    const scopeSummary = isActiveMember ? formatScopeSummary(cu.memberAccessScope, cu.memberIncludedBatches, cu.memberIncludeUpcoming) : '';
    const installmentMap = typeof computeStudentBatchInstallmentLedger === 'function'
      ? computeStudentBatchInstallmentLedger(cu.userId)
      : {};

    const cardGradients = [
      'linear-gradient(135deg, #10b981, #0d9488)',
      'linear-gradient(135deg, #4f46e5, #0ea5e9)',
      'linear-gradient(135deg, #7c3aed, #ec4899)',
      'linear-gradient(135deg, #f59e0b, #ea580c)',
      'linear-gradient(135deg, #0284c7, #2563eb)'
    ];

    const enrolledCardsHtml = userBatches.map((batchName, idx) => {
      const bStr = String(batchName || '').trim();
      const isFreeTrail = bStr.toLowerCase() === 'rp-trail';
      const safeB = escapeHtml(bStr).replace(/'/g, "\\'");
      const grad = cardGradients[idx % cardGradients.length];
      const balInfo = installmentMap[bStr];
      const hasBalanceDue = balInfo && Number(balInfo.remainingBalance || 0) > 0;
      const latestApproved = myReceipts.find((r) =>
        normalizeFeeStatusDisplay(r.Status) === 'Approved' &&
        String(r.Batch || '').toLowerCase() === bStr.toLowerCase()
      );
      const validTill = latestApproved?.ValidUntil || (isActiveMember ? cu.membershipValidUntil : cu.enrollmentValidUntil) || '';
      const statusText = isFreeTrail
        ? 'Permanent Free Access'
        : hasBalanceDue
          ? `Installment Balance Due · ₹${Number(balInfo.remainingBalance).toLocaleString('en-IN')}`
          : 'Active Enrollment';
      const statusColor = hasBalanceDue ? '#d97706' : '#059669';
      const initials = bStr.replace(/[^A-Za-z0-9]/g, '').slice(0, 2).toUpperCase() || 'BT';
      const safeBalPlan = escapeHtml((balInfo && balInfo.planName) || 'Standard Plan').replace(/'/g, "\\'");

      return `
        <div class="rp-enrolled-card" style="--ec-grad: ${grad};">
          <div class="rp-enrolled-card-top">
            <span class="rp-enrolled-badge-icon">${escapeHtml(initials)}</span>
            <div style="min-width: 0; flex: 1;">
              <div style="font-size: 15px; font-weight: 800; color: var(--secondary); line-height: 1.25;">${escapeHtml(bStr)}</div>
              <div style="font-size: 12px; font-weight: 700; color: ${statusColor}; margin-top: 3px;">${escapeHtml(statusText)}</div>
            </div>
          </div>
          <div class="rp-enrolled-meta">
            <span>${isFreeTrail ? 'Starter Trial Tier' : escapeHtml(latestApproved?.PlanName || (isActiveMember ? (cu.membershipPlan || 'Member Access') : 'Enrolled Batch'))}</span>
            <span aria-hidden="true">&middot;</span>
            <span>${isFreeTrail ? 'Lifetime Validity' : (validTill ? `Valid till ${escapeHtml(validTill)}` : 'Active Access')}</span>
            ${latestApproved && Number(latestApproved.AmountPaid || 0) > 0 ? `<span aria-hidden="true">&middot;</span><span>Paid ₹${Number(latestApproved.AmountPaid).toLocaleString('en-IN')}</span>` : ''}
          </div>
          <div class="rp-enrolled-actions">
            ${hasBalanceDue
              ? `<button type="button" class="btn btn-sm btn-warning" style="background:linear-gradient(135deg,#f59e0b,#ea580c); color:#fff; border:none; border-radius:10px; font-weight:700;" onclick="if(typeof window.switchProfileSubtab==='function') window.switchProfileSubtab('buy-plans'); setTimeout(()=>window.openStudentUpiFeeCheckout('batch', '${safeB}', ${balInfo.totalPlanFee}, '${safeB} — Installment 2 / Balance', ${balInfo.validityDays}, '${safeBalPlan}', 'buy-plans-upi-checkout-panel', { mode: 'balance', remainingBalance: ${balInfo.remainingBalance}, priorPaid: ${balInfo.totalPaid}, totalPlanFee: ${balInfo.totalPlanFee} }), 120);"><i class="fa-solid fa-wallet"></i> Pay Balance ₹${Number(balInfo.remainingBalance).toLocaleString('en-IN')}</button>`
              : `<button type="button" class="btn btn-primary btn-sm" style="border-radius:10px;" onclick="navigateTo('dashboard', true, true)"><i class="fa-solid fa-arrow-right"></i> Open Dashboard</button>`
            }
            ${!isFreeTrail
              ? `<button type="button" class="btn btn-secondary btn-sm" style="border-radius:10px;" onclick="if(typeof window.switchProfileSubtab==='function') window.switchProfileSubtab('buy-plans');"><i class="fa-solid fa-rotate"></i> Renew / Upgrade</button>`
              : `<button type="button" class="btn btn-secondary btn-sm" style="border-radius:10px;" onclick="if(typeof window.switchProfileSubtab==='function') window.switchProfileSubtab('buy-plans');"><i class="fa-solid fa-bag-shopping"></i> Explore Paid Batches</button>`
            }
          </div>
        </div>
      `;
    }).join('');

    mount.innerHTML = `
      <div style="display:flex; flex-direction:column; gap:16px;">
        <div class="rp-enrolled-grid">
          ${enrolledCardsHtml || `<div style="padding:20px; text-align:center; color:var(--text-muted); font-size:13px;">No batches assigned yet. Visit <strong>Buy New Batch</strong> to enroll.</div>`}
        </div>

        <div id="profile-upi-checkout-panel" style="display:none; padding:18px; border-radius:12px; border:1.5px solid var(--primary); background:var(--background);"></div>
      </div>
    `;
  };

export function recomputeCheckoutPayableAndQr() {
    if (!_selectedStudentFeePlan) return;
    const plan = _selectedStudentFeePlan;
    const cfg = getResolvedFeeConfig();

    const basePlanFee = Math.max(0, Number(plan.originalAmount || 0));
    const discountAmt = Math.max(0, Math.min(basePlanFee, Number(plan.discountAmount || 0)));
    const netPlanFee = Math.max(0, basePlanFee - discountAmt);

    let payableNow = netPlanFee;
    let remainingAfter = 0;
    let instLabel = 'Full Payment';

    if (plan.mode === 'balance') {
      const remBase = Math.max(0, Number(plan.remainingBalanceBase || 0));
      const balDiscount = Math.max(0, Math.min(remBase, discountAmt));
      payableNow = Math.max(0, remBase - balDiscount);
      remainingAfter = 0;
      instLabel = payableNow === 0 ? 'Balance Settled (₹0 Payable)' : 'Installment 2 of 2 (Balance)';
    } else if (netPlanFee === 0) {
      payableNow = 0;
      remainingAfter = 0;
      instLabel = plan.couponCode ? '100% Coupon Discount (₹0 Fee)' : 'Free Batch Enrollment (₹0 Fee)';
    } else if (plan.installmentMode === 'installment1' && plan.allowInstallments) {
      const pct = Math.max(20, Math.min(80, Number(plan.firstInstallmentPercent || 50) || 50));
      payableNow = Math.max(1, Math.round((netPlanFee * pct) / 100));
      remainingAfter = Math.max(0, netPlanFee - payableNow);
      instLabel = `Installment 1 of 2 (${pct}%)`;
    }

    plan.amount = payableNow;
    plan.netPlanFee = netPlanFee;
    plan.remainingAfter = remainingAfter;
    plan.installmentLabel = instLabel;

    const isZeroFeeNow = payableNow <= 0;
    const upiNote = `${plan.planName} ${instLabel} (${portalState.currentUser ? portalState.currentUser.userId : ''})`.slice(0, 50);
    const upiLink = !isZeroFeeNow ? buildUpiPaymentLink(cfg.upiId, cfg.payeeName, payableNow, upiNote) : '';
    const qrSrc = !isZeroFeeNow ? buildQrCodeImgSrc(cfg, upiLink) : '';

    const qrImg = document.getElementById('checkout-qr-img');
    const upiMeta = document.getElementById('checkout-upi-payee-meta');
    const upiActions = document.getElementById('checkout-upi-actions-wrap');
    const upiAnchor = document.getElementById('checkout-upi-link');
    const headerAmtEl = document.getElementById('checkout-header-payable-amt');
    const summaryEl = document.getElementById('checkout-fee-breakdown-summary');
    const instWrap = document.getElementById('checkout-installment-schedule-wrap');
    const payFieldsWrap = document.getElementById('checkout-payment-fields-wrap');
    const zeroBanner = document.getElementById('checkout-zero-fee-banner');
    const submitBtn = document.getElementById('student-fee-submit-btn');
    const footerHint = document.getElementById('checkout-footer-hint');
    const noUpiWarning = document.getElementById('checkout-missing-upi-warning');

    if (qrImg) {
      if (isZeroFeeNow) {
        qrImg.style.display = 'none';
      } else if (qrSrc) {
        qrImg.src = qrSrc;
        qrImg.style.display = 'block';
      }
    }
    if (upiMeta) upiMeta.style.display = isZeroFeeNow ? 'none' : 'block';
    if (upiActions) upiActions.style.display = isZeroFeeNow ? 'none' : 'flex';
    if (upiAnchor && upiLink) upiAnchor.href = upiLink;
    if (instWrap) instWrap.style.display = (!isZeroFeeNow && plan.allowInstallments) ? 'block' : 'none';
    if (payFieldsWrap) payFieldsWrap.style.display = isZeroFeeNow ? 'none' : 'flex';
    if (zeroBanner) zeroBanner.style.display = isZeroFeeNow ? 'block' : 'none';
    if (noUpiWarning) noUpiWarning.style.display = (!isZeroFeeNow && !cfg.upiId && !cfg.qrImageUrl) ? 'block' : 'none';
    if (headerAmtEl) headerAmtEl.textContent = isZeroFeeNow ? '₹0 (Free)' : ('₹' + payableNow.toLocaleString('en-IN'));
    if (submitBtn) {
      submitBtn.disabled = (!isZeroFeeNow && !cfg.upiId && !cfg.qrImageUrl);
      submitBtn.innerHTML = isZeroFeeNow
        ? '<i class="fa-solid fa-paper-plane"></i> Send ₹0 Free Enrollment Request for Approval'
        : '<i class="fa-solid fa-paper-plane"></i> Submit UTR for Admin Approval';
    }
    if (footerHint) {
      footerHint.textContent = isZeroFeeNow
        ? 'No UPI payment or UTR is needed because the total payable fee is ₹0. Once Admin approves your request, your access will activate and a ₹0 Official Fee Receipt will unlock in Fee Payment History.'
        : 'Duplicate UTRs are automatically blocked. After Admin approves your UTR, your access will activate automatically and a printable PDF receipt will unlock in Fee Payment History.';
    }

    if (summaryEl) {
      summaryEl.innerHTML = `
        <div style="display:flex; justify-content:space-between; font-size:12px; color:var(--text-muted);">
          <span>${plan.mode === 'balance' ? 'Remaining Balance Due' : 'Total Plan Fee'}</span>
          <span class="mono-num" style="font-weight:700; color:var(--secondary);">₹${(plan.mode === 'balance' ? plan.remainingBalanceBase : basePlanFee).toLocaleString('en-IN')}</span>
        </div>
        ${discountAmt > 0 ? `
          <div style="display:flex; justify-content:space-between; font-size:12px; color:#047857; margin-top:3px;">
            <span>Coupon <strong>${escapeHtml(plan.couponCode)}</strong></span>
            <span class="mono-num" style="font-weight:800;">- ₹${discountAmt.toLocaleString('en-IN')}</span>
          </div>
        ` : ''}
        <div style="display:flex; justify-content:space-between; font-size:13.5px; font-weight:900; color:var(--secondary); margin-top:6px; padding-top:6px; border-top:1px dashed var(--border);">
          <span>Payable Now (${escapeHtml(instLabel)})</span>
          <span class="mono-num" style="color:${isZeroFeeNow ? '#059669' : 'var(--primary)'};">₹${payableNow.toLocaleString('en-IN')}</span>
        </div>
        ${remainingAfter > 0 ? `
          <div style="display:flex; justify-content:space-between; font-size:11.5px; color:#b45309; margin-top:4px; font-weight:700;">
            <span>Remaining Balance (Pay later)</span>
            <span class="mono-num">₹${remainingAfter.toLocaleString('en-IN')}</span>
          </div>
        ` : ''}
      `;
    }
  }

window.setStudentCheckoutInstallmentMode = function (modeVal) {
    if (!_selectedStudentFeePlan) return;
    _selectedStudentFeePlan.installmentMode = (modeVal === 'installment1') ? 'installment1' : 'full';
    recomputeCheckoutPayableAndQr();
  };

window.applyStudentFeeCoupon = async function () {
    if (!_selectedStudentFeePlan) return;
    const inp = document.getElementById('student-fee-coupon-input');
    const feedback = document.getElementById('student-fee-coupon-feedback');
    const code = String(inp ? inp.value : '').trim().toUpperCase();
    if (!code) {
      if (feedback) feedback.innerHTML = `<span style="color:#b91c1c;">Enter a promo coupon code first.</span>`;
      return;
    }
    const baseAmt = _selectedStudentFeePlan.mode === 'balance'
      ? _selectedStudentFeePlan.remainingBalanceBase
      : _selectedStudentFeePlan.originalAmount;
    const cfg = getResolvedFeeConfig();

    if (feedback) feedback.innerHTML = `<span style="color:var(--primary);"><span class="mini-spin"></span> Validating coupon...</span>`;
    let res = null;
    if (typeof apiCall === 'function') {
      try {
        res = await apiCall('validateFeeCoupon', {
          couponCode: code,
          feeType: _selectedStudentFeePlan.feeType,
          baseAmount: baseAmt
        }, true);
      } catch (e) {
        res = null;
      }
    }
    if (!res || (res.valid === undefined && res.discountAmount === undefined)) {
      res = evaluateFeeCouponLocally(cfg, code, _selectedStudentFeePlan.feeType, baseAmt);
    }

    if (res && (res.valid || res.success)) {
      _selectedStudentFeePlan.couponCode = res.code || code;
      _selectedStudentFeePlan.discountAmount = Math.max(0, Number(res.discountAmount || 0) || 0);
      if (feedback) {
        feedback.innerHTML = `<span style="color:#047857; font-weight:700;"><i class="fa-solid fa-circle-check"></i> ${escapeHtml(res.message || ('Coupon applied! Saved ₹' + _selectedStudentFeePlan.discountAmount))}</span> <button type="button" class="btn btn-secondary btn-sm" style="padding:1px 7px; font-size:10.5px; margin-left:6px;" onclick="window.clearStudentFeeCoupon()">Remove</button>`;
      }
      recomputeCheckoutPayableAndQr();
    } else {
      _selectedStudentFeePlan.couponCode = '';
      _selectedStudentFeePlan.discountAmount = 0;
      if (feedback) {
        feedback.innerHTML = `<span style="color:#b91c1c; font-weight:700;"><i class="fa-solid fa-circle-xmark"></i> ${escapeHtml((res && res.message) || 'Invalid or expired coupon code.')}</span>`;
      }
      recomputeCheckoutPayableAndQr();
    }
  };

window.clearStudentFeeCoupon = function () {
    if (!_selectedStudentFeePlan) return;
    _selectedStudentFeePlan.couponCode = '';
    _selectedStudentFeePlan.discountAmount = 0;
    const inp = document.getElementById('student-fee-coupon-input');
    const feedback = document.getElementById('student-fee-coupon-feedback');
    if (inp) inp.value = '';
    if (feedback) feedback.innerHTML = '';
    recomputeCheckoutPayableAndQr();
  };

window.openStudentUpiFeeCheckout = function (feeType, batchName, amount, planLabel, validityDays, planName, panelId, opts) {
    const options = opts || {};
    const targetPanelId = panelId || (document.getElementById('buy-plans-upi-checkout-panel') ? 'buy-plans-upi-checkout-panel' : 'profile-upi-checkout-panel');
    const panel = document.getElementById(targetPanelId);
    if (!panel) return;
    const cfg = getResolvedFeeConfig();
    const normFeeType = String(feeType || '').toLowerCase().includes('member') ? 'member' : 'batch';

    const origAmt = Math.max(0, Number(options.totalPlanFee || amount || 0) || 0);
    const isBalanceMode = options.mode === 'balance' && Number(options.remainingBalance || 0) > 0;

    _selectedStudentFeePlan = {
      feeType: normFeeType,
      batchName: normFeeType === 'member' ? 'ALL_BATCHES' : batchName,
      originalAmount: origAmt,
      amount: isBalanceMode ? Number(options.remainingBalance) : origAmt,
      planLabel: planLabel || planName || batchName,
      planName: planName || planLabel || batchName,
      validityDays: Number(validityDays) || 90,
      panelId: targetPanelId,
      allowInstallments: Boolean(options.allowInstallments && normFeeType === 'batch' && !isBalanceMode),
      firstInstallmentPercent: Math.max(20, Math.min(80, Number(options.firstInstallmentPercent || 50) || 50)),
      installmentMode: 'full',
      mode: isBalanceMode ? 'balance' : 'new',
      remainingBalanceBase: isBalanceMode ? Number(options.remainingBalance) : 0,
      priorPaid: Number(options.priorPaid || 0) || 0,
      couponCode: '',
      discountAmount: 0,
      installmentLabel: isBalanceMode ? 'Installment 2 of 2 (Balance)' : 'Full Payment'
    };

    const isInitiallyZero = _selectedStudentFeePlan.amount <= 0;
    const firstInstPct = _selectedStudentFeePlan.firstInstallmentPercent;
    const firstInstPreviewAmt = Math.round((origAmt * firstInstPct) / 100);
    const upiNote = `${_selectedStudentFeePlan.planName} (${portalState.currentUser ? portalState.currentUser.userId : ''})`.slice(0, 50);
    const initialUpiLink = (!isInitiallyZero && cfg.upiId) ? buildUpiPaymentLink(cfg.upiId, cfg.payeeName, _selectedStudentFeePlan.amount, upiNote) : '';
    const initialQrSrc = (!isInitiallyZero && (cfg.upiId || cfg.qrImageUrl)) ? buildQrCodeImgSrc(cfg, initialUpiLink) : '';

    panel.style.display = 'block';
    panel.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:10px; margin-bottom:14px; padding-bottom:10px; border-bottom:1px solid var(--border);">
        <div>
          <div style="font-size:11px; font-weight:800; color:var(--primary); text-transform:uppercase; letter-spacing:0.05em;">
            ${options.isRenewal ? 'PLAN RENEWAL · ' : ''}${isInitiallyZero ? 'FREE (₹0) ENROLLMENT REQUEST' : 'UPI / QR FEE CHECKOUT'}
          </div>
          <h4 style="margin:3px 0 0 0; font-size:16px; color:var(--secondary);">${escapeHtml(_selectedStudentFeePlan.planLabel)} · <span id="checkout-header-payable-amt" class="mono-num">${isInitiallyZero ? '₹0 (Free)' : ('₹' + _selectedStudentFeePlan.amount.toLocaleString('en-IN'))}</span></h4>
          <div style="font-size:11.5px; color:var(--text-muted); margin-top:2px;">${escapeHtml(cfg.paymentInstructions)}</div>
        </div>
        <button type="button" class="btn btn-secondary btn-sm" onclick="document.getElementById('${targetPanelId}').style.display='none'"><i class="fa-solid fa-xmark"></i> Close</button>
      </div>

      <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(260px, 1fr)); gap:18px; align-items:start;">
        <div id="checkout-qr-column" style="display:flex; flex-direction:column; align-items:center; gap:10px; padding:14px; border-radius:10px; background:var(--background); border:1px solid var(--border);">
          <img id="checkout-qr-img" src="${escapeHtml(initialQrSrc)}" alt="UPI Payment QR Code" style="display:${initialQrSrc && !isInitiallyZero ? 'block' : 'none'}; width:196px; height:196px; object-fit:contain; border-radius:8px; border:1px solid var(--border); background:#fff; padding:6px;">
          <div id="checkout-upi-payee-meta" style="display:${isInitiallyZero ? 'none' : 'block'}; text-align:center;">
            <div style="font-size:12px; font-weight:800; color:var(--secondary);">${escapeHtml(cfg.payeeName)}</div>
            ${cfg.upiId ? `<div class="mono-num" style="font-size:12.5px; font-weight:700; color:var(--primary); margin-top:2px;">${escapeHtml(cfg.upiId)}</div>` : ''}
          </div>
          <div id="checkout-missing-upi-warning" style="display:${!isInitiallyZero && !cfg.upiId && !cfg.qrImageUrl ? 'block' : 'none'}; width:100%; padding:10px; border-radius:8px; background:rgba(245,158,11,0.12); border:1px solid rgba(245,158,11,0.35); color:#b45309; font-size:12px; font-weight:700;">
            <i class="fa-solid fa-circle-info"></i> Admin has not configured UPI/QR yet. If you have a 100% discount coupon, apply it on the right to enroll for ₹0!
          </div>
          <div id="checkout-fee-breakdown-summary" style="width:100%; padding:10px 12px; border-radius:8px; background:var(--surface); border:1px solid var(--border);"></div>
          <div id="checkout-upi-actions-wrap" style="display:${isInitiallyZero ? 'none' : 'flex'}; gap:8px; flex-wrap:wrap; justify-content:center;">
            ${cfg.upiId ? `<button type="button" class="btn btn-secondary btn-sm" onclick="navigator.clipboard && navigator.clipboard.writeText('${escapeHtml(cfg.upiId).replace(/'/g, "\\'")}').then(()=>showToast('📋 UPI ID copied!'))"><i class="fa-regular fa-copy"></i> Copy UPI ID</button>` : ''}
            ${cfg.upiId ? `<a id="checkout-upi-link" href="${escapeHtml(initialUpiLink)}" class="btn btn-primary btn-sm" style="text-decoration:none;"><i class="fa-solid fa-mobile-screen-button"></i> Pay in UPI App</a>` : ''}
          </div>
        </div>

        <div style="display:flex; flex-direction:column; gap:11px;">
          ${_selectedStudentFeePlan.allowInstallments ? `
            <div id="checkout-installment-schedule-wrap" style="padding:10px 12px; border-radius:9px; border:1px solid var(--border); background:var(--background);">
              <div style="font-size:11.5px; font-weight:800; color:var(--secondary); margin-bottom:6px;"><i class="fa-solid fa-layer-group" style="color:var(--primary);"></i> Payment Schedule</div>
              <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
                <label style="display:flex; align-items:flex-start; gap:7px; padding:8px; border-radius:8px; border:1px solid var(--border); background:var(--surface); cursor:pointer; font-size:12px; margin:0;">
                  <input type="radio" name="checkout-installment-mode" value="full" checked onchange="window.setStudentCheckoutInstallmentMode('full')" style="margin-top:2px;">
                  <span><strong>Full Payment</strong><br><span style="font-size:11px; color:var(--text-muted);">₹${origAmt.toLocaleString('en-IN')} · ₹0 balance</span></span>
                </label>
                <label style="display:flex; align-items:flex-start; gap:7px; padding:8px; border-radius:8px; border:1px solid var(--border); background:var(--surface); cursor:pointer; font-size:12px; margin:0;">
                  <input type="radio" name="checkout-installment-mode" value="installment1" onchange="window.setStudentCheckoutInstallmentMode('installment1')" style="margin-top:2px;">
                  <span><strong>Installment 1 of 2</strong><br><span style="font-size:11px; color:var(--text-muted);">Pay ${firstInstPct}% (₹${firstInstPreviewAmt.toLocaleString('en-IN')}) now</span></span>
                </label>
              </div>
            </div>
          ` : ''}

          <!-- Promo / Discount Coupon Box (hidden if plan is already ₹0 from Admin) -->
          ${origAmt > 0 ? `
            <div class="rp-coupon-box">
              <label style="font-size:11.5px; font-weight:800; color:var(--secondary); display:block; margin-bottom:5px;"><i class="fa-solid fa-tag" style="color:#047857;"></i> Have a Promo / Discount Coupon?</label>
              <div style="display:flex; gap:6px;">
                <input type="text" id="student-fee-coupon-input" class="form-control mono-num" placeholder="Enter coupon code (e.g. SAVE100)" maxlength="32" style="text-transform:uppercase; min-height:34px; margin:0; flex:1;">
                <button type="button" class="btn btn-secondary btn-sm" onclick="window.applyStudentFeeCoupon()" style="white-space:nowrap;">Apply</button>
              </div>
              <div id="student-fee-coupon-feedback" style="font-size:11.5px; margin-top:5px;"></div>
            </div>
          ` : ''}

          <div id="checkout-zero-fee-banner" style="display:${isInitiallyZero ? 'block' : 'none'}; padding:11px 13px; border-radius:10px; background:rgba(16,185,129,0.12); border:1.5px solid rgba(16,185,129,0.4); color:#047857; font-size:12.5px; font-weight:700; line-height:1.45;">
            <i class="fa-solid fa-circle-check"></i> Total Payable Fee is <strong>₹0</strong> — No payment or UTR details required! Click below to send your enrollment request directly for Admin Approval.
          </div>

          <div id="student-fee-checkout-error" style="display:none; padding:9px 12px; border-radius:8px; background:rgba(239,68,68,0.1); border:1px solid rgba(239,68,68,0.35); color:#b91c1c; font-size:12px; font-weight:700;"></div>

          <div id="checkout-payment-fields-wrap" style="display:${isInitiallyZero ? 'none' : 'flex'}; flex-direction:column; gap:11px;">
            <div class="form-group" style="margin:0;">
              <label style="font-size:12px; font-weight:700;">12-Digit UTR / UPI Transaction Reference ID <span style="color:#ef4444;">*</span></label>
              <input type="text" id="student-fee-utr-input" class="form-control mono-num" placeholder="e.g. 423198765432" maxlength="40" oninput="const e=document.getElementById('student-fee-checkout-error'); if(e) e.style.display='none';">
            </div>
            <div class="form-group" style="margin:0;">
              <label style="font-size:12px; font-weight:700;">Payment Mode</label>
              <select id="student-fee-mode-select" class="form-control">
                <option value="UPI">UPI (GPay / PhonePe / Paytm / BHIM)</option>
                <option value="QR Scan">QR Code Scan</option>
                <option value="Bank Transfer">NEFT / IMPS / Bank Transfer</option>
              </select>
            </div>
          </div>
          <div class="form-group" style="margin:0;">
            <label style="font-size:12px; font-weight:700;">Remarks (Optional)</label>
            <input type="text" id="student-fee-remarks-input" class="form-control" placeholder="${isInitiallyZero ? 'e.g. Requesting free enrollment approval' : 'e.g. Paid via PhonePe'}">
          </div>
          <button type="button" id="student-fee-submit-btn" class="btn btn-success" onclick="window.submitStudentFeeUtrPayment()">
            <i class="fa-solid fa-paper-plane"></i> ${isInitiallyZero ? 'Send ₹0 Free Enrollment Request for Approval' : 'Submit UTR for Admin Approval'}
          </button>
          <div id="checkout-footer-hint" style="font-size:11px; color:var(--text-muted); line-height:1.45;">
            Duplicate UTRs are automatically blocked. After Admin approves your request, your ${normFeeType === 'member' ? 'Member Plan & batch access' : `enrollment in "${escapeHtml(batchName)}"`} will activate automatically and a printable PDF receipt will unlock in Fee Payment History.
          </div>
        </div>
      </div>
    `;
    recomputeCheckoutPayableAndQr();
    panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };

window.submitStudentFeeUtrPayment = async function () {
    if (!_selectedStudentFeePlan || !portalState.currentUser) return;
    const errBox = document.getElementById('student-fee-checkout-error');
    const showCheckoutErr = (msg) => {
      if (errBox) {
        errBox.innerHTML = `<i class="fa-solid fa-circle-exclamation"></i> ${escapeHtml(msg)}`;
        errBox.style.display = 'block';
      }
      safeNotify(msg);
    };

    const isZeroFeeRequest = Number(_selectedStudentFeePlan.amount || 0) <= 0;
    const remarks = String(document.getElementById('student-fee-remarks-input')?.value || '').trim();
    let utr = '';
    let mode = '';

    if (isZeroFeeRequest) {
      utr = `FREE-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
      mode = _selectedStudentFeePlan.couponCode ? '100% Coupon (₹0 Paid)' : 'Free Batch (₹0 Fee)';
    } else {
      utr = String(document.getElementById('student-fee-utr-input')?.value || '').trim();
      const normUtr = utr.toUpperCase().replace(/\s+/g, '');
      mode = String(document.getElementById('student-fee-mode-select')?.value || 'UPI').trim();
      if (!normUtr || normUtr.length < 6) {
        showCheckoutErr('Please enter a valid UPI UTR / Transaction Reference ID (at least 6 characters).');
        return;
      }

      // Client-side Duplicate UTR Pre-Check before hitting server
      const existingRows = (portalState.globalData && Array.isArray(portalState.globalData.userFeeReceipts)) ? portalState.globalData.userFeeReceipts : [];
      const dupRow = existingRows.find((r) => {
        const rUtr = String(r.UTR || '').trim().toUpperCase().replace(/\s+/g, '');
        const rSt = normalizeFeeStatusDisplay(r.Status);
        return rUtr && rUtr === normUtr && rSt !== 'Rejected';
      });
      if (dupRow) {
        showCheckoutErr(`Duplicate UTR blocked: "${utr}" was already submitted under Receipt ${dupRow.ReceiptNo || '-'} (${normalizeFeeStatusDisplay(dupRow.Status)}).`);
        return;
      }
    }

    const btn = document.getElementById('student-fee-submit-btn');
    if (btn) { btn.disabled = true; btn.innerHTML = '<span class="mini-spin"></span> Submitting...'; }
    try {
      const zeroFeeBaseRemarks = remarks
        || (_selectedStudentFeePlan.couponCode ? `100% Coupon (${_selectedStudentFeePlan.couponCode}) — ₹0 Paid` : 'Free Batch (₹0 Fee) Approval Request');
      const finalRemarks = isZeroFeeRequest
        ? `${zeroFeeBaseRemarks} [₹0_FREE]`.trim()
        : remarks;

      const basePayload = {
        userId: portalState.currentUser.userId,
        feeType: _selectedStudentFeePlan.feeType,
        batchName: _selectedStudentFeePlan.batchName,
        planName: _selectedStudentFeePlan.planName,
        validityDays: _selectedStudentFeePlan.validityDays,
        amountPaid: isZeroFeeRequest ? 0 : _selectedStudentFeePlan.amount,
        totalPlanFee: _selectedStudentFeePlan.originalAmount,
        couponCode: _selectedStudentFeePlan.couponCode || '',
        discountAmount: _selectedStudentFeePlan.discountAmount || 0,
        installmentLabel: _selectedStudentFeePlan.installmentLabel || (isZeroFeeRequest ? 'Free Enrollment (₹0 Paid)' : 'Full Payment'),
        utr: utr,
        paymentMode: mode,
        remarks: finalRemarks,
        isZeroFeeRequest: isZeroFeeRequest
      };

      let res = await apiCall('submitStudentFeePayment', basePayload);

      // If remote Apps Script backend enforces amountPaid > 0, retry seamlessly with sentinel amount while tagged [₹0_FREE]
      // so the real approval request is stored on the server and displayed as ₹0 across student/admin ledgers & receipts.
      const isPositiveAmtErr = (r) => Boolean(
        r && !r.success && /greater\s*than\s*0|amount.*>\s*0|amount.*positive|invalid.*amount/i.test(String(r.message || ''))
      );
      if (isZeroFeeRequest && isPositiveAmtErr(res)) {
        res = await apiCall('submitStudentFeePayment', {
          ...basePayload,
          amountPaid: 0.01,
          remainingBalance: 0
        });
        if (isPositiveAmtErr(res)) {
          res = await apiCall('submitStudentFeePayment', {
            ...basePayload,
            amountPaid: 1,
            remainingBalance: 0
          });
        }
      }

      if (res && res.success) {
        safeNotify(res.message || (isZeroFeeRequest
          ? '✅ ₹0 Enrollment request sent for Admin Approval! Track status & receipt in Fee Payment History.'
          : '✅ Payment UTR submitted! Track approval in Fee Payment History.'));
        const panel = document.getElementById(_selectedStudentFeePlan.panelId || 'buy-plans-upi-checkout-panel');
        if (panel) panel.style.display = 'none';
        if (typeof window.switchBuyPlansSubtab === 'function' && document.getElementById('buy-plans-history-mount')) {
          window.switchBuyPlansSubtab('history');
        } else {
          await window.renderProfileFeesSection(true);
        }
      } else {
        showCheckoutErr((res && res.message) || 'Could not submit fee request.');
      }
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = isZeroFeeRequest
          ? '<i class="fa-solid fa-paper-plane"></i> Send ₹0 Free Enrollment Request for Approval'
          : '<i class="fa-solid fa-paper-plane"></i> Submit UTR for Admin Approval';
      }
    }
  };

export function readAdminFeeBuilderInputsIntoState() {
    if (!_adminFeeBuilderState) return;
    // Capture Member Plan edits from DOM
    document.querySelectorAll('#adm-member-plans-list [data-mp-idx]').forEach((row) => {
      const idx = Number(row.getAttribute('data-mp-idx'));
      if (!_adminFeeBuilderState.memberPlans[idx]) return;
      _adminFeeBuilderState.memberPlans[idx] = {
        ..._adminFeeBuilderState.memberPlans[idx],
        name: String(row.querySelector('.adm-mp-name')?.value || '').trim(),
        amount: Math.max(0, Number(row.querySelector('.adm-mp-amt')?.value || 0) || 0),
        validityDays: Math.max(1, Number(row.querySelector('.adm-mp-days')?.value || 365) || 365),
        accessScope: String(row.querySelector('.adm-mp-scope')?.value || 'ALL_PAST_CURRENT_UPCOMING'),
        includedBatches: String(row.querySelector('.adm-mp-batches')?.value || '').trim(),
        includeUpcoming: Boolean(row.querySelector('.adm-mp-upcoming')?.checked),
        description: String(row.querySelector('.adm-mp-desc')?.value || '').trim()
      };
    });
    // Capture Batch Plan edits from DOM (including Installments toggle)
    document.querySelectorAll('#adm-batch-plans-builder [data-bp-batch]').forEach((row) => {
      const bName = row.getAttribute('data-bp-batch');
      const idx = Number(row.getAttribute('data-bp-idx'));
      if (!_adminFeeBuilderState.batchPlans[bName] || !_adminFeeBuilderState.batchPlans[bName][idx]) return;
      _adminFeeBuilderState.batchPlans[bName][idx] = {
        ..._adminFeeBuilderState.batchPlans[bName][idx],
        name: String(row.querySelector('.adm-bp-name')?.value || '').trim(),
        amount: Math.max(0, Number(row.querySelector('.adm-bp-amt')?.value || 0) || 0),
        validityDays: Math.max(1, Number(row.querySelector('.adm-bp-days')?.value || 90) || 90),
        note: String(row.querySelector('.adm-bp-note')?.value || '').trim(),
        allowInstallments: Boolean(row.querySelector('.adm-bp-inst')?.checked),
        installmentCount: 2,
        firstInstallmentPercent: Math.max(20, Math.min(80, Number(row.querySelector('.adm-bp-inst-pct')?.value || 50) || 50))
      };
    });
    // Capture Promo Coupon edits from DOM
    document.querySelectorAll('#adm-coupons-list [data-cp-idx]').forEach((row) => {
      const idx = Number(row.getAttribute('data-cp-idx'));
      if (!_adminFeeBuilderState.coupons[idx]) return;
      _adminFeeBuilderState.coupons[idx] = {
        ..._adminFeeBuilderState.coupons[idx],
        code: String(row.querySelector('.adm-cp-code')?.value || '').trim().toUpperCase().replace(/[^A-Z0-9_-]/g, ''),
        discountType: String(row.querySelector('.adm-cp-type')?.value || 'FLAT').toUpperCase() === 'PERCENT' ? 'PERCENT' : 'FLAT',
        value: Math.max(0, Number(row.querySelector('.adm-cp-val')?.value || 0) || 0),
        appliesTo: String(row.querySelector('.adm-cp-applies')?.value || 'ALL').toUpperCase(),
        minAmount: Math.max(0, Number(row.querySelector('.adm-cp-min')?.value || 0) || 0),
        maxUses: Math.max(0, parseInt(row.querySelector('.adm-cp-max')?.value || 0, 10) || 0),
        validUntil: String(row.querySelector('.adm-cp-exp')?.value || '').trim().slice(0, 10),
        active: Boolean(row.querySelector('.adm-cp-active')?.checked)
      };
    });
  }

window.addAdminMemberPlanRow = function () {
    readAdminFeeBuilderInputsIntoState();
    _adminFeeBuilderState = _adminFeeBuilderState || { memberPlans: [], batchPlans: {}, coupons: [] };
    _adminFeeBuilderState.memberPlans.push({
      id: 'MP-' + Date.now(),
      name: 'Member Plan ' + (_adminFeeBuilderState.memberPlans.length + 1),
      amount: 0,
      validityDays: 365,
      accessScope: 'ALL_PAST_CURRENT_UPCOMING',
      includedBatches: '',
      includeUpcoming: true,
      description: ''
    });
    renderAdminFeeBuildersOnly();
  };

window.removeAdminMemberPlanRow = function (idx) {
    readAdminFeeBuilderInputsIntoState();
    if (_adminFeeBuilderState && Array.isArray(_adminFeeBuilderState.memberPlans)) {
      _adminFeeBuilderState.memberPlans.splice(idx, 1);
    }
    renderAdminFeeBuildersOnly();
  };

window.addAdminBatchPlanRow = function (batchName) {
    readAdminFeeBuilderInputsIntoState();
    _adminFeeBuilderState = _adminFeeBuilderState || { memberPlans: [], batchPlans: {}, coupons: [] };
    if (!Array.isArray(_adminFeeBuilderState.batchPlans[batchName])) {
      _adminFeeBuilderState.batchPlans[batchName] = [];
    }
    _adminFeeBuilderState.batchPlans[batchName].push({
      id: 'BP-' + Date.now(),
      name: 'Plan ' + (_adminFeeBuilderState.batchPlans[batchName].length + 1),
      amount: 0,
      validityDays: 90,
      note: '',
      allowInstallments: false,
      installmentCount: 2,
      firstInstallmentPercent: 50
    });
    renderAdminFeeBuildersOnly();
  };

window.addAdminBatchStandardTierPresets = function (batchName) {
    readAdminFeeBuilderInputsIntoState();
    _adminFeeBuilderState = _adminFeeBuilderState || { memberPlans: [], batchPlans: {}, coupons: [] };
    if (!Array.isArray(_adminFeeBuilderState.batchPlans[batchName])) {
      _adminFeeBuilderState.batchPlans[batchName] = [];
    }
    const existingNames = new Set(_adminFeeBuilderState.batchPlans[batchName].map(p => String(p.name || '').toLowerCase()));
    const ts = Date.now();
    const presets = [
      { id: 'BP-' + ts + '-M', name: 'Monthly Plan', amount: 0, validityDays: 30, note: '30-day rolling batch access', allowInstallments: false, installmentCount: 2, firstInstallmentPercent: 50 },
      { id: 'BP-' + ts + '-Q', name: 'Quarterly Plan', amount: 0, validityDays: 90, note: '3-month batch access with priority review', allowInstallments: true, installmentCount: 2, firstInstallmentPercent: 50 },
      { id: 'BP-' + ts + '-A', name: 'Annual Plan', amount: 0, validityDays: 365, note: 'Full-year batch access (best value)', allowInstallments: true, installmentCount: 2, firstInstallmentPercent: 50 }
    ];
    let added = 0;
    presets.forEach((p) => {
      if (!existingNames.has(p.name.toLowerCase())) {
        _adminFeeBuilderState.batchPlans[batchName].push(p);
        added++;
      }
    });
    renderAdminFeeBuildersOnly();
    safeNotify(added > 0 ? `Added ${added} Monthly/Quarterly/Annual plan template(s) for ${batchName} — enter ₹ fees & Save!` : `Monthly, Quarterly & Annual plans already exist for ${batchName}.`);
  };

window.removeAdminBatchPlanRow = function (batchName, idx) {
    readAdminFeeBuilderInputsIntoState();
    if (_adminFeeBuilderState && Array.isArray(_adminFeeBuilderState.batchPlans[batchName])) {
      _adminFeeBuilderState.batchPlans[batchName].splice(idx, 1);
    }
    renderAdminFeeBuildersOnly();
  };

window.addAdminCouponRow = function () {
    readAdminFeeBuilderInputsIntoState();
    _adminFeeBuilderState = _adminFeeBuilderState || { memberPlans: [], batchPlans: {}, coupons: [] };
    if (!Array.isArray(_adminFeeBuilderState.coupons)) _adminFeeBuilderState.coupons = [];
    _adminFeeBuilderState.coupons.push({
      code: '',
      discountType: 'FLAT',
      value: 100,
      appliesTo: 'ALL',
      minAmount: 0,
      maxUses: 0,
      usedCount: 0,
      validUntil: '',
      active: true,
      note: ''
    });
    renderAdminFeeBuildersOnly();
  };

window.removeAdminCouponRow = function (idx) {
    readAdminFeeBuilderInputsIntoState();
    if (_adminFeeBuilderState && Array.isArray(_adminFeeBuilderState.coupons)) {
      _adminFeeBuilderState.coupons.splice(idx, 1);
    }
    renderAdminFeeBuildersOnly();
  };

export function renderAdminFeeBuildersOnly() {
    const mpMount = document.getElementById('adm-member-plans-list');
    const bpMount = document.getElementById('adm-batch-plans-builder');
    const cpMount = document.getElementById('adm-coupons-list');
    if (!_adminFeeBuilderState) return;

    if (mpMount) {
      const mPlans = _adminFeeBuilderState.memberPlans || [];
      mpMount.innerHTML = mPlans.length > 0 ? mPlans.map((mp, idx) => `
        <div data-mp-idx="${idx}" style="padding:12px; border-radius:10px; border:1px solid var(--border); background:var(--background); display:grid; grid-template-columns:repeat(auto-fit, minmax(150px, 1fr)); gap:8px; align-items:end;">
          <div class="form-group" style="margin:0;">
            <label style="font-size:11px; font-weight:700;">Member Tier Name</label>
            <input type="text" class="form-control adm-mp-name" value="${escapeHtml(mp.name)}" placeholder="e.g. Gold All-Access" style="min-height:34px; margin:0;">
          </div>
          <div class="form-group" style="margin:0;">
            <label style="font-size:11px; font-weight:700;">Fee Amount (₹)</label>
            <input type="number" min="0" class="form-control mono-num adm-mp-amt" value="${mp.amount}" style="min-height:34px; margin:0;">
          </div>
          <div class="form-group" style="margin:0;">
            <label style="font-size:11px; font-weight:700;">Validity (Days)</label>
            <input type="number" min="1" class="form-control mono-num adm-mp-days" value="${mp.validityDays}" style="min-height:34px; margin:0;">
          </div>
          <div class="form-group" style="margin:0; grid-column:span 2;">
            <label style="font-size:11px; font-weight:700;">Default Batch Access Scope</label>
            <select class="form-control adm-mp-scope" style="min-height:34px; margin:0; font-size:12px;">
              <option value="ALL_PAST_CURRENT_UPCOMING" ${mp.accessScope === 'ALL_PAST_CURRENT_UPCOMING' ? 'selected' : ''}>All Batches (Past + Current + Upcoming)</option>
              <option value="ALL_EXISTING_ONLY" ${mp.accessScope === 'ALL_EXISTING_ONLY' ? 'selected' : ''}>All Existing Batches Only (No Future)</option>
              <option value="CURRENT_AND_UPCOMING" ${mp.accessScope === 'CURRENT_AND_UPCOMING' ? 'selected' : ''}>Current &amp; Upcoming Batches</option>
              <option value="CUSTOM_SELECTED" ${mp.accessScope === 'CUSTOM_SELECTED' ? 'selected' : ''}>Specific Selected Batches</option>
            </select>
          </div>
          <div class="form-group" style="margin:0;">
            <label style="font-size:11px; font-weight:700;">Custom Batches (CSV)</label>
            <input type="text" class="form-control adm-mp-batches" value="${escapeHtml(mp.includedBatches || '')}" placeholder="Optional for Custom scope" style="min-height:34px; margin:0;">
          </div>
          <div class="form-group" style="margin:0; grid-column:span 2;">
            <label style="font-size:11px; font-weight:700;">Description</label>
            <input type="text" class="form-control adm-mp-desc" value="${escapeHtml(mp.description || '')}" placeholder="Shown to students on Buy Plans page" style="min-height:34px; margin:0;">
          </div>
          <div style="display:flex; align-items:center; justify-content:space-between; gap:8px;">
            <label style="display:inline-flex; align-items:center; gap:5px; font-size:11.5px; font-weight:700; cursor:pointer; margin:0;">
              <input type="checkbox" class="adm-mp-upcoming" ${mp.includeUpcoming ? 'checked' : ''}> Auto-Upcoming
            </label>
            <button type="button" class="btn btn-danger btn-sm" style="padding:4px 8px; min-height:30px;" onclick="window.removeAdminMemberPlanRow(${idx})" title="Remove Member Plan"><i class="fa-solid fa-trash"></i></button>
          </div>
        </div>
      `).join('') : `<div style="padding:12px; border-radius:8px; border:1px dashed var(--border); font-size:12px; color:var(--text-muted);">No Member Plans added yet. Click <strong>+ Add Member Plan</strong> to create Bronze / Silver / Gold / All-Access tiers.</div>`;
    }

    if (bpMount) {
      const customBatches = typeof getInstituteBatchesList === 'function'
        ? getInstituteBatchesList().filter((b) => b && b.toLowerCase() !== 'rp-trail' && b.toLowerCase() !== 'general batch' && b.toLowerCase() !== 'free tier')
        : [];
      const allBatches = Array.from(new Set([...customBatches, ...Object.keys(_adminFeeBuilderState.batchPlans || {})])).filter((b) => b && b.toLowerCase() !== 'rp-trail');

      if (allBatches.length === 0) {
        bpMount.innerHTML = `<div style="padding:14px; border-radius:10px; border:1px dashed var(--border); font-size:12.5px; color:var(--text-muted);">No custom batches created yet. Create a batch in <strong>Users &amp; Roles</strong> first, then add one or more pricing plans for it here. (<strong>RP-Trail</strong> is always Free ₹0.)</div>`;
      } else {
        bpMount.innerHTML = allBatches.map((bName) => {
          const plans = _adminFeeBuilderState.batchPlans[bName] || [];
          const safeB = escapeHtml(bName).replace(/'/g, "\\'");
          return `
            <div style="padding:12px 14px; border-radius:10px; border:1px solid var(--border); background:var(--background); margin-bottom:10px;">
              <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; margin-bottom:8px;">
                <strong style="font-size:13.5px; color:var(--secondary);"><i class="fa-solid fa-layer-group" style="color:var(--primary);"></i> ${escapeHtml(bName)} <span style="font-size:11px; color:var(--text-muted); font-weight:600;">(${plans.length} plan${plans.length === 1 ? '' : 's'})</span></strong>
                <div style="display:flex; gap:6px; flex-wrap:wrap;">
                  <button type="button" class="btn btn-secondary btn-sm" style="padding:4px 9px; font-size:11px; min-height:28px;" onclick="window.addAdminBatchStandardTierPresets('${safeB}')" title="Quickly add Monthly (30d), Quarterly (90d), and Annual (365d) tiers"><i class="fa-solid fa-wand-magic-sparkles"></i> + Monthly / Quarterly / Annual</button>
                  <button type="button" class="btn btn-secondary btn-sm" style="padding:4px 10px; font-size:11.5px; min-height:28px;" onclick="window.addAdminBatchPlanRow('${safeB}')"><i class="fa-solid fa-plus"></i> Add Custom Plan</button>
                </div>
              </div>
              ${plans.length > 0 ? plans.map((pl, idx) => `
                <div data-bp-batch="${escapeHtml(bName)}" data-bp-idx="${idx}" style="display:grid; grid-template-columns:1.1fr 95px 85px 1.2fr auto 74px auto; gap:7px; align-items:center; margin-bottom:6px;">
                  <input type="text" class="form-control adm-bp-name" value="${escapeHtml(pl.name)}" placeholder="e.g. Monthly / Full Batch" style="min-height:32px; margin:0; font-size:12px;">
                  <input type="number" min="0" class="form-control mono-num adm-bp-amt" value="${pl.amount}" placeholder="₹ Fee" style="min-height:32px; margin:0; font-size:12px;">
                  <input type="number" min="1" class="form-control mono-num adm-bp-days" value="${pl.validityDays}" placeholder="Days" style="min-height:32px; margin:0; font-size:12px;">
                  <input type="text" class="form-control adm-bp-note" value="${escapeHtml(pl.note || '')}" placeholder="Plan note (optional)" style="min-height:32px; margin:0; font-size:12px;">
                  <label style="display:inline-flex; align-items:center; gap:5px; font-size:11px; font-weight:700; white-space:nowrap; margin:0; cursor:pointer;" title="Allow student to split fee into 2 installments">
                    <input type="checkbox" class="adm-bp-inst" ${pl.allowInstallments ? 'checked' : ''}> 2-Part Split
                  </label>
                  <input type="number" min="20" max="80" class="form-control mono-num adm-bp-inst-pct" value="${pl.firstInstallmentPercent || 50}" placeholder="1st %" title="Installment 1 percentage (20-80%)" style="min-height:32px; margin:0; font-size:11.5px;">
                  <button type="button" class="btn btn-danger btn-sm" style="padding:4px 8px; min-height:30px;" onclick="window.removeAdminBatchPlanRow('${safeB}', ${idx})" title="Delete Plan"><i class="fa-solid fa-trash"></i></button>
                </div>
              `).join('') : `<div style="font-size:11.5px; color:var(--text-muted);">No pricing plan added for ${escapeHtml(bName)} yet.</div>`}
            </div>
          `;
        }).join('');
      }
    }

    if (cpMount) {
      const coupons = _adminFeeBuilderState.coupons || [];
      cpMount.innerHTML = coupons.length > 0 ? coupons.map((cp, idx) => `
        <div data-cp-idx="${idx}" style="padding:11px 12px; border-radius:10px; border:1px solid var(--border); background:var(--background); display:grid; grid-template-columns:repeat(auto-fit, minmax(120px, 1fr)); gap:8px; align-items:end;">
          <div class="form-group" style="margin:0;">
            <label style="font-size:11px; font-weight:700;">Coupon Code</label>
            <input type="text" class="form-control mono-num adm-cp-code" value="${escapeHtml(cp.code)}" placeholder="e.g. RP200" maxlength="32" style="text-transform:uppercase; min-height:32px; margin:0; font-size:12px;">
          </div>
          <div class="form-group" style="margin:0;">
            <label style="font-size:11px; font-weight:700;">Discount Type</label>
            <select class="form-control adm-cp-type" style="min-height:32px; margin:0; font-size:12px;">
              <option value="FLAT" ${cp.discountType === 'FLAT' ? 'selected' : ''}>Flat ₹ Off</option>
              <option value="PERCENT" ${cp.discountType === 'PERCENT' ? 'selected' : ''}>Percent % Off</option>
            </select>
          </div>
          <div class="form-group" style="margin:0;">
            <label style="font-size:11px; font-weight:700;">Value (₹ / %)</label>
            <input type="number" min="0" class="form-control mono-num adm-cp-val" value="${cp.value}" style="min-height:32px; margin:0; font-size:12px;">
          </div>
          <div class="form-group" style="margin:0;">
            <label style="font-size:11px; font-weight:700;">Applies To</label>
            <select class="form-control adm-cp-applies" style="min-height:32px; margin:0; font-size:12px;">
              <option value="ALL" ${cp.appliesTo === 'ALL' ? 'selected' : ''}>All Plans</option>
              <option value="BATCH" ${cp.appliesTo === 'BATCH' ? 'selected' : ''}>Batch Fees Only</option>
              <option value="MEMBER" ${cp.appliesTo === 'MEMBER' ? 'selected' : ''}>Member Plans Only</option>
            </select>
          </div>
          <div class="form-group" style="margin:0;">
            <label style="font-size:11px; font-weight:700;">Min Fee (₹)</label>
            <input type="number" min="0" class="form-control mono-num adm-cp-min" value="${cp.minAmount || 0}" style="min-height:32px; margin:0; font-size:12px;">
          </div>
          <div class="form-group" style="margin:0;">
            <label style="font-size:11px; font-weight:700;">Expiry Date</label>
            <input type="date" class="form-control adm-cp-exp" value="${escapeHtml(cp.validUntil || '')}" style="min-height:32px; margin:0; font-size:12px;">
          </div>
          <div class="form-group" style="margin:0;">
            <label style="font-size:11px; font-weight:700;">Max Uses (0=∞)</label>
            <input type="number" min="0" class="form-control mono-num adm-cp-max" value="${cp.maxUses || 0}" style="min-height:32px; margin:0; font-size:12px;">
          </div>
          <div style="display:flex; align-items:center; justify-content:space-between; gap:8px;">
            <label style="display:inline-flex; align-items:center; gap:5px; font-size:11.5px; font-weight:700; cursor:pointer; margin:0;">
              <input type="checkbox" class="adm-cp-active" ${cp.active !== false ? 'checked' : ''}> Active <span class="mono-num" style="color:var(--text-muted); font-size:10.5px;">(${cp.usedCount || 0} used)</span>
            </label>
            <button type="button" class="btn btn-danger btn-sm" style="padding:4px 8px; min-height:30px;" onclick="window.removeAdminCouponRow(${idx})" title="Delete Coupon"><i class="fa-solid fa-trash"></i></button>
          </div>
        </div>
      `).join('') : `<div style="padding:12px; border-radius:8px; border:1px dashed var(--border); font-size:12px; color:var(--text-muted);">No discount coupons created yet. Click <strong>+ Add Coupon</strong> to create flat ₹ or % promo codes for students.</div>`;
    }
  }

export function renderAdminLedgerRowsOnly() {
    const tbody = document.getElementById('admin-fee-ledger-tbody');
    if (!tbody) return;
    const ledger = (portalState.adminData && Array.isArray(portalState.adminData.feeLedger)) ? portalState.adminData.feeLedger : [];
    if (ledger.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:16px; color:var(--text-muted); font-size:12.5px;">Fee ledger is empty. Student UPI submissions and verified payments will appear here and in the <code>FEE_LEDGER</code> Google Sheet.</td></tr>`;
      return;
    }
    tbody.innerHTML = ledger.map((r) => {
      const receiptNo = String(r.ReceiptNo || r.ReceiptID || '-');
      const safeRid = escapeHtml(receiptNo).replace(/'/g, "\\'");
      const stName = r.StudentName || r.UserName || r.UserID || '-';
      const isMem = String(r.FeeType || '').toLowerCase().includes('member');
      const planCol = r.PlanName ? `${r.PlanName}${!isMem && r.Batch ? ' (' + r.Batch + ')' : ''}` : (isMem ? '★ Member Plan' : (r.Batch || '-'));
      const instLabel = String(r.InstallmentLabel || r.InstallmentNo || '').trim();
      const couponCode = String(r.CouponCode || '').trim();
      const remBal = getEffectiveFeeRemainingBalance(r);
      const effAmt = getEffectiveFeeAmountPaid(r);
      const isApproved = normalizeFeeStatusDisplay(r.Status) === 'Approved';
      return `
        <tr>
          <td class="mono-num" style="font-weight:700;">${escapeHtml(receiptNo)}</td>
          <td><strong>${escapeHtml(stName)}</strong> <span class="mono-num" style="font-size:11px; color:var(--text-muted);">(${escapeHtml(r.UserID || '-')})</span></td>
          <td>
            <div>${escapeHtml(planCol)}</div>
            <div style="font-size:10.5px; color:var(--text-muted);">
              ${instLabel && instLabel !== '-' ? escapeHtml(instLabel) : ''}${couponCode && couponCode !== '-' ? ` · Coupon: ${escapeHtml(couponCode)}` : ''}
            </div>
          </td>
          <td class="mono-num">
            <div style="font-weight:800;">₹${effAmt.toLocaleString('en-IN')}</div>
            ${remBal > 0
              ? `<div style="font-size:10.5px; color:#b45309; font-weight:700;">Bal ₹${remBal.toLocaleString('en-IN')}</div>`
              : (effAmt === 0 ? `<div style="font-size:10.5px; color:#047857; font-weight:700;">₹0 Paid (Free / Coupon)</div>` : '')}
          </td>
          <td class="mono-num">${escapeHtml(r.UTR || r.PaymentMode || '-')}</td>
          <td>${renderFeeStatusBadgeHtml(r.Status)}</td>
          <td class="mono-num" style="font-size:11.5px; color:var(--text-muted);">${escapeHtml(formatReadableFeeDate(r.Timestamp || r.PaymentDate || '-'))}</td>
          <td>${isApproved ? `<button type="button" class="btn btn-secondary btn-sm" style="padding:3px 8px; font-size:11px;" onclick="window.openPrintableFeeReceipt('${safeRid}')"><i class="fa-solid fa-file-pdf"></i> Receipt</button>` : '—'}</td>
        </tr>
      `;
    }).join('');
  }

window.streamAdminFeeLedgerOneByOne = async function () {
    const streamed = [];
    portalState.adminData = portalState.adminData || {};
    portalState.adminData.feeLedger = [];
    renderAdminLedgerRowsOnly();
    await window.streamCollectionOneByOne({
      streamKey: 'admin_fee_ledger_stream',
      collection: 'fee_ledger',
      anchorId: 'admin-fee-ledger-tbody',
      labelSingular: 'fee record',
      fallbackAction: 'getFeeLedger',
      fallbackParams: {},
      extractFallbackItems: (res) => (res && Array.isArray(res.ledger || res.rows)) ? (res.ledger || res.rows) : [],
      onBatch: (records) => {
        if (!Array.isArray(records) || records.length === 0) return;
        for (let i = 0; i < records.length; i++) {
          if (records[i]) streamed.push(records[i]);
        }
        portalState.adminData.feeLedger = streamed.slice();
        renderAdminLedgerRowsOnly();
      },
      onDone: () => {
        portalState.adminData.feeLedger = streamed.slice();
        renderAdminLedgerRowsOnly();
      }
    });
  };

window.renderAdminFeesManager = async function (forceFetch = false) {
    const mount = document.getElementById('admin-fees-manager-mount');
    if (!mount) return;
    if (forceFetch && typeof apiCall === 'function') {
      const [cfgRes, ledRes] = await Promise.all([
        apiCall('getFeeConfig', {}, true),
        apiCall('getFeeLedger', {}, true)
      ]);
      portalState.adminData = portalState.adminData || {};
      if (cfgRes && cfgRes.success && cfgRes.feeConfig) {
        portalState.adminData.feeConfig = cfgRes.feeConfig;
        if (portalState.globalData) portalState.globalData.feeConfig = cfgRes.feeConfig;
      }
      if (ledRes && ledRes.success && Array.isArray(ledRes.ledger || ledRes.rows)) {
        portalState.adminData.feeLedger = ledRes.ledger || ledRes.rows;
      }
    }

    const cfg = getResolvedFeeConfig();
    _adminFeeBuilderState = {
      memberPlans: JSON.parse(JSON.stringify(cfg.memberPlans || [])),
      batchPlans: JSON.parse(JSON.stringify(cfg.batchPlans || {})),
      coupons: JSON.parse(JSON.stringify(cfg.coupons || []))
    };

    const ledger = (portalState.adminData && Array.isArray(portalState.adminData.feeLedger)) ? portalState.adminData.feeLedger : [];
    const approvedTotal = ledger
      .filter((r) => normalizeFeeStatusDisplay(r.Status) === 'Approved')
      .reduce((acc, r) => acc + getEffectiveFeeAmountPaid(r), 0);
    const pendingRows = ledger.filter((r) => normalizeFeeStatusDisplay(r.Status) === 'Pending');
    const activeMembersCount = ((portalState.adminData && Array.isArray(portalState.adminData.users)) ? portalState.adminData.users : [])
      .filter((u) => String(u.Role || u.role || '').toLowerCase() === 'member' || Boolean(u.IsMemberAllAccess || u.isMemberAllAccess)).length;

    const pendingQueueHtml = pendingRows.length > 0
      ? pendingRows.map((r, pIdx) => {
          const rid = String(r.ReceiptNo || r.ReceiptID || '');
          const safeRid = escapeHtml(rid).replace(/'/g, "\\'");
          const uid = String(r.UserID || '');
          const safeUid = escapeHtml(uid).replace(/'/g, "\\'");
          const stName = r.StudentName || r.UserName || uid;
          const safeName = escapeHtml(stName).replace(/'/g, "\\'");
          const isMem = String(r.FeeType || '').toLowerCase().includes('member');
          const planLabel = r.PlanName || (isMem ? 'Member Plan' : (r.Batch || 'Batch Fee'));
          const safePlan = escapeHtml(planLabel).replace(/'/g, "\\'");
          const vDays = Number(r.ValidityDays || (isMem ? 365 : 90)) || 90;
          const instLabel = String(r.InstallmentLabel || r.InstallmentNo || 'Full Payment').trim();
          const couponCode = String(r.CouponCode || '').trim();
          const effAmt = getEffectiveFeeAmountPaid(r);
          const remBal = getEffectiveFeeRemainingBalance(r);
          const cleanRem = cleanFeeRemarksForDisplay(r.Remarks);
          const rejectReasonId = `adm-reject-reason-${pIdx}`;

          return `
            <tr>
              <td class="mono-num" style="font-weight:700;">${escapeHtml(rid)}</td>
              <td><strong>${escapeHtml(stName)}</strong><div class="mono-num" style="font-size:11px; color:var(--text-muted);">${escapeHtml(uid)}</div></td>
              <td>
                <div style="font-weight:800; color:var(--secondary);">${escapeHtml(planLabel)}</div>
                <div style="font-size:11px; color:${isMem ? '#7c3aed' : 'var(--text-muted)'}; font-weight:700;">${isMem ? '★ Member Plan' : ('Batch: ' + escapeHtml(r.Batch || '-'))}</div>
                <div style="font-size:10.5px; color:var(--text-muted); margin-top:2px;">
                  ${escapeHtml(instLabel)}${couponCode && couponCode !== '-' ? ` · <span style="color:#047857; font-weight:700;">Coupon ${escapeHtml(couponCode)}</span>` : ''}
                </div>
              </td>
              <td class="mono-num">
                <div style="font-weight:800;">₹${effAmt.toLocaleString('en-IN')}</div>
                ${remBal > 0
                  ? `<div style="font-size:10.5px; color:#b45309; font-weight:700;">Bal ₹${remBal.toLocaleString('en-IN')}</div>`
                  : (effAmt === 0 ? `<div style="font-size:10.5px; color:#047857; font-weight:700;">₹0 Paid (Free / Coupon)</div>` : '')}
              </td>
              <td class="mono-num"><strong>${escapeHtml(r.UTR || '-')}</strong><div style="font-size:11px; color:var(--text-muted);">${escapeHtml(cleanRem)}</div></td>
              <td class="mono-num" style="font-size:11.5px;">${escapeHtml(formatReadableFeeDate(r.Timestamp || r.PaymentDate || '-'))}</td>
              <td>
                <div style="display:flex; flex-direction:column; gap:5px;">
                  <div style="display:flex; gap:6px; flex-wrap:wrap;">
                    ${isMem
                      ? `<button type="button" class="btn btn-success btn-sm" onclick="window.adminApproveMemberFeeWithScope('${safeRid}', '${safeUid}', '${safeName}', '${safePlan}', ${vDays})"><i class="fa-solid fa-check-double"></i> Approve &amp; Set Batches</button>`
                      : `<button type="button" class="btn btn-success btn-sm" onclick="window.adminVerifyFeePayment('${safeRid}', 'approve')"><i class="fa-solid fa-check"></i> Approve</button>`}
                    <button type="button" class="btn btn-danger btn-sm" onclick="window.adminVerifyFeePayment('${safeRid}', 'reject', '${rejectReasonId}')"><i class="fa-solid fa-xmark"></i> Reject</button>
                  </div>
                  <input type="text" id="${rejectReasonId}" class="form-control" placeholder="Optional rejection note..." style="min-height:26px; font-size:11px; padding:3px 7px; margin:0;">
                </div>
              </td>
            </tr>
          `;
        }).join('')
      : `<tr><td colspan="7" style="text-align:center; padding:16px; color:var(--text-muted); font-size:12.5px;">No pending student UPI verifications right now.</td></tr>`;

    const qrPreviewSrc = cfg.qrImageUrl || buildQrCodeImgSrc(cfg, buildUpiPaymentLink(cfg.upiId, cfg.payeeName, 0, 'RP Skill'));

    mount.innerHTML = `
      <div id="admin-fee-management-card" style="display:flex; flex-direction:column; gap:18px;">
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
          <div>
            <h3 style="margin:0; font-size:18px; color:var(--secondary);"><i class="fa-solid fa-indian-rupee-sign" style="color:var(--primary);"></i> Admin Fee Management — UPI/QR, Plans, Coupons &amp; Approvals</h3>
            <p style="margin:3px 0 0 0; font-size:12.5px; color:var(--text-muted);">Configure UPI/QR links, multi-plan pricing with 2-part installments, discount coupons, and approve or reject student payment submissions.</p>
          </div>
          <button type="button" class="btn btn-secondary btn-sm" onclick="window.renderAdminFeesManager(true)"><i class="fa-solid fa-arrows-rotate"></i> Refresh Fee Data</button>
        </div>

        <div class="rp-saas-kpi-grid" style="margin:0;">
          <div class="rp-saas-kpi-card">
            <span class="rp-saas-kpi-label">Approved Revenue</span>
            <span class="rp-saas-kpi-value mono-num" style="color:#059669;">₹${approvedTotal.toLocaleString('en-IN')}</span>
          </div>
          <div class="rp-saas-kpi-card">
            <span class="rp-saas-kpi-label">Pending Approvals</span>
            <span class="rp-saas-kpi-value mono-num" style="color:${pendingRows.length > 0 ? '#d97706' : 'var(--secondary)'};">${pendingRows.length}</span>
          </div>
          <div class="rp-saas-kpi-card">
            <span class="rp-saas-kpi-label">Active Members</span>
            <span class="rp-saas-kpi-value mono-num" style="color:#7c3aed;">${activeMembersCount}</span>
          </div>
          <div class="rp-saas-kpi-card">
            <span class="rp-saas-kpi-label">Active Coupons</span>
            <span class="rp-saas-kpi-value mono-num" style="color:#0369a1;">${(cfg.coupons || []).filter(c => c.active).length}</span>
          </div>
        </div>

        <!-- Admin Fee Management Configuration Card -->
        <div class="card" style="margin:0; border-top:3px solid var(--primary);">
          <h4 style="margin:0 0 12px 0; font-size:15px; color:var(--secondary);"><i class="fa-solid fa-qrcode"></i> UPI / QR Payment Configuration</h4>
          <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:12px; align-items:start;">
            <div class="form-group" style="margin:0;">
              <label style="font-size:12px; font-weight:700;">Institute UPI ID</label>
              <input type="text" id="adm-fee-upi-id" class="form-control mono-num" value="${escapeHtml(cfg.upiId)}" placeholder="e.g. ranjanpathshala@upi">
            </div>
            <div class="form-group" style="margin:0;">
              <label style="font-size:12px; font-weight:700;">Payee Display Name</label>
              <input type="text" id="adm-fee-payee-name" class="form-control" value="${escapeHtml(cfg.payeeName)}" placeholder="Ranjan Pathshala">
            </div>
            <div class="form-group" style="margin:0;">
              <label style="font-size:12px; font-weight:700;">Custom QR Code Image Link (Optional)</label>
              <input type="url" id="adm-fee-qr-url" class="form-control" value="${escapeHtml(cfg.qrImageUrl)}" placeholder="https://... (leave blank for auto UPI QR)">
            </div>
            ${qrPreviewSrc ? `
              <div style="display:flex; align-items:center; gap:10px; padding:8px; border-radius:8px; background:var(--background); border:1px solid var(--border);">
                <img src="${escapeHtml(qrPreviewSrc)}" alt="QR Preview" style="width:54px; height:54px; object-fit:contain; background:#fff; border-radius:6px; border:1px solid var(--border); padding:2px;">
                <div style="font-size:11px; color:var(--text-muted);">Live QR Preview<br><strong style="color:var(--secondary);">${escapeHtml(cfg.upiId || 'Custom QR')}</strong></div>
              </div>
            ` : ''}
            <div class="form-group" style="margin:0; grid-column:1 / -1;">
              <label style="font-size:12px; font-weight:700;">Student Payment Instructions</label>
              <input type="text" id="adm-fee-instructions" class="form-control" value="${escapeHtml(cfg.paymentInstructions)}" placeholder="Instructions displayed on UPI checkout">
            </div>
          </div>

          <!-- Multi-Plan Member Tiers Builder -->
          <div style="margin-top:18px; padding-top:14px; border-top:1px solid var(--border);">
            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; margin-bottom:10px;">
              <div>
                <div style="font-size:13.5px; font-weight:800; color:#7c3aed;"><i class="fa-solid fa-crown"></i> Member Tier Plans (Multiple Plans Supported)</div>
                <div style="font-size:11.5px; color:var(--text-muted);">Define multiple membership plans with custom batch access scopes (All Past+Current+Upcoming, Existing Only, Current+Upcoming, or Specific Batches).</div>
              </div>
              <button type="button" class="btn btn-primary btn-sm" onclick="window.addAdminMemberPlanRow()"><i class="fa-solid fa-plus"></i> Add Member Plan</button>
            </div>
            <div id="adm-member-plans-list" style="display:flex; flex-direction:column; gap:10px;"></div>
          </div>

          <!-- Multi-Plan Per-Batch Pricing Builder (with Installments Toggle) -->
          <div style="margin-top:18px; padding-top:14px; border-top:1px solid var(--border);">
            <div style="margin-bottom:10px;">
              <div style="font-size:13.5px; font-weight:800; color:var(--secondary);"><i class="fa-solid fa-layer-group" style="color:var(--primary);"></i> Per-Batch Pricing Plans &amp; Installments (RP-Trail is always Free ₹0)</div>
              <div style="font-size:11.5px; color:var(--text-muted);">Add one or more plans per batch and optionally enable <strong>2-Part Split Installments</strong> with a custom first-installment percentage.</div>
            </div>
            <div style="padding:10px 14px; border-radius:8px; background:rgba(16,185,129,0.06); border:1px solid rgba(16,185,129,0.28); font-size:12px; margin-bottom:10px; display:flex; justify-content:space-between; flex-wrap:wrap; gap:6px;">
              <span><strong style="color:#047857;">RP-Trail</strong> (Permanent Free Batch)</span>
              <span class="mono-num" style="font-weight:800; color:#047857;">₹0 · Lifetime Free Access for Every Student</span>
            </div>
            <div id="adm-batch-plans-builder"></div>
          </div>

          <!-- Promo & Discount Coupons Builder -->
          <div style="margin-top:18px; padding-top:14px; border-top:1px solid var(--border);">
            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; margin-bottom:10px;">
              <div>
                <div style="font-size:13.5px; font-weight:800; color:#047857;"><i class="fa-solid fa-tags"></i> Promo &amp; Discount Coupons</div>
                <div style="font-size:11.5px; color:var(--text-muted);">Create limited-time flat ₹ off or percentage % off coupon codes that students can apply before generating their UPI QR amount.</div>
              </div>
              <button type="button" class="btn btn-secondary btn-sm" onclick="window.addAdminCouponRow()"><i class="fa-solid fa-plus"></i> Add Coupon</button>
            </div>
            <div id="adm-coupons-list" style="display:flex; flex-direction:column; gap:8px;"></div>
          </div>

          <div style="display:flex; justify-content:flex-end; margin-top:16px;">
            <button type="button" id="adm-save-fee-config-btn" class="btn btn-primary" onclick="window.saveAdminFeeConfiguration()">
              <i class="fa-solid fa-floppy-disk"></i> Save UPI, Plans &amp; Coupons to Google Sheets
            </button>
          </div>
        </div>

        <!-- Pending Student Payment Queue -->
        <div class="card" style="margin:0; border-top:3px solid #f59e0b;">
          <h4 style="margin:0 0 10px 0; font-size:15px; color:var(--secondary);"><i class="fa-solid fa-clock-rotate-left" style="color:#d97706;"></i> Pending Student Payment Approvals (${pendingRows.length})</h4>
          <div class="table-responsive">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Receipt No</th>
                  <th>Student</th>
                  <th>Plan / Batch</th>
                  <th>Amount</th>
                  <th>UTR / Remarks</th>
                  <th>Submitted</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>${pendingQueueHtml}</tbody>
            </table>
          </div>
        </div>

        <!-- Complete Fee Ledger (with 1-by-1 Stream Refresh & Receipts) -->
        <div class="card" style="margin:0;">
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; margin-bottom:10px;">
            <h4 style="margin:0; font-size:15px; color:var(--secondary);"><i class="fa-solid fa-receipt"></i> Complete Fee Ledger (Synced with <code>FEE_LEDGER</code> Sheet)</h4>
            <button type="button" class="btn btn-secondary btn-sm" onclick="window.streamAdminFeeLedgerOneByOne()"><i class="fa-solid fa-stream"></i> Stream Ledger 1-by-1</button>
          </div>
          <div class="table-responsive">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Receipt No</th>
                  <th>Student</th>
                  <th>Plan / Batch</th>
                  <th>Amount / Balance</th>
                  <th>UTR / Mode</th>
                  <th>Status</th>
                  <th>Date</th>
                  <th>Receipt</th>
                </tr>
              </thead>
              <tbody id="admin-fee-ledger-tbody"></tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    renderAdminFeeBuildersOnly();
    renderAdminLedgerRowsOnly();
    window.renderStaticStreamDoneFooter('admin-fee-ledger-tbody', ledger.length, 'fee record', window.streamAdminFeeLedgerOneByOne);
  };

window.saveAdminFeeConfiguration = async function () {
    readAdminFeeBuilderInputsIntoState();
    const btn = document.getElementById('adm-save-fee-config-btn');
    const upiId = String(document.getElementById('adm-fee-upi-id')?.value || '').trim();
    const payeeName = String(document.getElementById('adm-fee-payee-name')?.value || 'Ranjan Pathshala').trim();
    const qrImageUrl = String(document.getElementById('adm-fee-qr-url')?.value || '').trim();
    const paymentInstructions = String(document.getElementById('adm-fee-instructions')?.value || '').trim();

    const memberPlans = (_adminFeeBuilderState && Array.isArray(_adminFeeBuilderState.memberPlans))
      ? _adminFeeBuilderState.memberPlans.filter(p => p.name)
      : [];
    const batchPlans = (_adminFeeBuilderState && _adminFeeBuilderState.batchPlans) ? _adminFeeBuilderState.batchPlans : {};
    const coupons = (_adminFeeBuilderState && Array.isArray(_adminFeeBuilderState.coupons))
      ? _adminFeeBuilderState.coupons.filter(c => c.code)
      : [];
    const legacyBatchFees = {};
    Object.keys(batchPlans).forEach((b) => {
      if (Array.isArray(batchPlans[b]) && batchPlans[b][0]) {
        legacyBatchFees[b] = {
          amount: batchPlans[b][0].amount,
          validityDays: batchPlans[b][0].validityDays,
          note: batchPlans[b][0].note || '',
          allowInstallments: Boolean(batchPlans[b][0].allowInstallments)
        };
      }
    });

    if (btn) { btn.disabled = true; btn.innerHTML = '<span class="mini-spin"></span> Saving...'; }
    try {
      const payload = {
        upiId,
        payeeName,
        qrImageUrl,
        paymentInstructions,
        memberPlans,
        batchPlans,
        coupons,
        memberFee: memberPlans[0] ? memberPlans[0].amount : 0,
        memberValidityDays: memberPlans[0] ? memberPlans[0].validityDays : 365,
        memberDescription: memberPlans[0] ? memberPlans[0].description : '',
        batchFees: legacyBatchFees
      };
      const res = await apiCall('saveFeeConfig', payload);
      if (res && res.success) {
        portalState.adminData = portalState.adminData || {};
        portalState.adminData.feeConfig = res.feeConfig || payload;
        if (portalState.globalData) portalState.globalData.feeConfig = portalState.adminData.feeConfig;
        safeNotify('✅ UPI/QR, Batch Plans, Member Plans & Coupons saved to Google Sheets!');
        await window.renderAdminFeesManager(false);
      } else {
        safeNotify((res && res.message) || 'Failed to save fee settings.');
      }
    } finally {
      if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Save UPI, Plans &amp; Coupons to Google Sheets'; }
    }
  };

window.adminApproveMemberFeeWithScope = function (receiptNo, userId, studentName, planName, validityDays) {
    if (typeof window.openAdminMemberAccessModal === 'function') {
      const cfg = getResolvedFeeConfig();
      const matched = (cfg.memberPlans || []).find(p => String(p.name || '').trim().toLowerCase() === String(planName || '').trim().toLowerCase());
      window.openAdminMemberAccessModal(userId, studentName, {
        pendingReceiptNo: receiptNo,
        planName: planName,
        validityDays: validityDays || (matched ? matched.validityDays : 365),
        accessScope: matched ? matched.accessScope : 'ALL_PAST_CURRENT_UPCOMING',
        includedBatches: matched ? matched.includedBatches : '',
        includeUpcoming: matched ? matched.includeUpcoming : true
      });
    } else {
      window.adminVerifyFeePayment(receiptNo, 'approve');
    }
  };

window.adminVerifyFeePayment = async function (receiptNo, decision, reasonInputId) {
    if (!receiptNo) return;
    const isApprove = decision === 'approve';
    const customReason = reasonInputId ? String(document.getElementById(reasonInputId)?.value || '').trim() : '';
    const remarks = isApprove
      ? 'Approved & Activated by Admin'
      : (customReason || 'Rejected by Admin (UTR not matched)');
    const res = await apiCall('verifyFeePayment', {
      receiptNo,
      decision: isApprove ? 'approve' : 'reject',
      remarks
    });
    if (res && res.success) {
      safeNotify(res.message || (isApprove ? '✅ Payment Approved & access activated!' : 'Payment marked Rejected.'));
      await window.renderAdminFeesManager(true);
      if (typeof loadAdminData === 'function') loadAdminData();
    } else {
      safeNotify((res && res.message) || 'Failed to update fee verification status.');
    }
  };

if (typeof window.rpSanitizeUrl !== 'function') {
    window.rpSanitizeUrl = function (rawUrl) {
      const s = String(rawUrl || '').trim();
      if (!s) return '#';
      if (/^https?:\/\//i.test(s) || s.startsWith('/')) return s;
      return '#';
    };
  }

if (typeof window.toggleCbtFullScreen !== 'function') {
    window.toggleCbtFullScreen = function () {
      try {
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen?.();
        } else {
          document.exitFullscreen?.();
        }
      } catch (e) {}
    };
  }

export function initRpHeaderAndSpotlightEffects() {
    const headerEl = document.querySelector('header');
    const syncScroll = () => {
      if (!headerEl) return;
      headerEl.classList.toggle('rp-header-scrolled', window.scrollY > 8);
    };
    window.addEventListener('scroll', syncScroll, { passive: true });
    syncScroll();

    const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
    if (typeof syncPublicHeaderThemeToggle === 'function') {
      syncPublicHeaderThemeToggle(currentTheme);
    }

    // Subtle pointer-tracked spotlight effect on cards (desktop pointer devices only)
    const prefersReduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const finePointer = window.matchMedia && window.matchMedia('(pointer: fine)').matches;
    if (!prefersReduced && finePointer) {
      let rafPending = false;
      let lastEvent = null;
      document.addEventListener('pointermove', (e) => {
        lastEvent = e;
        if (rafPending) return;
        rafPending = true;
        requestAnimationFrame(() => {
          rafPending = false;
          if (!lastEvent) return;
          const card = lastEvent.target && lastEvent.target.closest
            ? lastEvent.target.closest('.card, .material-card, .eval-rule-select-card')
            : null;
          if (!card) return;
          card.classList.add('rp-spotlight-card');
          const rect = card.getBoundingClientRect();
          card.style.setProperty('--mx', (lastEvent.clientX - rect.left) + 'px');
          card.style.setProperty('--my', (lastEvent.clientY - rect.top) + 'px');
        });
      }, { passive: true });
    }

    // Keyboard Escape closes nav drawer on mobile/tablet
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        const nav = document.getElementById('main-nav-tabs');
        if (nav && nav.classList.contains('menu-open') && window.innerWidth < 1024 && typeof closeAllDeviceNavMenu === 'function') {
          closeAllDeviceNavMenu(true);
        }
      }
    });
  }

onDomReady(() => {
    window.resetBannerPromoCardSelection();
    window.toggleAutoScrollBehaviorField();
    mountServerPaginationToolbar();
    window.populateMonitorCandidatesForSelectedBatch();
    initRpHeaderAndSpotlightEffects();
    setTimeout(() => {
      window.initRpScrollRevealAnimations(document);
      window.initExpandableSearchControls(document);
    }, 60);
  });
