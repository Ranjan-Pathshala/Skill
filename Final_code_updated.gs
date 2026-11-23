/**
 * Ranjan Pathshala Skill BACKEND ENGINE (Google Apps Script)
 * High-Speed API Version 3.9 (Pooled DbConnectionManager + Instant CacheService RAM Layer + Lock-Free Concurrent Reads)
 * Includes: Multi-Monitor Support (up to 3/batch), Multi-Banner Single-Line Logged-In & Logged-Out Scrolling Banners,
 * ₹0 Free / 100%-Coupon Batch Approval & Receipts, Keystroke Rhythm & Latency Heatmap Persistence,
 * Guaranteed Google Drive & Sheet Shorthand Pad Photo Storage, Content Auto-Delete Policy Sheet Persistence,
 * Lossless Fee Plans JSON Persistence with Attached Monthly/Quarterly/Annual Billing Cycles & Included Batches,
 * and Automated 90-Day Activity Logs Archival & Trigger Management.
 */

/**
 * Request-Scoped Database & Cache Connection Handle Manager
 * Prevents repeated SpreadsheetApp.getActiveSpreadsheet() & getDataRange() calls within a request,
 * tracks dirty writes, flushes pending sheet mutations before lock release, and deterministically
 * closes all handles in the `finally` block to prevent memory/handle leaks.
 */
var DbConnectionManager = {
  _ssHandle: null,
  _cacheHandle: null,
  _tz: null,
  _sheetHandles: {},
  _requestDataCache: {},
  _hasDirtyWrites: false,
  _openedAt: 0,

  open: function() {
    this._openedAt = Date.now();
    this._hasDirtyWrites = false;
    this._sheetHandles = {};
    this._requestDataCache = {};
  },

  getSpreadsheet: function() {
    if (!this._ssHandle) {
      this._ssHandle = SpreadsheetApp.getActiveSpreadsheet();
    }
    return this._ssHandle;
  },

  getCache: function() {
    if (!this._cacheHandle) {
      try {
        this._cacheHandle = CacheService.getScriptCache();
      } catch (e) {
        this._cacheHandle = null;
      }
    }
    return this._cacheHandle;
  },

  getTimeZone: function() {
    if (!this._tz) {
      this._tz = Session.getScriptTimeZone();
    }
    return this._tz;
  },

  getSheet: function(sheetName) {
    if (!this._sheetHandles[sheetName]) {
      var ss = this.getSpreadsheet();
      this._sheetHandles[sheetName] = ss ? ss.getSheetByName(sheetName) : null;
    }
    return this._sheetHandles[sheetName];
  },

  setSheet: function(sheetName, sheetObj) {
    this._sheetHandles[sheetName] = sheetObj;
    return sheetObj;
  },

  getRequestRows: function(sheetName) {
    return this._requestDataCache.hasOwnProperty(sheetName) ? this._requestDataCache[sheetName] : null;
  },

  setRequestRows: function(sheetName, rows) {
    this._requestDataCache[sheetName] = rows;
  },

  markDirty: function(sheetName) {
    this._hasDirtyWrites = true;
    if (sheetName && this._requestDataCache.hasOwnProperty(sheetName)) {
      delete this._requestDataCache[sheetName];
    }
  },

  close: function() {
    try {
      if (this._hasDirtyWrites && this._ssHandle) {
        SpreadsheetApp.flush();
      }
    } catch (flushErr) {}
    this._sheetHandles = {};
    this._requestDataCache = {};
    this._ssHandle = null;
    this._cacheHandle = null;
    this._hasDirtyWrites = false;
  }
};

function doGet(e) {
  var params = (e && e.parameter) ? e.parameter : {};
  var wantsStatus = String(params.status || params.mode || '').toLowerCase() === 'status' || String(params.status || '') === '1';
  if (!wantsStatus) {
    var htmlNames = ['Indexa', 'index', 'Index', 'portal'];
    for (var i = 0; i < htmlNames.length; i++) {
      try {
        return HtmlService.createHtmlOutputFromFile(htmlNames[i])
          .setTitle('RP Skill | Ranjan Pathshala — Stenography, Typing & CBT Portal')
          .addMetaTag('viewport', 'width=device-width, initial-scale=1.0')
          .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
      } catch (htmlNotFoundErr) {}
    }
  }
  return ContentService.createTextOutput("Ranjan Pathshala Skill Backend Running API Version 3.6 (Pooled DB Connection Handles & High-Speed Cache Enabled)");
}

// Direct server bridge for Google Apps Script HtmlService Preview / Web App deployments (google.script.run)
function rpClientApiBridge(action, payload) {
  return dispatchPortalAction(action, payload || {});
}

// Write mutations acquire a script lock; read requests run lock-free in parallel!
var WRITE_ACTIONS = {
  'signup': true,
  'logout': true,
  'forgetPassword': true,
  'verifyMfaOtp': true,
  'updateProfile': true,
  'uploadMaterial': true,
  'deleteMaterial': true,
  'updateMaterial': true,
  'submitFeedback': true,
  'adminReplyFeedback': true,
  'updateUserRoleStatus': true,
  'updateUserBatch': true,
  'bulkUpdateUserBatches': true,
  'appointBatchMonitor': true,
  'saveBatchGroupMessage': true,
  'replyBatchGroupMessage': true,
  'deleteBatchGroupMessage': true,
  'manageSubtab': true,
  'updateBannerSettings': true,
  'updateDashboardCustomBanner': true,
  'updateDateSpecificBanners': true,
  'saveScheduledLiveTests': true,
  'saveInstituteBatches': true,
  'updateMaintenanceSettings': true,
  'saveTestHistory': true,
  'saveEvaluationRules': true,
  'saveDailyGoalProgress': true,
  'saveUserEngagementSession': true,
  'syncUserCloudState': true,
  'createSpreadsheetBackup': true,
  'sendBatchDigestEmail': true,
  'setupDailyDigestTrigger': true,
  'archiveOldTestHistoryRows': true,
  'saveFeeInstallmentRecord': true,
  'recordGranularAuditDiff': true,
  'bulkOnboardStudentsCsv': true,
  'sendTelegramBatchWebhookAlert': true,
  'saveTelegramWebhookConfig': true,
  'saveFranchiseBranches': true,
  'saveSettings': true,
  'voteBatchPoll': true,
  'lockUserDevices': true,
  'submitOutlineRequest': true,
  'applyEnrollmentValidity': true,
  'sendBulkVerificationReminders': true,
  'updateOwnContactBeforeVerify': true,
  'sendMobileVerificationOtp': true,
  'verifyMobileOtp': true,
  'resolveOutlineRequest': true,
  'replyWordOutlineRequest': true,
  'saveWhatsAppGatewayConfig': true,
  'uploadAudioToDrive': true,
  'uploadShorthandPad': true,
  'reviewShorthandPad': true,
  'deleteShorthandPad': true,
  'saveShorthandPadAnnotation': true,
  'saveBatchValidityMap': true,
  'saveParentDetails': true,
  'saveFeeConfig': true,
  'submitStudentFeePayment': true,
  'verifyFeePayment': true,
  'updateMemberAccessScope': true,
  'adminUpdateUserDetails': true,
  'bulkDeleteMaterials': true,
  'purgeExpiredMaterials': true,
  'saveContentAutoDeletePolicy': true,
  'setupAutoDeleteMaterialsTrigger': true,
  'sendWeeklyReportToAll': true,
  'archiveOldActivityLogs': true,
  'setupMonthlyActivityArchivalTrigger': true
};

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return ContentService.createTextOutput(JSON.stringify({ success: false, message: 'Invalid payload received.' }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    var requestData = JSON.parse(e.postData.contents);
    var response = dispatchPortalAction(requestData.action, requestData.payload || {});
    return ContentService.createTextOutput(JSON.stringify(response))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, message: 'Server Exception: ' + error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function dispatchPortalAction(action, payload) {
  var lock = null;
  DbConnectionManager.open();
  try {
    action = String(action || '').trim();
    payload = (payload && typeof payload === 'object' && !Array.isArray(payload)) ? payload : {};
    var response = {};

    // Acquire lock ONLY for write operations so concurrent student reads never block or timeout
    if (WRITE_ACTIONS[action]) {
      lock = LockService.getScriptLock();
      if (!lock.tryLock(20000)) {
        return { success: false, message: 'Server busy saving data. Please try again shortly.' };
      }
    }

    initSheetsOnce();

    // Enforce strict server-side session authentication & RBAC on all protected actions
    var PUBLIC_OR_AUTH_ACTIONS = {
      'login': true,
      'signup': true,
      'logout': true,
      'forgetPassword': true,
      'sendMfaOtp': true,
      'verifyMfaOtp': true,
      'sendWhatsAppOtp': true,
      'verifyWhatsAppOtp': true,
      'getPublicStats': true,
      'getHelpContacts': true,
      'getEvaluationRules': true,
      'getFranchiseBranches': true,
      'getFeeConfig': true,
      'getMaterials': true,
      'verifySession': true,
      'verifySessionToken': true
    };
    var ADMIN_ONLY_ACTIONS = {
      'getAdminData': true,
      'uploadMaterial': true,
      'deleteMaterial': true,
      'updateMaterial': true,
      'adminReplyFeedback': true,
      'updateUserRoleStatus': true,
      'updateMemberAccessScope': true,
      'updateUserBatch': true,
      'bulkUpdateUserBatches': true,
      'appointBatchMonitor': true,
      'manageSubtab': true,
      'updateBannerSettings': true,
      'updateDashboardCustomBanner': true,
      'updateDateSpecificBanners': true,
      'saveScheduledLiveTests': true,
      'saveInstituteBatches': true,
      'updateMaintenanceSettings': true,
      'saveEvaluationRules': true,
      'createSpreadsheetBackup': true,
      'setupDailyDigestTrigger': true,
      'sendWeeklyReportToAll': true,
      'archiveOldTestHistoryRows': true,
      'saveFeeInstallmentRecord': true,
      'getFeeInstallmentLedger': true,
      'saveFeeConfig': true,
      'verifyFeePayment': true,
      'recordGranularAuditDiff': true,
      'getGranularAuditDiffs': true,
      'bulkOnboardStudentsCsv': true,
      'sendTelegramBatchWebhookAlert': true,
      'saveTelegramWebhookConfig': true,
      'saveFranchiseBranches': true,
      'saveSettings': true,
      'lockUserDevices': true,
      'bulkDeleteMaterials': true,
      'purgeExpiredMaterials': true,
      'saveContentAutoDeletePolicy': true,
      'setupAutoDeleteMaterialsTrigger': true,
      'adminUpdateUserDetails': true,
      'applyEnrollmentValidity': true,
      'getAdminLiveTestRanks': true,
      'sendBulkVerificationReminders': true,
      'uploadAudioToDrive': true,
      'saveBatchValidityMap': true,
      'saveWhatsAppGatewayConfig': true,
      'getWhatsAppGatewayConfig': true,
      'archiveOldActivityLogs': true,
      'getActivityArchivalStatus': true,
      'setupMonthlyActivityArchivalTrigger': true
    };
    var SELF_SCOPED_USER_ACTIONS = {
      'updateProfile': true,
      'syncUserCloudState': true,
      'saveDailyGoalProgress': true,
      'getDailyGoalProgress': true,
      'saveTestHistory': true,
      'getTestHistory': true,
      'getUserHistory': true,
      'getTestHistoryDetail': true,
      'getFeedbackHistory': true,
      'saveUserEngagementSession': true,
      'uploadShorthandPad': true,
      'updateOwnContactBeforeVerify': true,
      'sendMobileVerificationOtp': true,
      'verifyMobileOtp': true,
      'saveParentDetails': true,
      'submitStudentFeePayment': true,
      'validateFeeCoupon': true,
      'getFeeLedger': true,
      'getStreamRecord': true,
      'submitFeedback': true,
      'voteBatchPoll': true
    };

    var isGuestSafeStream = (action === 'getStreamRecord' && String((payload && payload.collection) || '').toLowerCase().trim() === 'materials');
    if (!PUBLIC_OR_AUTH_ACTIONS[action] && !isGuestSafeStream) {
      var checkUid = String((payload && (payload.authUserId || payload.requesterId || payload.userId)) || '').trim();
      var checkTok = String((payload && (payload.authSessionToken || payload.sessionToken)) || '').trim();
      if (!checkUid || !checkTok || checkUid === 'GUEST' || checkUid === 'ADMIN' || checkUid === 'SUPERADMIN') {
        return {
          success: false,
          valid: false,
          sessionInvalid: true,
          unauthorized: true,
          message: 'Authentication required. Please sign in to access this feature.'
        };
      }
      var lockCheck = handleVerifySessionToken({
        userId: checkUid,
        sessionToken: checkTok,
        deviceId: payload.deviceId || payload.authDeviceId || '',
        strictAuth: true
      });
      if (!lockCheck || lockCheck.valid !== true) {
        return lockCheck || {
          success: false,
          valid: false,
          sessionInvalid: true,
          message: 'Invalid or expired session. Please sign in again.'
        };
      }
      var verifiedRole = String(lockCheck.userRole || 'user').toLowerCase().trim();
      var isVerifiedAdmin = (verifiedRole === 'admin' || verifiedRole === 'superadmin');
      payload._verifiedUserId = checkUid;
      payload._verifiedRole = verifiedRole;
      payload.requesterId = checkUid;
      payload.authUserId = checkUid;
      var requiresAdmin = Boolean(ADMIN_ONLY_ACTIONS[action]) || (action === 'sendBatchDigestEmail' && !(payload && payload.parentEmail));
      if (requiresAdmin && !isVerifiedAdmin) {
        handleLogActivity({
          userId: checkUid,
          userName: String(payload.requesterName || checkUid),
          activityType: 'SECURITY_VIOLATION',
          details: 'Blocked unauthorized attempt to call admin action [' + action + '] by role [' + verifiedRole + '].'
        });
        return {
          success: false,
          unauthorized: true,
          message: 'Forbidden: Administrator authorization is required for this operation.'
        };
      }

      // Prevent horizontal privilege escalation (IDOR) on self-scoped user actions
      if (SELF_SCOPED_USER_ACTIONS[action] && !isVerifiedAdmin) {
        payload.userId = checkUid;
      }
    }

    switch (action) {
      case 'signup':
        response = handleSignup(payload);
        break;
      case 'login':
        response = handleLogin(payload);
        break;
      case 'logout':
        response = handleLogout(payload);
        break;
      case 'forgetPassword':
        response = handleForgetPassword(payload);
        break;
      case 'updateProfile':
        response = handleUpdateProfile(payload);
        break;
      case 'getDashboardData':
        response = handleGetDashboardData(payload);
        break;
      case 'getPublicStats':
        response = handleGetPublicStats(payload);
        break;
      case 'getMaterials':
        response = handleGetMaterials(payload);
        break;
      case 'uploadMaterial':
        response = handleUploadMaterial(payload);
        break;
      case 'deleteMaterial':
        response = handleDeleteMaterial(payload);
        break;
      case 'bulkDeleteMaterials':
        response = handleBulkDeleteMaterials(payload);
        break;
      case 'purgeExpiredMaterials':
        response = handlePurgeExpiredMaterials(payload);
        break;
      case 'saveContentAutoDeletePolicy':
        response = handleSaveContentAutoDeletePolicy(payload);
        break;
      case 'setupAutoDeleteMaterialsTrigger':
        response = handleSetupAutoDeleteMaterialsTrigger(payload);
        break;
      case 'updateMaterial':
        response = handleUpdateMaterial(payload);
        break;
      case 'logActivity':
        response = handleLogActivity(payload);
        break;
      case 'submitFeedback':
        response = handleSubmitFeedback(payload);
        break;
      case 'getFeedbackHistory':
        response = handleGetFeedbackHistory(payload);
        break;
      case 'adminReplyFeedback':
        response = handleAdminReplyFeedback(payload);
        break;
      case 'getAdminData':
        response = handleGetAdminData(payload);
        break;
      case 'adminUpdateUserDetails':
        response = handleAdminUpdateUserDetails(payload);
        break;
      case 'updateUserRoleStatus':
      case 'updateUserBatch':
        response = handleUpdateUserRoleStatus(payload);
        break;
      case 'bulkUpdateUserBatches':
        response = handleBulkUpdateUserBatches(payload);
        break;
      case 'appointBatchMonitor':
        response = handleAppointBatchMonitor(payload);
        break;
      case 'saveBatchGroupMessage':
        response = handleSaveBatchGroupMessage(payload);
        break;
      case 'replyBatchGroupMessage':
        response = handleReplyBatchGroupMessage(payload);
        break;
      case 'getBatchGroupMessages':
        response = handleGetBatchGroupMessages(payload);
        break;
      case 'deleteBatchGroupMessage':
        response = handleDeleteBatchGroupMessage(payload);
        break;
      case 'voteBatchPoll':
        response = handleVoteBatchPoll(payload);
        break;
      case 'lockUserDevices':
        response = handleLockUserDevices(payload);
        break;
      case 'submitOutlineRequest':
        response = handleSubmitOutlineRequest(payload);
        break;
      case 'getOutlineRequests':
      case 'getWordOutlineRequests':
        response = handleGetOutlineRequests(payload);
        break;
      case 'resolveOutlineRequest':
      case 'replyWordOutlineRequest':
        response = handleResolveOutlineRequest(payload);
        break;
      case 'saveWhatsAppGatewayConfig':
        response = handleSaveWhatsAppGatewayConfig(payload);
        break;
      case 'getWhatsAppGatewayConfig':
        response = handleGetWhatsAppGatewayConfig(payload);
        break;
      case 'manageSubtab':
        response = handleManageSubtab(payload);
        break;
      case 'updateBannerSettings':
        response = handleUpdateBannerSettings(payload);
        break;
      case 'updateDashboardCustomBanner':
        response = handleUpdateDashboardCustomBanner(payload);
        break;
      case 'updateDateSpecificBanners':
        response = handleUpdateDateSpecificBanners(payload);
        break;
      case 'saveScheduledLiveTests':
        response = handleSaveScheduledLiveTests(payload);
        break;
      case 'saveInstituteBatches':
        response = handleSaveInstituteBatches(payload);
        break;
      case 'updateMaintenanceSettings':
        response = handleUpdateMaintenanceSettings(payload);
        break;
      case 'saveTestHistory':
        response = handleSaveTestHistory(payload);
        break;
      case 'getTestHistory':
        response = handleGetTestHistory(payload);
        break;
      case 'saveEvaluationRules':
        response = handleSaveEvaluationRules(payload);
        break;
      case 'getEvaluationRules':
        response = handleGetEvaluationRules(payload);
        break;
      case 'getDriveFileBase64':
        response = handleGetDriveFileBase64(payload);
        break;
      case 'getHelpContacts':
        response = handleGetHelpContacts(payload);
        break;
      case 'verifySession':
      case 'verifySessionToken':
        response = handleVerifySessionToken(payload);
        break;
      case 'saveDailyGoalProgress':
        response = handleSaveDailyGoalProgress(payload);
        break;
      case 'getDailyGoalProgress':
        response = handleGetDailyGoalProgress(payload);
        break;
      case 'sendMfaOtp':
        response = handleSendMfaOtp(payload);
        break;
      case 'verifyMfaOtp':
        response = handleVerifyMfaOtp(payload);
        break;
      case 'sendWhatsAppOtp':
        response = handleSendWhatsAppOtp(payload);
        break;
      case 'verifyWhatsAppOtp':
        response = handleVerifyWhatsAppOtp(payload);
        break;
      case 'saveUserEngagementSession':
        response = handleSaveUserEngagementSession(payload);
        break;
      case 'syncUserCloudState':
        response = handleSyncUserCloudState(payload);
        break;
      case 'createSpreadsheetBackup':
        response = handleCreateSpreadsheetBackup(payload);
        break;
      case 'sendBatchDigestEmail':
        response = handleSendBatchDigestEmail(payload);
        break;
      case 'setupDailyDigestTrigger':
        response = handleSetupDailyDigestTrigger(payload);
        break;
      case 'sendWeeklyReportToAll':
        response = handleSendWeeklyReportToAll(payload);
        break;
      case 'archiveOldTestHistoryRows':
        response = handleArchiveOldTestHistoryRows(payload);
        break;
      case 'saveFeeInstallmentRecord':
        response = handleSaveFeeInstallmentRecord(payload);
        break;
      case 'getFeeInstallmentLedger':
        response = handleGetFeeInstallmentLedger(payload);
        break;
      case 'recordGranularAuditDiff':
        response = handleRecordGranularAuditDiff(payload);
        break;
      case 'getGranularAuditDiffs':
        response = handleGetGranularAuditDiffs(payload);
        break;
      case 'bulkOnboardStudentsCsv':
        response = handleBulkOnboardStudentsCsv(payload);
        break;
      case 'sendTelegramBatchWebhookAlert':
        response = handleSendTelegramBatchWebhookAlert(payload);
        break;
      case 'saveTelegramWebhookConfig':
        response = handleSaveTelegramWebhookConfig(payload);
        break;
      case 'saveFranchiseBranches':
        response = handleSaveFranchiseBranches(payload);
        break;
      case 'getFranchiseBranches':
        response = handleGetFranchiseBranches(payload);
        break;
      case 'saveSettings':
        response = handleSaveSettings(payload);
        break;
      case 'uploadShorthandPad':
        response = handleUploadShorthandPad(payload);
        break;
      case 'getShorthandPads':
        response = handleGetShorthandPads(payload);
        break;
      case 'reviewShorthandPad':
        response = handleReviewShorthandPad(payload);
        break;
      case 'deleteShorthandPad':
        response = handleDeleteShorthandPad(payload);
        break;
      case 'applyEnrollmentValidity':
        response = handleApplyEnrollmentValidity(payload);
        break;
      case 'getAdminLiveTestRanks':
        response = handleGetAdminLiveTestRanks(payload);
        break;
      case 'updateOwnContactBeforeVerify':
        response = handleUpdateOwnContactBeforeVerify(payload);
        break;
      case 'sendMobileVerificationOtp':
        response = handleSendMobileVerificationOtp(payload);
        break;
      case 'verifyMobileOtp':
        response = handleVerifyMobileOtp(payload);
        break;
      case 'sendBulkVerificationReminders':
        response = handleSendBulkVerificationReminders(payload);
        break;
      case 'getBatchLeaderboard':
        response = handleGetBatchLeaderboard(payload);
        break;
      case 'uploadAudioToDrive':
        response = handleUploadAudioToDrive(payload);
        break;
      case 'saveShorthandPadAnnotation':
        response = handleSaveShorthandPadAnnotation(payload);
        break;
      case 'getShorthandPadAnnotations':
        response = handleGetShorthandPadAnnotations(payload);
        break;
      case 'saveBatchValidityMap':
        response = handleSaveBatchValidityMap(payload);
        break;
      case 'saveParentDetails':
        response = handleSaveParentDetails(payload);
        break;
      case 'saveFeeConfig':
        response = handleSaveFeeConfig(payload);
        break;
      case 'getFeeConfig':
        response = handleGetFeeConfig(payload);
        break;
      case 'submitStudentFeePayment':
        response = handleSubmitStudentFeePayment(payload);
        break;
      case 'validateFeeCoupon':
        response = handleValidateFeeCoupon(payload);
        break;
      case 'verifyFeePayment':
        response = handleVerifyFeePayment(payload);
        break;
      case 'getFeeLedger':
        response = handleGetFeeLedger(payload);
        break;
      case 'getTestHistoryDetail':
        response = handleGetTestHistoryDetail(payload);
        break;
      case 'getStreamRecord':
        response = handleGetStreamRecord(payload);
        break;
      case 'updateMemberAccessScope':
        response = handleUpdateMemberAccessScope(payload);
        break;
      case 'getUserHistory':
        response = handleGetTestHistory(payload);
        break;
      case 'archiveOldActivityLogs':
        response = handleArchiveOldActivityLogs(payload);
        break;
      case 'getActivityArchivalStatus':
        response = handleGetActivityArchivalStatus(payload);
        break;
      case 'setupMonthlyActivityArchivalTrigger':
        response = handleSetupMonthlyActivityArchivalTrigger(payload);
        break;
      default:
        response = { success: false, message: 'Invalid server action.' };
    }

    return response;

  } catch (error) {
    return { success: false, message: 'Server Exception: ' + error.toString() };
  } finally {
    // Always flush pending writes and close pooled database/cache handles before releasing script lock
    try { DbConnectionManager.close(); } catch (closeErr) {}
    if (lock) {
      try { lock.releaseLock(); } catch (e) {}
    }
  }
}

function isValidMobile(mobile) {
  return /^[0-9]{10}$/.test(String(mobile || '').trim());
}

function isValidPassword(password) {
  return String(password || '').trim().length >= 4;
}

// =========================================================================
// SECURITY HARDENING HELPERS (SCRIPT PROPERTIES, SALTED SHA-256 HASHING)
// =========================================================================

function getPrimarySuperadminEmail() {
  try {
    var propEmail = PropertiesService.getScriptProperties().getProperty('PRIMARY_SUPERADMIN_EMAIL');
    if (propEmail && String(propEmail).trim().indexOf('@') !== -1) {
      return String(propEmail).toLowerCase().trim();
    }
  } catch (e) {}
  return '2003aranjan@gmail.com';
}

function isPrimarySuperadminEmail(email) {
  var clean = String(email || '').toLowerCase().trim();
  return Boolean(clean && clean === getPrimarySuperadminEmail());
}

function getWhatsAppGatewayWebhookUrl() {
  try {
    var propUrl = PropertiesService.getScriptProperties().getProperty('FREE_WHATSAPP_WEBHOOK_URL');
    if (propUrl && String(propUrl).trim().indexOf('http') === 0) {
      return String(propUrl).trim();
    }
  } catch (e) {}
  try {
    var settings = getSheetData('SETTINGS');
    for (var i = 0; i < settings.length; i++) {
      var k = String(settings[i].Key || '').toUpperCase().trim();
      if (k === 'WHATSAPP_GATEWAY_WEBHOOK_URL' || k === 'FREE_WHATSAPP_WEBHOOK_URL') {
        var val = String(settings[i].Value || '').trim();
        if (val && val.indexOf('http') === 0) return val;
      }
    }
  } catch (e2) {}
  return '';
}

function isWhatsAppWebhookConfigured() {
  return Boolean(getWhatsAppGatewayWebhookUrl());
}

function isStrictWhatsAppOtpRequiredOnSignup() {
  try {
    var propStrict = PropertiesService.getScriptProperties().getProperty('REQUIRE_WHATSAPP_OTP_ON_SIGNUP');
    if (String(propStrict || '').toLowerCase() === 'true') return true;
  } catch (e) {}
  try {
    var settings = getSheetData('SETTINGS');
    for (var i = 0; i < settings.length; i++) {
      if (String(settings[i].Key || '').toUpperCase().trim() === 'REQUIRE_WHATSAPP_OTP_ON_SIGNUP') {
        return String(settings[i].Value || '').toLowerCase().trim() === 'true';
      }
    }
  } catch (e2) {}
  return false;
}

function handleGetWhatsAppGatewayConfig(payload) {
  var url = getWhatsAppGatewayWebhookUrl();
  var strictReq = isStrictWhatsAppOtpRequiredOnSignup();
  return {
    success: true,
    configured: Boolean(url),
    webhookUrlMasked: url ? (url.slice(0, 28) + (url.length > 28 ? '...' : '')) : '',
    requireOnSignup: strictReq
  };
}

function isSafeExternalFetchUrl(rawUrl) {
  var u = String(rawUrl || '').trim();
  if (!u || !/^https?:\/\//i.test(u)) return false;
  var hostMatch = u.match(/^https?:\/\/([^\/:?#]+)/i);
  if (!hostMatch || !hostMatch[1]) return false;
  var host = hostMatch[1].toLowerCase().replace(/^\[|\]$/g, '');
  if (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '0.0.0.0' ||
    host === '::1' ||
    /\.local$/i.test(host) ||
    /\.internal$/i.test(host) ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^169\.254\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host)
  ) {
    return false;
  }
  return true;
}

function handleSaveWhatsAppGatewayConfig(payload) {
  var webhookUrl = String(payload.webhookUrl || '').trim();
  var requireOnSignup = Boolean(payload.requireOnSignup);
  if (webhookUrl && !isSafeExternalFetchUrl(webhookUrl)) {
    return { success: false, message: 'WhatsApp Gateway Webhook URL must be a valid public https:// or http:// endpoint.' };
  }
  try {
    if (webhookUrl) {
      PropertiesService.getScriptProperties().setProperty('FREE_WHATSAPP_WEBHOOK_URL', webhookUrl);
    } else {
      PropertiesService.getScriptProperties().deleteProperty('FREE_WHATSAPP_WEBHOOK_URL');
    }
    PropertiesService.getScriptProperties().setProperty('REQUIRE_WHATSAPP_OTP_ON_SIGNUP', requireOnSignup ? 'true' : 'false');
  } catch (e) {}
  try {
    var sheet = getOrCreateSheet('SETTINGS');
    var data = sheet.getDataRange().getValues();
    var upsert = function(keyName, valStr) {
      var foundRow = 0;
      for (var r = 1; r < data.length; r++) {
        if (String(data[r][0] || '').toUpperCase().trim() === keyName) {
          foundRow = r + 1;
          break;
        }
      }
      if (foundRow > 0) {
        sheet.getRange(foundRow, 2).setValue(valStr);
      } else {
        sheet.appendRow([keyName, valStr]);
      }
    };
    upsert('WHATSAPP_GATEWAY_WEBHOOK_URL', webhookUrl);
    upsert('REQUIRE_WHATSAPP_OTP_ON_SIGNUP', requireOnSignup ? 'true' : 'false');
    invalidateSheetCache('SETTINGS');
  } catch (e2) {}
  return {
    success: true,
    configured: Boolean(webhookUrl),
    requireOnSignup: requireOnSignup,
    message: webhookUrl
      ? 'WhatsApp OTP Gateway Webhook saved! Live WhatsApp OTP delivery is now active.'
      : 'WhatsApp Gateway cleared. Sign-up will verify via Email OTP and mark mobile numbers as Pending Verification.'
  };
}

function isHashedPassword(storedPassword) {
  return String(storedPassword || '').indexOf('sha256$') === 0;
}

function computeSha256Hex(inputStr) {
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(inputStr || ''), Utilities.Charset.UTF_8);
  var hex = '';
  for (var i = 0; i < bytes.length; i++) {
    var b = (bytes[i] + 256) % 256;
    hex += (b < 16 ? '0' : '') + b.toString(16);
  }
  return hex;
}

function hashPasswordWithSalt(plainPassword, existingSalt) {
  var raw = String(plainPassword || '').trim();
  if (!raw) return '';
  if (isHashedPassword(raw)) return raw;
  var salt = existingSalt || (Utilities.getUuid().replace(/-/g, '').substring(0, 16));
  // Iterative SHA-256 stretching (250 rounds) fast enough for Apps Script quotas while resisting rainbow tables
  var digest = computeSha256Hex(salt + ':' + raw + ':rp_skill_v1');
  for (var r = 0; r < 249; r++) {
    digest = computeSha256Hex(digest + ':' + salt);
  }
  return 'sha256$' + salt + '$' + digest;
}

function verifyUserPassword(plainPassword, storedPassword) {
  var raw = String(plainPassword || '').trim();
  var stored = String(storedPassword || '').trim();
  if (!raw || !stored) return false;
  if (isHashedPassword(stored)) {
    var parts = stored.split('$');
    if (parts.length !== 3) return false;
    var expected = hashPasswordWithSalt(raw, parts[1]);
    return expected === stored;
  }
  // Legacy plaintext compatibility (upgraded transparently on login)
  return raw === stored;
}

function getSecureTelegramBotToken() {
  try {
    return String(PropertiesService.getScriptProperties().getProperty('TELEGRAM_BOT_TOKEN') || '').trim();
  } catch (e) {
    return '';
  }
}

function saveSecureTelegramBotToken(token) {
  var clean = String(token || '').trim();
  try {
    var props = PropertiesService.getScriptProperties();
    if (clean) {
      props.setProperty('TELEGRAM_BOT_TOKEN', clean);
    }
  } catch (e) {}
}

function safeSheetCellValue(val, maxChars) {
  var limit = maxChars || 48500;
  if (val === undefined || val === null) return '-';
  if (typeof val !== 'string') return val;
  if (val.length > limit) {
    return val.substring(0, limit);
  }
  return val;
}

function sanitizeInput(str) {
  if (str === undefined || str === null || String(str).trim() === '') return '-';
  if (typeof str !== 'string') return str;
  var trimmed = str.trim();
  if (trimmed.length > 48500) {
    trimmed = trimmed.substring(0, 48500);
  }
  if (/^[=+\-@]/.test(trimmed) && trimmed !== '-') {
    return "'" + trimmed;
  }
  return trimmed;
}

function defaultDash(val) {
  if (val === undefined || val === null || String(val).trim() === '') return '-';
  if (typeof val === 'string' && val.length > 48500) return val.substring(0, 48500);
  return val;
}

function getScriptLocalDate() {
  return Utilities.formatDate(new Date(), DbConnectionManager.getTimeZone(), 'yyyy-MM-dd');
}

function formatDriveUrl(url) {
  if (!url || String(url).trim() === '' || String(url).trim() === '-') return '-';
  var strUrl = String(url).trim();
  
  if (strUrl.indexOf('drive.google.com') !== -1 && strUrl.indexOf('/folders/') === -1) {
    var openMatch = strUrl.match(/drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/);
    if (openMatch && openMatch[1]) {
      strUrl = 'https://drive.google.com/file/d/' + openMatch[1] + '/preview';
    } else if (strUrl.indexOf('/file/d/') !== -1) {
      strUrl = strUrl.replace(/\/view.*$/, '/preview');
      strUrl = strUrl.replace(/\/edit.*$/, '/preview');
      if (strUrl.indexOf('/preview') === -1) {
        strUrl = strUrl.replace(/\?usp=sharing.*$/, '').replace(/\/usp=sharing.*$/, '');
        if (!strUrl.endsWith('/preview')) {
          strUrl += '/preview';
        }
      }
    }
  }

  if (strUrl.indexOf('github.com') !== -1 && strUrl.indexOf('/blob/') !== -1) {
    strUrl = strUrl.replace('github.com', 'raw.githubusercontent.com').replace('/blob/', '/');
  }

  return strUrl;
}

function initSheetsOnce() {
  var cache = DbConnectionManager.getCache();
  if (cache && cache.get('RP_SHEETS_INIT_V36') === '1') {
    return;
  }
  initSheets();
  if (cache) {
    cache.put('RP_SHEETS_INIT_V36', '1', 21600); // Cache schema verification for 6 hours
  }
}

var SHEET_SCHEMAS = {
  'USERS': [
    'UserID', 'Name', 'Email', 'Mobile', 'Password', 'Role', 'Status', 'SessionToken',
    'CreatedDate', 'AdminPermissions', 'Batch',
    'EmailVerified', 'MobileVerified', 'VisiblePassword', 'ParentName', 'ParentMobile',
    'ParentEmail', 'BatchValidUntil', 'MembershipPlan', 'MembershipValidUntil',
    'MemberAccessScope', 'MemberIncludedBatches', 'MemberIncludeUpcoming', 'MemberJoinDate',
    'FeeStatus', 'StudentTabPermissions', 'Theme', 'HeatmapEnabled', 'MfaPin',
    'AllDevicesLocked', 'DeviceBindingStrict', 'BoundDeviceId', 'ActiveDeviceId',
    'PreviousBatch', 'AutoSwitchedToFreeTier', 'LastLoginAt', 'OtherNotes'
  ],
  'USER_CLOUD_STATE': [
    'UserID', 'Theme', 'HeatmapEnabled', 'WeakOutlines', 'SavedMcqs', 'StudyPlanner', 'ExtraCloudState', 'UpdatedAt'
  ],
  'MATERIALS': [
    'ID', 'Type', 'Subtab', 'Category', 'Title', 'ContentOrUrl', 'ThumbnailUrl', 'LogoUrl',
    'AccessLevel', 'UploadedDate', 'Medium', 'Difficulty', 'ExamDate', 'TimeLimit', 'ExtraMetaJson',
    'TargetBatch', 'Description', 'CbtEvalRule', 'QuestionsCount', 'AudioStartTime',
    'AudioEndTime', 'MergedTracks', 'PublishAt', 'ExpireAt', 'AutoDeleteDays', 'AdditionalNotes'
  ],
  'SUBTABS': ['ID', 'Type', 'SubtabName'],
  'HOMEWORK': ['ID', 'TargetDate', 'Title', 'Details', 'CreatedDate', 'TargetBatch'],
  'ANNOUNCEMENTS': ['ID', 'Title', 'Content', 'PostedDate'],
  'FEEDBACK': ['ID', 'UserID', 'UserName', 'Category', 'Message', 'SubmittedDate', 'AdminResponse'],
  'ACTIVITY_LOGS': ['LogID', 'UserID', 'UserName', 'ActivityType', 'Details', 'Timestamp'],
  'ACTIVITY_LOGS_ARCHIVE': ['LogID', 'UserID', 'UserName', 'ActivityType', 'Details', 'Timestamp', 'ArchivedAt'],
  'TEST_HISTORY': [
    'HistoryID', 'UserID', 'UserName', 'ExamName', 'PassageTitle', 'TimeDuration',
    'TypingDate', 'TimeTaken', 'ErrorRelaxed', 'PenaltyWord', 'Date', 'GrossSpeed',
    'NetSpeed', 'TotalWord', 'TotalCharacter', 'TotalTypedCharacter', 'TotalTypedWords',
    'TotalBackspace', 'AccuracyPercentage', 'ErrorPercentage', 'MarksObtained', 'TotalMarks',
    'WrongTyped', 'WordLeft', 'ExtraTyped', 'ParaNotChanged', 'PunctuationError', 'CapitalError',
    'Status', 'TimeUsed', 'UserTranscription', 'ReferenceText', 'Timestamp', 'CorrectWords', 'ExtraMetaJson',
    'Batch', 'ExamRule', 'ExamCategory', 'FullMistakes', 'HalfMistakes', 'SpeedUnit', 'ResultGrade', 'AdditionalNotes'
  ],
  'SETTINGS': ['Key', 'Value'],
  'EVALUATION_RULES': ['RuleKey', 'RuleJson'],
  'DAILY_GOALS': ['GoalID', 'UserID', 'UserName', 'Date', 'TargetWords', 'WordsCompleted', 'StrokesCompleted', 'TestsCount', 'Status', 'UpdatedAt'],
  'BATCH_MESSAGES': ['MessageID', 'BatchName', 'AuthorID', 'AuthorName', 'AuthorRole', 'Visibility', 'RecipientMonitorID', 'StudentUserID', 'StudentUserName', 'Tag', 'Pinned', 'Message', 'TargetWPM', 'TargetAcc', 'TargetDeadline', 'RepliesJson', 'Status', 'Timestamp'],
  'TEST_HISTORY_ARCHIVE': [
    'HistoryID', 'UserID', 'UserName', 'ExamName', 'PassageTitle', 'TimeDuration',
    'TypingDate', 'TimeTaken', 'ErrorRelaxed', 'PenaltyWord', 'Date', 'GrossSpeed',
    'NetSpeed', 'TotalWord', 'TotalCharacter', 'TotalTypedCharacter', 'TotalTypedWords',
    'TotalBackspace', 'AccuracyPercentage', 'ErrorPercentage', 'MarksObtained', 'TotalMarks',
    'WrongTyped', 'WordLeft', 'ExtraTyped', 'ParaNotChanged', 'PunctuationError', 'CapitalError',
    'Status', 'TimeUsed', 'UserTranscription', 'ReferenceText', 'Timestamp', 'CorrectWords', 'ExtraMetaJson',
    'Batch', 'ExamRule', 'ExamCategory', 'FullMistakes', 'HalfMistakes', 'SpeedUnit', 'ResultGrade', 'AdditionalNotes', 'ArchivedAt'
  ],
  'FEE_LEDGER': [
    'ReceiptNo', 'UserID', 'StudentName', 'Batch', 'Branch', 'InstallmentNo',
    'AmountPaid', 'DueAmount', 'PaymentMode', 'ValidityUntil', 'IssuedBy', 'Timestamp',
    'FeeType', 'PlanName', 'ValidityDays', 'UTR', 'Status', 'Remarks', 'ReviewedBy', 'ReviewedAt',
    'CouponCode', 'DiscountAmount', 'TotalPlanFee', 'InstallmentLabel', 'RemainingBalance'
  ],
  'AUDIT_DIFF_LOGS': ['AuditID', 'ActorID', 'ActorName', 'TargetType', 'TargetKey', 'BeforeJson', 'AfterJson', 'Summary', 'Timestamp'],
  'SHORTHAND_PADS': ['PadID', 'UserID', 'UserName', 'Batch', 'MaterialID', 'MaterialTitle', 'DiagnosisTag', 'Notes', 'ImageDataOrUrl', 'SubmittedAt', 'ReviewStatus', 'ReviewedBy', 'ReviewerRole', 'ReviewerRemarks', 'ReviewedAt']
};

// Canonical Batch Helper: Always retains RP-Trail while keeping custom assigned batch(es) FIRST
function normalizeUserBatchesWithFreeTier(rawVal) {
  var items = [];
  if (Array.isArray(rawVal)) {
    items = rawVal;
  } else {
    var s = String(rawVal || '').trim();
    if (s && s !== '-') {
      items = s.split(',');
    }
  }
  var custom = [];
  var seen = {};
  for (var i = 0; i < items.length; i++) {
    var b = String(items[i] || '').trim();
    if (!b || b === '-') continue;
    var low = b.toLowerCase();
    if (low === 'general batch' || low === 'free tier' || low === 'rp-trail') continue;
    if (!seen[low]) {
      seen[low] = true;
      custom.push(b);
    }
  }
  custom.push('RP-Trail');
  return custom.join(', ');
}

function ensureSheetHeadersCached(sheet, sheetName) {
  var expectedHeaders = SHEET_SCHEMAS[sheetName] || null;
  if (!sheet || !expectedHeaders || !expectedHeaders.length) return [];
  var lastCol = sheet.getLastColumn();
  if (lastCol === 0) {
    sheet.appendRow(expectedHeaders);
    DbConnectionManager.markDirty(sheetName);
    return expectedHeaders.slice();
  }
  var existingHeaders = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  var missing = [];
  for (var h = 0; h < expectedHeaders.length; h++) {
    if (existingHeaders.indexOf(expectedHeaders[h]) === -1) {
      missing.push(expectedHeaders[h]);
    }
  }
  if (missing.length > 0) {
    sheet.getRange(1, lastCol + 1, 1, missing.length).setValues([missing]);
    existingHeaders = existingHeaders.concat(missing);
    DbConnectionManager.markDirty(sheetName);
  }
  return existingHeaders;
}

function setRowNamedColumns(sheet, sheetName, rowIndex, colMap) {
  if (!sheet || !rowIndex || !colMap) return;
  var headers = ensureSheetHeadersCached(sheet, sheetName);
  for (var colName in colMap) {
    if (!colMap.hasOwnProperty(colName)) continue;
    var idx = headers.indexOf(colName);
    if (idx === -1) {
      headers.push(colName);
      sheet.getRange(1, headers.length).setValue(colName);
      idx = headers.length - 1;
    }
    sheet.getRange(rowIndex, idx + 1).setValue(colMap[colName]);
  }
}

function normalizeFeeStatusLabel(rawStatus) {
  var s = String(rawStatus || 'Pending').trim().toLowerCase();
  if (s === 'verified' || s === 'approved' || s === 'paid') return 'Approved';
  if (s === 'rejected' || s === 'declined' || s === 'failed') return 'Rejected';
  return 'Pending';
}

function readUserCloudStateRow(userId) {
  var uid = String(userId || '').trim();
  if (!uid) return {};
  try {
    var rows = getSheetData('USER_CLOUD_STATE');
    for (var i = 0; i < rows.length; i++) {
      if (String(rows[i].UserID || '').trim() === uid) {
        var out = {};
        if (rows[i].Theme && rows[i].Theme !== '-') out.theme = String(rows[i].Theme);
        if (rows[i].HeatmapEnabled && rows[i].HeatmapEnabled !== '-') out.heatmapEnabled = (String(rows[i].HeatmapEnabled).toLowerCase() !== 'no');
        if (rows[i].WeakOutlines && rows[i].WeakOutlines !== '-') out.weakOutlinesVault = parseReadableSheetData(rows[i].WeakOutlines, []);
        if (rows[i].SavedMcqs && rows[i].SavedMcqs !== '-') out.cbtBookmarkedMcqs = parseReadableSheetData(rows[i].SavedMcqs, []);
        if (rows[i].StudyPlanner && rows[i].StudyPlanner !== '-') out.weeklyStudyPlanner = parseReadableSheetData(rows[i].StudyPlanner, {});
        if (rows[i].ExtraCloudState && rows[i].ExtraCloudState !== '-') {
          var extra = parseReadableSheetData(rows[i].ExtraCloudState, {});
          if (extra && typeof extra === 'object' && !Array.isArray(extra)) {
            for (var k in extra) {
              if (extra.hasOwnProperty(k)) out[k] = extra[k];
            }
          }
        }
        return out;
      }
    }
  } catch (e) {}
  return {};
}

function writeUserCloudStateRow(userId, cloudObj) {
  var uid = String(userId || '').trim();
  if (!uid || !cloudObj || typeof cloudObj !== 'object') return;
  try {
    var sheet = getOrCreateSheet('USER_CLOUD_STATE');
    var rows = getSheetData('USER_CLOUD_STATE');
    var targetRowIdx = -1;
    var existing = {};
    for (var i = 0; i < rows.length; i++) {
      if (String(rows[i].UserID || '').trim() === uid) {
        targetRowIdx = i + 2;
        existing = readUserCloudStateRow(uid);
        break;
      }
    }
    var merged = {};
    for (var ek in existing) {
      if (existing.hasOwnProperty(ek)) merged[ek] = existing[ek];
    }
    for (var nk in cloudObj) {
      if (cloudObj.hasOwnProperty(nk)) merged[nk] = cloudObj[nk];
    }
    var extra = {};
    var scalarKeys = {
      emailVerified: true, mobileVerified: true, adminVisiblePassword: true, parentName: true,
      parentMobile: true, parentEmail: true, enrollmentValidUntil: true, membershipPlan: true,
      membershipValidUntil: true, memberAccessScope: true, memberIncludedBatches: true,
      memberIncludeUpcoming: true, memberJoinDate: true, feeStatus: true, allowedPortalTabs: true,
      theme: true, heatmapEnabled: true, mfaPin: true, allDevicesLocked: true,
      deviceBindingStrict: true, boundDeviceId: true, activeDeviceId: true, activeSessionToken: true,
      previousBatch: true, autoSwitchedToFreeTier: true, lastLoginAt: true,
      weakOutlinesVault: true, cbtBookmarkedMcqs: true, weeklyStudyPlanner: true
    };
    for (var mk in merged) {
      if (merged.hasOwnProperty(mk) && !scalarKeys[mk]) {
        extra[mk] = merged[mk];
      }
    }
    var nowIso = new Date().toISOString();
    var rowVals = [
      uid,
      merged.theme ? String(merged.theme) : '-',
      merged.heatmapEnabled === false ? 'No' : 'Yes',
      merged.weakOutlinesVault ? formatReadableSheetData(merged.weakOutlinesVault) : '-',
      merged.cbtBookmarkedMcqs ? formatReadableSheetData(merged.cbtBookmarkedMcqs) : '-',
      merged.weeklyStudyPlanner ? formatReadableSheetData(merged.weeklyStudyPlanner) : '-',
      Object.keys(extra).length ? formatReadableSheetData(extra) : '-',
      nowIso
    ];
    if (targetRowIdx >= 2) {
      sheet.getRange(targetRowIdx, 1, 1, rowVals.length).setValues([rowVals]);
    } else {
      sheet.appendRow(rowVals);
    }
    invalidateSheetCache('USER_CLOUD_STATE');
  } catch (e) {}
}

function readUserSettingsFromRow(userObj, includeCloudState) {
  var u = userObj || {};
  var legacy = {};
  if (u.UserPreferencesJson && u.UserPreferencesJson !== '-') {
    legacy = parseReadableSheetData(u.UserPreferencesJson, {});
    if (!legacy || typeof legacy !== 'object' || Array.isArray(legacy)) legacy = {};
  }
  var prefs = {};
  for (var lk in legacy) {
    if (legacy.hasOwnProperty(lk)) prefs[lk] = legacy[lk];
  }
  function isYesVal(v) {
    var s = String(v || '').toLowerCase().trim();
    return s === 'yes' || s === 'true' || s === '1';
  }
  function cleanStr(v) {
    var s = String(v === undefined || v === null ? '' : v).trim();
    return (s === '-' ? '' : s);
  }
  if (u.EmailVerified !== undefined && u.EmailVerified !== '' && u.EmailVerified !== '-') prefs.emailVerified = isYesVal(u.EmailVerified);
  if (u.MobileVerified !== undefined && u.MobileVerified !== '' && u.MobileVerified !== '-') prefs.mobileVerified = isYesVal(u.MobileVerified);
  if (cleanStr(u.ParentName)) prefs.parentName = cleanStr(u.ParentName);
  if (cleanStr(u.ParentMobile)) prefs.parentMobile = cleanStr(u.ParentMobile);
  if (cleanStr(u.ParentEmail)) prefs.parentEmail = cleanStr(u.ParentEmail);
  if (cleanStr(u.BatchValidUntil)) prefs.enrollmentValidUntil = cleanStr(u.BatchValidUntil);
  if (cleanStr(u.MembershipPlan)) prefs.membershipPlan = cleanStr(u.MembershipPlan);
  if (cleanStr(u.MembershipValidUntil)) prefs.membershipValidUntil = cleanStr(u.MembershipValidUntil);
  if (cleanStr(u.MemberAccessScope)) prefs.memberAccessScope = cleanStr(u.MemberAccessScope);
  if (cleanStr(u.MemberIncludedBatches)) prefs.memberIncludedBatches = cleanStr(u.MemberIncludedBatches);
  if (u.MemberIncludeUpcoming !== undefined && u.MemberIncludeUpcoming !== '' && u.MemberIncludeUpcoming !== '-') prefs.memberIncludeUpcoming = isYesVal(u.MemberIncludeUpcoming);
  if (cleanStr(u.MemberJoinDate)) prefs.memberJoinDate = cleanStr(u.MemberJoinDate);
  if (cleanStr(u.FeeStatus)) prefs.feeStatus = cleanStr(u.FeeStatus);
  if (cleanStr(u.StudentTabPermissions)) prefs.allowedPortalTabs = cleanStr(u.StudentTabPermissions);
  if (cleanStr(u.Theme)) prefs.theme = cleanStr(u.Theme);
  if (u.HeatmapEnabled !== undefined && u.HeatmapEnabled !== '' && u.HeatmapEnabled !== '-') prefs.heatmapEnabled = isYesVal(u.HeatmapEnabled);
  if (cleanStr(u.MfaPin)) prefs.mfaPin = cleanStr(u.MfaPin);
  if (u.AllDevicesLocked !== undefined && u.AllDevicesLocked !== '' && u.AllDevicesLocked !== '-') prefs.allDevicesLocked = isYesVal(u.AllDevicesLocked);
  if (u.DeviceBindingStrict !== undefined && u.DeviceBindingStrict !== '' && u.DeviceBindingStrict !== '-') prefs.deviceBindingStrict = isYesVal(u.DeviceBindingStrict);
  if (cleanStr(u.BoundDeviceId)) prefs.boundDeviceId = cleanStr(u.BoundDeviceId);
  if (cleanStr(u.ActiveDeviceId)) prefs.activeDeviceId = cleanStr(u.ActiveDeviceId);
  if (cleanStr(u.PreviousBatch)) prefs.previousBatch = cleanStr(u.PreviousBatch);
  if (u.AutoSwitchedToFreeTier !== undefined && u.AutoSwitchedToFreeTier !== '' && u.AutoSwitchedToFreeTier !== '-') prefs.autoSwitchedToFreeTier = isYesVal(u.AutoSwitchedToFreeTier);
  if (cleanStr(u.LastLoginAt)) prefs.lastLoginAt = cleanStr(u.LastLoginAt);

  if (includeCloudState && u.UserID) {
    var cloud = readUserCloudStateRow(u.UserID);
    for (var ck in cloud) {
      if (cloud.hasOwnProperty(ck) && cloud[ck] !== undefined) prefs[ck] = cloud[ck];
    }
  }
  return prefs;
}

function syncUserReadableColumns(sheet, rowIndex, userObj, prefs) {
  try {
    if (!sheet || !rowIndex) return;
    var p = (prefs && typeof prefs === 'object' && !Array.isArray(prefs)) ? prefs : {};
    var u = userObj || {};
    var roleLow = String(u.Role || '').toLowerCase().trim();
    var emailVer = Boolean(p.emailVerified === true || String(u.EmailVerified || '').toLowerCase() === 'yes' || String(u.EmailVerified || '').toLowerCase() === 'true');
    var mobVer = Boolean(p.mobileVerified === true || String(u.MobileVerified || '').toLowerCase() === 'yes' || String(u.MobileVerified || '').toLowerCase() === 'true');
    var visPass = '-';
    var pName = String(p.parentName || (u.ParentName && u.ParentName !== '-' ? u.ParentName : '') || u.Name || '-').trim() || '-';
    var pMob = String(p.parentMobile || (u.ParentMobile && u.ParentMobile !== '-' ? u.ParentMobile : '') || u.Mobile || '-').trim() || '-';
    var pEmail = String(p.parentEmail || (u.ParentEmail && u.ParentEmail !== '-' ? u.ParentEmail : '') || u.Email || '-').trim() || '-';
    var validUntil = String(p.enrollmentValidUntil || (u.BatchValidUntil && u.BatchValidUntil !== '-' ? u.BatchValidUntil : '') || '-').trim() || '-';
    var memPlan = String(p.membershipPlan || (u.MembershipPlan && u.MembershipPlan !== '-' ? u.MembershipPlan : '') || (roleLow === 'member' ? 'Member All-Access Pass' : 'Standard')).trim();
    var memValid = String(p.membershipValidUntil || (u.MembershipValidUntil && u.MembershipValidUntil !== '-' ? u.MembershipValidUntil : '') || '-').trim() || '-';
    var memScope = String(p.memberAccessScope || (u.MemberAccessScope && u.MemberAccessScope !== '-' ? u.MemberAccessScope : '') || (roleLow === 'member' ? 'ALL_PAST_CURRENT_UPCOMING' : '-')).trim() || '-';
    var memBatchesRaw = p.memberIncludedBatches !== undefined ? p.memberIncludedBatches : (u.MemberIncludedBatches || '');
    var memBatchesStr = Array.isArray(memBatchesRaw)
      ? memBatchesRaw.map(function(x) { return String(x || '').trim(); }).filter(Boolean).join(', ')
      : String(memBatchesRaw || '').trim();
    if (!memBatchesStr) memBatchesStr = '-';
    var memIncludeUpc = (p.memberIncludeUpcoming !== undefined)
      ? Boolean(p.memberIncludeUpcoming)
      : (String(u.MemberIncludeUpcoming || '').toLowerCase() === 'yes' || memScope === 'ALL_PAST_CURRENT_UPCOMING' || memScope === 'CURRENT_AND_UPCOMING');
    var memJoin = String(p.memberJoinDate || (u.MemberJoinDate && u.MemberJoinDate !== '-' ? u.MemberJoinDate : '') || (roleLow === 'member' ? new Date().toISOString().slice(0, 10) : '-')).trim() || '-';
    var feeSt = String(p.feeStatus || (u.FeeStatus && u.FeeStatus !== '-' ? u.FeeStatus : '') || 'Free (RP-Trail)').trim();
    var tabPerms = String(p.allowedPortalTabs || (u.StudentTabPermissions && u.StudentTabPermissions !== '-' ? u.StudentTabPermissions : '') || 'ALL').trim();
    var themeVal = String(p.theme || (u.Theme && u.Theme !== '-' ? u.Theme : '') || 'light').trim();
    var heatVal = (p.heatmapEnabled === false || String(u.HeatmapEnabled || '').toLowerCase() === 'no') ? 'No' : 'Yes';
    var mfaPinVal = String(p.mfaPin || (u.MfaPin && u.MfaPin !== '-' ? u.MfaPin : '') || '-').trim() || '-';
    var devLockAll = Boolean(p.allDevicesLocked === true || String(u.AllDevicesLocked || '').toLowerCase() === 'yes');
    var devStrict = Boolean(p.deviceBindingStrict === true || String(u.DeviceBindingStrict || '').toLowerCase() === 'yes');
    var boundDev = String(p.boundDeviceId !== undefined ? p.boundDeviceId : (u.BoundDeviceId || '')).trim() || '-';
    var actDev = String(p.activeDeviceId !== undefined ? p.activeDeviceId : (u.ActiveDeviceId || '')).trim() || '-';
    var prevBatch = String(p.previousBatch || (u.PreviousBatch && u.PreviousBatch !== '-' ? u.PreviousBatch : '') || '-').trim() || '-';
    var autoSw = Boolean(p.autoSwitchedToFreeTier === true || String(u.AutoSwitchedToFreeTier || '').toLowerCase() === 'yes');
    var lastLog = String(p.lastLoginAt || (u.LastLoginAt && u.LastLoginAt !== '-' ? u.LastLoginAt : '') || '-').trim() || '-';

    var noteParts = [];
    if (p.onboardedViaCsv) noteParts.push('CSV Onboarded: Yes');
    if (p.requiresContactVerification) noteParts.push('Contact Verification Pending');
    if (p.branch) noteParts.push('Branch: ' + p.branch);
    var notesStr = noteParts.length ? noteParts.join(' | ') : '-';

    setRowNamedColumns(sheet, 'USERS', rowIndex, {
      'EmailVerified': emailVer ? 'Yes' : 'No',
      'MobileVerified': mobVer ? 'Yes' : 'No',
      'VisiblePassword': visPass || '-',
      'ParentName': pName,
      'ParentMobile': pMob,
      'ParentEmail': pEmail,
      'BatchValidUntil': validUntil,
      'MembershipPlan': memPlan,
      'MembershipValidUntil': memValid,
      'MemberAccessScope': memScope,
      'MemberIncludedBatches': memBatchesStr,
      'MemberIncludeUpcoming': memIncludeUpc ? 'Yes' : 'No',
      'MemberJoinDate': memJoin,
      'FeeStatus': feeSt,
      'StudentTabPermissions': tabPerms,
      'Theme': themeVal,
      'HeatmapEnabled': heatVal,
      'MfaPin': mfaPinVal,
      'AllDevicesLocked': devLockAll ? 'Yes' : 'No',
      'DeviceBindingStrict': devStrict ? 'Yes' : 'No',
      'BoundDeviceId': boundDev,
      'ActiveDeviceId': actDev,
      'PreviousBatch': prevBatch,
      'AutoSwitchedToFreeTier': autoSw ? 'Yes' : 'No',
      'LastLoginAt': lastLog,
      'OtherNotes': notesStr
    });

    // Persist large student collections cleanly in USER_CLOUD_STATE (never in USERS!)
    if (u.UserID && (p.weakOutlinesVault !== undefined || p.cbtBookmarkedMcqs !== undefined || p.weeklyStudyPlanner !== undefined)) {
      writeUserCloudStateRow(u.UserID, p);
    }
  } catch (syncErr) {}
}

function appendUserRowClean(userSheet, userObj, prefsObj) {
  var headers = userSheet.getLastColumn() > 0
    ? userSheet.getRange(1, 1, 1, userSheet.getLastColumn()).getValues()[0]
    : SHEET_SCHEMAS['USERS'];
  var rowVals = [];
  for (var c = 0; c < headers.length; c++) {
    var h = String(headers[c] || '').trim();
    if (h === 'UserPreferencesJson') {
      rowVals.push('-');
    } else if (userObj[h] !== undefined) {
      rowVals.push(userObj[h]);
    } else {
      rowVals.push('-');
    }
  }
  userSheet.appendRow(rowVals);
  var newRowIdx = userSheet.getLastRow();
  syncUserReadableColumns(userSheet, newRowIdx, userObj, prefsObj || {});
  return newRowIdx;
}

function parseInstituteBatchesMetaSettings(settingsData) {
  var rows = settingsData || getSheetData('SETTINGS');
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i].Key || '').toUpperCase().trim() === 'INSTITUTE_BATCHES_META') {
      var parsed = parseReadableSheetData(rows[i].Value, {});
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
    }
  }
  return {};
}

function isMemberAllAccessActive(roleVal, prefs, rowObj) {
  var r = String(roleVal || '').toLowerCase().trim();
  if (r !== 'member') return false;
  var validStr = String((prefs && prefs.membershipValidUntil) || (rowObj && rowObj.MembershipValidUntil) || (prefs && prefs.enrollmentValidUntil) || '').trim();
  if (!validStr || validStr === '-') return true;
  var expMs = new Date(validStr + (validStr.length === 10 ? 'T23:59:59' : '')).getTime();
  if (isNaN(expMs)) return true;
  return Date.now() <= expMs;
}

function evaluateMemberBatchAccess(roleVal, prefs, rowObj, targetBatch, batchMetaMap) {
  var bClean = String(targetBatch || '').trim();
  if (!bClean || bClean.toLowerCase() === 'rp-trail' || bClean.toLowerCase() === 'all' || bClean.toLowerCase() === 'public') return true;
  if (!isMemberAllAccessActive(roleVal, prefs, rowObj)) return false;
  var scope = String((prefs && prefs.memberAccessScope) || (rowObj && rowObj.MemberAccessScope) || 'ALL_PAST_CURRENT_UPCOMING').toUpperCase().trim();
  if (scope === 'ALL_PAST_CURRENT_UPCOMING' || scope === '-' || !scope) return true;

  var joinStr = String((prefs && prefs.memberJoinDate) || (rowObj && rowObj.MemberJoinDate) || (rowObj && rowObj.CreatedDate) || '').trim().slice(0, 10);
  var meta = (batchMetaMap && batchMetaMap[bClean]) ? batchMetaMap[bClean] : null;
  var batchCreatedStr = (meta && meta.createdAt) ? String(meta.createdAt).slice(0, 10) : '';

  if (scope === 'ALL_EXISTING_ONLY') {
    if (!joinStr || !batchCreatedStr) return true;
    return batchCreatedStr <= joinStr;
  }
  if (scope === 'CURRENT_AND_UPCOMING') {
    if (!joinStr || !batchCreatedStr) return true;
    return batchCreatedStr >= joinStr;
  }
  if (scope === 'CUSTOM_SELECTED') {
    var incRaw = (prefs && prefs.memberIncludedBatches !== undefined) ? prefs.memberIncludedBatches : (rowObj && rowObj.MemberIncludedBatches ? rowObj.MemberIncludedBatches : '');
    var incList = Array.isArray(incRaw)
      ? incRaw.map(function(x) { return String(x || '').trim().toLowerCase(); })
      : String(incRaw || '').split(',').map(function(x) { return x.trim().toLowerCase(); }).filter(Boolean);
    if (incList.indexOf(bClean.toLowerCase()) !== -1) return true;
    var incUpcoming = Boolean((prefs && prefs.memberIncludeUpcoming === true) || String((rowObj && rowObj.MemberIncludeUpcoming) || '').toLowerCase() === 'yes');
    if (incUpcoming && joinStr && batchCreatedStr && batchCreatedStr >= joinStr) return true;
    return false;
  }
  return true;
}

function getOrCreateSheet(sheetName, skipHeaderCheck) {
  var sheet = DbConnectionManager.getSheet(sheetName);
  var ss = DbConnectionManager.getSpreadsheet();
  var expectedHeaders = SHEET_SCHEMAS[sheetName] || null;

  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    DbConnectionManager.setSheet(sheetName, sheet);
    if (expectedHeaders && expectedHeaders.length > 0) {
      sheet.appendRow(expectedHeaders);
      DbConnectionManager.markDirty(sheetName);
    }
    return sheet;
  }

  // Skip redundant getRange(1,1) header RPC during fast read-only queries
  if (!skipHeaderCheck && expectedHeaders && expectedHeaders.length > 0) {
    ensureSheetHeadersCached(sheet, sheetName);
  }
  return sheet;
}

function initSheets() {
  for (var sheetName in SHEET_SCHEMAS) {
    getOrCreateSheet(sheetName);
  }
}

var CACHEABLE_SHEETS = {
  'USERS': true,
  'USER_CLOUD_STATE': true,
  'MATERIALS': true,
  'SUBTABS': true,
  'ANNOUNCEMENTS': true,
  'HOMEWORK': true,
  'SETTINGS': true,
  'EVALUATION_RULES': true,
  'FEE_LEDGER': true
};

// Multi-chunk CacheService helpers so sheets larger than 95KB are cached reliably (up to ~450KB)
function cachePutChunked(cache, baseKey, strVal, ttlSec) {
  if (!cache || !strVal) return;
  try {
    var chunkSize = 85000;
    if (strVal.length <= chunkSize) {
      cache.put(baseKey + '_CNT', '1', ttlSec);
      cache.put(baseKey + '_0', strVal, ttlSec);
      return;
    }
    var count = Math.ceil(strVal.length / chunkSize);
    if (count > 5) return; // Skip caching only if truly massive (>425KB)
    var batchMap = {};
    batchMap[baseKey + '_CNT'] = String(count);
    for (var i = 0; i < count; i++) {
      batchMap[baseKey + '_' + i] = strVal.slice(i * chunkSize, (i + 1) * chunkSize);
    }
    cache.putAll(batchMap, ttlSec);
  } catch (e) {}
}

function cacheGetChunked(cache, baseKey) {
  if (!cache) return null;
  try {
    var cntRaw = cache.get(baseKey + '_CNT');
    if (!cntRaw) return null;
    var count = parseInt(cntRaw, 10) || 0;
    if (count <= 0 || count > 5) return null;
    if (count === 1) return cache.get(baseKey + '_0');
    var keys = [];
    for (var i = 0; i < count; i++) keys.push(baseKey + '_' + i);
    var map = cache.getAll(keys);
    var parts = [];
    for (var j = 0; j < keys.length; j++) {
      if (!map[keys[j]]) return null;
      parts.push(map[keys[j]]);
    }
    return parts.join('');
  } catch (e) {
    return null;
  }
}

function cacheRemoveChunked(cache, baseKey) {
  if (!cache) return;
  try {
    cache.removeAll([baseKey, baseKey + '_CNT', baseKey + '_0', baseKey + '_1', baseKey + '_2', baseKey + '_3', baseKey + '_4']);
  } catch (e) {}
}

function invalidateSheetCache(sheetName) {
  DbConnectionManager.markDirty(sheetName);
  try {
    var cache = DbConnectionManager.getCache();
    if (cache) {
      cacheRemoveChunked(cache, 'SHEET_CACHE_V36_' + sheetName);
    }
  } catch (e) {}
}

function getFastTotalVisitsCount() {
  try {
    var props = PropertiesService.getScriptProperties();
    var cached = parseInt(props.getProperty('RP_TOTAL_LOGIN_VISITS') || '', 10);
    if (!isNaN(cached) && cached >= 0) return cached;
    var logs = getSheetData('ACTIVITY_LOGS');
    var count = 0;
    for (var i = 0; i < logs.length; i++) {
      if (logs[i].ActivityType === 'LOGIN') count++;
    }
    props.setProperty('RP_TOTAL_LOGIN_VISITS', String(count));
    return count;
  } catch (e) {
    return 0;
  }
}

function incrementFastTotalVisitsCount() {
  try {
    var props = PropertiesService.getScriptProperties();
    var cur = parseInt(props.getProperty('RP_TOTAL_LOGIN_VISITS') || '0', 10) || 0;
    props.setProperty('RP_TOTAL_LOGIN_VISITS', String(cur + 1));
  } catch (e) {}
}

function getSheetData(sheetName) {
  var reqCached = DbConnectionManager.getRequestRows(sheetName);
  if (reqCached !== null) {
    return reqCached;
  }

  var cache = null;
  var cacheKey = 'SHEET_CACHE_V36_' + sheetName;
  if (CACHEABLE_SHEETS[sheetName]) {
    try {
      cache = DbConnectionManager.getCache();
      var cachedJson = cache ? cacheGetChunked(cache, cacheKey) : null;
      if (cachedJson) {
        var parsedRows = JSON.parse(cachedJson);
        DbConnectionManager.setRequestRows(sheetName, parsedRows);
        return parsedRows;
      }
    } catch (e) {}
  }

  // Fast read path: skip extra header-write RPC when sheet already exists
  var sheet = DbConnectionManager.getSheet(sheetName);
  if (!sheet) {
    sheet = getOrCreateSheet(sheetName, false);
  }
  if (!sheet) return [];
  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) {
    DbConnectionManager.setRequestRows(sheetName, []);
    return [];
  }
  var headers = data[0];
  var rows = [];
  var tz = DbConnectionManager.getTimeZone();

  var STRING_HEADERS = {
    'ID': true, 'UserID': true, 'Name': true, 'Email': true, 'Mobile': true,
    'Password': true, 'VisiblePassword': true, 'Role': true, 'Status': true, 'SessionToken': true,
    'AdminPermissions': true, 'Type': true, 'Subtab': true, 'Category': true,
    'Title': true, 'ContentOrUrl': true, 'ThumbnailUrl': true, 'LogoUrl': true,
    'AccessLevel': true, 'Medium': true, 'Difficulty': true, 'SubtabName': true,
    'ExamName': true, 'UserName': true, 'PassageTitle': true, 'TargetBatch': true,
    'ParentName': true, 'ParentMobile': true, 'ParentEmail': true, 'FeeStatus': true,
    'MembershipPlan': true, 'MembershipValidUntil': true, 'BatchValidUntil': true,
    'ReceiptNo': true, 'UTR': true, 'FeeType': true
  };

  for (var i = 1; i < data.length; i++) {
    var row = {};
    for (var j = 0; j < headers.length; j++) {
      var colName = headers[j];
      if (!colName) continue;
      var val = data[i][j];
      if ((sheetName === 'HOMEWORK' || sheetName === 'MATERIALS' || sheetName === 'TEST_HISTORY') &&
          (colName === 'TargetDate' || colName === 'ExamDate' || colName === 'Date')) {
        if (val instanceof Date) {
          val = Utilities.formatDate(val, tz, 'yyyy-MM-dd');
        } else if (val) {
          val = String(val).split('T')[0];
        }
      }
      if (val === '' || val === null || val === undefined) {
        row[colName] = '-';
      } else if (STRING_HEADERS[colName]) {
        row[colName] = String(val);
      } else {
        row[colName] = val;
      }
    }
    if (sheetName === 'MATERIALS') {
      // Read dedicated human-readable columns first, then fallback to legacy ExtraMetaJson
      if (row.CbtEvalRule && row.CbtEvalRule !== '-' && (!row.CbtEvalRuleKey || row.CbtEvalRuleKey === '-')) {
        row.CbtEvalRuleKey = String(row.CbtEvalRule);
      }
      if (row.AudioStartTime && row.AudioStartTime !== '-') row.MediaStartTime = String(row.AudioStartTime);
      if (row.AudioEndTime && row.AudioEndTime !== '-') row.MediaEndTime = String(row.AudioEndTime);
      if (row.ExtraMetaJson && row.ExtraMetaJson !== '-') {
        try {
          var parsedMeta = parseReadableSheetData(row.ExtraMetaJson, {});
          if (parsedMeta && typeof parsedMeta === 'object' && !Array.isArray(parsedMeta)) {
            if (parsedMeta.TargetBatch && (!row.TargetBatch || row.TargetBatch === '-')) row.TargetBatch = parsedMeta.TargetBatch;
            if (parsedMeta.CbtEvalRuleKey && (!row.CbtEvalRuleKey || row.CbtEvalRuleKey === '-')) row.CbtEvalRuleKey = parsedMeta.CbtEvalRuleKey;
            if (parsedMeta.QuestionsCount !== undefined && (row.QuestionsCount === undefined || row.QuestionsCount === '-')) row.QuestionsCount = parsedMeta.QuestionsCount;
            if (parsedMeta.PublishAt && (!row.PublishAt || row.PublishAt === '-')) row.PublishAt = parsedMeta.PublishAt;
            if (parsedMeta.ExpireAt && (!row.ExpireAt || row.ExpireAt === '-')) row.ExpireAt = parsedMeta.ExpireAt;
            if (parsedMeta.AutoDeleteAt && (!row.AutoDeleteAt || row.AutoDeleteAt === '-')) row.AutoDeleteAt = parsedMeta.AutoDeleteAt;
            if (parsedMeta.AutoDeleteDays && (!row.AutoDeleteDays || row.AutoDeleteDays === '-')) row.AutoDeleteDays = parsedMeta.AutoDeleteDays;
            if (parsedMeta.MediaStartTime !== undefined && parsedMeta.MediaStartTime !== '' && (!row.MediaStartTime || row.MediaStartTime === '-')) row.MediaStartTime = String(parsedMeta.MediaStartTime);
            if (parsedMeta.MediaEndTime !== undefined && parsedMeta.MediaEndTime !== '' && (!row.MediaEndTime || row.MediaEndTime === '-')) row.MediaEndTime = String(parsedMeta.MediaEndTime);
            if (Array.isArray(parsedMeta.MergedAudioTracks) && parsedMeta.MergedAudioTracks.length > 0) row.MergedAudioTracks = parsedMeta.MergedAudioTracks;
          }
        } catch (e) {}
      }
    }
    if (sheetName === 'TEST_HISTORY' && row.ExtraMetaJson && row.ExtraMetaJson !== '-') {
      try {
        var parsedHistMeta = parseReadableSheetData(row.ExtraMetaJson, {});
        if (parsedHistMeta && typeof parsedHistMeta === 'object' && !Array.isArray(parsedHistMeta)) {
          for (var hk in parsedHistMeta) {
            if (row[hk] === undefined || row[hk] === '-') row[hk] = parsedHistMeta[hk];
          }
        }
      } catch (e) {}
    }
    rows.push(row);
  }

  DbConnectionManager.setRequestRows(sheetName, rows);

  if (cache && CACHEABLE_SHEETS[sheetName]) {
    try {
      var serialized = JSON.stringify(rows);
      cachePutChunked(cache, cacheKey, serialized, 300); // 5-minute multi-chunk cache
    } catch (e) {}
  }

  return rows;
}

// =========================================================================
// HUMAN-READABLE GOOGLE SHEET SERIALIZER & BACKWARD-COMPATIBLE PARSER
// Stores all structured data (except Evaluation Rules, which remain JSON)
// in clear, clean Key: Value / bullet plain text inside Google Sheets,
// while transparently reading both readable plain text and legacy JSON.
// =========================================================================
function formatReadableScalarForSheet(val) {
  if (val === null || val === undefined) return '-';
  if (typeof val === 'boolean') return val ? 'true' : 'false';
  if (typeof val === 'number') return isFinite(val) ? String(val) : '0';
  var s = String(val).replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  if (s === '') return '';
  if (s.indexOf('\n') !== -1) {
    return s;
  }
  return s;
}

function serializeReadableLines(val, indent) {
  var pad = '';
  for (var p = 0; p < indent; p++) pad += '  ';
  var lines = [];

  if (val === null || val === undefined) {
    lines.push(pad + '-');
    return lines;
  }
  if (typeof val !== 'object') {
    var sc = formatReadableScalarForSheet(val);
    if (sc.indexOf('\n') !== -1) {
      lines.push(pad + '|');
      var parts = sc.split('\n');
      for (var i = 0; i < parts.length; i++) lines.push(pad + '  ' + parts[i]);
    } else {
      lines.push(pad + sc);
    }
    return lines;
  }
  if (Array.isArray(val)) {
    if (val.length === 0) {
      lines.push(pad + '(empty list)');
      return lines;
    }
    for (var a = 0; a < val.length; a++) {
      var item = val[a];
      if (item === null || item === undefined) {
        lines.push(pad + '- -');
      } else if (typeof item !== 'object') {
        var isc = formatReadableScalarForSheet(item);
        if (isc.indexOf('\n') !== -1) {
          lines.push(pad + '- |');
          var iparts = isc.split('\n');
          for (var ip = 0; ip < iparts.length; ip++) lines.push(pad + '    ' + iparts[ip]);
        } else {
          lines.push(pad + '- ' + isc);
        }
      } else if (Array.isArray(item)) {
        lines.push(pad + '-');
        var nestedArr = serializeReadableLines(item, indent + 2);
        for (var na = 0; na < nestedArr.length; na++) lines.push(nestedArr[na]);
      } else {
        var objKeys = Object.keys(item).filter(function(k) { return item[k] !== undefined; });
        if (objKeys.length === 0) {
          lines.push(pad + '- (empty)');
        } else {
          for (var ok = 0; ok < objKeys.length; ok++) {
            var k = objKeys[ok];
            var v = item[k];
            var prefix = (ok === 0) ? (pad + '- ') : (pad + '  ');
            if (v !== null && typeof v === 'object') {
              if (Array.isArray(v) && v.length === 0) {
                lines.push(prefix + k + ': (empty list)');
              } else if (!Array.isArray(v) && Object.keys(v).filter(function(sk) { return v[sk] !== undefined; }).length === 0) {
                lines.push(prefix + k + ': (empty)');
              } else {
                lines.push(prefix + k + ':');
                var subLines = serializeReadableLines(v, indent + 2);
                for (var sl = 0; sl < subLines.length; sl++) lines.push(subLines[sl]);
              }
            } else {
              var vsc = formatReadableScalarForSheet(v);
              if (vsc.indexOf('\n') !== -1) {
                lines.push(prefix + k + ': |');
                var vparts = vsc.split('\n');
                for (var vp = 0; vp < vparts.length; vp++) lines.push(pad + '    ' + vparts[vp]);
              } else {
                lines.push(prefix + k + ': ' + vsc);
              }
            }
          }
        }
      }
    }
    return lines;
  }

  var keys = Object.keys(val).filter(function(k) { return val[k] !== undefined; });
  if (keys.length === 0) {
    lines.push(pad + '(empty)');
    return lines;
  }
  for (var ki = 0; ki < keys.length; ki++) {
    var key = keys[ki];
    var kv = val[key];
    if (kv !== null && typeof kv === 'object') {
      if (Array.isArray(kv) && kv.length === 0) {
        lines.push(pad + key + ': (empty list)');
      } else if (!Array.isArray(kv) && Object.keys(kv).filter(function(sk) { return kv[sk] !== undefined; }).length === 0) {
        lines.push(pad + key + ': (empty)');
      } else {
        lines.push(pad + key + ':');
        var childLines = serializeReadableLines(kv, indent + 1);
        for (var cl = 0; cl < childLines.length; cl++) lines.push(childLines[cl]);
      }
    } else {
      var kvsc = formatReadableScalarForSheet(kv);
      if (kvsc.indexOf('\n') !== -1) {
        lines.push(pad + key + ': |');
        var kvparts = kvsc.split('\n');
        for (var kvp = 0; kvp < kvparts.length; kvp++) lines.push(pad + '  ' + kvparts[kvp]);
      } else {
        lines.push(pad + key + ': ' + kvsc);
      }
    }
  }
  return lines;
}

function formatReadableSheetData(val, maxChars) {
  var limit = maxChars || 48500;
  if (val === null || val === undefined) return '-';
  if (typeof val === 'string') {
    var trimmed = val.trim();
    if (!trimmed || trimmed === '-') return '-';
    if ((trimmed.charAt(0) === '{' && trimmed.charAt(trimmed.length - 1) === '}') ||
        (trimmed.charAt(0) === '[' && trimmed.charAt(trimmed.length - 1) === ']')) {
      try {
        var decoded = JSON.parse(trimmed);
        return safeSheetCellValue(serializeReadableLines(decoded, 0).join('\n'), limit);
      } catch (e) {}
    }
    return safeSheetCellValue(trimmed, limit);
  }
  return safeSheetCellValue(serializeReadableLines(val, 0).join('\n'), limit);
}

function parseReadableScalarValue(raw) {
  var s = String(raw === undefined || raw === null ? '' : raw).trim();
  if (s === '') return '';
  if (s === '(empty)') return {};
  if (s === '(empty list)') return [];
  if (s === 'true') return true;
  if (s === 'false') return false;
  if (s === 'null') return null;
  if (/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/.test(s)) {
    var num = Number(s);
    if (isFinite(num)) return num;
  }
  return s;
}

function parseReadableLinesBlock(lines, startIdx, baseIndent) {
  var idx = startIdx;
  while (idx < lines.length && lines[idx].trim() === '') idx++;
  if (idx >= lines.length) return { value: '', nextIdx: idx };

  var firstLine = lines[idx];
  var firstIndent = firstLine.match(/^ */)[0].length;
  if (firstIndent < baseIndent) return { value: '', nextIdx: idx };
  var firstTrim = firstLine.trim();

  if (firstTrim === '(empty list)') return { value: [], nextIdx: idx + 1 };
  if (firstTrim === '(empty)') return { value: {}, nextIdx: idx + 1 };

  if (firstTrim === '-' || firstTrim.indexOf('- ') === 0) {
    var arr = [];
    while (idx < lines.length) {
      if (lines[idx].trim() === '') { idx++; continue; }
      var curIndent = lines[idx].match(/^ */)[0].length;
      if (curIndent !== firstIndent) break;
      var curTrim = lines[idx].trim();
      if (curTrim !== '-' && curTrim.indexOf('- ') !== 0) break;

      var rest = curTrim === '-' ? '' : curTrim.substring(2);
      idx++;
      if (rest === '') {
        var nested = parseReadableLinesBlock(lines, idx, firstIndent + 1);
        arr.push(nested.value);
        idx = nested.nextIdx;
      } else if (rest === '|') {
        var blockLines = [];
        var minBlockIndent = firstIndent + 2;
        while (idx < lines.length) {
          var bl = lines[idx];
          var blIndent = bl.match(/^ */)[0].length;
          if (bl.trim() !== '' && blIndent < minBlockIndent) break;
          blockLines.push(bl.length >= minBlockIndent ? bl.substring(minBlockIndent) : '');
          idx++;
        }
        arr.push(blockLines.join('\n'));
      } else if (rest === '(empty)') {
        arr.push({});
      } else {
        var colonPos = rest.indexOf(':');
        var looksLikeKeyVal = colonPos > 0 && /^[A-Za-z0-9_.\- /()]+$/.test(rest.substring(0, colonPos)) && (colonPos === rest.length - 1 || rest.charAt(colonPos + 1) === ' ');
        if (looksLikeKeyVal) {
          var objItem = {};
          var k0 = rest.substring(0, colonPos).trim();
          var v0 = rest.substring(colonPos + 1).trim();
          var itemFieldIndent = firstIndent + 2;
          if (v0 === '') {
            var c0 = parseReadableLinesBlock(lines, idx, itemFieldIndent + 1);
            objItem[k0] = c0.value;
            idx = c0.nextIdx;
          } else if (v0 === '|') {
            var m0 = [];
            var m0Indent = itemFieldIndent + 2;
            while (idx < lines.length) {
              var ml = lines[idx];
              var mlInd = ml.match(/^ */)[0].length;
              if (ml.trim() !== '' && mlInd < m0Indent) break;
              m0.push(ml.length >= m0Indent ? ml.substring(m0Indent) : '');
              idx++;
            }
            objItem[k0] = m0.join('\n');
          } else {
            objItem[k0] = parseReadableScalarValue(v0);
          }
          while (idx < lines.length) {
            if (lines[idx].trim() === '') { idx++; continue; }
            var fi = lines[idx].match(/^ */)[0].length;
            if (fi < itemFieldIndent) break;
            if (fi > itemFieldIndent) { idx++; continue; }
            var ft = lines[idx].trim();
            if (ft.indexOf('- ') === 0 || ft === '-') break;
            var cp = ft.indexOf(':');
            if (cp <= 0) { idx++; continue; }
            var fk = ft.substring(0, cp).trim();
            var fv = ft.substring(cp + 1).trim();
            idx++;
            if (fv === '') {
              var fc = parseReadableLinesBlock(lines, idx, itemFieldIndent + 1);
              objItem[fk] = fc.value;
              idx = fc.nextIdx;
            } else if (fv === '|') {
              var fm = [];
              var fmIndent = itemFieldIndent + 2;
              while (idx < lines.length) {
                var fml = lines[idx];
                var fmlInd = fml.match(/^ */)[0].length;
                if (fml.trim() !== '' && fmlInd < fmIndent) break;
                fm.push(fml.length >= fmIndent ? fml.substring(fmIndent) : '');
                idx++;
              }
              objItem[fk] = fm.join('\n');
            } else {
              objItem[fk] = parseReadableScalarValue(fv);
            }
          }
          arr.push(objItem);
        } else {
          arr.push(parseReadableScalarValue(rest));
        }
      }
    }
    return { value: arr, nextIdx: idx };
  }

  var obj = {};
  while (idx < lines.length) {
    if (lines[idx].trim() === '') { idx++; continue; }
    var oIndent = lines[idx].match(/^ */)[0].length;
    if (oIndent < firstIndent) break;
    if (oIndent > firstIndent) { idx++; continue; }
    var oTrim = lines[idx].trim();
    var oColon = oTrim.indexOf(':');
    if (oColon <= 0) { idx++; continue; }
    var oKey = oTrim.substring(0, oColon).trim();
    var oVal = oTrim.substring(oColon + 1).trim();
    idx++;
    if (oVal === '') {
      var child = parseReadableLinesBlock(lines, idx, firstIndent + 1);
      obj[oKey] = child.value;
      idx = child.nextIdx;
    } else if (oVal === '|') {
      var bLines = [];
      var bIndent = firstIndent + 2;
      while (idx < lines.length) {
        var bl2 = lines[idx];
        var bl2Ind = bl2.match(/^ */)[0].length;
        if (bl2.trim() !== '' && bl2Ind < bIndent) break;
        bLines.push(bl2.length >= bIndent ? bl2.substring(bIndent) : '');
        idx++;
      }
      obj[oKey] = bLines.join('\n');
    } else {
      obj[oKey] = parseReadableScalarValue(oVal);
    }
  }
  return { value: obj, nextIdx: idx };
}

function parseReadableSheetData(raw, fallback) {
  if (raw === null || raw === undefined) return fallback;
  if (typeof raw === 'object') return raw;
  var s = String(raw).trim();
  if (!s || s === '-') return fallback;
  if ((s.charAt(0) === '{' && s.charAt(s.length - 1) === '}') ||
      (s.charAt(0) === '[' && s.charAt(s.length - 1) === ']')) {
    try {
      return JSON.parse(s);
    } catch (e) {}
  }
  if (s === '(empty list)') return [];
  if (s === '(empty)') return {};
  try {
    var lines = s.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
    var parsed = parseReadableLinesBlock(lines, 0, 0).value;
    if (Array.isArray(fallback)) {
      if (Array.isArray(parsed)) return parsed;
      return s.split(',').map(function(t) { return t.trim(); }).filter(Boolean);
    }
    if (parsed && typeof parsed === 'object') return parsed;
  } catch (err) {}
  return fallback;
}

// Auto-disables banner in SETTINGS sheet if stopTime has passed
function parseBannerSettings(settingsData) {
  var banner = {
    enabled: false,
    text: '-',
    loggedOutText: '-',
    sameForBoth: false,
    bannerMode: 'different',
    startTime: '-',
    stopTime: '-',
    expired: false
  };
  var hasExplicitSameFlag = false;
  var hasExplicitLogoutText = false;

  for (var s = 0; s < settingsData.length; s++) {
    var key = String(settingsData[s].Key || '').toUpperCase().trim();
    var val = settingsData[s].Value;

    if (key === 'BANNER_ENABLED') {
      banner.enabled = (val === true || String(val).trim().toLowerCase() === 'true' || String(val).trim() === '1');
    } else if (key === 'BANNER_TEXT') {
      banner.text = (val !== undefined && val !== null && String(val).trim() !== '') ? String(val) : '-';
    } else if (key === 'LOGOUT_BANNER_TEXT') {
      hasExplicitLogoutText = true;
      banner.loggedOutText = (val !== undefined && val !== null && String(val).trim() !== '') ? String(val) : '-';
    } else if (key === 'BANNER_SAME_FOR_BOTH') {
      hasExplicitSameFlag = true;
      banner.sameForBoth = (val === true || String(val).trim().toLowerCase() === 'true' || String(val).trim() === '1');
    } else if (key === 'BANNER_MODE') {
      var modeStr = String(val || '').toLowerCase().trim();
      if (modeStr === 'same' || modeStr === 'different') {
        banner.bannerMode = modeStr;
      }
    } else if (key === 'BANNER_START_TIME') {
      banner.startTime = (val !== undefined && val !== null && String(val).trim() !== '') ? String(val) : '-';
    } else if (key === 'BANNER_STOP_TIME') {
      banner.stopTime = (val !== undefined && val !== null && String(val).trim() !== '') ? String(val) : '-';
    }
  }

  if (banner.bannerMode === 'same' && !hasExplicitSameFlag) {
    banner.sameForBoth = true;
  }
  if (banner.sameForBoth) {
    banner.bannerMode = 'same';
    banner.loggedOutText = banner.text;
  } else if (!hasExplicitLogoutText) {
    banner.loggedOutText = '-';
  }

  if (banner.stopTime && banner.stopTime !== '-') {
    var stopDate = new Date(banner.stopTime);
    var now = new Date();
    if (!isNaN(stopDate.getTime()) && now > stopDate) {
      banner.enabled = false;
      banner.expired = true;
      if (DbConnectionManager._hasDirtyWrites) {
        var sheet = DbConnectionManager.getSheet('SETTINGS');
        if (sheet) {
          var sData = sheet.getDataRange().getValues();
          for (var i = 1; i < sData.length; i++) {
            if (String(sData[i][0]).toUpperCase().trim() === 'BANNER_ENABLED' && sData[i][1] !== false) {
              sheet.getRange(i + 1, 2).setValue(false);
              invalidateSheetCache('SETTINGS');
            }
          }
        }
      }
    }
  }

  // Banner is inactive only if BOTH logged-in and logged-out texts are empty/'-'
  var hasLoggedInText = Boolean(banner.text && banner.text !== '-' && String(banner.text).trim() !== '');
  var hasLoggedOutText = Boolean(banner.loggedOutText && banner.loggedOutText !== '-' && String(banner.loggedOutText).trim() !== '');
  if (!hasLoggedInText && !hasLoggedOutText) {
    banner.enabled = false;
  }

  return banner;
}

// Parses Site & Tab-Specific Maintenance Settings from SETTINGS sheet
function parseMaintenanceSettings(settingsData) {
  var maintenance = {
    enabled: false,
    mode: 'full_site', // 'full_site' | 'only_selected_tabs_work' | 'selected_tabs_under_maintenance'
    message: '🚧 Our portal is currently undergoing scheduled maintenance and upgrades. Please check back shortly!',
    workingTabs: ['dashboard'],
    maintenanceTabs: []
  };
  if (!Array.isArray(settingsData)) return maintenance;
  for (var s = 0; s < settingsData.length; s++) {
    var key = String(settingsData[s].Key || '').toUpperCase().trim();
    var val = settingsData[s].Value;
    if (key === 'MAINTENANCE_ENABLED') {
      maintenance.enabled = (val === true || String(val).trim().toLowerCase() === 'true' || String(val).trim() === '1');
    } else if (key === 'MAINTENANCE_MODE' && val && val !== '-') {
      maintenance.mode = String(val).trim();
    } else if (key === 'MAINTENANCE_MESSAGE' && val && val !== '-') {
      maintenance.message = String(val);
    } else if (key === 'MAINTENANCE_WORKING_TABS' && val && val !== '-') {
      maintenance.workingTabs = parseReadableSheetData(val, ['dashboard']);
    } else if (key === 'MAINTENANCE_BLOCKED_TABS' && val && val !== '-') {
      maintenance.maintenanceTabs = parseReadableSheetData(val, []);
    }
  }
  return maintenance;
}

function parseDashboardCustomBannerSettings(settingsData) {
  var dashBanner = null;
  if (!Array.isArray(settingsData)) return null;
  for (var s = 0; s < settingsData.length; s++) {
    var key = String(settingsData[s].Key || '').toUpperCase().trim();
    var val = settingsData[s].Value;
    if (key === 'DASHBOARD_CUSTOM_BANNER_JSON' && val && val !== '-') {
      dashBanner = parseReadableSheetData(val, null);
    }
  }
  if (dashBanner && typeof dashBanner === 'object') {
    var normalizedSlides = [];
    if (Array.isArray(dashBanner.slides) && dashBanner.slides.length > 0) {
      for (var i = 0; i < dashBanner.slides.length; i++) {
        var sl = dashBanner.slides[i] || {};
        var sImg = String(sl.imageUrl || '').trim();
        var sTitle = String(sl.title || '').trim();
        var sText = String(sl.text || '').trim();
        if (sImg || sTitle || sText) {
          normalizedSlides.push({
            imageUrl: sImg,
            title: sTitle,
            text: sText,
            ctaText: String(sl.ctaText || '').trim(),
            ctaLink: String(sl.ctaLink || '').trim()
          });
        }
      }
    } else if (dashBanner.imageUrl || dashBanner.title || dashBanner.text) {
      normalizedSlides.push({
        imageUrl: String(dashBanner.imageUrl || '').trim(),
        title: String(dashBanner.title || '').trim(),
        text: String(dashBanner.text || '').trim(),
        ctaText: String(dashBanner.ctaText || '').trim(),
        ctaLink: String(dashBanner.ctaLink || '').trim()
      });
    }
    dashBanner.slides = normalizedSlides;
    var sec = parseInt(dashBanner.autoScrollSeconds || 4, 10);
    dashBanner.autoScrollSeconds = isNaN(sec) ? 4 : Math.max(2, Math.min(30, sec));
  }
  return dashBanner;
}

// Helper to send formatted transactional emails for Sign Up, Forget Password, and Profile Update
function sendPortalEmailNotification(toEmail, subject, plainBody, htmlBody) {
  var cleanEmail = String(toEmail || '').toLowerCase().trim();
  if (!cleanEmail || cleanEmail.indexOf('@') === -1) return false;
  try {
    MailApp.sendEmail({
      to: cleanEmail,
      subject: subject,
      body: plainBody,
      htmlBody: htmlBody || plainBody.replace(/\n/g, '<br>')
    });
    return true;
  } catch (err) {
    try {
      MailApp.sendEmail(cleanEmail, subject, plainBody);
      return true;
    } catch (e2) {
      return false;
    }
  }
}

function handleSignup(payload) {
  var email = String(payload.email || '').toLowerCase().trim();
  var mobile = String(payload.mobile || '').replace(/\D/g, '').slice(-10);
  var name = sanitizeInput(String(payload.name || '').trim());
  var password = String(payload.password || '').trim();

  if (!email || !mobile || !name || name === '-' || !password) {
    return { success: false, message: 'All compulsory (*) fields must be completed.' };
  }

  if (!isValidMobile(mobile)) {
    return { success: false, message: 'Invalid mobile number. Must be exactly 10 digits.' };
  }

  if (!isValidPassword(password)) {
    return { success: false, message: 'Password must be at least 4 characters long.' };
  }

  var users = getSheetData('USERS');
  for (var i = 0; i < users.length; i++) {
    if (String(users[i].Email || '').toLowerCase().trim() === email) {
      return { success: false, message: 'Email address already registered in system.' };
    }
    var existingMob = String(users[i].Mobile || '').replace(/\D/g, '').slice(-10);
    if (existingMob && existingMob === mobile) {
      return { success: false, message: 'Mobile number already registered in system.' };
    }
  }

  var userId = 'USR-' + (users.length + 1) + '-' + Math.floor(1000 + Math.random() * 9000);
  var isSuperAdmin = (users.length === 0 || isPrimarySuperadminEmail(email));
  var role = isSuperAdmin ? 'superadmin' : 'user'; 
  var status = 'active';
  var createdDate = new Date().toISOString();
  var defaultPerms = isSuperAdmin ? 'ALL' : '-';
  var passwordHash = hashPasswordWithSalt(password);
  var waWebhookEnabled = isWhatsAppWebhookConfigured();

  // Requirement #6: Until the user verifies the OTP, do NOT append or update anything in the Google Sheet.
  // Stage the pending signup record in CacheService with salted password hash until handleVerifyMfaOtp verifies the 6-digit OTP.
  var signupOtpCode = String(Math.floor(100000 + Math.random() * 900000));
  var signupWaOtpCode = waWebhookEnabled ? String(Math.floor(100000 + Math.random() * 900000)) : '';
  var pendingRecord = {
    userId: userId,
    name: name,
    email: email,
    mobile: mobile,
    passwordHash: passwordHash,
    plainPassword: password,
    role: role,
    status: status,
    createdDate: createdDate,
    defaultPerms: defaultPerms,
    batch: 'RP-Trail',
    otpCode: signupOtpCode,
    waOtpCode: signupWaOtpCode
  };

  var cache = DbConnectionManager.getCache();
  if (cache) {
    var pendingJson = JSON.stringify(pendingRecord);
    cache.put('PENDING_SIGNUP_' + userId, pendingJson, 600);
    cache.put('PENDING_SIGNUP_EMAIL_' + email, pendingJson, 600);
    cache.put('MFA_OTP_' + userId, signupOtpCode, 600);
    if (signupWaOtpCode) {
      cache.put('WA_OTP_' + userId, signupWaOtpCode, 600);
    }
  }
  var strictWaRequired = isStrictWhatsAppOtpRequiredOnSignup();
  if (strictWaRequired && !waWebhookEnabled) {
    return {
      success: false,
      whatsappGatewayConfigured: false,
      whatsappOtpRequired: true,
      message: 'WhatsApp OTP verification is mandatory for Sign-Up, but the WhatsApp Gateway Webhook URL is not configured on the server yet. Please ask Admin to configure the WhatsApp Gateway in Admin → Enterprise Ops.'
    };
  }
  var waSignupInfo = waWebhookEnabled
    ? sendFreeWhatsAppOtpMessage(mobile, name, signupWaOtpCode, 'New Account Mobile Verification')
    : { webhookDispatched: false };
  if (waWebhookEnabled && !waSignupInfo.webhookDispatched && strictWaRequired) {
    return {
      success: false,
      whatsappGatewayConfigured: true,
      whatsappOtpRequired: true,
      whatsappDispatched: false,
      message: 'WhatsApp OTP could not be delivered by the configured gateway webhook. Please verify the WhatsApp Gateway URL or retry in a moment.'
    };
  }

  var emailSent = sendPortalEmailNotification(
    email,
    'Compulsory 2FA Verification OTP & Welcome - RP Skill | Ranjan Pathshala',
    'Hello ' + name + ',\n\n' +
    'Thank you for registering at RP Skill | Ranjan Pathshala! Please verify your email using the 6-digit OTP below to complete account creation.\n\n' +
    '--- COMPULSORY SIGN-UP 2FA VERIFICATION CODE ---\n' +
    '6-Digit Verification OTP: ' + signupOtpCode + ' (Valid for 10 minutes)\n\n' +
    '--- YOUR STAGED ACCOUNT DETAILS ---\n' +
    'User ID: ' + userId + '\n' +
    'Full Name: ' + name + '\n' +
    'Registered Email ID: ' + email + '\n' +
    'Registered Mobile No: ' + mobile + '\n' +
    'Password: (Protected & Encrypted — never sent via email)\n' +
    'Role: ' + role.toUpperCase() + '\n\n' +
    'Note: Your account will only be activated and saved after you verify the 6-digit OTP on the portal verification screen.\n\n' +
    'Best Regards,\nRP Skill | Ranjan Pathshala Team',
    '<div style="font-family:Segoe UI,Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;border:1px solid #e2e8f0;border-radius:12px;background:#ffffff;color:#0f172a;">' +
      '<h2 style="margin:0 0 12px 0;color:#4f46e5;">Verify Your Email — RP Skill | Ranjan Pathshala</h2>' +
      '<p style="font-size:14px;line-height:1.6;">Hello <strong>' + name + '</strong>, please enter the compulsory <strong>6-digit 2FA Verification OTP</strong> below on the portal screen to verify your email address and complete your registration:</p>' +
      '<div style="background:#eef2ff;border:2px dashed #4f46e5;border-radius:10px;padding:16px;text-align:center;margin:16px 0;">' +
        '<div style="font-size:11px;font-weight:800;color:#4f46e5;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">Compulsory Sign-Up 2FA OTP</div>' +
        '<span style="font-size:28px;font-weight:900;letter-spacing:6px;color:#312e81;">' + signupOtpCode + '</span>' +
      '</div>' +
      '<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:14px;margin:16px 0;font-size:13.5px;line-height:1.7;">' +
        '<div><strong>User ID:</strong> ' + userId + '</div>' +
        '<div><strong>Full Name:</strong> ' + name + '</div>' +
        '<div><strong>Email ID:</strong> ' + email + '</div>' +
        '<div><strong>Mobile Number:</strong> ' + mobile + '</div>' +
        '<div><strong>Password Security:</strong> Salted SHA-256 Encrypted</div>' +
      '</div>' +
      '<p style="font-size:12px;color:#64748b;margin-top:20px;">Best Regards,<br><strong>RP Skill | Ranjan Pathshala</strong></p>' +
    '</div>'
  );

  return {
    success: true,
    mfaRequired: true,
    pendingOtpVerification: true,
    verificationRequired: true,
    verificationReason: 'SIGNUP_COMPULSORY_2FA',
    userId: userId,
    email: email,
    mobile: mobile,
    name: name,
    emailVerified: false,
    mobileVerified: false,
    whatsappGatewayConfigured: waWebhookEnabled,
    whatsappOtpRequired: Boolean(waWebhookEnabled && waSignupInfo.webhookDispatched),
    whatsappDispatched: Boolean(waSignupInfo.webhookDispatched),
    emailSent: emailSent,
    message: !emailSent
      ? ('Account staged for ' + email + ', but the server could not send the OTP email (check Google Apps Script MailApp quota/authorization). Please try Resend OTP.')
      : ((waWebhookEnabled && waSignupInfo.webhookDispatched)
          ? ('6-digit Email OTP sent to ' + email + ' & WhatsApp OTP sent to +91-' + mobile + '. Enter both codes to activate your account.')
          : ('6-digit Email OTP sent to ' + email + '. (WhatsApp OTP Gateway is not configured on the server yet, so your mobile number will remain Pending Verification until Admin connects a WhatsApp gateway.)')),
    newUser: { userId: userId, name: name, email: email, mobile: mobile, role: role, createdDate: createdDate, preferences: { emailVerified: false, mobileVerified: false, mfaEnabled: true } }
  };
}

// Explicit Session Revocation & Cache Purge on Logout to prevent orphaned session tokens & stale cache
function handleLogout(payload) {
  var userId = String(payload.userId || '').trim();
  var cache = DbConnectionManager.getCache();
  if (cache) {
    try {
      if (userId) {
        cache.remove('ACTIVE_SESS_' + userId);
        cache.remove('MFA_OTP_' + userId);
        cache.remove('PROFILE_OTP_' + userId);
        cache.remove('FORGET_OTP_' + userId);
      }

    } catch (e) {}
  }
  if (!userId) return { success: true, cacheCleared: true, message: 'Logged out and cache cleared.' };
  var users = getSheetData('USERS');
  var userSheet = getOrCreateSheet('USERS');
  var sessColIdx = 8;
  if (userSheet) {
    var logoutHeaders = ensureSheetHeadersCached(userSheet, 'USERS');
    var foundSessIdx = logoutHeaders.indexOf('SessionToken');
    if (foundSessIdx !== -1) sessColIdx = foundSessIdx + 1;
  }
  for (var i = 0; i < users.length; i++) {
    if (String(users[i].UserID) === userId) {
      if (userSheet) {
        userSheet.getRange(i + 2, sessColIdx).setValue('-');
        invalidateSheetCache('USERS');
      }
      break;
    }
  }
  return { success: true, cacheCleared: true, message: 'Session terminated, server cache cleared, and database handle released cleanly.' };
}

// Per-Minute Login Restriction using CacheService
function handleLogin(payload, isInternalTrustedCall) {
  var identifier = String(payload.identifier || '').toLowerCase().trim();
  var password = String(payload.password || '').trim();
  var isSilentVerify = payload.silentVerify === true;
  var trustedInternal = (isInternalTrustedCall === true);

  if (!identifier || (!trustedInternal && !password)) {
    return { success: false, message: 'Email/Mobile and Password are required (*).' };
  }

  var cache = DbConnectionManager.getCache();
  var rateKey = 'LOGIN_RATE_' + identifier.replace(/[^a-z0-9]/g, '_');

  if (!isSilentVerify && !trustedInternal && cache) {
    var attemptsStr = cache.get(rateKey);
    var attempts = attemptsStr ? parseInt(attemptsStr, 10) : 0;
    if (attempts >= 8) {
      handleLogActivity({
        userId: 'RESTRICTED',
        userName: identifier,
        activityType: 'SECURITY_VIOLATION',
        details: 'Login rate limit exceeded (max 8 attempts/min).'
      });
      return {
        success: false,
        rateLimited: true,
        message: 'Login restricted: Too many attempts per minute. Please wait 60 seconds before trying again.'
      };
    }
    cache.put(rateKey, String(attempts + 1), 60);
  }

  var users = getSheetData('USERS');
  var userSheet = getOrCreateSheet('USERS');
  var matchedUserForAlert = null;
  
  var normalizedIdentifierMobile = identifier.replace(/\D/g, '').slice(-10);
  for (var i = 0; i < users.length; i++) {
    var user = users[i];
    var userEmail = String(user.Email || '').toLowerCase().trim();
    var userMobile = String(user.Mobile || '').trim();
    var userMobileNorm = userMobile.replace(/\D/g, '').slice(-10);
    var isIdentifierMatch = (userEmail === identifier) || (userMobile === identifier) || (normalizedIdentifierMobile.length === 10 && userMobileNorm === normalizedIdentifierMobile);

    if (isIdentifierMatch) {
      matchedUserForAlert = user;
    }

    if (isIdentifierMatch && (trustedInternal || verifyUserPassword(password, user.Password))) {
      var userStatusClean = String(user.Status || 'active').toLowerCase().trim();
      if (userStatusClean === 'blocked') {
        return { success: false, blocked: true, sessionInvalid: true, message: '🚫 Your account is blocked by Admin. Contact Official Support.' };
      }
      if (userStatusClean === 'locked') {
        return { success: false, lockedAcrossDevices: true, sessionInvalid: true, message: '🔒 Your account is locked across all devices by the Administrator. Contact Official Support.' };
      }

      var userPrefs = readUserSettingsFromRow(user, true);

      if (userPrefs && userPrefs.allDevicesLocked === true) {
        return {
          success: false,
          lockedAcrossDevices: true,
          sessionInvalid: true,
          message: '🔒 Security Lock Active: Your account has been locked across all devices. Please contact Official Admin / Superadmin Support to unlock.'
        };
      }

      var incomingDeviceId = String(payload.deviceId || '').trim();
      if (userPrefs && userPrefs.deviceBindingStrict === true && userPrefs.boundDeviceId && incomingDeviceId && String(userPrefs.boundDeviceId) !== incomingDeviceId) {
        return {
          success: false,
          deviceLocked: true,
          sessionInvalid: true,
          message: '🔒 Cross-Device Hardware Lock Active: This account is locked to registered device [' + userPrefs.boundDeviceId + ']. Login on another device is restricted.'
        };
      }

      if (cache && !isSilentVerify) {
        cache.remove(rateKey);
      }

      var rowIndex = i + 2;
      // Transparently upgrade legacy plaintext password to salted SHA-256 hash on login
      if (!trustedInternal && password && !isHashedPassword(user.Password)) {
        try {
          var passHeaders = userSheet.getRange(1, 1, 1, Math.max(10, userSheet.getLastColumn())).getValues()[0];
          var pColIdx = passHeaders.indexOf('Password') + 1 || 5;
          userSheet.getRange(rowIndex, pColIdx).setValue(hashPasswordWithSalt(password));
        } catch (hashMigErr) {}
      }

      var prevToken = String(user.SessionToken || '-');
      var sessionToken = 'SESS-' + Math.random().toString(36).substring(2, 15) + '-' + Date.now();
      var loginHeaders = ensureSheetHeadersCached(userSheet, 'USERS');
      var loginSessCol = loginHeaders.indexOf('SessionToken') + 1 || 8;
      userSheet.getRange(rowIndex, loginSessCol).setValue(sessionToken);
      try { SpreadsheetApp.flush(); } catch (flushLoginErr) {}
      invalidateSheetCache('USERS');
      if (cache) {
        cache.put('ACTIVE_SESS_' + user.UserID, sessionToken, 21600);
        if (incomingDeviceId) {
          cache.put('ACTIVE_DEV_' + user.UserID, incomingDeviceId, 21600);
        }
      }

      var roleVal = String(user.Role || 'user').toLowerCase().trim();
      if (isPrimarySuperadminEmail(userEmail) && roleVal !== 'superadmin') {
        roleVal = 'superadmin';
        userSheet.getRange(rowIndex, 6).setValue('superadmin');
        invalidateSheetCache('USERS');
      }
      var adminPerms = (user.AdminPermissions && user.AdminPermissions !== '-')
        ? String(user.AdminPermissions)
        : (roleVal === 'superadmin' ? 'ALL' : 'content,analytics,batch-discussion,livetests,users,attendance-matrix,outline-replies,logs,subtabs,evaluation,banner,leaderboard,feedback-admin,enterprise-ops');

      userPrefs.activeDeviceId = incomingDeviceId || userPrefs.activeDeviceId || 'WEB-PRIMARY';
      userPrefs.activeSessionToken = sessionToken;
      userPrefs.lastLoginAt = new Date().toISOString();
      delete userPrefs.adminVisiblePassword;
      if (!userPrefs.boundDeviceId && incomingDeviceId) {
        userPrefs.boundDeviceId = incomingDeviceId;
      }

      // Enforce automatic switch to RP-Trail (Free Batch) if batch enrollment validity has expired
      var validityCheck = enforceBatchValidityAutoFreeTierForRow(user, rowIndex, userSheet, userPrefs);
      var effectiveBatch = normalizeUserBatchesWithFreeTier(validityCheck.batch || user.Batch || 'RP-Trail');

      var waWebhookEnabled = isWhatsAppWebhookConfigured();
      var requiresBulkMobileVer = Boolean(userPrefs && (userPrefs.requiresContactVerification === true || userPrefs.onboardedViaCsv === true) && userPrefs.mobileVerified !== true);
      var isEmailVerified = Boolean((userPrefs && userPrefs.emailVerified === true) || roleVal === 'superadmin');
      var isMobileVerified = Boolean((userPrefs && userPrefs.mobileVerified === true) || roleVal === 'superadmin' || (!waWebhookEnabled && !requiresBulkMobileVer));
      var otpMailSent = false;
      var loginCache = DbConnectionManager.getCache();
      if (loginCache) {
        loginCache.remove('BLOCKED_USER_' + user.UserID);
        loginCache.remove('LOCKED_USER_' + user.UserID);
      }
      try {
        syncUserReadableColumns(userSheet, rowIndex, user, userPrefs);
        invalidateSheetCache('USERS');
      } catch (prefSaveErr) {}
      if (!isSilentVerify) {
        incrementFastTotalVisitsCount();
      }

      if ((!isEmailVerified || !isMobileVerified) && !isSilentVerify && !payload.mfaVerified) {
        if (!isEmailVerified) {
          var loginVerifyOtp = String(Math.floor(100000 + Math.random() * 900000));
          if (loginCache) {
            loginCache.put('MFA_OTP_' + user.UserID, loginVerifyOtp, 600);
          }
          otpMailSent = sendPortalEmailNotification(
            user.Email,
            'Verify Your Email ID (Login OTP) - RP Skill | Ranjan Pathshala',
            'Hello ' + user.Name + ',\n\nYour email ID (' + user.Email + ') is not yet verified on RP Skill | Ranjan Pathshala.\n\nUse this 6-digit verification OTP to verify your Email ID during Login:\n\nOTP: ' + loginVerifyOtp + '\n\nValid for 10 minutes.\n\nRP Skill Security Cell',
            '<div style="font-family:Segoe UI,Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px;border:1px solid #e2e8f0;border-top:4px solid #f59e0b;border-radius:12px;background:#ffffff;color:#0f172a;">' +
              '<h2 style="margin:0 0 10px 0;color:#d97706;font-size:18px;">Verify Your Email ID — Login Verification Code</h2>' +
              '<p style="font-size:14px;color:#334155;line-height:1.5;">Hello <strong>' + user.Name + '</strong>, we noticed your Email ID (<strong>' + user.Email + '</strong>) is not verified yet. Enter this 6-digit OTP on the Login verification prompt to verify your Email ID immediately:</p>' +
              '<div style="background:#fffbeb;border:1px dashed #f59e0b;border-radius:10px;padding:16px;text-align:center;margin:16px 0;">' +
                '<span style="font-size:26px;font-weight:800;letter-spacing:6px;color:#b45309;">' + loginVerifyOtp + '</span>' +
              '</div>' +
              '<p style="font-size:12px;color:#64748b;">Valid for 10 minutes. Once verified, you will have full unrestricted access to all exams and study materials.</p>' +
            '</div>'
          );
        }
        if (!isMobileVerified && waWebhookEnabled && user.Mobile && String(user.Mobile).replace(/\D/g, '').length >= 10) {
          var loginWaVerifyOtp = String(Math.floor(100000 + Math.random() * 900000));
          if (loginCache) {
            loginCache.put('WA_OTP_' + user.UserID, loginWaVerifyOtp, 600);
          }
          sendFreeWhatsAppOtpMessage(user.Mobile, user.Name, loginWaVerifyOtp, 'Existing User Mobile Verification');
        }
      }

      if (!isSilentVerify) {
        var deviceInfo = payload.deviceId ? (' [Device: ' + payload.deviceId + ']') : '';
        if (prevToken && prevToken !== '-' && prevToken !== payload.previousToken) {
          handleLogActivity({
            userId: user.UserID,
            userName: user.Name + ' (' + roleVal.toUpperCase() + ')',
            activityType: 'SINGLE_DEVICE_ENFORCED',
            details: 'New login displaced previous active session.' + deviceInfo
          });
        }
        handleLogActivity({
          userId: user.UserID,
          userName: user.Name + ' (' + roleVal.toUpperCase() + ')',
          activityType: 'LOGIN',
          details: 'User logged in successfully (Single-Device Session Active | Email Verified: ' + (isEmailVerified ? 'YES' : 'NO') + ' | Batch: ' + effectiveBatch + ').' + deviceInfo
        });
      }

      userPrefs.emailVerified = isEmailVerified;
      userPrefs.mobileVerified = isMobileVerified;
      return {
        success: true,
        userId: user.UserID,
        name: user.Name,
        email: user.Email,
        mobile: (user.Mobile && user.Mobile !== '-') ? user.Mobile : '',
        role: roleVal,
        batch: effectiveBatch,
        enrollmentValidUntil: userPrefs.enrollmentValidUntil || '',
        autoSwitchedToFreeTier: Boolean(userPrefs.autoSwitchedToFreeTier),
        previousBatch: userPrefs.previousBatch || '',
        onboardedViaCsv: Boolean(userPrefs.onboardedViaCsv),
        permissions: adminPerms,
        userPreferences: (function(p) {
          var cp = {};
          for (var pk in p) { if (p.hasOwnProperty(pk) && pk !== 'adminVisiblePassword') cp[pk] = p[pk]; }
          return cp;
        })(userPrefs),
        sessionToken: sessionToken,
        emailVerified: isEmailVerified,
        mobileVerified: isMobileVerified,
        whatsappOtpRequired: (waWebhookEnabled || requiresBulkMobileVer) && !isMobileVerified,
        verificationRequired: (!isEmailVerified || !isMobileVerified),
        emailVerificationRequired: !isEmailVerified,
        mobileVerificationRequired: !isMobileVerified,
        otpSent: otpMailSent,
        message: validityCheck.switched
          ? 'Your batch validity expired, so your account was automatically switched to RP-Trail (Free Batch).'
          : ((isEmailVerified && isMobileVerified)
              ? 'Login successful!'
              : ('A 6-digit verification OTP has been dispatched to ' + user.Email + '. Please verify your Email & Mobile Number to continue.')),
        user: {
          userId: user.UserID,
          name: user.Name,
          email: user.Email,
          mobile: (user.Mobile && user.Mobile !== '-') ? user.Mobile : '',
          role: roleVal,
          batch: effectiveBatch,
          parentName: String(userPrefs.parentName || '').trim() || String(user.Name || ''),
          parentMobile: String(userPrefs.parentMobile || '').trim() || ((user.Mobile && user.Mobile !== '-') ? String(user.Mobile) : ''),
          parentEmail: String(userPrefs.parentEmail || '').trim() || String(user.Email || ''),
          parentIsFallback: !(String(userPrefs.parentName || '').trim() || String(userPrefs.parentMobile || '').trim() || String(userPrefs.parentEmail || '').trim()),
          enrollmentValidUntil: userPrefs.enrollmentValidUntil || '',
          autoSwitchedToFreeTier: Boolean(userPrefs.autoSwitchedToFreeTier),
          previousBatch: userPrefs.previousBatch || '',
          onboardedViaCsv: Boolean(userPrefs.onboardedViaCsv),
          emailVerified: isEmailVerified,
          mobileVerified: isMobileVerified,
          token: sessionToken,
          sessionToken: sessionToken,
          adminPermissions: adminPerms,
          preferences: (function(p) {
            var cp = {};
            for (var pk in p) { if (p.hasOwnProperty(pk) && pk !== 'adminVisiblePassword') cp[pk] = p[pk]; }
            return cp;
          })(userPrefs)
        }
      };
    }
  }

  // Requirement #14: If login attempt fails, send a security alert email to the registered email ID
  var targetAlertEmail = matchedUserForAlert ? String(matchedUserForAlert.Email || '').toLowerCase().trim() : (identifier.indexOf('@') !== -1 ? identifier : '');
  var targetUserName = matchedUserForAlert ? String(matchedUserForAlert.Name || 'Candidate') : 'Candidate';
  var failTimestamp = Utilities.formatDate(new Date(), DbConnectionManager.getTimeZone(), 'dd MMM yyyy, hh:mm:ss a');
  var failDevice = payload.deviceId ? String(payload.deviceId) : 'Web Browser Session';
  var alertEmailSent = false;

  if (targetAlertEmail && targetAlertEmail.indexOf('@') !== -1 && !isSilentVerify) {
    alertEmailSent = sendPortalEmailNotification(
      targetAlertEmail,
      'Security Alert: Failed Login Attempt on RP Skill | Ranjan Pathshala',
      'Dear ' + targetUserName + ',\n\n' +
      'We detected an unsuccessful login attempt on your RP Skill | Ranjan Pathshala account.\n\n' +
      '--- SECURITY EVENT DETAILS ---\n' +
      'Account Identifier: ' + identifier + '\n' +
      'Date & Time: ' + failTimestamp + '\n' +
      'Device / Session ID: ' + failDevice + '\n' +
      'Status: Failed Authentication (Invalid Password / Credentials)\n\n' +
      'If this was you, you may recover your password anytime using the "Forgot Password" option on the login screen.\n' +
      'If you did not initiate this attempt, please update your password immediately.\n\n' +
      'Best Regards,\nSecurity Cell\nRP Skill | Ranjan Pathshala',
      '<div style="font-family:Segoe UI,Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;border:1px solid #fecaca;border-top:4px solid #dc2626;border-radius:12px;background:#ffffff;color:#0f172a;">' +
        '<h2 style="margin:0 0 10px 0;color:#dc2626;font-size:18px;">⚠️ Security Alert: Failed Login Attempt Detected</h2>' +
        '<p style="font-size:13.5px;line-height:1.6;color:#334155;">Dear <strong>' + targetUserName + '</strong>, an unsuccessful sign-in attempt was recorded for your <strong>RP Skill | Ranjan Pathshala</strong> account.</p>' +
        '<div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:14px;margin:14px 0;font-size:13px;line-height:1.7;color:#7f1d1d;">' +
          '<div><strong>Login Identifier:</strong> ' + identifier + '</div>' +
          '<div><strong>Attempt Timestamp:</strong> ' + failTimestamp + '</div>' +
          '<div><strong>Device / Session:</strong> ' + failDevice + '</div>' +
          '<div><strong>Action Taken:</strong> Access Denied &amp; Security Alert Dispatched</div>' +
        '</div>' +
        '<p style="font-size:12.5px;color:#475569;line-height:1.5;">If you forgot your password, please use the <strong>Forgot Password</strong> option on the portal login screen to receive your credentials via email.</p>' +
        '<p style="font-size:12px;color:#64748b;margin-top:18px;">Best Regards,<br><strong>Security &amp; Examination Cell — RP Skill | Ranjan Pathshala</strong></p>' +
      '</div>'
    );
  }

  if (!isSilentVerify) {
    handleLogActivity({
      userId: matchedUserForAlert ? matchedUserForAlert.UserID : 'UNAUTH',
      userName: matchedUserForAlert ? (matchedUserForAlert.Name + ' (' + identifier + ')') : identifier,
      activityType: 'SECURITY_VIOLATION',
      details: 'Failed login attempt for identifier: ' + identifier + ' | Security Alert Email Sent: ' + (alertEmailSent ? ('YES (' + targetAlertEmail + ')') : 'NO')
    });
  }

  return {
    success: false,
    emailAlertSent: alertEmailSent,
    alertEmail: targetAlertEmail || null,
    message: alertEmailSent
      ? ('Invalid login credentials. A security alert email has been sent to ' + targetAlertEmail + '.')
      : 'Invalid credentials. Please verify your registered Email/Mobile and Password.'
  };
}

function handleVerifySessionToken(payload) {
  var userId = String(payload.userId || '').trim();
  var token = String(payload.sessionToken || payload.token || '').trim();
  var deviceId = String(payload.deviceId || '').trim();
  if (!userId) {
    return { success: true, valid: true };
  }
  var cache = DbConnectionManager.getCache();
  if (cache && cache.get('BLOCKED_USER_' + userId) === 'true') {
    return {
      success: true,
      valid: false,
      sessionInvalid: true,
      blocked: true,
      reason: 'ACCOUNT_BLOCKED',
      message: '🚫 Your account has been blocked by the Administrator. You have been logged out across all devices immediately.'
    };
  }
  if (cache && cache.get('LOCKED_USER_' + userId) === 'true') {
    return {
      success: true,
      valid: false,
      sessionInvalid: true,
      lockedAcrossDevices: true,
      reason: 'ACCOUNT_LOCKED_ALL_DEVICES',
      message: '🔒 Security Lock: Your account has been locked across all devices by the Administrator.'
    };
  }
  var users = getSheetData('USERS');
  for (var i = 0; i < users.length; i++) {
    if (String(users[i].UserID) === userId) {
      var statusVal = String(users[i].Status || 'active').toLowerCase().trim();
      var uPrefs = readUserSettingsFromRow(users[i], false);
      if (statusVal === 'blocked') {
        if (cache) {
          cache.put('BLOCKED_USER_' + userId, 'true', 21600);
          cache.remove('ACTIVE_SESS_' + userId);
        }
        return {
          success: true,
          valid: false,
          sessionInvalid: true,
          blocked: true,
          reason: 'ACCOUNT_BLOCKED',
          message: '🚫 Your account has been blocked by the Administrator. You have been logged out across all devices immediately.'
        };
      }
      if (statusVal === 'locked' || (uPrefs && uPrefs.allDevicesLocked === true)) {
        if (cache) {
          cache.put('LOCKED_USER_' + userId, 'true', 21600);
          cache.remove('ACTIVE_SESS_' + userId);
        }
        return {
          success: true,
          valid: false,
          sessionInvalid: true,
          lockedAcrossDevices: true,
          reason: 'ACCOUNT_LOCKED_ALL_DEVICES',
          message: '🔒 Security Lock: Your account has been locked across all devices by the Administrator.'
        };
      }
      var cachedToken = cache ? cache.get('ACTIVE_SESS_' + userId) : null;
      var dbToken = String(users[i].SessionToken || '-').trim();
      if (dbToken.indexOf('LOCKED-') === 0 || dbToken.indexOf('BLOCKED-') === 0) {
        return {
          success: true,
          valid: false,
          sessionInvalid: true,
          lockedAcrossDevices: true,
          reason: 'SESSION_REVOKED_LOCK',
          message: '🔒 Your active session was locked across all devices. Please re-authenticate.'
        };
      }
      var validCached = cachedToken ? String(cachedToken).trim() : '';
      var validDb = (dbToken && dbToken !== '-') ? dbToken : '';
      var authoritativeToken = validCached || validDb;
      if (payload.strictAuth === true && (!token || !authoritativeToken)) {
        return {
          success: false,
          valid: false,
          sessionInvalid: true,
          reason: 'SESSION_EXPIRED',
          message: 'Your session has expired or been logged out. Please sign in again.'
        };
      }
      var tokenMatchesActive = Boolean(token && ((validCached && validCached === token) || (validDb && validDb === token)));
      if (token && authoritativeToken && !tokenMatchesActive) {
        return {
          success: true,
          valid: false,
          sessionInvalid: true,
          differentDevice: true,
          reason: 'DIFFERENT_DEVICE_LOGIN',
          message: '⚠️ Cross-Device Lock Enforced: Your account was signed in on another device. Only 1 active device is permitted at a time.'
        };
      }
      var cachedDev = (cache ? cache.get('ACTIVE_DEV_' + userId) : null) || (uPrefs && uPrefs.activeDeviceId ? String(uPrefs.activeDeviceId) : '');
      if (deviceId && cachedDev && cachedDev !== 'WEB-PRIMARY' && cachedDev !== deviceId) {
        return {
          success: true,
          valid: false,
          sessionInvalid: true,
          differentDevice: true,
          reason: 'DIFFERENT_DEVICE_ID',
          message: '⚠️ Cross-Device Lock Enforced: Your account is currently active on another device (' + cachedDev + ').'
        };
      }
      var verifiedUserRole = isPrimarySuperadminEmail(users[i].Email)
        ? 'superadmin'
        : String(users[i].Role || 'user').toLowerCase().trim();
      var sessUserSheet = getOrCreateSheet('USERS');
      var sessValidityRes = enforceBatchValidityAutoFreeTierForRow(users[i], i + 2, sessUserSheet, uPrefs);
      return {
        success: true,
        valid: true,
        status: statusVal,
        userRole: verifiedUserRole,
        batch: (function(b) {
          var s = String(b || '').trim();
          return (!s || s === '-' || s.toLowerCase() === 'general batch' || s.toLowerCase() === 'free tier') ? 'RP-Trail' : s;
        })(sessValidityRes.batch || users[i].Batch),
        enrollmentValidUntil: uPrefs.enrollmentValidUntil || '',
        autoSwitchedToFreeTier: Boolean(uPrefs.autoSwitchedToFreeTier),
        previousBatch: uPrefs.previousBatch || '',
        activeDeviceId: cachedDev || deviceId || 'WEB',
        allDevicesLocked: Boolean(uPrefs && uPrefs.allDevicesLocked),
        deviceBindingStrict: Boolean(uPrefs && uPrefs.deviceBindingStrict)
      };
    }
  }
  if (payload.strictAuth === true) {
    return {
      success: false,
      valid: false,
      sessionInvalid: true,
      reason: 'USER_NOT_FOUND',
      message: 'Account session is no longer valid. Please sign in again.'
    };
  }
  return { success: true, valid: true };
}

function handleForgetPassword(payload) {
  var email = String(payload.email || '').toLowerCase().trim();
  var mobile = String(payload.mobile || '').trim();
  var normInputMobile = mobile.replace(/\D/g, '').slice(-10);
  var step = String(payload.step || 'sendOtp').trim();
  var otpCodeInput = String(payload.otpCode || payload.code || '').trim();
  var newPassword = String(payload.newPassword || '').trim();

  if (!email || !normInputMobile || normInputMobile.length !== 10) {
    return { success: false, message: 'Please enter both your Registered Email ID and valid 10-digit Mobile Number.' };
  }

  var userSheet = getOrCreateSheet('USERS');
  var users = getSheetData('USERS');
  for (var i = 0; i < users.length; i++) {
    var rowEmail = String(users[i].Email || '').toLowerCase().trim();
    var rowMobileNorm = String(users[i].Mobile || '').replace(/\D/g, '').slice(-10);
    if (rowEmail === email && rowMobileNorm === normInputMobile) {
      var user = users[i];
      var userName = user.Name || 'User';
      var userPass = String(user.Password || '');
      var cache = DbConnectionManager.getCache();

      // Step 1: Send 6-Digit Email OTP + 6-Digit Free WhatsApp Mobile OTP before resetting password
      if (step === 'sendOtp' && !otpCodeInput) {
        var generatedOtp = String(Math.floor(100000 + Math.random() * 900000));
        var generatedWaOtp = String(Math.floor(100000 + Math.random() * 900000));
        if (cache) {
          cache.put('FORGET_OTP_' + user.UserID, generatedOtp, 600);
          cache.put('MFA_OTP_' + user.UserID, generatedOtp, 600);
          cache.put('FORGET_WA_OTP_' + user.UserID, generatedWaOtp, 600);
          cache.put('WA_OTP_' + user.UserID, generatedWaOtp, 600);
        }
        var otpEmailSent = sendPortalEmailNotification(
          email,
          'Password Reset Email & WhatsApp 2FA OTP - RP Skill | Ranjan Pathshala',
          'Hello ' + userName + ',\n\n' +
          'We received a Password Reset request for your RP Skill | Ranjan Pathshala account.\n\n' +
          '--- EMAIL 2FA VERIFICATION CODE ---\n' +
          '6-Digit Email OTP: ' + generatedOtp + ' (Valid for 10 minutes)\n\n' +
          'Please enter this 6-digit OTP and your new password on the Forgot Password screen.\n\n' +
          'Best Regards,\nRP Skill Security Cell',
          '<div style="font-family:Segoe UI,Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;border:1px solid #e2e8f0;border-radius:12px;background:#ffffff;color:#0f172a;">' +
            '<h2 style="margin:0 0 12px 0;color:#4f46e5;">🔐 Password Reset 2FA Verification Code</h2>' +
            '<p style="font-size:14px;line-height:1.6;">Hello <strong>' + userName + '</strong>, please enter this 6-digit Email OTP on the Forgot Password screen:</p>' +
            '<div style="background:#eef2ff;border:2px dashed #4f46e5;border-radius:10px;padding:16px;text-align:center;margin:16px 0;">' +
              '<span style="font-size:28px;font-weight:900;letter-spacing:6px;color:#312e81;">' + generatedOtp + '</span>' +
            '</div>' +
            '<p style="font-size:12px;color:#64748b;margin-top:20px;">Best Regards,<br><strong>RP Skill | Ranjan Pathshala</strong></p>' +
          '</div>'
        );
        var waResetWebhookEnabled = isWhatsAppWebhookConfigured();
        if (waResetWebhookEnabled) {
          sendFreeWhatsAppOtpMessage(normInputMobile, userName, generatedWaOtp, 'Password Reset Verification');
        }
        return {
          success: true,
          otpSent: true,
          mfaRequired: true,
          emailSent: otpEmailSent,
          whatsappOtpRequired: waResetWebhookEnabled,
          userId: user.UserID,
          email: email,
          message: waResetWebhookEnabled
            ? ('6-digit Email OTP sent to ' + email + ' and WhatsApp OTP sent to +91-' + normInputMobile + '. Check your inbox and WhatsApp.')
            : ('6-digit Password Reset OTP has been sent to ' + email + '. Please check your email inbox to reset your password.')
        };
      }

      // Step 2: Strictly verify 6-Digit Email OTP (and WhatsApp OTP when webhook is configured) before updating password
      var mobileOtpInput = String(payload.mobileOtpCode || '').trim();
      var waResetEnforced = isWhatsAppWebhookConfigured();
      var cachedForgetOtp = cache ? (cache.get('FORGET_OTP_' + user.UserID) || cache.get('MFA_OTP_' + user.UserID)) : null;
      var cachedForgetWaOtp = cache ? (cache.get('FORGET_WA_OTP_' + user.UserID) || cache.get('WA_OTP_' + user.UserID)) : null;
      if (!otpCodeInput || !cachedForgetOtp || String(cachedForgetOtp).trim() !== otpCodeInput) {
        return { success: false, message: 'Invalid or expired 6-digit Email OTP. Password was NOT updated.' };
      }
      if (waResetEnforced && (!mobileOtpInput || !cachedForgetWaOtp || String(cachedForgetWaOtp).trim() !== mobileOtpInput)) {
        return { success: false, message: 'Invalid or expired 6-digit WhatsApp Mobile OTP. Please verify your mobile OTP.' };
      }

      if (!newPassword || newPassword.length < 4) {
        return { success: false, message: 'Please enter a new password of at least 4 characters.' };
      }

      if (cache) {
        cache.remove('FORGET_OTP_' + user.UserID);
        cache.remove('MFA_OTP_' + user.UserID);
        cache.remove('FORGET_WA_OTP_' + user.UserID);
        cache.remove('WA_OTP_' + user.UserID);
      }

      var hashedNewPass = hashPasswordWithSalt(newPassword);
      if (userSheet) {
        var headers = userSheet.getRange(1, 1, 1, Math.max(10, userSheet.getLastColumn())).getValues()[0];
        var passColIdx = headers.indexOf('Password') + 1;
        if (passColIdx <= 0) passColIdx = 5;
        userSheet.getRange(i + 2, passColIdx).setValue(hashedNewPass);

        // Clear old session token on password reset so old sessions must re-authenticate
        var sessColIdx = headers.indexOf('SessionToken') + 1;
        if (sessColIdx <= 0) sessColIdx = 8;
        userSheet.getRange(i + 2, sessColIdx).setValue('-');
        if (cache) cache.remove('ACTIVE_SESS_' + user.UserID);

        try {
          var prefs = readUserSettingsFromRow(user, false);
          prefs.emailVerified = true;
          prefs.mobileVerified = true;
          delete prefs.adminVisiblePassword;
          prefs.passwordUpdatedAt = new Date().toISOString();
          syncUserReadableColumns(userSheet, i + 2, user, prefs);
        } catch (e) {}

        invalidateSheetCache('USERS');
      }

      var emailSent = sendPortalEmailNotification(
        email,
        'Password Updated Successfully - RP Skill | Ranjan Pathshala',
        'Hello ' + userName + ',\n\n' +
        'Your Email 2FA OTP verification succeeded and your password has been securely updated (salted SHA-256 encrypted) in the RP Skill | Ranjan Pathshala database.\n\n' +
        'Registered Email ID: ' + email + '\n' +
        'Registered Mobile No: ' + normInputMobile + '\n\n' +
        'For your security, passwords are never emailed in plaintext. You can now log in using your new password.\n\n' +
        'Best Regards,\nRP Skill | Ranjan Pathshala Team',
        '<div style="font-family:Segoe UI,Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;border:1px solid #e2e8f0;border-radius:12px;background:#ffffff;color:#0f172a;">' +
          '<h2 style="margin:0 0 12px 0;color:#4f46e5;">Password Updated Successfully - RP Skill</h2>' +
          '<p style="font-size:14px;line-height:1.6;">Hello <strong>' + userName + '</strong>, your 2FA verification succeeded and your password has been securely hashed and updated:</p>' +
          '<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:14px;margin:16px 0;font-size:13.5px;line-height:1.7;">' +
            '<div><strong>Email ID:</strong> ' + email + '</div>' +
            '<div><strong>Mobile Number:</strong> ' + normInputMobile + '</div>' +
            '<div><strong>Security Status:</strong> Salted SHA-256 Protected (all prior sessions revoked)</div>' +
          '</div>' +
          '<p style="font-size:12px;color:#64748b;margin-top:20px;">If you did not request this reset, contact the Administrator immediately.<br><strong>RP Skill | Ranjan Pathshala</strong></p>' +
        '</div>'
      );
      handleLogActivity({
        userId: user.UserID || 'USER',
        userName: userName,
        activityType: 'PASSWORD_RESET_COMPLETED',
        details: 'Email 2FA OTP verified & hashed password updated in Google Sheet for ' + email
      });
      return {
        success: true,
        verified: true,
        passwordUpdated: true,
        emailSent: emailSent,
        message: 'OTP verified! Your new password has been securely saved and a confirmation email was sent to ' + email + '.'
      };
    }
  }
  return { success: false, message: 'Matching record not found for provided Email and 10-digit Mobile combination.' };
}

function handleUpdateProfile(payload) {
  var userId = payload.userId;
  var name = sanitizeInput(payload.name);
  var email = String(payload.email || '').toLowerCase().trim();
  var mobile = String(payload.mobile || '').trim();
  var password = payload.newPassword !== undefined ? payload.newPassword : payload.password;
  var step = String(payload.step || 'commit').trim();
  var otpCodeInput = String(payload.otpCode || '').trim();

  if (!name || name === '-' || !email || !mobile) {
    return { success: false, message: 'Name, Email, and Mobile are compulsory (*).' };
  }

  if (!isValidMobile(mobile)) {
    return { success: false, message: 'Invalid mobile number. Must be exactly 10 digits.' };
  }

  var userSheet = getOrCreateSheet('USERS');
  var users = getSheetData('USERS');
  
  for (var i = 0; i < users.length; i++) {
    if (users[i].UserID === userId) {
      var prevEmail = String(users[i].Email || '').toLowerCase().trim();
      var currentPass = String(users[i].Password || '');
      var cache = DbConnectionManager.getCache();

      // Step 1: Send 6-Digit Email OTP (and WhatsApp OTP if webhook configured) to authorize Profile Update
      var waProfWebhookEnabled = isWhatsAppWebhookConfigured();
      if (step === 'sendOtp' || step === 'requestOtp') {
        var profileOtp = String(Math.floor(100000 + Math.random() * 900000));
        var profileWaOtp = waProfWebhookEnabled ? String(Math.floor(100000 + Math.random() * 900000)) : '';
        if (cache) {
          cache.put('PROFILE_OTP_' + userId, profileOtp, 600);
          cache.put('MFA_OTP_' + userId, profileOtp, 600);
          if (profileWaOtp) {
            cache.put('PROFILE_WA_OTP_' + userId, profileWaOtp, 600);
            cache.put('WA_OTP_' + userId, profileWaOtp, 600);
          }
        }
        var otpSent = sendPortalEmailNotification(
          email,
          'Profile Update 2FA Verification Code - RP Skill | Ranjan Pathshala',
          'Hello ' + name + ',\n\n' +
          'You requested to update your profile details on RP Skill | Ranjan Pathshala.\n\n' +
          '6-Digit Email OTP: ' + profileOtp + ' (Valid for 10 minutes)\n\n' +
          'Please enter this 6-digit OTP code in your Profile menu to confirm and save your updated profile.\n\n' +
          'Best Regards,\nRP Skill Security Cell',
          '<div style="font-family:Segoe UI,Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;border:1px solid #e2e8f0;border-radius:12px;background:#ffffff;color:#0f172a;">' +
            '<h2 style="margin:0 0 12px 0;color:#4f46e5;">🔐 Profile Update 2FA Verification</h2>' +
            '<p style="font-size:14px;line-height:1.6;">Hello <strong>' + name + '</strong>, enter this 6-digit Email OTP to authorize and save your profile update:</p>' +
            '<div style="background:#eef2ff;border:2px dashed #4f46e5;border-radius:10px;padding:16px;text-align:center;margin:16px 0;">' +
              '<span style="font-size:28px;font-weight:900;letter-spacing:6px;color:#312e81;">' + profileOtp + '</span>' +
            '</div>' +
          '</div>'
        );
        if (waProfWebhookEnabled && profileWaOtp) {
          sendFreeWhatsAppOtpMessage(mobile, name, profileWaOtp, 'Profile Update Mobile Verification');
        }
        return {
          success: true,
          otpSent: true,
          otpRequired: true,
          mfaRequired: true,
          emailSent: otpSent,
          whatsappOtpRequired: waProfWebhookEnabled,
          message: waProfWebhookEnabled
            ? ('6-digit Email OTP sent to ' + email + ' and WhatsApp OTP sent to +91-' + mobile + '.')
            : ('6-digit Email OTP sent to ' + email + '. Please check your inbox and enter the code to save your profile.')
        };
      }

      // Step 2: Strictly verify 6-digit Email OTP (and WhatsApp OTP if webhook configured) before saving profile modifications
      var mobileOtpInput = String(payload.mobileOtpCode || '').trim();
      var cachedProfOtp = cache ? (cache.get('PROFILE_OTP_' + userId) || cache.get('MFA_OTP_' + userId)) : null;
      var cachedProfWaOtp = cache ? (cache.get('PROFILE_WA_OTP_' + userId) || cache.get('WA_OTP_' + userId)) : null;
      if (!otpCodeInput || !cachedProfOtp || String(cachedProfOtp).trim() !== otpCodeInput) {
        return { success: false, otpRequired: true, message: 'Invalid or expired 6-digit Email OTP. Profile changes were NOT saved.' };
      }
      if (waProfWebhookEnabled && (!mobileOtpInput || !cachedProfWaOtp || String(cachedProfWaOtp).trim() !== mobileOtpInput)) {
        return { success: false, otpRequired: true, message: 'Invalid or expired 6-digit WhatsApp Mobile OTP. Profile changes were NOT saved.' };
      }
      if (cache) {
        cache.remove('PROFILE_OTP_' + userId);
        cache.remove('MFA_OTP_' + userId);
        cache.remove('PROFILE_WA_OTP_' + userId);
        cache.remove('WA_OTP_' + userId);
      }

      var rowIndex = i + 2;
      var headers = userSheet.getRange(1, 1, 1, Math.max(10, userSheet.getLastColumn())).getValues()[0];
      var nameColIdx = headers.indexOf('Name') + 1 || 2;
      var emailColIdx = headers.indexOf('Email') + 1 || 3;
      var mobileColIdx = headers.indexOf('Mobile') + 1 || 4;
      var passColIdx = headers.indexOf('Password') + 1 || 5;
      var passwordChanged = false;

      userSheet.getRange(rowIndex, nameColIdx).setValue(name);
      userSheet.getRange(rowIndex, emailColIdx).setValue(email);
      userSheet.getRange(rowIndex, mobileColIdx).setValue(mobile);
      if (password && String(password).trim() !== '') {
        userSheet.getRange(rowIndex, passColIdx).setValue(hashPasswordWithSalt(String(password).trim()));
        passwordChanged = true;
      }

      var existingPrefs = readUserSettingsFromRow(users[i], true);
      existingPrefs.emailVerified = true;
      existingPrefs.mobileVerified = true;
      delete existingPrefs.adminVisiblePassword;
      if (payload.parentName !== undefined) existingPrefs.parentName = sanitizeInput(String(payload.parentName || '').trim());
      if (payload.parentMobile !== undefined) existingPrefs.parentMobile = String(payload.parentMobile || '').replace(/[^0-9]/g, '').slice(-10);
      if (payload.parentEmail !== undefined) existingPrefs.parentEmail = String(payload.parentEmail || '').toLowerCase().trim();
      if (payload.preferences && typeof payload.preferences === 'object') {
        for (var pk in payload.preferences) {
          if (pk !== 'adminVisiblePassword') existingPrefs[pk] = payload.preferences[pk];
        }
      }
      syncUserReadableColumns(userSheet, rowIndex, {
        UserID: userId,
        Name: name,
        Email: email,
        Mobile: mobile,
        Role: users[i].Role
      }, existingPrefs);

      invalidateSheetCache('USERS');

      var plainText =
        'Hello ' + name + ',\n\n' +
        'Your profile on RP Skill | Ranjan Pathshala has been updated and verified via Email 2FA.\n\n' +
        '--- UPDATED PROFILE DETAILS ---\n' +
        'Full Name: ' + name + '\n' +
        'Email ID: ' + email + '\n' +
        'Mobile Number: ' + mobile + '\n' +
        'Password: ' + (passwordChanged ? 'Updated (Salted SHA-256 Encrypted)' : 'Unchanged') + '\n' +
        'Email Verification Status: VERIFIED\n' +
        'Updated On: ' + new Date().toLocaleString() + '\n\n' +
        'If you did not make this change, please contact the Administrator immediately.\n\n' +
        'Best Regards,\nRP Skill | Ranjan Pathshala Team';

      var htmlContent =
        '<div style="font-family:Segoe UI,Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;border:1px solid #e2e8f0;border-radius:12px;background:#ffffff;color:#0f172a;">' +
          '<h2 style="margin:0 0 12px 0;color:#4f46e5;">Profile Updated Successfully (2FA Verified)</h2>' +
          '<p style="font-size:14px;line-height:1.6;">Hello <strong>' + name + '</strong>, your RP Skill | Ranjan Pathshala profile details have been updated:</p>' +
          '<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:14px;margin:16px 0;font-size:13.5px;line-height:1.7;">' +
            '<div><strong>Full Name:</strong> ' + name + '</div>' +
            '<div><strong>Email ID:</strong> ' + email + '</div>' +
            '<div><strong>Mobile Number:</strong> ' + mobile + '</div>' +
            '<div><strong>Password:</strong> ' + (passwordChanged ? 'Updated (Encrypted)' : 'Unchanged') + '</div>' +
            '<div><strong>Email 2FA Status:</strong> Verified</div>' +
          '</div>' +
          '<p style="font-size:12px;color:#64748b;margin-top:20px;">Best Regards,<br><strong>RP Skill | Ranjan Pathshala</strong></p>' +
        '</div>';

      var emailSent = sendPortalEmailNotification(
        email,
        'Profile Updated - RP Skill | Ranjan Pathshala',
        plainText,
        htmlContent
      );
      if (prevEmail && prevEmail !== email && prevEmail.indexOf('@') !== -1) {
        sendPortalEmailNotification(
          prevEmail,
          'Profile Email Changed - RP Skill | Ranjan Pathshala',
          plainText,
          htmlContent
        );
      }

      handleLogActivity({
        userId: userId,
        userName: name,
        activityType: 'PROFILE_UPDATE',
        details: 'User updated profile via Email 2FA (Confirmation Email sent to ' + email + ')'
      });
      return {
        success: true,
        verified: true,
        emailSent: emailSent,
        preferences: existingPrefs,
        message: 'Email 2FA verified! Profile updated successfully. Confirmation email sent to ' + email + '.'
      };
    }
  }
  return { success: false, message: 'User record not found.' };
}

function projectLightweightHistoryRow(h) {
  if (!h || typeof h !== 'object') return h;
  var out = {};
  for (var k in h) {
    if (!h.hasOwnProperty(k)) continue;
    if (k === 'UserTranscription' || k === 'ReferenceText' || k === 'ExtraMetaJson') continue;
    out[k] = h[k];
  }
  out.HasFullTranscript = Boolean((h.UserTranscription && h.UserTranscription !== '-') || (h.ReferenceText && h.ReferenceText !== '-'));
  return out;
}

function handleGetDashboardData(payload) {
  var announcements = getSheetData('ANNOUNCEMENTS').slice().reverse();
  var homework = getSheetData('HOMEWORK');
  var materials = getSheetData('MATERIALS');
  var subtabs = getSheetData('SUBTABS');
  var settings = getSheetData('SETTINGS');
  var allHistory = getSheetData('TEST_HISTORY');
  var usersList = getSheetData('USERS');
  var feeLedgerAll = getSheetData('FEE_LEDGER');
  var evalRulesRes = handleGetEvaluationRules({});

  var adminContacts = buildAdminContactsFromUsersList(usersList);

  var requestUserId = payload.userId ? String(payload.userId) : '';
  var userHistoryFull = requestUserId
    ? allHistory.filter(function(h) { return String(h.UserID) === requestUserId; })
    : allHistory.slice(-30);
  // Keep payload compact so dashboard always loads fast even with hundreds of long passages
  var userHistory = userHistoryFull.slice(-80).map(function(h) {
    var clone = projectLightweightHistoryRow(h);
    if (h.UserTranscription && String(h.UserTranscription).length <= 1500) clone.UserTranscription = h.UserTranscription;
    if (h.ReferenceText && String(h.ReferenceText).length <= 1500) clone.ReferenceText = h.ReferenceText;
    return clone;
  });
  var lightRecentHistory = allHistory.slice(-100).map(projectLightweightHistoryRow);

  var totalVisitsCount = getFastTotalVisitsCount();
  var banner = parseBannerSettings(settings);
  var maintenance = parseMaintenanceSettings(settings);
  var dashboardCustomBanner = parseDashboardCustomBannerSettings(settings);
  var dateSpecificBanners = parseDateSpecificBannersSettings(settings);
  var scheduledLiveTests = parseScheduledLiveTestsSettings(settings);
  var instituteBatches = parseInstituteBatchesSettings(settings);
  var batchMonitors = parseBatchMonitorsSettings(settings);
  var batchGroupMessages = parseBatchGroupMessagesSettings(settings);
  var feeConfig = parseFeeConfigSettings(settings);
  var batchMetaMap = parseInstituteBatchesMetaSettings(settings);

  var userCloudState = null;
  var currentUserBatchStatus = null;
  var initUserSheet = null;
  var batchStudentRoster = [];
  for (var uIdx = 0; uIdx < usersList.length; uIdx++) {
    var uRow = usersList[uIdx];
    var isCurrentUserRow = Boolean(requestUserId && String(uRow.UserID) === requestUserId);
    var uPrefs = readUserSettingsFromRow(uRow, isCurrentUserRow);
    var uRole = String(uRow.Role || 'user').toLowerCase().trim();
    if (isPrimarySuperadminEmail(uRow.Email)) uRole = 'superadmin';
    var isVer = Boolean((uPrefs && uPrefs.emailVerified === true) || String(uRow.EmailVerified || '').toLowerCase() === 'yes' || uRole === 'superadmin');
    var isMobVerInit = Boolean((uPrefs && uPrefs.mobileVerified === true) || String(uRow.MobileVerified || '').toLowerCase() === 'yes' || uRole === 'superadmin');
    var rowBatch = normalizeUserBatchesWithFreeTier(uRow.Batch || 'RP-Trail');
    var memberAllAccess = isMemberAllAccessActive(uRole, uPrefs, uRow);
    if (isCurrentUserRow) {
      if (!initUserSheet) initUserSheet = getOrCreateSheet('USERS', true);
      var initValRes = enforceBatchValidityAutoFreeTierForRow(uRow, uIdx + 2, initUserSheet, uPrefs);
      rowBatch = normalizeUserBatchesWithFreeTier(initValRes.batch || rowBatch);
      // Never leak adminVisiblePassword back into client cloudState
      var cleanCloud = {};
      for (var ck in uPrefs) {
        if (uPrefs.hasOwnProperty(ck) && ck !== 'adminVisiblePassword') cleanCloud[ck] = uPrefs[ck];
      }
      userCloudState = cleanCloud;
      currentUserBatchStatus = {
        batch: rowBatch,
        role: uRole,
        isMemberAllAccess: memberAllAccess,
        membershipPlan: String(uPrefs.membershipPlan || uRow.MembershipPlan || (memberAllAccess ? 'Member All-Access Pass' : 'Standard')),
        membershipValidUntil: String(uPrefs.membershipValidUntil || uRow.MembershipValidUntil || ''),
        memberAccessScope: String(uPrefs.memberAccessScope || (uRow.MemberAccessScope && uRow.MemberAccessScope !== '-' ? uRow.MemberAccessScope : '') || (uRole === 'member' ? 'ALL_PAST_CURRENT_UPCOMING' : '')),
        memberIncludedBatches: String(uPrefs.memberIncludedBatches || (uRow.MemberIncludedBatches && uRow.MemberIncludedBatches !== '-' ? uRow.MemberIncludedBatches : '') || ''),
        memberIncludeUpcoming: Boolean(uPrefs.memberIncludeUpcoming === true || String(uRow.MemberIncludeUpcoming || '').toLowerCase() === 'yes'),
        memberJoinDate: String(uPrefs.memberJoinDate || (uRow.MemberJoinDate && uRow.MemberJoinDate !== '-' ? uRow.MemberJoinDate : '') || ''),
        feeStatus: String(uPrefs.feeStatus || uRow.FeeStatus || (memberAllAccess ? 'Member Active' : 'Free (RP-Trail)')),
        enrollmentValidUntil: String(uPrefs.enrollmentValidUntil || uRow.BatchValidUntil || ''),
        autoSwitchedToFreeTier: Boolean(uPrefs.autoSwitchedToFreeTier),
        previousBatch: uPrefs.previousBatch || '',
        emailVerified: isVer,
        mobileVerified: isMobVerInit,
        parentName: String(uPrefs.parentName || (uRow.ParentName && uRow.ParentName !== '-' ? uRow.ParentName : '') || uRow.Name || ''),
        parentMobile: String(uPrefs.parentMobile || (uRow.ParentMobile && uRow.ParentMobile !== '-' ? uRow.ParentMobile : '') || uRow.Mobile || ''),
        parentEmail: String(uPrefs.parentEmail || (uRow.ParentEmail && uRow.ParentEmail !== '-' ? uRow.ParentEmail : '') || uRow.Email || ''),
        onboardedViaCsv: Boolean(uPrefs.onboardedViaCsv),
        requiresContactVerification: Boolean(uPrefs.requiresContactVerification)
      };
    }
    if (String(uRow.Status || 'active').toLowerCase() !== 'blocked') {
      batchStudentRoster.push({
        UserID: String(uRow.UserID || ''),
        userId: String(uRow.UserID || ''),
        Name: String(uRow.Name || uRow.UserID || 'Candidate'),
        name: String(uRow.Name || uRow.UserID || 'Candidate'),
        Role: uRole,
        role: uRole,
        Batch: rowBatch,
        batch: rowBatch,
        IsMemberAllAccess: memberAllAccess,
        MemberAccessScope: String(uPrefs.memberAccessScope || (uRow.MemberAccessScope && uRow.MemberAccessScope !== '-' ? uRow.MemberAccessScope : '') || ''),
        MemberIncludedBatches: String(uPrefs.memberIncludedBatches || (uRow.MemberIncludedBatches && uRow.MemberIncludedBatches !== '-' ? uRow.MemberIncludedBatches : '') || ''),
        MemberIncludeUpcoming: Boolean(uPrefs.memberIncludeUpcoming === true || String(uRow.MemberIncludeUpcoming || '').toLowerCase() === 'yes'),
        MemberJoinDate: String(uPrefs.memberJoinDate || (uRow.MemberJoinDate && uRow.MemberJoinDate !== '-' ? uRow.MemberJoinDate : '') || ''),
        EmailVerified: isVer,
        emailVerified: isVer
      });
    }
  }

  var userFeeReceipts = requestUserId
    ? feeLedgerAll.filter(function(f) { return String(f.UserID || '') === requestUserId; }).map(function(f) {
        var c = {};
        for (var fk in f) { if (f.hasOwnProperty(fk)) c[fk] = f[fk]; }
        c.Status = normalizeFeeStatusLabel(f.Status);
        return c;
      }).reverse().slice(0, 50)
    : [];

  return {
    success: true,
    announcements: announcements.slice(0, 15),
    homework: homework.slice(0, 15),
    materials: materials,
    subtabs: subtabs,
    evaluationRulesMap: evalRulesRes.rulesMap || {},
    history: lightRecentHistory,
    userHistory: userHistory,
    userCloudState: userCloudState,
    currentUserBatchStatus: currentUserBatchStatus,
    users: batchStudentRoster,
    batchStudentRoster: batchStudentRoster,
    adminContacts: adminContacts,
    batchMonitors: batchMonitors,
    batchMonitorsMap: batchMonitors,
    batchGroupMessages: batchGroupMessages,
    scheduledLiveTests: scheduledLiveTests,
    dateSpecificBanners: dateSpecificBanners,
    instituteBatches: instituteBatches,
    batchValidityMap: parseBatchValidityMapSettings(settings),
    batchMetaMap: batchMetaMap,
    feeConfig: feeConfig,
    userFeeReceipts: userFeeReceipts,
    stats: {
      totalPdfs: materials.filter(function(m) { return isTypeMatch(m.Type, 'pdf'); }).length,
      totalWords: materials.filter(function(m) { return isTypeMatch(m.Type, 'word'); }).length,
      totalAudios: materials.filter(function(m) { return isTypeMatch(m.Type, 'audio'); }).length,
      totalTypingTests: materials.filter(function(m) { return isTypeMatch(m.Type, 'typingtest'); }).length,
      totalPitmanBooks: materials.filter(function(m) { return isTypeMatch(m.Type, 'pitman'); }).length,
      totalVideoCourses: materials.filter(function(m) { return isTypeMatch(m.Type, 'videocourse'); }).length,
      totalLearningDrills: materials.filter(function(m) { return isTypeMatch(m.Type, 'learningtyping'); }).length,
      totalCbtTests: materials.filter(function(m) { return isTypeMatch(m.Type, 'cbttest'); }).length,
      totalTestsGiven: allHistory.length,
      userTestsGiven: userHistoryFull.length,
      totalUsers: usersList.length,
      totalVisits: totalVisitsCount
    },
    banner: banner,
    dashboardCustomBanner: dashboardCustomBanner,
    maintenance: maintenance
  };
}

function handleGetPublicStats(payload) {
  var usersList = getSheetData('USERS');
  var settings = getSheetData('SETTINGS');
  var totalVisitsCount = getFastTotalVisitsCount();
  var maintenance = parseMaintenanceSettings(settings);
  var banner = parseBannerSettings(settings);
  var dashboardCustomBanner = parseDashboardCustomBannerSettings(settings);
  var dateSpecificBanners = parseDateSpecificBannersSettings(settings);
  var scheduledLiveTests = parseScheduledLiveTestsSettings(settings);
  var feeConfig = parseFeeConfigSettings(settings);

  var adminContacts = buildAdminContactsFromUsersList(usersList);

  var activeUsersCount = 0;
  var activeCutoffMs = Date.now() - (45 * 60 * 1000);
  for (var au = 0; au < usersList.length; au++) {
    var st = String(usersList[au].Status || '').toLowerCase().trim();
    var hasTok = Boolean(usersList[au].SessionToken && String(usersList[au].SessionToken).trim() && String(usersList[au].SessionToken).trim() !== '-');
    var lastLoginMs = usersList[au].LastLoginAt ? new Date(usersList[au].LastLoginAt).getTime() : 0;
    if (st !== 'blocked' && (hasTok || (lastLoginMs && !isNaN(lastLoginMs) && lastLoginMs >= activeCutoffMs))) {
      activeUsersCount++;
    }
  }

  return {
    success: true,
    adminContacts: adminContacts,
    maintenance: maintenance,
    banner: banner,
    dashboardCustomBanner: dashboardCustomBanner,
    feeConfig: feeConfig,
    dateSpecificBanners: dateSpecificBanners,
    scheduledLiveTests: scheduledLiveTests,
    stats: {
      activeUsers: activeUsersCount,
      totalUsers: usersList.length,
      totalVisits: totalVisitsCount
    }
  };
}

function isTypeMatch(materialType, targetType) {
  var m = String(materialType || '').toLowerCase().replace(/[-_\s]/g, '');
  var t = String(targetType || '').toLowerCase().replace(/[-_\s]/g, '');
  if (m === t) return true;
  if ((t === 'videocourse' || t === 'videocourses') &&
      (m === 'videocourse' || m === 'videocourses')) {
    return true;
  }
  if ((t === 'video' || t === 'videos' || t === 'referencevideo') &&
      (m === 'video' || m === 'videos' || m === 'referencevideo')) {
    return true;
  }
  if ((t === 'pdf' || t === 'pdfs') && (m === 'pdf' || m === 'pdfs')) return true;
  if ((t === 'audio' || t === 'audios') && (m === 'audio' || m === 'audios')) return true;
  if ((t === 'word' || t === 'words') && (m === 'word' || m === 'words')) return true;
  if ((t === 'pitman' || t === 'pitmanbook' || t === 'pitmanbooks') && (m === 'pitman' || m === 'pitmanbook' || m === 'pitmanbooks')) return true;
  if ((t === 'typingtest' || t === 'typing') && (m === 'typingtest' || m === 'typing')) return true;
  if ((t === 'learningtyping' || t === 'learning') && (m === 'learningtyping' || m === 'learning')) return true;
  if ((t === 'cbttest' || t === 'cbt') && (m === 'cbttest' || m === 'cbt')) return true;
  return false;
}

function isMaterialWithinScheduleWindow(item) {
  if (!item) return false;
  var nowMs = Date.now();
  var pubStr = String(item.PublishAt || item.publishAt || '').trim();
  if (pubStr && pubStr !== '-') {
    var pubMs = new Date(pubStr).getTime();
    if (!isNaN(pubMs) && nowMs < pubMs) return false;
  }
  var expStr = String(item.ExpireAt || item.expireAt || '').trim();
  if (expStr && expStr !== '-') {
    var expMs = new Date(expStr).getTime();
    if (!isNaN(expMs) && nowMs > expMs) return false;
  }
  return true;
}

function handleGetMaterials(payload) {
  payload = payload || {};
  var type = String(payload.type || '').toLowerCase().trim();
  var includeScheduled = Boolean(payload.includeScheduled);
  var allMats = getSheetData('MATERIALS');
  if (!includeScheduled) {
    allMats = allMats.filter(isMaterialWithinScheduleWindow);
  }
  var allSubtabs = getSheetData('SUBTABS');

  var materials = (!type || type === 'all') ? allMats : allMats.filter(function(m) {
    return isTypeMatch(m.Type, type);
  });
  var subtabs = (!type || type === 'all') ? allSubtabs : allSubtabs.filter(function(s) {
    return isTypeMatch(s.Type, type);
  });

  var searchQ = String(payload.search || '').toLowerCase().trim();
  if (searchQ) {
    materials = materials.filter(function(m) {
      return (String(m.Title || '') + ' ' + String(m.Subtab || '') + ' ' + String(m.Category || '')).toLowerCase().indexOf(searchQ) !== -1;
    });
  }

  var totalCount = materials.length;
  var hasPagination = payload.page !== undefined && payload.page !== null && payload.page !== '';
  if (hasPagination) {
    var page = Math.max(1, parseInt(payload.page || 1, 10) || 1);
    var pageSize = Math.min(500, Math.max(10, parseInt(payload.pageSize || payload.limit || 100, 10) || 100));
    var start = (page - 1) * pageSize;
    var paged = materials.slice(start, start + pageSize);
    return {
      success: true,
      materials: paged,
      subtabs: subtabs,
      totalCount: totalCount,
      page: page,
      pageSize: pageSize,
      totalPages: Math.max(1, Math.ceil(totalCount / pageSize)),
      hasMore: (start + pageSize) < totalCount
    };
  }
  return { success: true, materials: materials, subtabs: subtabs, totalCount: totalCount };
}

function handleUploadMaterial(payload) {
  var materialType = payload.materialType;
  var normalizedType = materialType ? materialType.toLowerCase().replace(/[-_]/g, '').trim() : '';
  
  var sheetName = 'MATERIALS';
  if (normalizedType === 'homework') sheetName = 'HOMEWORK';
  else if (normalizedType === 'announcement') sheetName = 'ANNOUNCEMENTS';

  var sheet = getOrCreateSheet(sheetName);
  var id = 'MAT-' + Date.now();

  if (normalizedType === 'homework') {
    sheet.appendRow([
      id, 
      defaultDash(payload.targetDate), 
      sanitizeInput(payload.title), 
      sanitizeInput(payload.details || payload.contentOrUrl), 
      new Date().toISOString(),
      defaultDash(payload.targetBatch || 'ALL_BATCHES')
    ]);
  } else if (normalizedType === 'announcement') {
    sheet.appendRow([
      id, 
      sanitizeInput(payload.title), 
      sanitizeInput(payload.contentOrUrl || payload.content), 
      new Date().toISOString()
    ]);
  } else {
    var metaObj = {};
    if (payload.extraMetaJson && payload.extraMetaJson !== '-') {
      metaObj = parseReadableSheetData(payload.extraMetaJson, {});
    }
    if (payload.targetBatch) metaObj.TargetBatch = String(payload.targetBatch).trim();
    if (payload.cbtEvalRuleKey) metaObj.CbtEvalRuleKey = String(payload.cbtEvalRuleKey).trim();
    if (payload.questionsCount !== undefined) metaObj.QuestionsCount = payload.questionsCount;
    if (payload.publishAt !== undefined || payload.PublishAt !== undefined) metaObj.PublishAt = String(payload.publishAt || payload.PublishAt || '').trim();
    if (payload.expireAt !== undefined || payload.ExpireAt !== undefined) metaObj.ExpireAt = String(payload.expireAt || payload.ExpireAt || '').trim();
    if (payload.autoDeleteAt !== undefined || payload.AutoDeleteAt !== undefined) metaObj.AutoDeleteAt = String(payload.autoDeleteAt || payload.AutoDeleteAt || '').trim();
    if (payload.autoDeleteDays !== undefined || payload.AutoDeleteDays !== undefined) metaObj.AutoDeleteDays = String(payload.autoDeleteDays || payload.AutoDeleteDays || '').trim();
    if (payload.mediaStartTime !== undefined || payload.MediaStartTime !== undefined) metaObj.MediaStartTime = String(payload.mediaStartTime !== undefined ? payload.mediaStartTime : payload.MediaStartTime).trim();
    if (payload.mediaEndTime !== undefined || payload.MediaEndTime !== undefined) metaObj.MediaEndTime = String(payload.mediaEndTime !== undefined ? payload.mediaEndTime : payload.MediaEndTime).trim();
    if (Array.isArray(payload.mergedAudioTracks)) {
      metaObj.MergedAudioTracks = payload.mergedAudioTracks.filter(function(t) { return t && t.url; }).map(function(t, idx) {
        return {
          title: String(t.title || ('Part ' + (idx + 1))).trim(),
          url: formatDriveUrl(String(t.url || '').trim()),
          startTime: String(t.startTime || '').trim(),
          endTime: String(t.endTime || '').trim()
        };
      });
    }
    var finalExtraMeta = Object.keys(metaObj).length > 0 ? safeSheetCellValue(JSON.stringify(metaObj), 48500) : '-';
    var mergedTracksReadable = Array.isArray(metaObj.MergedAudioTracks) && metaObj.MergedAudioTracks.length > 0
      ? metaObj.MergedAudioTracks.map(function(t, idx) {
          return (idx + 1) + '. ' + (t.title || ('Part ' + (idx + 1))) + (t.startTime || t.endTime ? (' [' + (t.startTime || '0') + 's-' + (t.endTime || 'end') + 's]') : '') + ' (' + t.url + ')';
        }).join(' | ')
      : '-';
    var notesSummary = [];
    if (metaObj.AutoDeleteAt) notesSummary.push('AutoDeleteAt: ' + metaObj.AutoDeleteAt);
    if (metaObj.HardWords) notesSummary.push('HardWords: ' + String(metaObj.HardWords).slice(0, 300));
    var additionalNotesStr = notesSummary.length ? notesSummary.join(' | ') : '-';

    sheet.appendRow([
      id,
      defaultDash(String(payload.materialType || '').trim()),
      sanitizeInput(payload.subtab ? String(payload.subtab).trim() : '-'),
      sanitizeInput(payload.category || '-'),
      sanitizeInput(payload.title || '-'),
      safeSheetCellValue(sanitizeInput(formatDriveUrl(payload.contentOrUrl || '-')), 48500),
      safeSheetCellValue(sanitizeInput(formatDriveUrl(payload.thumbnailUrl || '-')), 48500),
      safeSheetCellValue(sanitizeInput(formatDriveUrl(payload.logoUrl || '-')), 48500),
      defaultDash(payload.accessLevel || 'user'),
      new Date().toISOString(),
      defaultDash(payload.medium || 'English'),
      defaultDash(payload.difficulty || 'Medium'),
      defaultDash(payload.examDate || getScriptLocalDate()),
      defaultDash(payload.timeLimit || 5),
      safeSheetCellValue(finalExtraMeta, 48500),
      defaultDash(metaObj.TargetBatch || 'ALL_BATCHES'),
      sanitizeInput(metaObj.Description || payload.description || '-'),
      defaultDash(metaObj.CbtEvalRuleKey || '-'),
      metaObj.QuestionsCount !== undefined ? metaObj.QuestionsCount : '-',
      defaultDash(metaObj.MediaStartTime || '-'),
      defaultDash(metaObj.MediaEndTime || '-'),
      safeSheetCellValue(mergedTracksReadable, 10000),
      defaultDash(metaObj.PublishAt || '-'),
      defaultDash(metaObj.ExpireAt || '-'),
      defaultDash(metaObj.AutoDeleteDays || '-'),
      safeSheetCellValue(additionalNotesStr, 10000)
    ]);
  }

  try { SpreadsheetApp.flush(); } catch (flushErr) {}
  invalidateSheetCache(sheetName);
  handleLogActivity({
    userId: payload.actorId || 'ADMIN',
    userName: payload.actorName || 'Admin/Superadmin',
    activityType: 'MATERIAL_UPLOAD',
    details: 'Uploaded [' + (payload.materialType || sheetName) + '] "' + (payload.title || '-') + '" (Access: ' + (payload.accessLevel || 'public') + ')'
  });
  return { success: true, id: id, materialId: id, message: 'Material uploaded successfully.' };
}

function handleUpdateMaterial(payload) {
  var id = payload.id;
  var sheetNames = ['MATERIALS', 'HOMEWORK', 'ANNOUNCEMENTS'];

  for (var s = 0; s < sheetNames.length; s++) {
    var sheet = DbConnectionManager.getSheet(sheetNames[s]);
    if (!sheet) continue;
    var data = sheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][0]) === String(id)) {
        var rowIndex = i + 1;
        
        if (sheetNames[s] === 'HOMEWORK') {
          if (payload.targetDate !== undefined) sheet.getRange(rowIndex, 2).setValue(defaultDash(payload.targetDate));
          if (payload.title !== undefined) sheet.getRange(rowIndex, 3).setValue(sanitizeInput(payload.title));
          if (payload.details !== undefined || payload.contentOrUrl !== undefined) sheet.getRange(rowIndex, 4).setValue(sanitizeInput(payload.details || payload.contentOrUrl));
          if (payload.targetBatch !== undefined) sheet.getRange(rowIndex, 6).setValue(defaultDash(payload.targetBatch));
        } else if (sheetNames[s] === 'ANNOUNCEMENTS') {
          if (payload.title !== undefined) sheet.getRange(rowIndex, 2).setValue(sanitizeInput(payload.title));
          if (payload.contentOrUrl !== undefined || payload.content !== undefined) sheet.getRange(rowIndex, 3).setValue(sanitizeInput(payload.contentOrUrl || payload.content));
        } else {
          if (payload.materialType) sheet.getRange(rowIndex, 2).setValue(String(payload.materialType).trim());
          if (payload.subtab !== undefined) sheet.getRange(rowIndex, 3).setValue(sanitizeInput(String(payload.subtab).trim()));
          if (payload.category !== undefined) sheet.getRange(rowIndex, 4).setValue(sanitizeInput(payload.category));
          if (payload.title !== undefined) sheet.getRange(rowIndex, 5).setValue(sanitizeInput(payload.title));
          if (payload.contentOrUrl !== undefined) sheet.getRange(rowIndex, 6).setValue(sanitizeInput(formatDriveUrl(payload.contentOrUrl)));
          if (payload.thumbnailUrl !== undefined) sheet.getRange(rowIndex, 7).setValue(sanitizeInput(formatDriveUrl(payload.thumbnailUrl)));
          if (payload.logoUrl !== undefined) sheet.getRange(rowIndex, 8).setValue(sanitizeInput(formatDriveUrl(payload.logoUrl)));
          if (payload.accessLevel !== undefined) sheet.getRange(rowIndex, 9).setValue(defaultDash(payload.accessLevel));
          if (payload.medium !== undefined) sheet.getRange(rowIndex, 11).setValue(defaultDash(payload.medium));
          if (payload.difficulty !== undefined) sheet.getRange(rowIndex, 12).setValue(defaultDash(payload.difficulty));
          if (payload.examDate !== undefined) sheet.getRange(rowIndex, 13).setValue(defaultDash(payload.examDate));
          if (payload.timeLimit !== undefined) sheet.getRange(rowIndex, 14).setValue(defaultDash(payload.timeLimit));
          if (payload.extraMetaJson !== undefined || payload.targetBatch !== undefined || payload.cbtEvalRuleKey !== undefined || payload.publishAt !== undefined || payload.PublishAt !== undefined || payload.expireAt !== undefined || payload.ExpireAt !== undefined || payload.autoDeleteAt !== undefined || payload.AutoDeleteAt !== undefined || payload.autoDeleteDays !== undefined || payload.AutoDeleteDays !== undefined || payload.mediaStartTime !== undefined || payload.MediaStartTime !== undefined || payload.mediaEndTime !== undefined || payload.MediaEndTime !== undefined || payload.mergedAudioTracks !== undefined) {
            var existingMeta = parseReadableSheetData(data[i][14], {});
            if (payload.extraMetaJson && payload.extraMetaJson !== '-') {
              var incomingMeta = parseReadableSheetData(payload.extraMetaJson, {});
              for (var mk in incomingMeta) existingMeta[mk] = incomingMeta[mk];
            }
            if (payload.targetBatch !== undefined) existingMeta.TargetBatch = String(payload.targetBatch).trim();
            if (payload.cbtEvalRuleKey !== undefined) existingMeta.CbtEvalRuleKey = String(payload.cbtEvalRuleKey).trim();
            if (payload.publishAt !== undefined || payload.PublishAt !== undefined) existingMeta.PublishAt = String(payload.publishAt || payload.PublishAt || '').trim();
            if (payload.expireAt !== undefined || payload.ExpireAt !== undefined) existingMeta.ExpireAt = String(payload.expireAt || payload.ExpireAt || '').trim();
            if (payload.autoDeleteAt !== undefined || payload.AutoDeleteAt !== undefined) existingMeta.AutoDeleteAt = String(payload.autoDeleteAt || payload.AutoDeleteAt || '').trim();
            if (payload.autoDeleteDays !== undefined || payload.AutoDeleteDays !== undefined) existingMeta.AutoDeleteDays = String(payload.autoDeleteDays || payload.AutoDeleteDays || '').trim();
            if (payload.mediaStartTime !== undefined || payload.MediaStartTime !== undefined) existingMeta.MediaStartTime = String(payload.mediaStartTime !== undefined ? payload.mediaStartTime : payload.MediaStartTime).trim();
            if (payload.mediaEndTime !== undefined || payload.MediaEndTime !== undefined) existingMeta.MediaEndTime = String(payload.mediaEndTime !== undefined ? payload.mediaEndTime : payload.MediaEndTime).trim();
            if (Array.isArray(payload.mergedAudioTracks)) {
              existingMeta.MergedAudioTracks = payload.mergedAudioTracks.filter(function(t) { return t && t.url; }).map(function(t, idx) {
                return {
                  title: String(t.title || ('Part ' + (idx + 1))).trim(),
                  url: formatDriveUrl(String(t.url || '').trim()),
                  startTime: String(t.startTime || '').trim(),
                  endTime: String(t.endTime || '').trim()
                };
              });
            }
            var updatedMetaStr = Object.keys(existingMeta).length > 0 ? safeSheetCellValue(JSON.stringify(existingMeta), 48500) : '-';
            sheet.getRange(rowIndex, 15).setValue(updatedMetaStr);
            var updMergedReadable = Array.isArray(existingMeta.MergedAudioTracks) && existingMeta.MergedAudioTracks.length > 0
              ? existingMeta.MergedAudioTracks.map(function(t, idx) {
                  return (idx + 1) + '. ' + (t.title || ('Part ' + (idx + 1))) + (t.startTime || t.endTime ? (' [' + (t.startTime || '0') + 's-' + (t.endTime || 'end') + 's]') : '') + ' (' + t.url + ')';
                }).join(' | ')
              : '-';
            var updNotesSummary = [];
            if (existingMeta.AutoDeleteAt) updNotesSummary.push('AutoDeleteAt: ' + existingMeta.AutoDeleteAt);
            if (existingMeta.HardWords) updNotesSummary.push('HardWords: ' + String(existingMeta.HardWords).slice(0, 300));
            setRowNamedColumns(sheet, 'MATERIALS', rowIndex, {
              'TargetBatch': defaultDash(existingMeta.TargetBatch || 'ALL_BATCHES'),
              'Description': sanitizeInput(existingMeta.Description || payload.description || '-'),
              'CbtEvalRule': defaultDash(existingMeta.CbtEvalRuleKey || '-'),
              'QuestionsCount': existingMeta.QuestionsCount !== undefined ? existingMeta.QuestionsCount : '-',
              'AudioStartTime': defaultDash(existingMeta.MediaStartTime || '-'),
              'AudioEndTime': defaultDash(existingMeta.MediaEndTime || '-'),
              'MergedTracks': safeSheetCellValue(updMergedReadable, 10000),
              'PublishAt': defaultDash(existingMeta.PublishAt || '-'),
              'ExpireAt': defaultDash(existingMeta.ExpireAt || '-'),
              'AutoDeleteDays': defaultDash(existingMeta.AutoDeleteDays || '-'),
              'AdditionalNotes': updNotesSummary.length ? safeSheetCellValue(updNotesSummary.join(' | '), 10000) : '-'
            });
          }
        }

        try { SpreadsheetApp.flush(); } catch (flushErr) {}
        invalidateSheetCache(sheetNames[s]);
        handleLogActivity({
          userId: payload.actorId || 'ADMIN',
          userName: payload.actorName || 'Admin/Superadmin',
          activityType: 'MATERIAL_UPDATE',
          details: 'Updated item ID ' + id + ' ("' + (payload.title || '-') + '", Access: ' + (payload.accessLevel || '-') + ')'
        });
        return { success: true, message: 'Item updated successfully.' };
      }
    }
  }
  return { success: false, message: 'Item not found for update.' };
}

function handleDeleteMaterial(payload) {
  var id = payload.id;
  var sheetNames = ['MATERIALS', 'HOMEWORK', 'ANNOUNCEMENTS'];

  for (var s = 0; s < sheetNames.length; s++) {
    var sheet = DbConnectionManager.getSheet(sheetNames[s]);
    if (!sheet) continue;
    var data = sheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][0]) === String(id)) {
        var deletedTitle = String(data[i][4] || data[i][2] || id);
        sheet.deleteRow(i + 1);
        invalidateSheetCache(sheetNames[s]);
        handleLogActivity({
          userId: payload.actorId || 'ADMIN',
          userName: payload.actorName || 'Admin/Superadmin',
          activityType: 'MATERIAL_DELETE',
          details: 'Deleted material ID ' + id + ' ("' + deletedTitle + '")'
        });
        return { success: true, message: 'Item deleted successfully.' };
      }
    }
  }
  return { success: false, message: 'Item not found.' };
}

function handleBulkDeleteMaterials(payload) {
  var ids = (payload && Array.isArray(payload.ids)) ? payload.ids : [];
  if (!ids.length) {
    return { success: false, message: 'No material IDs provided for bulk deletion.' };
  }
  var idSet = {};
  for (var idx = 0; idx < ids.length; idx++) {
    var cleanId = String(ids[idx] || '').trim();
    if (cleanId) idSet[cleanId] = true;
  }

  var sheetNames = ['MATERIALS', 'HOMEWORK', 'ANNOUNCEMENTS'];
  var deletedCount = 0;
  var deletedIds = [];

  for (var s = 0; s < sheetNames.length; s++) {
    var sheet = DbConnectionManager.getSheet(sheetNames[s]);
    if (!sheet) continue;
    var data = sheet.getDataRange().getValues();
    var sheetDeleted = 0;
    for (var i = data.length - 1; i >= 1; i--) {
      var rowId = String(data[i][0] || '').trim();
      if (idSet[rowId]) {
        sheet.deleteRow(i + 1);
        deletedCount++;
        sheetDeleted++;
        deletedIds.push(rowId);
      }
    }
    if (sheetDeleted > 0) {
      invalidateSheetCache(sheetNames[s]);
    }
  }

  if (deletedCount > 0) {
    handleLogActivity({
      userId: payload.actorId || payload._verifiedUserId || 'ADMIN',
      userName: payload.actorName || 'Admin/Superadmin',
      activityType: 'MATERIAL_BULK_DELETE',
      details: 'Bulk deleted ' + deletedCount + ' content item(s): ' + deletedIds.slice(0, 15).join(', ')
    });
  }

  return {
    success: deletedCount > 0,
    deletedCount: deletedCount,
    deletedIds: deletedIds,
    message: deletedCount > 0
      ? ('Successfully deleted ' + deletedCount + ' selected content item(s).')
      : 'None of the selected items were found.'
  };
}

function parseContentAutoDeletePolicy(settings) {
  var def = { enabled: false, defaultDays: 0, deleteExpiredAutomatically: false, targetTypes: ['all'], updatedAt: '' };
  if (!Array.isArray(settings)) return def;
  for (var i = 0; i < settings.length; i++) {
    if (String(settings[i].Key || '').toUpperCase().trim() === 'CONTENT_AUTO_DELETE_POLICY') {
      var parsed = parseReadableSheetData(settings[i].Value, {});
      var types = Array.isArray(parsed.targetTypes) && parsed.targetTypes.length > 0
        ? parsed.targetTypes
        : (typeof parsed.targetTypes === 'string' && parsed.targetTypes.trim() ? parsed.targetTypes.split(',').map(function(s) { return s.trim(); }).filter(Boolean) : ['all']);
      return {
        enabled: parsed.enabled === true || String(parsed.enabled).toLowerCase() === 'true' || String(parsed.enabled) === '1',
        defaultDays: Math.max(0, parseInt(parsed.defaultDays || 0, 10) || 0),
        deleteExpiredAutomatically: parsed.deleteExpiredAutomatically === true || String(parsed.deleteExpiredAutomatically).toLowerCase() === 'true' || String(parsed.deleteExpiredAutomatically) === '1',
        targetTypes: types,
        updatedAt: String(parsed.updatedAt || '')
      };
    }
  }
  return def;
}

function handleSaveContentAutoDeletePolicy(payload) {
  var rawTypes = Array.isArray(payload.targetTypes)
    ? payload.targetTypes
    : (typeof payload.targetTypes === 'string' && payload.targetTypes.trim() ? [payload.targetTypes.trim()] : ['all']);
  var policy = {
    enabled: payload.enabled === true || String(payload.enabled).toLowerCase() === 'true' || String(payload.enabled) === '1',
    defaultDays: Math.max(0, parseInt(payload.defaultDays || 0, 10) || 0),
    deleteExpiredAutomatically: payload.deleteExpiredAutomatically === true || String(payload.deleteExpiredAutomatically).toLowerCase() === 'true' || String(payload.deleteExpiredAutomatically) === '1',
    targetTypes: rawTypes.length > 0 ? rawTypes : ['all'],
    updatedAt: new Date().toISOString()
  };
  var settingsSheet = getOrCreateSheet('SETTINGS');
  var data = settingsSheet.getDataRange().getValues();
  var foundRow = -1;
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0] || '').toUpperCase().trim() === 'CONTENT_AUTO_DELETE_POLICY') {
      foundRow = i + 1;
      break;
    }
  }
  var valStr = JSON.stringify(policy);
  if (foundRow > 0) {
    settingsSheet.getRange(foundRow, 2).setValue(valStr);
  } else {
    settingsSheet.appendRow(['CONTENT_AUTO_DELETE_POLICY', valStr]);
  }
  try { SpreadsheetApp.flush(); } catch (flushErr) {}
  invalidateSheetCache('SETTINGS');
  handleLogActivity({
    userId: payload.actorId || payload._verifiedUserId || 'ADMIN',
    userName: payload.actorName || 'Admin/Superadmin',
    activityType: 'CONTENT_AUTODELETE_POLICY',
    details: 'Saved Content Auto-Delete Policy (Enabled: ' + policy.enabled + ', Max Age: ' + policy.defaultDays + 'd, Target: ' + policy.targetTypes.join(',') + ', Purge Expired: ' + policy.deleteExpiredAutomatically + ')'
  });
  return { success: true, policy: policy, message: 'Content Auto-Delete policy saved to Google Sheet.' };
}

function handlePurgeExpiredMaterials(payload) {
  payload = payload || {};
  var nowMs = Date.now();
  var settings = getSheetData('SETTINGS');
  var policy = parseContentAutoDeletePolicy(settings);
  var includeExpired = payload.includeExpired !== undefined ? Boolean(payload.includeExpired) : Boolean(policy.deleteExpiredAutomatically);
  var maxAgeDays = payload.maxAgeDays !== undefined ? (parseInt(payload.maxAgeDays, 10) || 0) : (policy.enabled ? (policy.defaultDays || 0) : 0);
  var targetTypes = Array.isArray(payload.targetTypes) && payload.targetTypes.length > 0
    ? payload.targetTypes.map(function(t) { return String(t).toLowerCase().trim(); })
    : (Array.isArray(policy.targetTypes) ? policy.targetTypes.map(function(t) { return String(t).toLowerCase().trim(); }) : []);
  var maxAgeMs = maxAgeDays > 0 ? (maxAgeDays * 24 * 60 * 60 * 1000) : 0;

  var deletedCount = 0;
  var deletedIds = [];

  var matSheet = DbConnectionManager.getSheet('MATERIALS');
  if (matSheet) {
    var mData = matSheet.getDataRange().getValues();
    var matDeleted = 0;
    for (var i = mData.length - 1; i >= 1; i--) {
      var rowId = String(mData[i][0] || '').trim();
      var rowType = String(mData[i][1] || '').toLowerCase().trim();
      var createdStr = String(mData[i][9] || '').trim();
      var rawMeta = String(mData[i][14] || '').trim();
      var meta = parseReadableSheetData(rawMeta, {});
      var shouldDelete = false;
      var autoDelStr = String(meta.AutoDeleteAt || '').trim();
      if (autoDelStr && autoDelStr !== '-') {
        var autoDelMs = new Date(autoDelStr).getTime();
        if (!isNaN(autoDelMs) && nowMs >= autoDelMs) shouldDelete = true;
      }
      if (!shouldDelete && includeExpired) {
        var expStr = String(meta.ExpireAt || '').trim();
        if (expStr && expStr !== '-') {
          var expMs = new Date(expStr).getTime();
          if (!isNaN(expMs) && nowMs >= expMs) shouldDelete = true;
        }
      }
      if (!shouldDelete && maxAgeMs > 0 && createdStr && createdStr !== '-') {
        var typeOk = (targetTypes.length === 0 || targetTypes.indexOf('all') !== -1 || targetTypes.indexOf(rowType) !== -1);
        if (typeOk) {
          var createdMs = new Date(createdStr).getTime();
          if (!isNaN(createdMs) && (nowMs - createdMs) >= maxAgeMs) shouldDelete = true;
        }
      }
      if (shouldDelete) {
        matSheet.deleteRow(i + 1);
        deletedCount++;
        matDeleted++;
        deletedIds.push(rowId);
      }
    }
    if (matDeleted > 0) invalidateSheetCache('MATERIALS');
  }

  if (maxAgeMs > 0) {
    var extraSheets = [
      { name: 'HOMEWORK', type: 'homework', dateCol: 4 },
      { name: 'ANNOUNCEMENTS', type: 'announcement', dateCol: 3 }
    ];
    for (var es = 0; es < extraSheets.length; es++) {
      var info = extraSheets[es];
      var typeAllowed = (targetTypes.length === 0 || targetTypes.indexOf('all') !== -1 || targetTypes.indexOf(info.type) !== -1);
      if (!typeAllowed) continue;
      var sh = DbConnectionManager.getSheet(info.name);
      if (!sh) continue;
      var rows = sh.getDataRange().getValues();
      var shDel = 0;
      for (var r = rows.length - 1; r >= 1; r--) {
        var cMs = new Date(String(rows[r][info.dateCol] || '')).getTime();
        if (!isNaN(cMs) && (nowMs - cMs) >= maxAgeMs) {
          deletedIds.push(String(rows[r][0] || ''));
          sh.deleteRow(r + 1);
          deletedCount++;
          shDel++;
        }
      }
      if (shDel > 0) invalidateSheetCache(info.name);
    }
  }

  if (deletedCount > 0) {
    handleLogActivity({
      userId: payload.actorId || payload._verifiedUserId || 'SYSTEM',
      userName: payload.actorName || 'Auto-Delete Scheduler',
      activityType: 'MATERIAL_AUTO_DELETE',
      details: 'Auto-deleted ' + deletedCount + ' expired/aged content item(s): ' + deletedIds.slice(0, 15).join(', ')
    });
  }

  return {
    success: true,
    deletedCount: deletedCount,
    deletedIds: deletedIds,
    message: deletedCount > 0
      ? ('Auto-deleted ' + deletedCount + ' expired/scheduled content item(s).')
      : 'No expired or scheduled content items were due for deletion.'
  };
}

function runScheduledAutoDeleteMaterials() {
  return handlePurgeExpiredMaterials({ actorId: 'SYSTEM', actorName: 'Daily Auto-Delete Trigger' });
}

function handleSetupAutoDeleteMaterialsTrigger(payload) {
  try {
    var existing = ScriptApp.getProjectTriggers();
    for (var i = 0; i < existing.length; i++) {
      if (existing[i].getHandlerFunction() === 'runScheduledAutoDeleteMaterials') {
        ScriptApp.deleteTrigger(existing[i]);
      }
    }
    ScriptApp.newTrigger('runScheduledAutoDeleteMaterials')
      .timeBased()
      .everyDays(1)
      .atHour(1)
      .create();
    return { success: true, message: 'Daily Auto-Delete Content trigger scheduled (runs every day at 1:00 AM).' };
  } catch (e) {
    return { success: false, message: 'Could not create Apps Script trigger: ' + String(e) };
  }
}

function handleLogActivity(payload) {
  var sheet = getOrCreateSheet('ACTIVITY_LOGS');
  if (!sheet) return { success: false };
  var logId = 'LOG-' + Date.now() + '-' + Math.floor(100 + Math.random() * 900);
  var actorLabel = payload.userName || 'Anonymous';
  if (payload.userRole && String(actorLabel).indexOf('(') === -1) {
    actorLabel = actorLabel + ' (' + String(payload.userRole).toUpperCase() + ')';
  }
  sheet.appendRow([
    logId,
    payload.userId || 'GUEST',
    sanitizeInput(actorLabel),
    defaultDash(payload.activityType),
    sanitizeInput(payload.details),
    new Date().toISOString()
  ]);
  DbConnectionManager.markDirty('ACTIVITY_LOGS');
  invalidateSheetCache('ACTIVITY_LOGS');
  return { success: true, logId: logId };
}

function handleSubmitFeedback(payload) {
  var actorRole = String(payload._verifiedRole || '').toLowerCase().trim();
  var isStaff = (actorRole === 'admin' || actorRole === 'superadmin');
  var effectiveUserId = isStaff ? (payload.userId || payload._verifiedUserId) : (payload._verifiedUserId || payload.userId);
  var sheet = getOrCreateSheet('FEEDBACK');
  var id = 'FBD-' + Date.now();
  sheet.appendRow([id, defaultDash(effectiveUserId), sanitizeInput(payload.userName), sanitizeInput(payload.category), sanitizeInput(payload.message), new Date().toISOString(), '-']);
  DbConnectionManager.markDirty('FEEDBACK');
  invalidateSheetCache('FEEDBACK');
  return { success: true, message: 'Feedback submitted successfully.' };
}

function handleGetFeedbackHistory(payload) {
  var actorRole = String(payload._verifiedRole || '').toLowerCase().trim();
  var isStaff = (actorRole === 'admin' || actorRole === 'superadmin');
  var userId = isStaff ? (payload.userId || payload._verifiedUserId) : (payload._verifiedUserId || payload.userId);
  var feedbackList = getSheetData('FEEDBACK');
  var userFeedback = feedbackList.filter(function(f) { return String(f.UserID) === String(userId); }).reverse();
  
  return {
    success: true,
    feedbackList: userFeedback
  };
}

function handleAdminReplyFeedback(payload) {
  var feedbackId = payload.feedbackId;
  var adminResponse = sanitizeInput(payload.adminResponse);
  
  var sheet = getOrCreateSheet('FEEDBACK');
  var data = sheet.getDataRange().getValues();

  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(feedbackId)) {
      sheet.getRange(i + 1, 7).setValue(adminResponse);
      DbConnectionManager.markDirty('FEEDBACK');
      invalidateSheetCache('FEEDBACK');
      return { success: true, message: 'Admin response saved successfully.' };
    }
  }
  return { success: false, message: 'Feedback item not found.' };
}

function handleGetAdminData(payload) {
  payload = payload || {};
  // Automatically sweep expired batch enrollments into Free Tier before loading Admin Directory
  try { sweepExpiredBatchValiditiesToFreeTier(); } catch (sweepErr) {}
  var users = getSheetData('USERS').map(function(u) {
    var safeUser = {};
    for (var k in u) {
      if (u.hasOwnProperty(k) && k !== 'Password') {
        safeUser[k] = u[k];
      }
    }
    var rawPass = String(u.Password || '').trim();
    var passHashed = isHashedPassword(rawPass);
    var prefs = readUserSettingsFromRow(safeUser, false);
    delete safeUser.UserPreferencesJson;
    safeUser.HasPassword = Boolean(rawPass && rawPass !== '-');
    safeUser.PasswordIsHashed = passHashed;
    safeUser.Password = '';
    safeUser.VisiblePassword = '';
    safeUser.PasswordStatus = passHashed ? 'Encrypted (SHA-256)' : (safeUser.HasPassword ? 'Protected' : 'Not Set');
    safeUser.Batch = normalizeUserBatchesWithFreeTier(safeUser.Batch || 'RP-Trail');
    var roleVal = String(safeUser.Role || 'user').toLowerCase().trim();
    if (isPrimarySuperadminEmail(safeUser.Email)) {
      roleVal = 'superadmin';
    }
    safeUser.Role = roleVal;
    safeUser.AdminPermissions = (safeUser.AdminPermissions && safeUser.AdminPermissions !== '-')
      ? String(safeUser.AdminPermissions)
      : (roleVal === 'superadmin' ? 'ALL' : 'content,analytics,batch-discussion,livetests,users,attendance-matrix,outline-replies,logs,subtabs,evaluation,banner,leaderboard,feedback-admin,enterprise-ops');
    var isVer = Boolean((prefs && prefs.emailVerified === true) || String(safeUser.EmailVerified || '').toLowerCase() === 'yes' || roleVal === 'superadmin');
    var isMobVer = Boolean(roleVal === 'superadmin' || (prefs && prefs.mobileVerified === true) || String(safeUser.MobileVerified || '').toLowerCase() === 'yes');
    safeUser.EmailVerified = isVer;
    safeUser.emailVerified = isVer;
    safeUser.MobileVerified = isMobVer;
    safeUser.mobileVerified = isMobVer;
    var rawPName = (safeUser.ParentName && safeUser.ParentName !== '-') ? String(safeUser.ParentName).trim() : String((prefs && prefs.parentName) || '').trim();
    var rawPMob = (safeUser.ParentMobile && safeUser.ParentMobile !== '-') ? String(safeUser.ParentMobile).trim() : String((prefs && prefs.parentMobile) || '').trim();
    var rawPEmail = (safeUser.ParentEmail && safeUser.ParentEmail !== '-') ? String(safeUser.ParentEmail).trim() : String((prefs && prefs.parentEmail) || '').trim();
    safeUser.ParentName = rawPName || String(safeUser.Name || '');
    safeUser.ParentMobile = rawPMob || String(safeUser.Mobile || '');
    safeUser.ParentEmail = rawPEmail || String(safeUser.Email || '');
    safeUser.ParentIsFallback = !(rawPName || rawPMob || rawPEmail);
    safeUser.EnrollmentValidUntil = (safeUser.BatchValidUntil && safeUser.BatchValidUntil !== '-') ? String(safeUser.BatchValidUntil) : ((prefs && prefs.enrollmentValidUntil) ? String(prefs.enrollmentValidUntil) : '');
    safeUser.MembershipPlan = (safeUser.MembershipPlan && safeUser.MembershipPlan !== '-') ? String(safeUser.MembershipPlan) : ((prefs && prefs.membershipPlan) ? String(prefs.membershipPlan) : (roleVal === 'member' ? 'Member All-Access Pass' : 'Standard'));
    safeUser.MembershipValidUntil = (safeUser.MembershipValidUntil && safeUser.MembershipValidUntil !== '-') ? String(safeUser.MembershipValidUntil) : ((prefs && prefs.membershipValidUntil) ? String(prefs.membershipValidUntil) : '');
    safeUser.MemberAccessScope = String((prefs && prefs.memberAccessScope) || (safeUser.MemberAccessScope && safeUser.MemberAccessScope !== '-' ? safeUser.MemberAccessScope : '') || (roleVal === 'member' ? 'ALL_PAST_CURRENT_UPCOMING' : ''));
    safeUser.MemberIncludedBatches = String((prefs && prefs.memberIncludedBatches) || (safeUser.MemberIncludedBatches && safeUser.MemberIncludedBatches !== '-' ? safeUser.MemberIncludedBatches : '') || '');
    safeUser.MemberIncludeUpcoming = Boolean((prefs && prefs.memberIncludeUpcoming === true) || String(safeUser.MemberIncludeUpcoming || '').toLowerCase() === 'yes');
    safeUser.MemberJoinDate = String((prefs && prefs.memberJoinDate) || (safeUser.MemberJoinDate && safeUser.MemberJoinDate !== '-' ? safeUser.MemberJoinDate : '') || '');
    safeUser.IsMemberAllAccess = isMemberAllAccessActive(roleVal, prefs, safeUser);
    safeUser.FeeStatus = (safeUser.FeeStatus && safeUser.FeeStatus !== '-') ? String(safeUser.FeeStatus) : ((prefs && prefs.feeStatus) ? String(prefs.feeStatus) : (safeUser.IsMemberAllAccess ? 'Member Active' : 'Free (RP-Trail)'));
    safeUser.StudentTabPermissions = (safeUser.StudentTabPermissions && safeUser.StudentTabPermissions !== '-') ? String(safeUser.StudentTabPermissions) : String((prefs && prefs.allowedPortalTabs) || 'ALL');
    safeUser.AutoSwitchedToFreeTier = Boolean(prefs && prefs.autoSwitchedToFreeTier === true);
    safeUser.PreviousBatch = (prefs && prefs.previousBatch) ? String(prefs.previousBatch) : '';
    safeUser.OnboardedViaCsv = Boolean(prefs && prefs.onboardedViaCsv === true);
    safeUser.AllDevicesLocked = Boolean((prefs && prefs.allDevicesLocked === true) || String(safeUser.Status || '').toLowerCase() === 'locked');
    safeUser.DeviceBindingStrict = Boolean(prefs && prefs.deviceBindingStrict === true);
    safeUser.BoundDeviceId = (prefs && prefs.boundDeviceId) ? String(prefs.boundDeviceId) : '';
    safeUser.ActiveDeviceId = (prefs && prefs.activeDeviceId) ? String(prefs.activeDeviceId) : '';
    return safeUser;
  });

  // Server-side pagination & date-windowing for ACTIVITY_LOGS and TEST_HISTORY to keep load fast at scale
  var daysWindow = Math.max(0, parseInt(payload.daysWindow || 0, 10) || 0);
  var cutoffMs = daysWindow > 0 ? (Date.now() - daysWindow * 24 * 60 * 60 * 1000) : 0;

  var allLogs = getSheetData('ACTIVITY_LOGS').slice().reverse();
  if (cutoffMs > 0) {
    allLogs = allLogs.filter(function(l) {
      var ts = new Date(l.Timestamp || l.Date || 0).getTime();
      return !isNaN(ts) && ts >= cutoffMs;
    });
  }
  var totalLogsCount = allLogs.length;
  var violationCount = allLogs.filter(function(l) { return l.ActivityType === 'SECURITY_VIOLATION'; }).length;
  var logsPage = Math.max(1, parseInt(payload.logsPage || 1, 10) || 1);
  var logsLimit = Math.min(500, Math.max(25, parseInt(payload.logsLimit || 150, 10) || 150));
  var logsStart = (logsPage - 1) * logsLimit;
  var logs = allLogs.slice(logsStart, logsStart + logsLimit);

  var feedback = getSheetData('FEEDBACK').slice().reverse();
  var materials = getSheetData('MATERIALS');

  var allHistory = getSheetData('TEST_HISTORY').slice().reverse();
  if (cutoffMs > 0) {
    allHistory = allHistory.filter(function(h) {
      var ts = new Date(h.Date || h.Timestamp || 0).getTime();
      return !isNaN(ts) && ts >= cutoffMs;
    });
  }
  var totalHistoryCount = allHistory.length;
  var historyPage = Math.max(1, parseInt(payload.historyPage || 1, 10) || 1);
  var historyLimit = Math.min(500, Math.max(25, parseInt(payload.historyLimit || 150, 10) || 150));
  var historyStart = (historyPage - 1) * historyLimit;
  var history = allHistory.slice(historyStart, historyStart + historyLimit).map(projectLightweightHistoryRow);

  var homework = getSheetData('HOMEWORK').map(function(h) {
    return { ID: h.ID, Type: 'homework', Title: h.Title, Subtab: h.TargetDate || '-', ContentOrUrl: h.Details || '-', AccessLevel: 'public' };
  });

  var announcements = getSheetData('ANNOUNCEMENTS').map(function(a) {
    return { ID: a.ID, Type: 'announcement', Title: a.Title, Subtab: '-', ContentOrUrl: a.Content || '-', AccessLevel: 'public' };
  });

  var allMaterials = materials.concat(homework).concat(announcements);
  var subtabs = getSheetData('SUBTABS');
  var settings = getSheetData('SETTINGS');
  var feeLedger = getSheetData('FEE_LEDGER').slice().reverse().map(function(r) {
    var c = {};
    for (var rk in r) { if (r.hasOwnProperty(rk)) c[rk] = r[rk]; }
    c.Status = normalizeFeeStatusLabel(r.Status);
    return c;
  });

  var banner = parseBannerSettings(settings);
  var dashboardCustomBanner = parseDashboardCustomBannerSettings(settings);
  var dateSpecificBanners = parseDateSpecificBannersSettings(settings);
  var scheduledLiveTests = parseScheduledLiveTestsSettings(settings);
  var instituteBatches = parseInstituteBatchesSettings(settings);
  var batchValidityMap = parseBatchValidityMapSettings(settings);
  var batchMetaMap = parseInstituteBatchesMetaSettings(settings);
  var maintenance = parseMaintenanceSettings(settings);
  var feeConfig = parseFeeConfigSettings(settings);

  var evalRulesRes = handleGetEvaluationRules({});
  var evaluationRulesMap = evalRulesRes.rulesMap || {};

  var batchMonitors = parseBatchMonitorsSettings(settings);
  var batchGroupMessages = parseBatchGroupMessagesSettings(settings);
  var contentAutoDeletePolicy = parseContentAutoDeletePolicy(settings);

  // Build uncapped per-user daily attendance map across TEST_HISTORY, DAILY_GOALS, and ACTIVITY_LOGS
  var rawFullHistoryForAtt = getSheetData('TEST_HISTORY');
  var rawDailyGoalsForAtt = getSheetData('DAILY_GOALS');
  var rawLogsForAtt = getSheetData('ACTIVITY_LOGS');
  var attendanceActivityMap = {};
  var extractIsoDateOnly = function(rawVal) {
    if (!rawVal) return '';
    if (rawVal instanceof Date && !isNaN(rawVal.getTime())) {
      return Utilities.formatDate(rawVal, DbConnectionManager.getTimeZone(), 'yyyy-MM-dd');
    }
    var s = String(rawVal).trim();
    var m = s.match(/^(\d{4}-\d{2}-\d{2})/);
    if (m) return m[1];
    var parsed = new Date(s);
    if (!isNaN(parsed.getTime())) {
      return Utilities.formatDate(parsed, DbConnectionManager.getTimeZone(), 'yyyy-MM-dd');
    }
    return '';
  };
  var recordAttHit = function(uidVal, nameVal, dateVal, weight) {
    var iso = extractIsoDateOnly(dateVal);
    if (!iso) return;
    var w = Number(weight || 1) || 1;
    var keys = [];
    var uKey = String(uidVal || '').toLowerCase().trim();
    var nKey = String(nameVal || '').toLowerCase().trim();
    if (uKey && uKey !== '-' && uKey !== 'guest') keys.push(uKey);
    if (nKey && nKey !== '-' && nKey !== 'anonymous' && nKey !== uKey) keys.push(nKey);
    for (var k = 0; k < keys.length; k++) {
      var bucket = keys[k];
      if (!attendanceActivityMap[bucket]) attendanceActivityMap[bucket] = {};
      attendanceActivityMap[bucket][iso] = (attendanceActivityMap[bucket][iso] || 0) + w;
    }
  };
  for (var hi = 0; hi < rawFullHistoryForAtt.length; hi++) {
    var hRow = rawFullHistoryForAtt[hi];
    recordAttHit(hRow.UserID || hRow.userId, hRow.UserName || hRow.userName || hRow.Name, hRow.Timestamp || hRow.Date || hRow.TypingDate, 1);
  }
  for (var gi = 0; gi < rawDailyGoalsForAtt.length; gi++) {
    var gRow = rawDailyGoalsForAtt[gi];
    var gWords = Number(gRow.WordsCompleted || 0);
    var gTests = Number(gRow.TestsCount || 0);
    if (gWords > 0 || gTests > 0) {
      recordAttHit(gRow.UserID || gRow.userId, gRow.UserName || gRow.userName, gRow.Date || gRow.UpdatedAt, Math.max(1, gTests));
    }
  }
  for (var li = 0; li < rawLogsForAtt.length; li++) {
    var lRow = rawLogsForAtt[li];
    var actType = String(lRow.ActivityType || '').toUpperCase().trim();
    if (actType === 'LOGIN' || actType === 'TEST_SUBMITTED' || actType === 'PRACTICE_COMPLETE' || actType === 'SHORTHAND_PAD_UPLOAD') {
      var cleanActorName = String(lRow.UserName || '').replace(/\s*\([^)]*\)\s*$/, '').trim();
      recordAttHit(lRow.UserID || lRow.userId, cleanActorName, lRow.Timestamp || lRow.Date, 1);
    }
  }

  return {
    success: true,
    users: users,
    totalUsersCount: users.length,
    logs: logs,
    totalLogsCount: totalLogsCount,
    logsPage: logsPage,
    logsLimit: logsLimit,
    logsTotalPages: Math.max(1, Math.ceil(totalLogsCount / logsLimit)),
    logsHasMore: (logsStart + logsLimit) < totalLogsCount,
    feedback: feedback,
    materials: allMaterials,
    subtabs: subtabs,
    banner: banner,
    dashboardCustomBanner: dashboardCustomBanner,
    dateSpecificBanners: dateSpecificBanners,
    scheduledLiveTests: scheduledLiveTests,
    instituteBatches: instituteBatches,
    batchValidityMap: batchValidityMap,
    batchMetaMap: batchMetaMap,
    maintenance: maintenance,
    feeConfig: feeConfig,
    feeLedger: feeLedger,
    history: history,
    attendanceActivityMap: attendanceActivityMap,
    totalHistoryCount: totalHistoryCount,
    historyPage: historyPage,
    historyTotalPages: Math.max(1, Math.ceil(totalHistoryCount / historyLimit)),
    daysWindow: daysWindow,
    historyLimit: historyLimit,
    historyHasMore: (historyStart + historyLimit) < totalHistoryCount,
    violationCount: violationCount,
    evaluationRulesMap: evaluationRulesMap,
    batchMonitors: batchMonitors,
    batchMonitorsMap: batchMonitors,
    batchGroupMessages: batchGroupMessages,
    contentAutoDeletePolicy: contentAutoDeletePolicy
  };
}

function handleAdminUpdateUserDetails(payload) {
  var targetUserId = String(payload.targetUserId || payload.userId || '').trim();
  if (!targetUserId) {
    return { success: false, message: 'Target UserID is required.' };
  }

  var requesterRole = String(payload._verifiedRole || 'user').toLowerCase().trim();
  var requesterId = String(payload._verifiedUserId || payload.requesterId || '').trim();
  if (requesterRole !== 'admin' && requesterRole !== 'superadmin') {
    return { success: false, message: 'Unauthorized: Only an Admin or Superadmin can edit user details.' };
  }

  var userSheet = getOrCreateSheet('USERS');
  var users = getSheetData('USERS');
  var headers = SHEET_SCHEMAS['USERS'];
  var targetIdx = -1;
  for (var i = 0; i < users.length; i++) {
    if (String(users[i].UserID) === targetUserId) {
      targetIdx = i;
      break;
    }
  }
  if (targetIdx === -1) {
    return { success: false, message: 'User account not found.' };
  }

  var targetUser = users[targetIdx];
  var targetRole = isPrimarySuperadminEmail(targetUser.Email) ? 'superadmin' : String(targetUser.Role || 'user').toLowerCase().trim();
  if ((targetRole === 'admin' || targetRole === 'superadmin') && requesterRole !== 'superadmin') {
    return { success: false, message: 'Only a Superadmin can edit Admin or Superadmin account details.' };
  }

  var newName = payload.name !== undefined ? sanitizeInput(String(payload.name).trim()) : String(targetUser.Name || '');
  var newEmail = payload.email !== undefined ? String(payload.email).toLowerCase().trim() : String(targetUser.Email || '').toLowerCase().trim();
  var newMobile = payload.mobile !== undefined ? String(payload.mobile).replace(/[^0-9]/g, '').slice(-10) : String(targetUser.Mobile || '').replace(/[^0-9]/g, '').slice(-10);
  var newPassword = payload.newPassword !== undefined ? String(payload.newPassword).trim() : '';

  if (!newName || newName.length < 2) {
    return { success: false, message: 'Full Name must be at least 2 characters.' };
  }
  if (!newEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
    return { success: false, message: 'Please enter a valid Email ID.' };
  }
  if (!newMobile || !/^\d{10}$/.test(newMobile)) {
    return { success: false, message: 'Please enter a valid 10-digit Mobile Number.' };
  }
  if (newPassword && !isValidPassword(newPassword)) {
    return { success: false, message: 'New password must be at least 4 characters long.' };
  }

  for (var j = 0; j < users.length; j++) {
    if (j === targetIdx) continue;
    var otherEmail = String(users[j].Email || '').toLowerCase().trim();
    var otherMobile = String(users[j].Mobile || '').replace(/[^0-9]/g, '').slice(-10);
    if (otherEmail && otherEmail === newEmail) {
      return { success: false, message: 'Another user is already registered with Email: ' + newEmail };
    }
    if (otherMobile && otherMobile === newMobile) {
      return { success: false, message: 'Another user is already registered with Mobile: ' + newMobile };
    }
  }

  var rowIndex = targetIdx + 2;
  var nameCol = headers.indexOf('Name') + 1 || 2;
  var emailCol = headers.indexOf('Email') + 1 || 3;
  var mobileCol = headers.indexOf('Mobile') + 1 || 4;
  var passCol = headers.indexOf('Password') + 1 || 5;

  userSheet.getRange(rowIndex, nameCol).setValue(newName);
  userSheet.getRange(rowIndex, emailCol).setValue(newEmail);
  userSheet.getRange(rowIndex, mobileCol).setValue(newMobile);
  if (newPassword) {
    userSheet.getRange(rowIndex, passCol).setValue(hashPasswordWithSalt(newPassword));
    var sessCol = headers.indexOf('SessionToken') + 1;
    if (sessCol > 0) {
      userSheet.getRange(rowIndex, sessCol).setValue('');
    }
    try {
      CacheService.getScriptCache().remove('ACTIVE_SESS_' + targetUserId);
    } catch (sessCacheErr) {}
  }

  var prefs = readUserSettingsFromRow(targetUser, false);
  delete prefs.adminVisiblePassword;
  if (payload.emailVerified !== undefined) prefs.emailVerified = Boolean(payload.emailVerified);
  if (payload.mobileVerified !== undefined) prefs.mobileVerified = Boolean(payload.mobileVerified);
  if (payload.parentName !== undefined) prefs.parentName = sanitizeInput(String(payload.parentName || '').trim());
  if (payload.parentMobile !== undefined) prefs.parentMobile = String(payload.parentMobile || '').replace(/[^0-9]/g, '').slice(-10);
  if (payload.parentEmail !== undefined) prefs.parentEmail = String(payload.parentEmail || '').toLowerCase().trim();
  if (payload.feeStatus !== undefined) prefs.feeStatus = sanitizeInput(String(payload.feeStatus || '').trim());
  if (payload.membershipValidUntil !== undefined) prefs.membershipValidUntil = String(payload.membershipValidUntil || '').trim();
  if (payload.memberAccessScope !== undefined) prefs.memberAccessScope = String(payload.memberAccessScope || '').trim();
  if (payload.memberIncludedBatches !== undefined) prefs.memberIncludedBatches = payload.memberIncludedBatches;
  if (payload.memberIncludeUpcoming !== undefined) prefs.memberIncludeUpcoming = Boolean(payload.memberIncludeUpcoming);
  syncUserReadableColumns(userSheet, rowIndex, {
    UserID: targetUserId,
    Name: newName,
    Email: newEmail,
    Mobile: newMobile,
    Role: targetRole,
    VisiblePassword: '-'
  }, prefs);

  invalidateSheetCache('USERS');
  handleLogActivity({
    userId: requesterId || 'ADMIN',
    userName: payload.actorName || 'Admin/Superadmin',
    activityType: 'ADMIN_USER_EDIT',
    details: 'Updated user ' + targetUserId + ' (Name: ' + newName + ', Email: ' + newEmail + ', Mobile: ' + newMobile + (newPassword ? ', Password Reset & Session Revoked' : '') + ')'
  });

  return {
    success: true,
    message: 'User details updated successfully' + (newPassword ? ' (Password reset & active sessions revoked).' : '.'),
    updatedUser: {
      UserID: targetUserId,
      Name: newName,
      Email: newEmail,
      Mobile: newMobile,
      Password: '',
      VisiblePassword: '',
      ParentName: String(prefs.parentName || '').trim() || newName,
      ParentMobile: String(prefs.parentMobile || '').trim() || newMobile,
      ParentEmail: String(prefs.parentEmail || '').trim() || newEmail,
      EmailVerified: Boolean(prefs.emailVerified),
      MobileVerified: Boolean(prefs.mobileVerified),
      PasswordIsHashed: newPassword ? true : isHashedPassword(targetUser.Password),
      PasswordStatus: 'Encrypted (SHA-256)'
    }
  };
}

function handleUpdateUserRoleStatus(payload) {
  var targetUserId = payload.targetUserId;
  var newRole = payload.newRole ? String(payload.newRole).toLowerCase().trim() : '';
  var newStatus = payload.newStatus ? String(payload.newStatus).toLowerCase().trim() : '';
  var adminPermissions = payload.adminPermissions;
  var studentTabPermissions = payload.studentTabPermissions;
  var userBatch = payload.batch || payload.targetBatch || payload.batchName;

  var userSheet = getOrCreateSheet('USERS');
  var users = getSheetData('USERS');
  var headers = SHEET_SCHEMAS['USERS'];

  for (var i = 0; i < users.length; i++) {
    if (String(users[i].UserID) === String(targetUserId)) {
      var rowIndex = i + 2;
      var targetEmail = String(users[i].Email || '').toLowerCase().trim();
      if (isPrimarySuperadminEmail(targetEmail) && newRole && newRole !== 'superadmin') {
        return { success: false, message: 'Primary Superadmin role cannot be downgraded.' };
      }
      var currentTargetRole = String(users[i].Role || 'user').toLowerCase().trim();
      var requesterId = String(payload._verifiedUserId || payload.requesterId || payload.authUserId || payload.actorId || '').trim();
      var requesterRole = String(payload._verifiedRole || 'user').toLowerCase().trim();
      if (requesterRole === 'user' && requesterId) {
        for (var rIdx = 0; rIdx < users.length; rIdx++) {
          if (String(users[rIdx].UserID) === requesterId) {
            requesterRole = isPrimarySuperadminEmail(users[rIdx].Email)
              ? 'superadmin'
              : String(users[rIdx].Role || 'user').toLowerCase().trim();
            break;
          }
        }
      }
      if (requesterRole !== 'admin' && requesterRole !== 'superadmin') {
        return { success: false, message: 'Unauthorized: Only an Admin or Superadmin can update user accounts.' };
      }
      if ((currentTargetRole === 'admin' || currentTargetRole === 'superadmin' || newRole === 'admin' || newRole === 'superadmin') && requesterRole !== 'superadmin' && !userBatch && studentTabPermissions === undefined) {
        return { success: false, message: 'Only a Superadmin can promote, demote, or modify Admin/Superadmin accounts.' };
      }
      if (newRole) userSheet.getRange(rowIndex, 6).setValue(newRole);
      if (newStatus) {
        userSheet.getRange(rowIndex, 7).setValue(newStatus);
        var roleCache = DbConnectionManager.getCache();
        if (newStatus === 'blocked') {
          userSheet.getRange(rowIndex, 8).setValue('BLOCKED-' + Date.now());
          if (roleCache) {
            roleCache.put('BLOCKED_USER_' + targetUserId, 'true', 21600);
            roleCache.remove('ACTIVE_SESS_' + targetUserId);
          }
        } else if (newStatus === 'active' && roleCache) {
          roleCache.remove('BLOCKED_USER_' + targetUserId);
        }
      }
      if (adminPermissions !== undefined) {
        var admCol = headers.indexOf('AdminPermissions') + 1 || 10;
        userSheet.getRange(rowIndex, admCol).setValue(String(adminPermissions));
      }
      if (userBatch !== undefined) {
        var batchCol = headers.indexOf('Batch') + 1 || 11;
        userSheet.getRange(rowIndex, batchCol).setValue(normalizeUserBatchesWithFreeTier(userBatch));
      }
      if (studentTabPermissions !== undefined || payload.allDevicesLocked !== undefined || payload.deviceBindingStrict !== undefined || payload.resetDeviceLock === true || newRole === 'member' || payload.memberAccessScope !== undefined) {
        var existingPrefs = readUserSettingsFromRow(users[i], false);
        if (studentTabPermissions !== undefined) {
          existingPrefs.allowedPortalTabs = studentTabPermissions;
        }
        if (newRole === 'member' || payload.memberAccessScope !== undefined) {
          existingPrefs.membershipPlan = sanitizeInput(String(payload.membershipPlan || existingPrefs.membershipPlan || 'Member All-Access Pass').trim());
          existingPrefs.memberAccessScope = String(payload.memberAccessScope || existingPrefs.memberAccessScope || 'ALL_PAST_CURRENT_UPCOMING').toUpperCase().trim();
          if (payload.memberIncludedBatches !== undefined) {
            existingPrefs.memberIncludedBatches = Array.isArray(payload.memberIncludedBatches)
              ? payload.memberIncludedBatches.map(function(x) { return String(x || '').trim(); }).filter(Boolean).join(', ')
              : String(payload.memberIncludedBatches || '').trim();
          }
          if (payload.memberIncludeUpcoming !== undefined) {
            existingPrefs.memberIncludeUpcoming = Boolean(payload.memberIncludeUpcoming);
          } else {
            existingPrefs.memberIncludeUpcoming = (existingPrefs.memberAccessScope === 'ALL_PAST_CURRENT_UPCOMING' || existingPrefs.memberAccessScope === 'CURRENT_AND_UPCOMING');
          }
          existingPrefs.memberJoinDate = String(payload.memberJoinDate || existingPrefs.memberJoinDate || Utilities.formatDate(new Date(), DbConnectionManager.getTimeZone(), 'yyyy-MM-dd')).trim();
          if (payload.membershipValidUntil !== undefined) {
            existingPrefs.membershipValidUntil = String(payload.membershipValidUntil || '').trim();
          }
          existingPrefs.feeStatus = 'Member (' + existingPrefs.membershipPlan + (existingPrefs.membershipValidUntil && existingPrefs.membershipValidUntil !== '-' ? (' till ' + existingPrefs.membershipValidUntil) : '') + ')';
        }
        if (payload.allDevicesLocked !== undefined) {
          existingPrefs.allDevicesLocked = Boolean(payload.allDevicesLocked);
          var lockCache = DbConnectionManager.getCache();
          if (existingPrefs.allDevicesLocked) {
            userSheet.getRange(rowIndex, 8).setValue('LOCKED-' + Date.now());
            if (lockCache) {
              lockCache.put('LOCKED_USER_' + targetUserId, 'true', 21600);
              lockCache.remove('ACTIVE_SESS_' + targetUserId);
              lockCache.remove('ACTIVE_DEV_' + targetUserId);
            }
          } else if (lockCache) {
            lockCache.remove('LOCKED_USER_' + targetUserId);
          }
        }
        if (payload.deviceBindingStrict !== undefined) {
          existingPrefs.deviceBindingStrict = Boolean(payload.deviceBindingStrict);
        }
        if (payload.resetDeviceLock === true) {
          existingPrefs.boundDeviceId = '';
          existingPrefs.activeDeviceId = '';
        }
        if (newRole) users[i].Role = newRole;
        syncUserReadableColumns(userSheet, rowIndex, users[i], existingPrefs);
      }
      invalidateSheetCache('USERS');
      handleLogActivity({
        userId: payload.actorId || 'SUPERADMIN',
        userName: payload.actorName || ('Role: ' + requesterRole.toUpperCase()),
        activityType: 'USER_PERMISSION_CHANGE',
        details: 'Updated user ' + users[i].Name + ' (' + targetUserId + ') -> Role: ' + (newRole || currentTargetRole) + ', Status: ' + (newStatus || users[i].Status) + ', Batch: ' + (userBatch || users[i].Batch || 'ALL_BATCHES')
      });
      return { success: true, message: 'User role, status, device lock, batch & tab access permissions updated successfully.' };
    }
  }
  return { success: false, message: 'User not found.' };
}

function handleLockUserDevices(payload) {
  var targetUserId = String(payload.targetUserId || payload.userId || '').trim();
  if (!targetUserId) {
    return { success: false, message: 'Target User ID is required.' };
  }
  var lockModeUpper = String(payload.lockMode || '').toUpperCase().trim();
  var hasExplicitLockAll = payload.lockAllDevices !== undefined || lockModeUpper === 'LOCK_ALL' || lockModeUpper === 'UNLOCK';
  var lockAll = payload.lockAllDevices !== undefined
    ? Boolean(payload.lockAllDevices)
    : (lockModeUpper === 'LOCK_ALL');
  var strictBind = payload.deviceBindingStrict !== undefined ? Boolean(payload.deviceBindingStrict) : undefined;
  var resetDevice = Boolean(payload.resetDeviceLock);
  var forceLogoutAll = Boolean(payload.forceLogoutAllDevices);

  var userSheet = getOrCreateSheet('USERS');
  var users = getSheetData('USERS');
  var headers = SHEET_SCHEMAS['USERS'];
  var cache = DbConnectionManager.getCache();

  for (var i = 0; i < users.length; i++) {
    if (String(users[i].UserID) === targetUserId) {
      var rowIndex = i + 2;
      var prefs = readUserSettingsFromRow(users[i], false);
      if (hasExplicitLockAll) {
        prefs.allDevicesLocked = lockAll;
      }
      if (strictBind !== undefined) {
        prefs.deviceBindingStrict = strictBind;
      }
      if (resetDevice) {
        prefs.boundDeviceId = '';
        prefs.activeDeviceId = '';
      }
      if (lockAll || forceLogoutAll) {
        userSheet.getRange(rowIndex, 8).setValue('LOCKED-' + Date.now());
        if (lockAll) {
          userSheet.getRange(rowIndex, 7).setValue('locked');
        }
        if (cache) {
          if (lockAll) cache.put('LOCKED_USER_' + targetUserId, 'true', 21600);
          cache.remove('ACTIVE_SESS_' + targetUserId);
          cache.remove('ACTIVE_DEV_' + targetUserId);
        }
      } else if (hasExplicitLockAll && !lockAll) {
        if (String(users[i].SessionToken || '').indexOf('LOCKED-') === 0) {
          userSheet.getRange(rowIndex, 8).setValue('-');
        }
        if (String(users[i].Status || '').toLowerCase().trim() === 'locked') {
          userSheet.getRange(rowIndex, 7).setValue('active');
        }
        if (cache) {
          cache.remove('LOCKED_USER_' + targetUserId);
        }
      }
      syncUserReadableColumns(userSheet, rowIndex, users[i], prefs);
      invalidateSheetCache('USERS');

      handleLogActivity({
        userId: payload.actorId || 'ADMIN',
        userName: payload.actorName || 'Admin/Superadmin',
        activityType: 'CROSS_DEVICE_USER_LOCK',
        details: 'Device lock updated for ' + (users[i].Name || targetUserId) + ': LockAllDevices=' + Boolean(prefs.allDevicesLocked) + ', StrictSingleDeviceBind=' + Boolean(prefs.deviceBindingStrict)
      });

      return {
        success: true,
        targetUserId: targetUserId,
        allDevicesLocked: Boolean(prefs.allDevicesLocked),
        deviceBindingStrict: Boolean(prefs.deviceBindingStrict),
        boundDeviceId: prefs.boundDeviceId || '',
        message: lockAll
          ? ('🔒 Locked ' + (users[i].Name || targetUserId) + ' across ALL devices immediately.')
          : (forceLogoutAll ? '⚡ Terminated active sessions across all devices.' : '🔓 Device lock settings updated successfully.')
      };
    }
  }
  return { success: false, message: 'User not found.' };
}

function updateMaterialsSubtabName(oldType, oldSubtabName, newType, newSubtabName) {
  var matSheet = DbConnectionManager.getSheet('MATERIALS');
  if (!matSheet) return;

  var data = matSheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    var rowType = String(data[i][1] || '').trim();
    var rowSubtab = String(data[i][2] || '').trim();

    if (rowType.toLowerCase() === oldType.toLowerCase() && rowSubtab.toLowerCase() === oldSubtabName.toLowerCase()) {
      matSheet.getRange(i + 1, 2).setValue(newType);
      matSheet.getRange(i + 1, 3).setValue(sanitizeInput(newSubtabName));
    }
  }
  invalidateSheetCache('MATERIALS');
}

function handleManageSubtab(payload) {
  var action = payload.subAction; 
  var sheet = getOrCreateSheet('SUBTABS');

  if (action === 'add') {
    sheet.appendRow(['STB-' + Date.now(), String(payload.type || '').trim(), sanitizeInput(String(payload.subtabName || '').trim())]);
    invalidateSheetCache('SUBTABS');
    return { success: true, message: 'Subtab / Exam category added successfully.' };
  } else if (action === 'edit') {
    var data = sheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      var matchId = payload.id && String(data[i][0]) === String(payload.id);
      var matchTypeAndName = String(data[i][1]).toLowerCase() === String(payload.type || '').toLowerCase() && 
                             String(data[i][2]).toLowerCase() === String(payload.oldSubtabName || '').toLowerCase();

      if (matchId || matchTypeAndName) {
        var oldSubtabName = String(data[i][2]).trim();
        var oldType = String(data[i][1]).trim();

        if (payload.newSubtabName) {
          sheet.getRange(i + 1, 3).setValue(sanitizeInput(String(payload.newSubtabName).trim()));
        }
        if (payload.newType) {
          sheet.getRange(i + 1, 2).setValue(String(payload.newType).trim());
        }

        var newSubtabName = payload.newSubtabName ? String(payload.newSubtabName).trim() : oldSubtabName;
        var newType = payload.newType ? String(payload.newType).trim() : oldType;

        if (newSubtabName !== oldSubtabName || newType !== oldType) {
          updateMaterialsSubtabName(oldType, oldSubtabName, newType, newSubtabName);
        }

        invalidateSheetCache('SUBTABS');
        return { success: true, message: 'Subtab updated successfully.' };
      }
    }
    return { success: false, message: 'Subtab record not found for update.' };
  } else if (action === 'delete') {
    var data = sheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      var matchId = String(data[i][0]) === String(payload.id);
      var matchTypeAndName = String(data[i][1]).toLowerCase() === String(payload.type || '').toLowerCase() && 
                             String(data[i][2]).toLowerCase() === String(payload.subtabName || '').toLowerCase();
      
      if (matchId || matchTypeAndName) {
        sheet.deleteRow(i + 1);
        invalidateSheetCache('SUBTABS');
        return { success: true, message: 'Subtab deleted successfully.' };
      }
    }
    return { success: false, message: 'Subtab record not found for deletion.' };
  }
  return { success: false, message: 'Invalid subtab operation action.' };
}

function handleUpdateBannerSettings(payload) {
  var sheet = getOrCreateSheet('SETTINGS');

  var data = sheet.getDataRange().getValues();
  var rowsMap = {};

  for (var i = 1; i < data.length; i++) {
    rowsMap[String(data[i][0]).toUpperCase().trim()] = i + 1;
  }

  var isEnabled = (payload.enabled === true || String(payload.enabled).toLowerCase() === 'true' || String(payload.enabled) === '1');
  var stopTime = (payload.stopTime !== undefined && payload.stopTime !== null && String(payload.stopTime).trim() !== '') ? String(payload.stopTime) : '-';

  // Auto-disable if stopTime is already in the past
  if (stopTime !== '-') {
    var stopDate = new Date(stopTime);
    if (!isNaN(stopDate.getTime()) && new Date() > stopDate) {
      isEnabled = false;
    }
  }

  var bannerText = (payload.text !== undefined && payload.text !== null && String(payload.text).trim() !== '') ? sanitizeInput(String(payload.text)) : '-';
  var sameForBoth = (payload.sameForBoth === true || String(payload.sameForBoth).toLowerCase() === 'true' || String(payload.bannerMode || '').toLowerCase().trim() === 'same');
  var bannerMode = sameForBoth ? 'same' : 'different';
  var rawLogoutText = (payload.loggedOutText !== undefined && payload.loggedOutText !== null && String(payload.loggedOutText).trim() !== '')
    ? sanitizeInput(String(payload.loggedOutText))
    : '-';
  var logoutBannerText = sameForBoth ? bannerText : rawLogoutText;
  var startTime = (payload.startTime !== undefined && payload.startTime !== null && String(payload.startTime).trim() !== '') ? String(payload.startTime) : '-';

  var settingsUpdates = {
    'BANNER_ENABLED': isEnabled,
    'BANNER_TEXT': bannerText,
    'LOGOUT_BANNER_TEXT': logoutBannerText,
    'BANNER_SAME_FOR_BOTH': sameForBoth,
    'BANNER_MODE': bannerMode,
    'BANNER_START_TIME': startTime,
    'BANNER_STOP_TIME': stopTime
  };

  for (var key in settingsUpdates) {
    if (rowsMap[key]) {
      sheet.getRange(rowsMap[key], 2).setValue(settingsUpdates[key]);
    } else {
      sheet.appendRow([key, settingsUpdates[key]]);
    }
  }

  try { SpreadsheetApp.flush(); } catch (flushErr) {}
  invalidateSheetCache('SETTINGS');
  handleLogActivity({
    userId: payload.actorId || 'ADMIN',
    userName: payload.actorName || 'Admin/Superadmin',
    activityType: 'BANNER_TOGGLE',
    details: 'Banner ' + (isEnabled ? 'ENABLED' : 'DISABLED') + ' | Mode: ' + bannerMode + ' | Logged-In: "' + bannerText + '" | Logged-Out: "' + logoutBannerText + '" | Window: ' + startTime + ' to ' + stopTime
  });
  return {
    success: true,
    banner: {
      enabled: isEnabled,
      text: bannerText,
      loggedOutText: logoutBannerText,
      sameForBoth: sameForBoth,
      bannerMode: bannerMode,
      startTime: startTime,
      stopTime: stopTime,
      expired: false
    },
    message: isEnabled
      ? (sameForBoth ? 'Same scrolling banner saved for both Logged-In & Logged-Out users.' : 'Logged-In & Logged-Out scrolling banners saved and active.')
      : 'Banner saved as Disabled (or stop time expired).'
  };
}

function handleUpdateDashboardCustomBanner(payload) {
  var sheet = getOrCreateSheet('SETTINGS');
  var data = sheet.getDataRange().getValues();
  var rowIdx = 0;
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]).toUpperCase().trim() === 'DASHBOARD_CUSTOM_BANNER_JSON') {
      rowIdx = i + 1;
      break;
    }
  }
  var rawSlides = Array.isArray(payload.slides) ? payload.slides : [];
  var cleanSlides = [];
  for (var j = 0; j < Math.min(rawSlides.length, 15); j++) {
    var sl = rawSlides[j] || {};
    var sImg = String(sl.imageUrl || '').trim();
    var sTitle = String(sl.title || '').trim();
    var sText = String(sl.text || '').trim();
    if (sImg || sTitle || sText) {
      cleanSlides.push({
        imageUrl: sImg,
        title: sTitle,
        text: sText,
        ctaText: String(sl.ctaText || '').trim(),
        ctaLink: String(sl.ctaLink || '').trim()
      });
    }
  }
  if (cleanSlides.length === 0 && (payload.imageUrl || payload.title || payload.text)) {
    cleanSlides.push({
      imageUrl: String(payload.imageUrl || '').trim(),
      title: String(payload.title || '').trim(),
      text: String(payload.text || '').trim(),
      ctaText: String(payload.ctaText || '').trim(),
      ctaLink: String(payload.ctaLink || '').trim()
    });
  }
  var firstSlide = cleanSlides[0] || { imageUrl: '', title: '', text: '', ctaText: '', ctaLink: '' };
  var autoScrollSec = parseInt(payload.autoScrollSeconds || 4, 10);
  if (isNaN(autoScrollSec)) autoScrollSec = 4;
  autoScrollSec = Math.max(2, Math.min(30, autoScrollSec));

  var bannerObj = {
    mode: String(payload.mode || 'hidden'),
    scheduleType: String(payload.scheduleType || (payload.targetDate ? 'specific_date' : 'always')),
    targetDate: String(payload.targetDate || ''),
    imageUrl: firstSlide.imageUrl || String(payload.imageUrl || ''),
    title: firstSlide.title || String(payload.title || ''),
    text: firstSlide.text || String(payload.text || ''),
    ctaText: firstSlide.ctaText || String(payload.ctaText || ''),
    ctaLink: firstSlide.ctaLink || String(payload.ctaLink || ''),
    slides: cleanSlides,
    autoScrollSeconds: autoScrollSec,
    updatedAt: new Date().toISOString()
  };
  var readableBannerStr = formatReadableSheetData(bannerObj, 48500);
  if (rowIdx > 0) {
    sheet.getRange(rowIdx, 2).setValue(readableBannerStr);
  } else {
    sheet.appendRow(['DASHBOARD_CUSTOM_BANNER_JSON', readableBannerStr]);
  }
  invalidateSheetCache('SETTINGS');
  handleLogActivity({
    userId: payload.actorId || 'ADMIN',
    userName: payload.actorName || 'Admin/Superadmin',
    activityType: 'DASHBOARD_BANNER_UPDATE',
    details: 'Updated Dashboard Page Banner (Mode: ' + bannerObj.mode + ', Slides: ' + cleanSlides.length + ', Auto-Scroll: ' + autoScrollSec + 's)'
  });
  return { success: true, dashboardCustomBanner: bannerObj, message: 'Dashboard Banner (' + cleanSlides.length + ' slide(s)) saved successfully.' };
}

function handleUpdateMaintenanceSettings(payload) {
  var sheet = getOrCreateSheet('SETTINGS');
  var data = sheet.getDataRange().getValues();
  var rowsMap = {};
  for (var i = 1; i < data.length; i++) {
    rowsMap[String(data[i][0]).toUpperCase().trim()] = i + 1;
  }

  var isEnabled = (payload.enabled === true || String(payload.enabled).toLowerCase() === 'true' || String(payload.enabled) === '1');
  var mode = payload.mode ? String(payload.mode).trim() : 'full_site';
  var message = (payload.message && String(payload.message).trim() !== '')
    ? sanitizeInput(String(payload.message).trim())
    : '🚧 Our portal is currently undergoing scheduled maintenance and upgrades. Please check back shortly!';
  var workingTabs = Array.isArray(payload.workingTabs) ? payload.workingTabs.join(', ') : (payload.workingTabs || 'dashboard');
  var maintenanceTabs = Array.isArray(payload.maintenanceTabs) ? payload.maintenanceTabs.join(', ') : (payload.maintenanceTabs || '');

  var updates = {
    'MAINTENANCE_ENABLED': isEnabled,
    'MAINTENANCE_MODE': mode,
    'MAINTENANCE_MESSAGE': message,
    'MAINTENANCE_WORKING_TABS': workingTabs,
    'MAINTENANCE_BLOCKED_TABS': maintenanceTabs
  };

  for (var key in updates) {
    if (rowsMap[key]) {
      sheet.getRange(rowsMap[key], 2).setValue(updates[key]);
    } else {
      sheet.appendRow([key, updates[key]]);
    }
  }

  invalidateSheetCache('SETTINGS');
  handleLogActivity({
    userId: payload.actorId || 'ADMIN',
    userName: payload.actorName || 'Admin/Superadmin',
    activityType: 'MAINTENANCE_SETTINGS_UPDATE',
    details: 'Maintenance ' + (isEnabled ? 'ENABLED' : 'DISABLED') + ' | Mode: ' + mode + ' | Msg: "' + message + '"'
  });

  return {
    success: true,
    message: isEnabled
      ? 'Maintenance Mode activated (' + mode + ').'
      : 'Maintenance Mode disabled (All tabs normal).'
  };
}

function handleSaveTestHistory(payload) {
  payload = payload || {};
  var existingHistory = getSheetData('TEST_HISTORY');
  var sheet = getOrCreateSheet('TEST_HISTORY');
  var historyId = payload.historyId || payload.HistoryID || ('TST-' + Date.now());
  
  var timestamp = payload.timestamp || payload.Timestamp || Utilities.formatDate(new Date(), DbConnectionManager.getTimeZone(), 'yyyy-MM-dd HH:mm:ss');
  var rawAcc = payload.accuracyPercentage !== undefined ? payload.accuracyPercentage : (payload.AccuracyPercentage !== undefined ? payload.AccuracyPercentage : (payload.accuracy !== undefined ? payload.accuracy : 0));
  var accuracy = parseFloat(rawAcc) || 0;
  var rawTotalMarks = payload.totalMarks !== undefined ? payload.totalMarks : (payload.TotalMarks !== undefined ? payload.TotalMarks : 100);
  var totalMarks = parseFloat(rawTotalMarks) || 100;
  var rawMarksObt = payload.marksObtained !== undefined ? payload.marksObtained : (payload.MarksObtained !== undefined ? payload.MarksObtained : accuracy);
  var marksObtained = parseFloat(rawMarksObt) || 0;

  payload.userId = payload.userId || payload.UserID || 'STUDENT';
  payload.userName = payload.userName || payload.UserName || 'Student';
  payload.examName = payload.examName || payload.ExamName || 'Skill Test';
  payload.passageTitle = payload.passageTitle || payload.PassageTitle || '-';
  payload.date = payload.date || payload.Date || getScriptLocalDate();
  payload.grossSpeed = payload.grossSpeed !== undefined ? payload.grossSpeed : (payload.GrossSpeed !== undefined ? payload.GrossSpeed : 0);
  payload.netSpeed = payload.netSpeed !== undefined ? payload.netSpeed : (payload.NetSpeed !== undefined ? payload.NetSpeed : 0);
  payload.totalWord = payload.totalWord !== undefined ? payload.totalWord : (payload.TotalWord !== undefined ? payload.TotalWord : 0);
  payload.totalCharacter = payload.totalCharacter !== undefined ? payload.totalCharacter : (payload.TotalCharacter !== undefined ? payload.TotalCharacter : 0);
  payload.totalTypedCharacter = payload.totalTypedCharacter !== undefined ? payload.totalTypedCharacter : (payload.TotalTypedCharacter !== undefined ? payload.TotalTypedCharacter : 0);
  payload.totalTypedWords = payload.totalTypedWords !== undefined ? payload.totalTypedWords : (payload.TotalTypedWords !== undefined ? payload.TotalTypedWords : 0);
  payload.totalBackspace = payload.totalBackspace !== undefined ? payload.totalBackspace : (payload.TotalBackspace !== undefined ? payload.TotalBackspace : 0);
  payload.status = payload.status || payload.Status || 'Completed';
  payload.timeUsed = payload.timeUsed || payload.TimeUsed || payload.timeTaken || payload.TimeTaken || '-';
  payload.userTranscription = payload.userTranscription || payload.UserTranscription || payload.typedText || payload.TypedText || '-';
  payload.referenceText = payload.referenceText || payload.ReferenceText || payload.originalText || payload.OriginalText || '-';

  // Cap keystroke rhythm & finger-latency heatmap snapshots safely within Google Sheets cell size limits
  var safeLatencySnapshot = undefined;
  if (payload.keystrokeLatencySnapshot && typeof payload.keystrokeLatencySnapshot === 'object' && !Array.isArray(payload.keystrokeLatencySnapshot)) {
    var cleanLatency = {};
    var latKeys = Object.keys(payload.keystrokeLatencySnapshot).slice(0, 64);
    for (var lk = 0; lk < latKeys.length; lk++) {
      var kName = String(latKeys[lk]).slice(0, 8);
      var kVal = payload.keystrokeLatencySnapshot[latKeys[lk]];
      if (kVal && typeof kVal === 'object') {
        cleanLatency[kName] = {
          count: Math.max(0, Number(kVal.count || 0) || 0),
          totalMs: Math.max(0, Math.round(Number(kVal.totalMs || 0) || 0)),
          errors: Math.max(0, Number(kVal.errors || 0) || 0)
        };
      }
    }
    if (Object.keys(cleanLatency).length > 0) safeLatencySnapshot = cleanLatency;
  }
  var safeIntervalsSnapshot = undefined;
  if (Array.isArray(payload.keystrokeIntervalsSnapshot) && payload.keystrokeIntervalsSnapshot.length > 0) {
    safeIntervalsSnapshot = payload.keystrokeIntervalsSnapshot.slice(-600).map(function(n) {
      return Math.max(0, Math.round(Number(n) || 0));
    });
  }

  var extraHistMeta = {
    userTimeGrossSpeed: payload.userTimeGrossSpeed !== undefined ? payload.userTimeGrossSpeed : (payload.grossSpeed || 0),
    userTimeNetSpeed: payload.userTimeNetSpeed !== undefined ? payload.userTimeNetSpeed : (payload.netSpeed || 0),
    verbFormError: payload.verbFormError || 0,
    singularPluralError: payload.singularPluralError || 0,
    transpositionErrors: payload.transpositionErrors || 0,
    homophoneErrors: payload.homophoneErrors || 0,
    lineSkipDetected: Boolean(payload.lineSkipDetected),
    lineSkipCount: payload.lineSkipCount || 0,
    proctoringViolations: payload.proctoringViolations || 0,
    proctoringIntegrityScore: payload.proctoringIntegrityScore !== undefined ? payload.proctoringIntegrityScore : 100,
    focusLossCount: payload.focusLossCount || 0,
    fullscreenExitCount: payload.fullscreenExitCount || 0,
    minuteByMinuteSlices: Array.isArray(payload.minuteByMinuteSlices) ? payload.minuteByMinuteSlices : undefined,
    keystrokeLatencySnapshot: safeLatencySnapshot,
    keystrokeIntervalsSnapshot: safeIntervalsSnapshot,
    wordCountRule: payload.wordCountRule || '1word',
    punctRuleMode: payload.punctRuleMode || 'all',
    isCbtExam: Boolean(payload.isCbtExam),
    cbtQuestionsReview: Array.isArray(payload.cbtQuestionsReview) ? payload.cbtQuestionsReview : undefined,
    liveTestId: payload.liveTestId || '',
    liveResultDisplayMode: payload.liveResultDisplayMode || 'immediate',
    liveResultPublishTimeMs: payload.liveResultPublishTimeMs || 0
  };

  var examBatchLabel = sanitizeInput(String(payload.batch || payload.userBatch || 'RP-Trail').trim() || 'RP-Trail');
  var examRuleLabel = sanitizeInput(String(payload.ruleName || payload.examRule || payload.wordCountRule || '-').trim() || '-');
  var examCategoryLabel = Boolean(payload.isCbtExam) ? 'CBT MCQ Exam' : (String(payload.examCategory || payload.materialType || 'Skill / Typing Test'));
  var fullMistakesVal = Number(payload.fullMistakes !== undefined ? payload.fullMistakes : ((Number(payload.wrongTyped) || 0) + (Number(payload.wordLeft) || 0) + (Number(payload.extraTyped) || 0)));
  var halfMistakesVal = Number(payload.halfMistakes !== undefined ? payload.halfMistakes : ((Number(payload.punctuationError || payload.punctuationLeft) || 0) + (Number(payload.capitalError) || 0) + (Number(payload.paraNotChanged) || 0)));
  var speedUnitLabel = Boolean(payload.isCbtExam) ? 'Marks' : 'WPM';
  var resultGradeLabel = accuracy >= 95 ? 'A+ (Excellent)' : (accuracy >= 90 ? 'A (Distinction)' : (accuracy >= 80 ? 'B (Good)' : (accuracy >= 70 ? 'C (Pass)' : 'Needs Improvement')));
  var readableNotesParts = [];
  if (payload.proctoringIntegrityScore !== undefined) readableNotesParts.push('Integrity: ' + payload.proctoringIntegrityScore + '%');
  if (payload.proctoringViolations) readableNotesParts.push('Violations: ' + payload.proctoringViolations);
  if (payload.liveTestId) readableNotesParts.push('LiveTestID: ' + payload.liveTestId);
  if (payload.lineSkipDetected) readableNotesParts.push('LineSkip: ' + (payload.lineSkipCount || 1));
  var readableHistNotes = readableNotesParts.length ? readableNotesParts.join(' | ') : '-';

  sheet.appendRow([
    historyId,
    defaultDash(payload.userId),
    sanitizeInput(payload.userName),
    sanitizeInput(payload.examName),
    sanitizeInput(payload.passageTitle || '-'),
    sanitizeInput(payload.timeDuration || '-'),
    sanitizeInput(payload.typingDate || '-'),
    sanitizeInput(payload.timeTaken || '-'),
    sanitizeInput(payload.errorRelaxed || '-'),
    sanitizeInput(payload.penaltyWord || '-'),
    defaultDash(payload.date),
    payload.grossSpeed !== undefined ? payload.grossSpeed : 0,
    payload.netSpeed !== undefined ? payload.netSpeed : 0,
    payload.totalWord !== undefined ? payload.totalWord : 0,
    payload.totalCharacter !== undefined ? payload.totalCharacter : 0,
    payload.totalTypedCharacter !== undefined ? payload.totalTypedCharacter : 0,
    payload.totalTypedWords !== undefined ? payload.totalTypedWords : 0,
    payload.totalBackspace !== undefined ? payload.totalBackspace : 0,
    accuracy,
    payload.errorPercentage !== undefined ? payload.errorPercentage : 0,
    marksObtained,
    totalMarks,
    payload.wrongTyped || 0,
    payload.wordLeft || 0,
    payload.extraTyped || 0,
    payload.paraNotChanged || 0,
    payload.punctuationError || payload.punctuationLeft || 0,
    payload.capitalError || 0,
    defaultDash(payload.status),
    defaultDash(payload.timeUsed),
    safeSheetCellValue(sanitizeInput(payload.userTranscription || '-'), 45000),
    safeSheetCellValue(sanitizeInput(payload.referenceText || '-'), 45000),
    timestamp,
    payload.correctWords !== undefined ? payload.correctWords : 0,
    formatReadableSheetData(extraHistMeta, 45000),
    examBatchLabel,
    examRuleLabel,
    examCategoryLabel,
    fullMistakesVal,
    halfMistakesVal,
    speedUnitLabel,
    resultGradeLabel,
    readableHistNotes
  ]);
  try { SpreadsheetApp.flush(); } catch (e) {}
  invalidateSheetCache('TEST_HISTORY');

  var isCbt = String(payload.examName || '').toLowerCase().indexOf('cbt') !== -1 || payload.isCbtExam === true;
  var prevBest = 0;
  for (var hIdx = 0; hIdx < existingHistory.length; hIdx++) {
    var rowItem = existingHistory[hIdx];
    var rowExam = String(rowItem.ExamName || '').toLowerCase();
    var rowIsCbt = rowExam.indexOf('cbt') !== -1;
    if (isCbt && rowIsCbt) {
      var mVal = parseFloat(rowItem.MarksObtained || 0);
      if (mVal > prevBest) prevBest = mVal;
    } else if (!isCbt && !rowIsCbt) {
      var sVal = parseFloat(rowItem.NetSpeed || 0);
      if (sVal > prevBest) prevBest = sVal;
    }
  }

  var currentMetric = isCbt ? parseFloat(marksObtained || 0) : parseFloat(payload.netSpeed || 0);
  var isNewHighScore = currentMetric > 0 && currentMetric > prevBest;

  handleLogActivity({
    userId: payload.userId || 'GUEST',
    userName: payload.userName || 'Student',
    activityType: 'TEST_GIVEN',
    details: 'Submitted "' + (payload.examName || '-') + '" | Net Speed: ' + (payload.netSpeed || 0) + ' WPM | Accuracy: ' + accuracy + '% | Marks: ' + marksObtained + '/' + totalMarks + ' | Status: ' + (payload.status || '-')
  });

  if (isNewHighScore) {
    var metricDesc = isCbt
      ? (marksObtained + '/' + totalMarks + ' Marks (Previous Best: ' + prevBest + ')')
      : ((payload.netSpeed || 0) + ' Net WPM (Previous Best: ' + prevBest + ' WPM)');
    handleLogActivity({
      userId: payload.userId || 'GUEST',
      userName: payload.userName || 'Student',
      activityType: 'HIGH_SCORE_RECORD_BROKEN',
      details: 'New High-Score Record in "' + (payload.examName || '-') + '" by ' + (payload.userName || 'Student') + ': ' + metricDesc
    });
  }
  
  return {
    success: true,
    message: 'Test history saved successfully.',
    isNewHighScore: isNewHighScore,
    previousBest: prevBest,
    newRecordValue: currentMetric
  };
}

function handleGetTestHistory(payload) {
  payload = payload || {};
  var userId = payload.userId;
  var historyList = getSheetData('TEST_HISTORY');
  var daysWindow = Math.max(0, parseInt(payload.daysWindow || 0, 10) || 0);
  var sinceDateMs = payload.sinceDate ? new Date(payload.sinceDate).getTime() : (daysWindow > 0 ? (Date.now() - daysWindow * 24 * 60 * 60 * 1000) : 0);

  var userHistory = historyList.filter(function(h) {
    if (String(h.UserID) !== String(userId)) return false;
    if (sinceDateMs && !isNaN(sinceDateMs)) {
      var ts = new Date(h.Date || h.Timestamp || 0).getTime();
      if (isNaN(ts) || ts < sinceDateMs) return false;
    }
    return true;
  }).reverse();

  var totalCount = userHistory.length;
  var page = Math.max(1, parseInt(payload.page || 1, 10) || 1);
  var limit = Math.min(1000, Math.max(20, parseInt(payload.limit || payload.pageSize || 200, 10) || 200));
  var start = (page - 1) * limit;
  var pagedHistory = userHistory.slice(start, start + limit);

  return {
    success: true,
    historyList: pagedHistory,
    totalCount: totalCount,
    page: page,
    limit: limit,
    totalPages: Math.max(1, Math.ceil(totalCount / limit)),
    daysWindow: daysWindow,
    hasMore: (start + limit) < totalCount
  };
}

function handleSaveEvaluationRules(payload) {
  var ruleKey = String(payload.ruleKey || '').trim();
  var ruleJson = String(payload.ruleJson || '');
  if (!ruleKey) {
    return { success: false, message: 'Exam Rule key is required.' };
  }
  
  var sheet = getOrCreateSheet('EVALUATION_RULES');
  
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    var existingKey = String(data[i][0]).trim();
    if (existingKey.toLowerCase() === ruleKey.toLowerCase()) {
      if (!ruleJson || ruleJson === '') {
        sheet.deleteRow(i + 1);
        invalidateSheetCache('EVALUATION_RULES');
        handleLogActivity({
          userId: payload.actorId || 'ADMIN',
          userName: payload.actorName || 'Admin/Superadmin',
          activityType: 'RULE_DELETED',
          details: 'Deleted evaluation rule [' + ruleKey + ']'
        });
        return { success: true, message: 'Evaluation rule deleted successfully.' };
      }
      sheet.getRange(i + 1, 1).setValue(ruleKey); 
      sheet.getRange(i + 1, 2).setValue(ruleJson);
      invalidateSheetCache('EVALUATION_RULES');
      handleLogActivity({
        userId: payload.actorId || 'ADMIN',
        userName: payload.actorName || 'Admin/Superadmin',
        activityType: 'RULE_UPDATE',
        details: 'Updated evaluation rule [' + ruleKey + ']'
      });
      return { success: true, message: 'Exam Evaluation rule updated successfully.' };
    }
  }
  
  if (ruleJson && ruleJson !== '') {
    sheet.appendRow([ruleKey, ruleJson]);
  }
  invalidateSheetCache('EVALUATION_RULES');
  handleLogActivity({
    userId: payload.actorId || 'ADMIN',
    userName: payload.actorName || 'Admin/Superadmin',
    activityType: 'RULE_UPDATE',
    details: 'Created evaluation rule [' + ruleKey + ']'
  });
  return { success: true, message: 'Exam Evaluation rule saved successfully.' };
}

function handleGetEvaluationRules(payload) {
  var rulesList = getSheetData('EVALUATION_RULES');
  var rulesMap = {};
  for (var i = 0; i < rulesList.length; i++) {
    try {
      var rKey = String(rulesList[i].RuleKey).trim();
      if (rKey && rKey !== '-' && rulesList[i].RuleJson && rulesList[i].RuleJson !== '-') {
        rulesMap[rKey] = JSON.parse(rulesList[i].RuleJson);
      }
    } catch (e) {}
  }
  return { success: true, rulesMap: rulesMap };
}

function buildAdminContactsFromUsersList(usersList, filterBatchesLower) {
  var list = Array.isArray(usersList) ? usersList : getSheetData('USERS');
  var settings = getSheetData('SETTINGS');
  var monitorsMap = parseBatchMonitorsSettings(settings);
  var monitorByUserId = {};
  for (var batchKey in monitorsMap) {
    if (!monitorsMap.hasOwnProperty(batchKey)) continue;
    var bLower = String(batchKey || '').trim().toLowerCase();
    if (Array.isArray(filterBatchesLower) && filterBatchesLower.length > 0) {
      if (filterBatchesLower.indexOf(bLower) === -1) continue;
    }
    var batchMonList = normalizeBatchMonitorsEntry(monitorsMap[batchKey]);
    for (var mi = 0; mi < batchMonList.length; mi++) {
      var mInfo = batchMonList[mi];
      var mUid = String(mInfo.userId || '').trim();
      if (mUid) {
        if (!monitorByUserId[mUid]) {
          monitorByUserId[mUid] = {
            batches: [],
            designation: mInfo.designation || mInfo.monitorType || 'Batch Monitor',
            fallbackName: mInfo.userName || mInfo.name || '',
            fallbackEmail: mInfo.email || '',
            fallbackMobile: mInfo.mobile || ''
          };
        }
        if (monitorByUserId[mUid].batches.indexOf(batchKey) === -1) {
          monitorByUserId[mUid].batches.push(batchKey);
        }
      }
    }
  }

  var contacts = [];
  var addedMonitorUids = {};
  for (var u = 0; u < list.length; u++) {
    var statusVal = String(list[u].Status || 'active').toLowerCase().trim();
    if (statusVal === 'blocked') continue;
    var uid = defaultDash(list[u].UserID);
    var r = String(list[u].Role || '').toLowerCase().trim();
    if (isPrimarySuperadminEmail(list[u].Email)) {
      r = 'superadmin';
    }
    var monEntry = monitorByUserId[uid] || null;
    if (r === 'superadmin' || r === 'admin' || monEntry) {
      var cleanRole = (r === 'superadmin' || r === 'admin') ? r : 'monitor';
      var rawName = String(list[u].Name || '').trim();
      var rawEmail = String(list[u].Email || '').trim();
      var rawMobile = String(list[u].Mobile || '').trim();
      var rawBatch = String(list[u].Batch || '').trim();
      var cleanBatch = (rawBatch && rawBatch !== '-' && rawBatch !== 'undefined') ? rawBatch : 'General Batch';
      var cleanName = (rawName && rawName !== '-' && rawName !== 'undefined')
        ? rawName
        : (cleanRole === 'superadmin' ? 'Superadmin' : (cleanRole === 'admin' ? 'Administrator' : ('Batch Monitor (' + cleanBatch + ')')));
      var cleanEmail = (rawEmail && rawEmail !== '-' && rawEmail.indexOf('@') !== -1)
        ? rawEmail
        : '';
      var cleanMobile = (rawMobile && rawMobile !== '-' && rawMobile.replace(/\D/g, '').length >= 10)
        ? rawMobile.replace(/\D/g, '').slice(-10)
        : '';
      var cleanDesignation = monEntry && monEntry.designation && monEntry.designation !== '-'
        ? monEntry.designation
        : (cleanRole === 'superadmin'
            ? 'Founder, Chief Superadmin & Principal Shorthand Instructor'
            : (cleanRole === 'admin' ? 'Academic & CBT Examination Administrator' : 'Appointed Batch Monitor & Peer Mentor'));

      var assignedMonBatches = (monEntry && Array.isArray(monEntry.batches) && monEntry.batches.length)
        ? monEntry.batches
        : (cleanRole === 'monitor' ? [cleanBatch] : ['All Institute Batches']);

      contacts.push({
        userId: (uid && uid !== '-') ? uid : ('OFC-' + (u + 1)),
        name: cleanName,
        email: cleanEmail,
        mobile: cleanMobile,
        role: cleanRole,
        isBatchMonitor: Boolean(monEntry),
        monitoredBatches: assignedMonBatches,
        assignedBatch: assignedMonBatches.join(', '),
        monitorDesignation: cleanDesignation,
        designation: cleanDesignation,
        department: cleanRole === 'superadmin' ? 'Directorate & Supreme Examination Cell' : (cleanRole === 'admin' ? 'Academic Operations & Evaluation Desk' : ('Batch Monitor — ' + assignedMonBatches.join(', '))),
        officeHours: '08:00 AM – 09:00 PM IST (Mon–Sun)',
        batch: assignedMonBatches.join(', '),
        status: statusVal || 'active',
        fromGoogleSheet: true,
        verified: true
      });

      if (monEntry && cleanRole !== 'monitor') {
        // If an Admin/Superadmin is ALSO appointed as the Batch Monitor for the student's batch, include a dedicated Batch Monitor entry for that batch
        contacts.push({
          userId: uid,
          name: cleanName,
          email: cleanEmail,
          mobile: cleanMobile,
          role: 'monitor',
          isBatchMonitor: true,
          isMyBatchMonitor: true,
          monitoredBatches: monEntry.batches,
          assignedBatch: monEntry.batches.join(', '),
          monitorDesignation: monEntry.designation || 'Assigned Batch Monitor',
          designation: monEntry.designation || 'Assigned Batch Monitor',
          department: 'Batch Monitor — ' + monEntry.batches.join(', '),
          officeHours: '08:00 AM – 09:00 PM IST (Mon–Sun)',
          batch: monEntry.batches.join(', '),
          status: 'active',
          fromGoogleSheet: true,
          verified: true
        });
      }
      if (monEntry) addedMonitorUids[uid] = true;
    }
  }

  for (var remUid in monitorByUserId) {
    if (!addedMonitorUids[remUid]) {
      var mObj = monitorByUserId[remUid];
      contacts.push({
        userId: remUid,
        name: mObj.fallbackName || ('Batch Monitor (' + mObj.batches.join(', ') + ')'),
        email: mObj.fallbackEmail || '-',
        mobile: mObj.fallbackMobile || '-',
        role: 'monitor',
        isBatchMonitor: true,
        isMyBatchMonitor: true,
        monitoredBatches: mObj.batches,
        assignedBatch: mObj.batches.join(', '),
        monitorDesignation: mObj.designation || 'Assigned Batch Monitor',
        designation: mObj.designation || 'Assigned Batch Monitor',
        department: 'Batch Monitor — ' + mObj.batches.join(', '),
        officeHours: '08:00 AM – 09:00 PM IST (Mon–Sun)',
        batch: mObj.batches.join(', '),
        status: 'active',
        fromGoogleSheet: true,
        verified: true
      });
    }
  }

  contacts.sort(function(a, b) {
    var rank = { monitor: 1, superadmin: 2, admin: 3 };
    var ra = rank[a.role] || 4;
    var rb = rank[b.role] || 4;
    if (ra === rb) return String(a.name).localeCompare(String(b.name));
    return ra - rb;
  });
  return contacts;
}

function handleGetHelpContacts(payload) {
  var usersList = getSheetData('USERS');
  var settings = getSheetData('SETTINGS');
  var reqUid = payload && (payload._verifiedUserId || payload.userId || payload.authUserId) ? String(payload._verifiedUserId || payload.userId || payload.authUserId).trim() : '';
  var reqRole = String((payload && payload._verifiedRole) || '').toLowerCase().trim();
  var reqBatchStr = '';

  if (reqUid) {
    for (var i = 0; i < usersList.length; i++) {
      if (String(usersList[i].UserID || '').trim() === reqUid) {
        if (!reqRole) reqRole = String(usersList[i].Role || 'user').toLowerCase().trim();
        var sheetBatch = String(usersList[i].Batch || '').trim();
        if (sheetBatch && sheetBatch !== '-') {
          reqBatchStr = sheetBatch;
        }
        break;
      }
    }
  }
  if (!reqBatchStr && payload && payload.userBatch) {
    reqBatchStr = String(payload.userBatch).trim();
  }

  var isAdminRequester = (reqRole === 'admin' || reqRole === 'superadmin');
  var filterBatchesLower = reqBatchStr
    ? reqBatchStr.split(',').map(function(b) {
        var t = String(b || '').trim().toLowerCase();
        if (!t || t === '-' || t === 'general batch' || t === 'free tier') return 'rp-trail';
        return t;
      }).filter(Boolean)
    : ['rp-trail'];

  var adminContacts = buildAdminContactsFromUsersList(usersList, isAdminRequester ? [] : filterBatchesLower);
  // Strictly strip any monitor contact that does not match the non-admin user's enrolled batch(es)
  if (!isAdminRequester) {
    adminContacts = adminContacts.filter(function(c) {
      if (!c) return false;
      var cRole = String(c.role || '').toLowerCase();
      if (cRole !== 'monitor' && !c.isBatchMonitor) return true;
      var mBatches = Array.isArray(c.monitoredBatches) ? c.monitoredBatches : (c.assignedBatch ? [String(c.assignedBatch)] : []);
      return mBatches.some(function(mb) {
        return filterBatchesLower.indexOf(String(mb || '').trim().toLowerCase()) !== -1;
      });
    });
  }

  var allBatchMonitors = parseBatchMonitorsSettings(settings);
  var filteredBatchMonitors = {};
  if (isAdminRequester) {
    filteredBatchMonitors = allBatchMonitors;
  } else {
    for (var bKey in allBatchMonitors) {
      if (filterBatchesLower.indexOf(String(bKey || '').trim().toLowerCase()) !== -1) {
        filteredBatchMonitors[bKey] = allBatchMonitors[bKey];
      }
    }
  }

  return {
    success: true,
    adminContacts: adminContacts,
    batchMonitors: filteredBatchMonitors,
    userBatches: filterBatchesLower
  };
}

function handleSubmitOutlineRequest(payload) {
  var wordRaw = sanitizeInput(String(payload.word || payload.title || '').trim());
  if (!wordRaw) {
    return { success: false, message: 'Please enter a valid word or phrase for the outline request.' };
  }
  var wordLower = wordRaw.toLowerCase();
  var allMats = getSheetData('MATERIALS');
  for (var i = 0; i < allMats.length; i++) {
    var m = allMats[i];
    if (isTypeMatch(m.Type, 'word')) {
      var mTitle = String(m.Title || '').trim().toLowerCase();
      if (mTitle === wordLower) {
        return {
          success: false,
          alreadyExists: true,
          existingItem: m,
          existingMaterial: m,
          message: 'The word "' + wordRaw + '" is already available in the Words & Outlines tab!'
        };
      }
    }
  }

  var userId = String(payload.userId || payload.authUserId || 'STUDENT').trim();
  var userName = sanitizeInput(String(payload.userName || 'Batch Student').trim());
  var userBatch = sanitizeInput(String(payload.batch || payload.userBatch || 'General Batch').trim());

  var fbSheet = getOrCreateSheet('FEEDBACK');
  var fbId = 'FB-OUTLINE-' + Date.now();
  fbSheet.appendRow([
    fbId,
    userId,
    userName,
    'Outline Query',
    'Shorthand Outline Request for Word: "' + wordRaw + '" (Batch: ' + userBatch + ')',
    new Date().toISOString(),
    '-'
  ]);
  invalidateSheetCache('FEEDBACK');

  handleLogActivity({
    userId: userId,
    userName: userName,
    activityType: 'WORD_OUTLINE_REQUEST',
    details: 'Requested Pitman Shorthand Outline for word "' + wordRaw + '" (' + userBatch + ')'
  });

  return {
    success: true,
    alreadyExists: false,
    word: wordRaw,
    requestId: fbId,
    status: 'Pending Review',
    routedTo: 'Faculty Outline Queue (Admin → Feedback & Batch Monitor Desk)',
    answeredBy: 'Admin, Superadmin, or Batch Monitor',
    message: 'Word "' + wordRaw + '" submitted to the Faculty Outline Queue! Your Batch Monitor, Admin, or Superadmin will answer it and publish the outline right here.'
  };
}

function handleGetOutlineRequests(payload) {
  var requesterId = String(payload._verifiedUserId || payload.userId || payload.authUserId || '').trim();
  var requesterRole = String(payload._verifiedRole || payload.role || payload.userRole || '').toLowerCase().trim();
  var isStaff = (requesterRole === 'admin' || requesterRole === 'superadmin' || requesterRole === 'instructor');
  var isMonitor = false;
  if (!isStaff && requesterId) {
    try {
      var settings = getSheetData('SETTINGS');
      var mMap = parseBatchMonitorsSettings(settings);
      var keys = Object.keys(mMap);
      for (var k = 0; k < keys.length; k++) {
        if (isUserInBatchMonitorsList(mMap[keys[k]], requesterId)) {
          isMonitor = true;
          break;
        }
      }
    } catch (e) {}
  }

  var fbRows = getSheetData('FEEDBACK');
  var results = [];
  for (var i = fbRows.length - 1; i >= 0; i--) {
    var r = fbRows[i];
    if (String(r.Category || '').trim() !== 'Outline Query') continue;
    var rUid = String(r.UserID || '').trim();
    if (!isStaff && !isMonitor && requesterId && rUid !== requesterId) continue;

    var rawMsg = String(r.Message || '');
    var wordMatch = rawMsg.match(/Word:\s*"([^"]+)"/i);
    var batchMatch = rawMsg.match(/\(Batch:\s*([^)]+)\)/i);
    var replyText = String(r.AdminResponse || r.AdminReply || '').trim();
    var isAnswered = Boolean(replyText && replyText !== '-');
    var imgMatch = replyText.match(/Outline Image:\s*(https?:\/\/\S+)/i);
    var parsedImgUrl = imgMatch ? imgMatch[1].trim() : '';
    var ticketId = String(r.ID || r.FeedbackID || ('OUT-' + i));
    var studentName = String(r.UserName || 'Student');
    var submittedDate = String(r.SubmittedDate || r.Date || '');

    results.push({
      id: ticketId,
      requestId: ticketId,
      userId: rUid,
      requestedById: rUid,
      userName: studentName,
      requestedBy: studentName,
      requestedByName: studentName,
      studentName: studentName,
      word: wordMatch ? wordMatch[1] : rawMsg.replace(/^Shorthand Outline Request for Word:\s*/i, '').trim(),
      batch: batchMatch ? batchMatch[1] : 'General Batch',
      message: rawMsg,
      date: submittedDate,
      status: isAnswered ? 'Answered' : 'Pending Review',
      answer: isAnswered ? replyText : '',
      answerNote: isAnswered ? replyText : '',
      replyNote: isAnswered ? replyText : '',
      outlineImageUrl: parsedImgUrl,
      routedTo: 'Admin Feedback & Batch Monitor Outline Desk',
      answeredBy: 'Admin / Superadmin / Batch Monitor',
      answeredByRole: 'Admin / Superadmin / Batch Monitor'
    });
  }

  return {
    success: true,
    canAnswer: Boolean(isStaff || isMonitor),
    requests: results
  };
}

function handleResolveOutlineRequest(payload) {
  var requestId = String(payload.requestId || payload.id || payload.feedbackId || '').trim();
  var answerText = sanitizeInput(String(payload.answerNote || payload.replyNote || payload.answer || payload.reply || '').trim());
  var wordText = sanitizeInput(String(payload.word || '').trim());
  var outlineImageUrl = String(payload.outlineImageUrl || payload.imageUrl || '').trim();
  var publishToLibrary = Boolean(payload.publishToDictionary || payload.publishToLibrary);
  var resolverId = String(payload._verifiedUserId || payload.userId || payload.authUserId || '').trim();
  var resolverName = sanitizeInput(String(payload.repliedByName || payload.requesterName || payload.userName || 'Faculty').trim());
  var resolverRole = String(payload._verifiedRole || payload.repliedByRole || payload.role || payload.userRole || '').toLowerCase().trim();

  var isStaff = (resolverRole === 'admin' || resolverRole === 'superadmin' || resolverRole === 'instructor');
  var isMonitor = false;
  if (!isStaff && resolverId) {
    try {
      var settings = getSheetData('SETTINGS');
      var mMap = parseBatchMonitorsSettings(settings);
      var keys = Object.keys(mMap);
      for (var k = 0; k < keys.length; k++) {
        if (isUserInBatchMonitorsList(mMap[keys[k]], resolverId)) {
          isMonitor = true;
          break;
        }
      }
    } catch (e) {}
  }

  if (!isStaff && !isMonitor) {
    return { success: false, message: 'Permission Denied: Only Admin, Superadmin, or Batch Monitors can answer outline requests.' };
  }
  if (!requestId || (!answerText && !outlineImageUrl)) {
    return { success: false, message: 'Request ID and an outline explanation or image URL are required.' };
  }

  var fbSheet = getOrCreateSheet('FEEDBACK');
  var data = fbSheet.getDataRange().getValues();
  var updated = false;
  var formattedReply = '[' + resolverName + ' (' + (isStaff ? 'Faculty/Admin' : 'Batch Monitor') + ')]: ' + (answerText || 'Outline image provided') + (outlineImageUrl ? (' | Outline Image: ' + outlineImageUrl) : '');
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0] || '').trim() === requestId) {
      if (!wordText) {
        var rowMsg = String(data[i][4] || '');
        var wm = rowMsg.match(/Word:\s*"([^"]+)"/i);
        if (wm && wm[1]) wordText = wm[1].trim();
      }
      fbSheet.getRange(i + 1, 7).setValue(formattedReply);
      updated = true;
      break;
    }
  }
  invalidateSheetCache('FEEDBACK');

  if (!updated) {
    return { success: false, message: 'Outline request ticket not found.' };
  }

  var publishedMaterialId = '';
  if (publishToLibrary && wordText) {
    try {
      var matSheet = getOrCreateSheet('MATERIALS');
      ensureSheetHeadersCached(matSheet, 'MATERIALS');
      publishedMaterialId = 'WORD-' + Date.now();
      var todayStr = new Date().toISOString().slice(0, 10);
      var matHeaders = matSheet.getLastColumn() > 0
        ? matSheet.getRange(1, 1, 1, matSheet.getLastColumn()).getValues()[0]
        : SHEET_SCHEMAS['MATERIALS'];
      var matMap = {
        'ID': publishedMaterialId,
        'Type': 'word',
        'Subtab': 'Faculty Answered Outlines',
        'Category': 'Words & Outlines',
        'Title': wordText,
        'ContentOrUrl': outlineImageUrl || answerText,
        'ThumbnailUrl': outlineImageUrl || '-',
        'LogoUrl': '-',
        'AccessLevel': 'public',
        'UploadedDate': todayStr,
        'Medium': 'English',
        'Difficulty': 'Standard',
        'ExamDate': '-',
        'TimeLimit': '-',
        'ExtraMetaJson': '-',
        'TargetBatch': 'ALL',
        'Description': answerText || ('Answered by ' + resolverName),
        'CbtEvalRule': '-',
        'QuestionsCount': '-',
        'AudioStartTime': '-',
        'AudioEndTime': '-',
        'MergedTracks': '-',
        'PublishAt': '-',
        'ExpireAt': '-',
        'AutoDeleteDays': '-',
        'AdditionalNotes': 'Answered by ' + resolverName
      };
      var matRow = [];
      for (var mh = 0; mh < matHeaders.length; mh++) {
        var colKey = String(matHeaders[mh] || '').trim();
        matRow.push(matMap[colKey] !== undefined ? matMap[colKey] : '-');
      }
      matSheet.appendRow(matRow);
      invalidateSheetCache('MATERIALS');
    } catch (matErr) {}
  }

  return {
    success: true,
    id: requestId,
    requestId: requestId,
    answer: formattedReply,
    answerNote: formattedReply,
    replyNote: formattedReply,
    outlineImageUrl: outlineImageUrl,
    publishedMaterialId: publishedMaterialId,
    message: publishedMaterialId
      ? ('Answer saved and "' + wordText + '" published to Words & Outlines dictionary!')
      : 'Answer saved and visible to the student in Words & Outlines!'
  };
}

// Fetches Google Drive or Direct PDF file as Base64 so client-side PDF.js and PDFLib can always open & watermark PDFs
function handleGetDriveFileBase64(payload) {
  var fileId = String(payload.fileId || '').trim();
  var rawUrl = String(payload.fileUrl || payload.url || '').trim();
  if (!fileId && rawUrl) {
    var match = rawUrl.match(/\/d\/([a-zA-Z0-9_-]+)/) || rawUrl.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (match && match[1]) fileId = match[1];
  }

  // 1. Try DriveApp first when a fileId is present
  if (fileId) {
    try {
      var file = DriveApp.getFileById(fileId);
      var bytes = file.getBlob().getBytes();
      var base64Data = Utilities.base64Encode(bytes);
      var mimeType = file.getMimeType() || 'application/octet-stream';
      return {
        success: true,
        base64: base64Data,
        mimeType: mimeType,
        dataUrl: 'data:' + mimeType + ';base64,' + base64Data,
        name: file.getName()
      };
    } catch (driveErr) {
      // Fall through to UrlFetchApp below for public Drive links outside personal Drive scope
    }
  }

  // 2. Fallback to UrlFetchApp for public Drive links or direct external PDF URLs
  try {
    var fetchTargetUrl = fileId
      ? ('https://drive.usercontent.google.com/download?id=' + fileId + '&export=download&confirm=t')
      : rawUrl;
    if (!fetchTargetUrl || !isSafeExternalFetchUrl(fetchTargetUrl)) {
      return { success: false, message: 'Missing valid public Drive File ID or HTTPS document URL.' };
    }
    var resp = UrlFetchApp.fetch(fetchTargetUrl, {
      followRedirects: true,
      muteHttpExceptions: true
    });
    if (fileId && (!resp || resp.getResponseCode() >= 400 || String(resp.getBlob().getContentType() || '').toLowerCase().indexOf('text/html') !== -1)) {
      resp = UrlFetchApp.fetch('https://drive.google.com/uc?export=download&id=' + fileId, {
        followRedirects: true,
        muteHttpExceptions: true
      });
    }
    if (resp && resp.getResponseCode() >= 200 && resp.getResponseCode() < 300) {
      var blob = resp.getBlob();
      var fetchedMime = String(blob.getContentType() || 'application/pdf').toLowerCase();
      if (fetchedMime.indexOf('text/html') !== -1) {
        return {
          success: false,
          message: 'Google Drive returned an access/login page instead of the file. Ensure the file sharing is set to "Anyone with the link" or owned by the Apps Script account.'
        };
      }
      var fetchedBytes = blob.getBytes();
      var fetchedB64 = Utilities.base64Encode(fetchedBytes);
      return {
        success: true,
        base64: fetchedB64,
        mimeType: fetchedMime,
        dataUrl: 'data:' + fetchedMime + ';base64,' + fetchedB64,
        name: blob.getName() || 'Document.pdf'
      };
    }
    return { success: false, message: 'HTTP status ' + (resp ? resp.getResponseCode() : 'unknown') };
  } catch (err) {
    return { success: false, message: 'Unable to fetch PDF bytes: ' + err.toString() };
  }
}

function handleSaveDailyGoalProgress(payload) {
  var actorRole = String(payload._verifiedRole || '').toLowerCase().trim();
  var isStaff = (actorRole === 'admin' || actorRole === 'superadmin');
  var userId = String(isStaff ? (payload.userId || payload._verifiedUserId || '') : (payload._verifiedUserId || payload.userId || '')).trim();
  if (!userId) {
    return { success: false, message: 'Missing user ID.' };
  }
  var userName = sanitizeInput(payload.userName || 'Student');
  var dateStr = String(payload.date || new Date().toISOString().slice(0, 10)).trim();
  var targetWords = Number(payload.targetWords || 0);
  var wordsCompleted = Number(payload.wordsCompleted || 0);
  var strokesCompleted = Number(payload.strokesCompleted || 0);
  var testsCount = Number(payload.testsCount || 0);
  var status = payload.status || (wordsCompleted >= targetWords && targetWords > 0 ? 'Achieved' : 'In Progress');

  var sheet = getOrCreateSheet('DAILY_GOALS');
  var data = sheet.getDataRange().getValues();
  var rowIndex = -1;

  for (var i = 1; i < data.length; i++) {
    if (String(data[i][1]).trim() === userId && String(data[i][3]).slice(0, 10) === dateStr.slice(0, 10)) {
      rowIndex = i + 1;
      break;
    }
  }

  var nowIso = new Date().toISOString();
  if (rowIndex > 1) {
    // Update existing daily goal entry
    var currentTarget = targetWords > 0 ? targetWords : Number(data[rowIndex - 1][4] || 0);
    var currentWords = wordsCompleted > 0 ? wordsCompleted : Number(data[rowIndex - 1][5] || 0);
    var currentStrokes = strokesCompleted > 0 ? strokesCompleted : Number(data[rowIndex - 1][6] || 0);
    var currentTests = testsCount > 0 ? testsCount : Number(data[rowIndex - 1][7] || 0);
    var currentStatus = (currentWords >= currentTarget && currentTarget > 0) ? 'Achieved' : (payload.status || 'In Progress');

    sheet.getRange(rowIndex, 5).setValue(currentTarget);
    sheet.getRange(rowIndex, 6).setValue(currentWords);
    sheet.getRange(rowIndex, 7).setValue(currentStrokes);
    sheet.getRange(rowIndex, 8).setValue(currentTests);
    sheet.getRange(rowIndex, 9).setValue(currentStatus);
    sheet.getRange(rowIndex, 10).setValue(nowIso);
  } else {
    // Append new daily goal entry
    var goalId = 'GOAL-' + Date.now();
    sheet.appendRow([
      goalId,
      userId,
      userName,
      dateStr,
      targetWords,
      wordsCompleted,
      strokesCompleted,
      testsCount,
      status,
      nowIso
    ]);
  }
  DbConnectionManager.markDirty('DAILY_GOALS');
  invalidateSheetCache('DAILY_GOALS');

  return {
    success: true,
    message: 'Daily goal progress synced successfully.',
    goal: {
      userId: userId,
      date: dateStr,
      targetWords: targetWords,
      wordsCompleted: wordsCompleted,
      strokesCompleted: strokesCompleted,
      testsCount: testsCount,
      status: status
    }
  };
}

function handleGetDailyGoalProgress(payload) {
  var userId = String(payload.userId || '').trim();
  var dateStr = String(payload.date || new Date().toISOString().slice(0, 10)).trim();
  if (!userId) {
    return { success: false, message: 'Missing user ID.' };
  }

  var sheet = getOrCreateSheet('DAILY_GOALS');
  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) {
    return { success: true, goal: null };
  }

  for (var i = 1; i < data.length; i++) {
    if (String(data[i][1]).trim() === userId && String(data[i][3]).slice(0, 10) === dateStr.slice(0, 10)) {
      return {
        success: true,
        goal: {
          goalId: data[i][0],
          userId: data[i][1],
          userName: data[i][2],
          date: data[i][3],
          targetWords: Number(data[i][4] || 0),
          wordsCompleted: Number(data[i][5] || 0),
          strokesCompleted: Number(data[i][6] || 0),
          testsCount: Number(data[i][7] || 0),
          status: data[i][8],
          updatedAt: data[i][9]
        }
      };
    }
  }

  return { success: true, goal: null };
}

/**
 * 100% Free-of-Cost WhatsApp OTP Dispatch Helper
 */
function sendFreeWhatsAppOtpMessage(mobileNumber, recipientName, otpCode, purposeLabel) {
  var cleanDigits = String(mobileNumber || '').replace(/\D/g, '').slice(-10);
  var fullPhone = cleanDigits.length === 10 ? ('91' + cleanDigits) : cleanDigits;
  var purpose = purposeLabel || 'Mobile Number Verification';
  var waText = '✅ *RP Skill | Ranjan Pathshala — WhatsApp OTP Verification*\n\n'
    + '👤 Name: ' + (recipientName || 'Student') + '\n'
    + '📱 Mobile: +91-' + cleanDigits + '\n'
    + '🔐 Purpose: ' + purpose + '\n'
    + '🔢 *Your 6-Digit WhatsApp OTP:* *' + otpCode + '*\n\n'
    + '_(Valid for 10 minutes — Do not share this code with anyone)_';
  var webhookDispatched = false;
  var gatewayError = '';

  try {
    var freeWebhook = String(getWhatsAppGatewayWebhookUrl() || '').trim();
    var authToken = '';
    try {
      authToken = String(PropertiesService.getScriptProperties().getProperty('WHATSAPP_GATEWAY_AUTH_TOKEN') || '').trim();
    } catch (tokErr) {}

    if (freeWebhook && freeWebhook.indexOf('http') === 0) {
      var resp;
      if (freeWebhook.indexOf('{phone}') !== -1 || freeWebhook.indexOf('{text}') !== -1 || freeWebhook.indexOf('{otp}') !== -1) {
        // Supports GET-based free WhatsApp gateways (e.g. CallMeBot / TextMeBot / custom query URL)
        var resolvedUrl = freeWebhook
          .replace(/\{phone\}/gi, encodeURIComponent(fullPhone))
          .replace(/\{mobile\}/gi, encodeURIComponent(cleanDigits))
          .replace(/\{otp\}/gi, encodeURIComponent(otpCode))
          .replace(/\{text\}/gi, encodeURIComponent(waText));
        resp = UrlFetchApp.fetch(resolvedUrl, { method: 'get', muteHttpExceptions: true });
      } else if (freeWebhook.indexOf('graph.facebook.com') !== -1) {
        // Supports official Meta WhatsApp Cloud API endpoint
        var headers = {};
        if (authToken) headers['Authorization'] = 'Bearer ' + authToken;
        resp = UrlFetchApp.fetch(freeWebhook, {
          method: 'post',
          contentType: 'application/json',
          headers: headers,
          payload: JSON.stringify({
            messaging_product: 'whatsapp',
            to: fullPhone,
            type: 'text',
            text: { body: waText }
          }),
          muteHttpExceptions: true
        });
      } else {
        var postOpts = {
          method: 'post',
          contentType: 'application/json',
          payload: JSON.stringify({
            phone: fullPhone,
            mobile: cleanDigits,
            to: fullPhone,
            message: waText,
            text: waText,
            otp: otpCode,
            recipientName: recipientName || 'Student'
          }),
          muteHttpExceptions: true
        };
        if (authToken) postOpts.headers = { 'Authorization': 'Bearer ' + authToken };
        resp = UrlFetchApp.fetch(freeWebhook, postOpts);
      }
      var code = resp ? resp.getResponseCode() : 0;
      webhookDispatched = code >= 200 && code < 300;
      if (!webhookDispatched) {
        gatewayError = 'HTTP ' + code;
      }
    } else {
      gatewayError = 'Webhook URL not configured';
    }
  } catch (err) {
    gatewayError = String(err || 'Gateway dispatch error');
  }

  // Never echo the raw OTP back to the client response
  return {
    freeMode: true,
    mobile: cleanDigits,
    webhookDispatched: webhookDispatched,
    gatewayError: gatewayError
  };
}

function handleSendWhatsAppOtp(payload) {
  var userId = String(payload.userId || '').trim();
  var email = String(payload.email || '').toLowerCase().trim();
  var mobileReq = String(payload.mobile || '').replace(/\D/g, '').slice(-10);
  var cache = DbConnectionManager.getCache();
  var users = getSheetData('USERS');
  for (var i = 0; i < users.length; i++) {
    var u = users[i];
    if (
      (userId && String(u.UserID) === userId) ||
      (email && String(u.Email || '').toLowerCase().trim() === email) ||
      (mobileReq && String(u.Mobile || '').replace(/\D/g, '').slice(-10) === mobileReq)
    ) {
      var waOtpCode = String(Math.floor(100000 + Math.random() * 900000));
      if (cache) {
        cache.put('WA_OTP_' + u.UserID, waOtpCode, 600);
        cache.put('MOB_OTP_' + u.UserID, waOtpCode, 600);
      }
      var targetMob = mobileReq || String(u.Mobile || '').replace(/\D/g, '').slice(-10);
      var waInfo = isWhatsAppWebhookConfigured()
        ? sendFreeWhatsAppOtpMessage(targetMob, u.Name, waOtpCode, payload.purpose || 'WhatsApp Mobile Verification')
        : { webhookDispatched: false, gatewayError: 'Webhook URL not configured' };

      var channel = waInfo.webhookDispatched ? 'whatsapp' : 'email_fallback';
      if (!waInfo.webhookDispatched && u.Email && String(u.Email).indexOf('@') !== -1) {
        sendPortalEmailNotification(
          u.Email,
          'Mobile / WhatsApp Verification OTP (+91-' + targetMob + ') — RP Skill | Ranjan Pathshala',
          'Hello ' + String(u.Name || 'Student') + ',\n\nYour 6-digit Mobile / WhatsApp Verification OTP for +91-' + targetMob + ' is: ' + waOtpCode + '\n\n(Sent via registered email fallback because WhatsApp Gateway webhook is not configured or unreachable.)\n\nValid for 10 minutes.\nRP Skill | Ranjan Pathshala'
        );
      }
      return {
        success: true,
        freeOfCost: true,
        channel: channel,
        mobile: targetMob,
        whatsappDispatched: Boolean(waInfo.webhookDispatched),
        message: waInfo.webhookDispatched
          ? ('6-digit WhatsApp OTP dispatched to +91-' + targetMob + '. Please check your WhatsApp messages.')
          : ('6-digit Mobile Verification OTP for +91-' + targetMob + ' has been sent to your registered email (' + String(u.Email || '') + '). Configure a WhatsApp Webhook URL in Admin → Enterprise Ops for direct WhatsApp delivery.')
      };
    }
  }
  return { success: false, message: 'User account not found for WhatsApp OTP.' };
}

function handleVerifyWhatsAppOtp(payload) {
  var userId = String(payload.userId || '').trim();
  var mobileOtpInput = String(payload.mobileOtpCode || payload.otpCode || '').trim();
  if (!userId || !mobileOtpInput) {
    return { success: false, message: 'User ID and 6-digit WhatsApp OTP are required.' };
  }
  var cache = DbConnectionManager.getCache();
  var cachedWaOtp = cache ? cache.get('WA_OTP_' + userId) : null;
  if (!cachedWaOtp || String(cachedWaOtp).trim() !== mobileOtpInput) {
    return { success: false, verified: false, message: 'Invalid or expired 6-digit WhatsApp OTP.' };
  }
  if (cache) cache.remove('WA_OTP_' + userId);

  var users = getSheetData('USERS');
  var userSheet = getOrCreateSheet('USERS');
  for (var i = 0; i < users.length; i++) {
    if (String(users[i].UserID) === userId) {
      var prefs = readUserSettingsFromRow(users[i], false);
      prefs.mobileVerified = true;
      prefs.mobileVerifiedAt = new Date().toISOString();
      syncUserReadableColumns(userSheet, i + 2, users[i], prefs);
      invalidateSheetCache('USERS');
      return {
        success: true,
        verified: true,
        mobileVerified: true,
        emailVerified: Boolean(prefs.emailVerified === true),
        message: 'Mobile number verified via WhatsApp OTP!'
      };
    }
  }
  return { success: false, message: 'User not found.' };
}

function handleSendMfaOtp(payload) {
  var userId = String(payload.userId || '').trim();
  var email = String(payload.email || payload.identifier || '').toLowerCase().trim();
  var cache = DbConnectionManager.getCache();
  var waWebhookEnabled = isWhatsAppWebhookConfigured();

  // Check if there is a staged pending signup awaiting OTP verification
  if (cache) {
    var pendingRaw = (userId && cache.get('PENDING_SIGNUP_' + userId)) || (email && cache.get('PENDING_SIGNUP_EMAIL_' + email));
    if (pendingRaw) {
      try {
        var pending = JSON.parse(pendingRaw);
        var newOtp = String(Math.floor(100000 + Math.random() * 900000));
        var newWaOtp = waWebhookEnabled ? String(Math.floor(100000 + Math.random() * 900000)) : '';
        pending.otpCode = newOtp;
        pending.waOtpCode = newWaOtp;
        var updatedJson = JSON.stringify(pending);
        cache.put('PENDING_SIGNUP_' + pending.userId, updatedJson, 600);
        cache.put('PENDING_SIGNUP_EMAIL_' + pending.email, updatedJson, 600);
        cache.put('MFA_OTP_' + pending.userId, newOtp, 600);
        if (newWaOtp) {
          cache.put('WA_OTP_' + pending.userId, newWaOtp, 600);
        }
        var sentPending = sendPortalEmailNotification(
          pending.email,
          '2FA Verification Code - RP Skill | Ranjan Pathshala',
          'Hello ' + pending.name + ',\n\nYour 6-digit verification code to complete registration is: ' + newOtp + '\n\nValid for 10 minutes.\n\nRP Skill Security Cell',
          '<div style="font-family:Segoe UI,Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px;border:1px solid #e2e8f0;border-radius:12px;background:#ffffff;color:#0f172a;">' +
            '<h2 style="margin:0 0 10px 0;color:#4f46e5;">🔐 2FA Registration Verification Code</h2>' +
            '<p style="font-size:14px;color:#334155;">Hello <strong>' + pending.name + '</strong>, enter this 6-digit OTP to verify your email and complete registration:</p>' +
            '<div style="background:#eef2ff;border:1px dashed #6366f1;border-radius:10px;padding:16px;text-align:center;margin:16px 0;">' +
              '<span style="font-size:26px;font-weight:800;letter-spacing:6px;color:#312e81;">' + newOtp + '</span>' +
            '</div>' +
          '</div>'
        );
        if (waWebhookEnabled && newWaOtp) {
          sendFreeWhatsAppOtpMessage(pending.mobile, pending.name, newWaOtp, 'Registration Mobile Verification');
        }
        return {
          success: true,
          emailSent: sentPending,
          whatsappOtpRequired: waWebhookEnabled,
          message: waWebhookEnabled
            ? ('Fresh 6-digit Email OTP (' + pending.email + ') & WhatsApp OTP (+91-' + pending.mobile + ') dispatched!')
            : ('Fresh 6-digit verification OTP sent to ' + pending.email + '. Please check your inbox.')
        };
      } catch (e) {}
    }
  }

  var users = getSheetData('USERS');
  for (var i = 0; i < users.length; i++) {
    if ((userId && String(users[i].UserID) === userId) || (email && (String(users[i].Email).toLowerCase().trim() === email || String(users[i].Mobile).trim() === email))) {
      var u = users[i];
      var otpCode = String(Math.floor(100000 + Math.random() * 900000));
      var waOtpCode = waWebhookEnabled ? String(Math.floor(100000 + Math.random() * 900000)) : '';
      if (cache) {
        cache.put('MFA_OTP_' + u.UserID, otpCode, 600);
        if (waOtpCode) cache.put('WA_OTP_' + u.UserID, waOtpCode, 600);
      }
      var sent = sendPortalEmailNotification(
        u.Email,
        '2FA Verification Code - RP Skill | Ranjan Pathshala',
        'Hello ' + u.Name + ',\n\nYour 6-digit verification code is: ' + otpCode + '\n\nValid for 10 minutes.\n\nRP Skill Security Cell',
        '<div style="font-family:Segoe UI,Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px;border:1px solid #e2e8f0;border-radius:12px;background:#ffffff;color:#0f172a;">' +
          '<h2 style="margin:0 0 10px 0;color:#4f46e5;">🔐 2FA Security Verification Code</h2>' +
          '<p style="font-size:14px;color:#334155;">Hello <strong>' + u.Name + '</strong>, use this code to verify your identity:</p>' +
          '<div style="background:#eef2ff;border:1px dashed #6366f1;border-radius:10px;padding:16px;text-align:center;margin:16px 0;">' +
            '<span style="font-size:26px;font-weight:800;letter-spacing:6px;color:#312e81;">' + otpCode + '</span>' +
          '</div>' +
        '</div>'
      );
      if (waWebhookEnabled && waOtpCode) {
        sendFreeWhatsAppOtpMessage(u.Mobile, u.Name, waOtpCode, 'Account Mobile Verification');
      }
      return {
        success: true,
        emailSent: sent,
        whatsappOtpRequired: waWebhookEnabled,
        message: waWebhookEnabled
          ? ('6-digit Email OTP (' + u.Email + ') & WhatsApp OTP (+91-' + u.Mobile + ') dispatched!')
          : ('6-digit verification OTP sent to ' + u.Email + '. Please check your email inbox.')
      };
    }
  }
  return { success: false, message: 'User account not found for MFA verification.' };
}

function handleVerifyMfaOtp(payload) {
  var userId = String(payload.userId || '').trim();
  var code = String(payload.code || payload.otpCode || '').trim();
  var mobileOtpCode = String(payload.mobileOtpCode || '').trim();
  var identifier = String(payload.identifier || payload.email || '').toLowerCase().trim();
  var waWebhookEnabled = isWhatsAppWebhookConfigured();

  if (!code && !mobileOtpCode) {
    return { success: false, message: 'Please enter the 6-digit verification OTP code.' };
  }

  var cache = DbConnectionManager.getCache();
  if (cache) {
    var pendingRaw = (userId && cache.get('PENDING_SIGNUP_' + userId)) || (identifier && cache.get('PENDING_SIGNUP_EMAIL_' + identifier));
    if (pendingRaw) {
      try {
        var pending = JSON.parse(pendingRaw);
        var expectedOtp = String(cache.get('MFA_OTP_' + pending.userId) || pending.otpCode || '').trim();
        var expectedWaOtp = waWebhookEnabled ? String(cache.get('WA_OTP_' + pending.userId) || pending.waOtpCode || '').trim() : '';
        if (!expectedOtp || code !== expectedOtp) {
          return { success: false, message: 'Invalid or expired 6-digit Email OTP. Please check your inbox.' };
        }
        if (waWebhookEnabled && expectedWaOtp && (!mobileOtpCode || mobileOtpCode !== expectedWaOtp)) {
          return { success: false, message: 'Invalid or missing 6-digit WhatsApp Mobile OTP.' };
        }
        // OTP verified! Now commit the new user row to the USERS Google Sheet with salted SHA-256 password hash
        var sheet = getOrCreateSheet('USERS');
        var existingRowsCheck = getSheetData('USERS');
        var alreadyCommitted = false;
        for (var exIdx = 0; exIdx < existingRowsCheck.length; exIdx++) {
          if (String(existingRowsCheck[exIdx].Email || '').toLowerCase().trim() === String(pending.email || '').toLowerCase().trim()) {
            alreadyCommitted = true;
            break;
          }
        }
        if (!alreadyCommitted) {
          var storedHash = pending.passwordHash || hashPasswordWithSalt(pending.password || '');
          var waVerifiedNow = Boolean(waWebhookEnabled && expectedWaOtp && mobileOtpCode && mobileOtpCode === expectedWaOtp);
          var verifiedPrefsObj = {
            emailVerified: true,
            mobileVerified: waVerifiedNow,
            mfaEnabled: false,
            verifiedAt: new Date().toISOString()
          };
          appendUserRowClean(sheet, {
            UserID: pending.userId,
            Name: pending.name,
            Email: pending.email,
            Mobile: pending.mobile,
            Password: storedHash,
            Role: pending.role,
            Status: pending.status,
            SessionToken: '-',
            CreatedDate: pending.createdDate,
            AdminPermissions: pending.defaultPerms,
            Batch: normalizeUserBatchesWithFreeTier(pending.batch || 'RP-Trail')
          }, verifiedPrefsObj);
          try { SpreadsheetApp.flush(); } catch (flushSignupErr) {}
          invalidateSheetCache('USERS');
        }

        cache.remove('MFA_OTP_' + pending.userId);
        cache.remove('WA_OTP_' + pending.userId);
        cache.remove('PENDING_SIGNUP_' + pending.userId);
        cache.remove('PENDING_SIGNUP_EMAIL_' + pending.email);

        var regDateFormatted = Utilities.formatDate(new Date(), DbConnectionManager.getTimeZone(), 'dd MMM yyyy, hh:mm:ss a');
        sendPortalEmailNotification(
          pending.email,
          'Registration Successfully — Welcome to RP Skill | Ranjan Pathshala',
          'Dear ' + pending.name + ',\n\n' +
          'Congratulations! Your registration on RP Skill | Ranjan Pathshala is now complete and your email has been verified.\n\n' +
          '--- YOUR OFFICIAL REGISTERED ACCOUNT SUMMARY ---\n' +
          'User ID: ' + pending.userId + '\n' +
          'Full Name: ' + pending.name + '\n' +
          'Email ID: ' + pending.email + '\n' +
          'Mobile No: ' + pending.mobile + '\n' +
          'Password: (Secured with Salted SHA-256 Encryption)\n' +
          'Role: ' + String(pending.role || 'user').toUpperCase() + '\n' +
          'Batch: ' + (pending.batch || 'RP-Trail') + '\n' +
          'Account Status: ACTIVE & EMAIL VERIFIED\n' +
          'Registration Date: ' + regDateFormatted + '\n\n' +
          'Best Regards,\nExamination & Academic Cell\nRP Skill | Ranjan Pathshala',
          '<div style="font-family:Segoe UI,Arial,sans-serif;max-width:580px;margin:0 auto;padding:24px;border:1px solid #cbd5e1;border-top:5px solid #10b981;border-radius:14px;background:#ffffff;color:#0f172a;">' +
            '<h2 style="margin:0 0 10px 0;color:#059669;font-size:20px;">🎉 Registration Completed — Welcome to RP Skill | Ranjan Pathshala!</h2>' +
            '<p style="font-size:14px;line-height:1.6;color:#334155;">Dear <strong>' + pending.name + '</strong>, your email verification is complete and your official candidate account is now active:</p>' +
            '<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:16px;margin:16px 0;font-size:13.5px;line-height:1.85;color:#0f172a;">' +
              '<div><strong>User ID:</strong> <code style="background:#e0f2fe;color:#0369a1;padding:2px 8px;border-radius:4px;font-weight:bold;">' + pending.userId + '</code></div>' +
              '<div><strong>Full Name:</strong> ' + pending.name + '</div>' +
              '<div><strong>Email ID:</strong> ' + pending.email + '</div>' +
              '<div><strong>Mobile No:</strong> ' + pending.mobile + '</div>' +
              '<div><strong>Password Security:</strong> Your Choosen Password </div>' +
              '<div><strong>Account Role:</strong> ' + String(pending.role || 'user').toUpperCase() + '</div>' +
              '<div><strong>Assigned Batch:</strong> ' + (pending.batch || 'RP-Trail') + '</div>' +
              '<div><strong>Verification Status:</strong> <span style="color:#059669;font-weight:bold;">VERIFIED &amp; ACTIVE</span></div>' +
              '<div><strong>Registered On:</strong> ' + regDateFormatted + '</div>' +
            '</div>' +
            '<p style="font-size:12.5px;color:#475569;line-height:1.5;">You can log in anytime using your <strong>Email ID / Mobile No</strong> and your chosen password.</p>' +
            '<p style="font-size:12px;color:#64748b;margin-top:18px;">Best Regards,<br><strong>RP Skill | Ranjan Pathshala Team</strong></p>' +
          '</div>'
        );

        handleLogActivity({
          userId: pending.userId,
          userName: pending.name + ' (' + String(pending.role).toUpperCase() + ')',
          activityType: 'NEW_USER_REGISTERED',
          details: 'New user verified 6-digit OTP, hashed account created in Google Sheets, and welcome email sent to: ' + pending.email
        });

        return handleLogin({
          identifier: pending.email,
          deviceId: payload.deviceId,
          previousToken: payload.previousToken,
          mfaVerified: true
        }, true);
      } catch (pendingErr) {
        return { success: false, message: 'Error committing verified registration: ' + pendingErr.toString() };
      }
    }
  }

  var users = getSheetData('USERS');
  for (var i = 0; i < users.length; i++) {
    var u = users[i];
    if (String(u.UserID) === userId || String(u.Email).toLowerCase().trim() === identifier || String(u.Mobile).trim() === identifier) {
      var prefs = readUserSettingsFromRow(u, false);
      var cachedOtp = cache ? cache.get('MFA_OTP_' + u.UserID) : null;
      var cachedWaOtp = cache ? cache.get('WA_OTP_' + u.UserID) : null;
      var configuredPin = prefs && prefs.mfaPin ? String(prefs.mfaPin).trim() : '';

      var emailOk = !code || (cachedOtp && cachedOtp === code) || (configuredPin && configuredPin === code);
      var mobileOk = !mobileOtpCode || (cachedWaOtp && cachedWaOtp === mobileOtpCode);

      if (emailOk && mobileOk && (code || mobileOtpCode)) {
        if (cache && code && cachedOtp === code) {
          cache.remove('MFA_OTP_' + u.UserID);
        }
        if (cache && mobileOtpCode && cachedWaOtp === mobileOtpCode) {
          cache.remove('WA_OTP_' + u.UserID);
        }
        try {
          var userSheet = getOrCreateSheet('USERS');
          if (code) prefs.emailVerified = true;
          if (mobileOtpCode && cachedWaOtp && cachedWaOtp === mobileOtpCode) prefs.mobileVerified = true;
          prefs.mfaEnabled = false;
          prefs.verifiedAt = new Date().toISOString();
          syncUserReadableColumns(userSheet, i + 2, u, prefs);
          invalidateSheetCache('USERS');
        } catch (prefErr) {}

        var loginResult = handleLogin({
          identifier: u.Email,
          deviceId: payload.deviceId,
          previousToken: payload.previousToken,
          mfaVerified: true
        }, true);
        loginResult.verified = true;
        loginResult.emailVerified = Boolean(prefs.emailVerified);
        loginResult.mobileVerified = Boolean(prefs.mobileVerified);
        return loginResult;
      }
      return { success: false, verified: false, message: !emailOk ? 'Invalid or expired 6-digit Email OTP.' : 'Invalid or expired 6-digit WhatsApp Mobile OTP.' };
    }
  }
  return { success: false, message: 'User record or pending registration not found.' };
}

function handleSaveUserEngagementSession(payload) {
  var userId = String(payload.userId || 'GUEST').trim();
  var userName = sanitizeInput(payload.userName || 'Student');
  var durationSec = Number(payload.durationSec || 0);
  var activeTab = sanitizeInput(payload.activeTab || 'dashboard');
  var summary = sanitizeInput(payload.summary || ('Active session: ' + Math.round(durationSec / 60) + 'm on ' + activeTab));

  handleLogActivity({
    userId: userId,
    userName: userName,
    activityType: 'USER_ENGAGEMENT_SESSION',
    details: summary
  });
  return { success: true };
}

var MAX_BATCH_MONITORS_PER_BATCH = 3;

function normalizeBatchMonitorsEntry(rawEntry) {
  if (!rawEntry) return [];
  var rawList = Array.isArray(rawEntry) ? rawEntry : [rawEntry];
  var out = [];
  var seenUids = {};
  for (var i = 0; i < rawList.length; i++) {
    var item = rawList[i];
    if (!item) continue;
    var uid = '';
    var normObj = null;
    if (typeof item === 'object') {
      uid = String(item.userId || item.UserID || '').trim();
      if (!uid) continue;
      normObj = {
        userId: uid,
        userName: String(item.userName || item.name || uid).trim(),
        email: String(item.email || '-').trim(),
        mobile: String(item.mobile || '-').trim(),
        role: String(item.role || 'user').trim(),
        monitorType: String(item.monitorType || item.designation || 'Top-Performing Student Monitor').trim(),
        designation: String(item.designation || item.monitorType || 'Top-Performing Student Monitor').trim(),
        appointedAt: String(item.appointedAt || new Date().toISOString()),
        appointedBy: String(item.appointedBy || 'Admin').trim()
      };
    } else {
      uid = String(item).trim();
      if (!uid) continue;
      normObj = {
        userId: uid,
        userName: uid,
        email: '-',
        mobile: '-',
        role: 'user',
        monitorType: 'Batch Monitor',
        designation: 'Batch Monitor',
        appointedAt: new Date().toISOString(),
        appointedBy: 'Admin'
      };
    }
    var uidLow = uid.toLowerCase();
    if (!seenUids[uidLow]) {
      seenUids[uidLow] = true;
      out.push(normObj);
      if (out.length >= MAX_BATCH_MONITORS_PER_BATCH) break;
    }
  }
  return out;
}

function isUserInBatchMonitorsList(entryOrList, targetUserId) {
  var uidLow = String(targetUserId || '').trim().toLowerCase();
  if (!uidLow) return false;
  var list = normalizeBatchMonitorsEntry(entryOrList);
  for (var i = 0; i < list.length; i++) {
    if (String(list[i].userId || '').trim().toLowerCase() === uidLow) {
      return true;
    }
  }
  return false;
}

function parseBatchMonitorsSettings(settings) {
  for (var i = 0; i < settings.length; i++) {
    if (String(settings[i].Key).toUpperCase().trim() === 'BATCH_MONITORS_JSON') {
      var parsed = parseReadableSheetData(settings[i].Value, {});
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        var normalizedMap = {};
        for (var bKey in parsed) {
          if (!parsed.hasOwnProperty(bKey)) continue;
          var list = normalizeBatchMonitorsEntry(parsed[bKey]);
          if (list.length > 0) {
            normalizedMap[bKey] = list;
          }
        }
        return normalizedMap;
      }
    }
  }
  return {};
}

function parseBatchGroupMessagesSettings(settings) {
  for (var i = 0; i < settings.length; i++) {
    if (String(settings[i].Key).toUpperCase().trim() === 'BATCH_GROUP_MESSAGES_JSON') {
      var parsed = parseReadableSheetData(settings[i].Value, []);
      if (Array.isArray(parsed)) return parsed;
    }
  }
  return [];
}

function parseDateSpecificBannersSettings(settings) {
  for (var i = 0; i < settings.length; i++) {
    if (String(settings[i].Key).toUpperCase().trim() === 'DATE_SPECIFIC_BANNERS_JSON') {
      var parsed = parseReadableSheetData(settings[i].Value, []);
      if (Array.isArray(parsed)) return parsed;
    }
  }
  return [];
}

function parseScheduledLiveTestsSettings(settings) {
  for (var i = 0; i < settings.length; i++) {
    if (String(settings[i].Key).toUpperCase().trim() === 'SCHEDULED_LIVE_TESTS_JSON') {
      var parsed = parseReadableSheetData(settings[i].Value, []);
      if (Array.isArray(parsed)) return parsed;
    }
  }
  return [];
}

function parseInstituteBatchesSettings(settings) {
  for (var i = 0; i < settings.length; i++) {
    if (String(settings[i].Key).toUpperCase().trim() === 'INSTITUTE_BATCHES_JSON') {
      var parsed = parseReadableSheetData(settings[i].Value, []);
      if (Array.isArray(parsed)) return parsed;
    }
  }
  return [];
}

function upsertSettingsJsonKey(keyName, jsonValue) {
  var sheet = getOrCreateSheet('SETTINGS');
  var data = sheet.getDataRange().getValues();
  var rowIdx = 0;
  var upperKey = String(keyName).toUpperCase().trim();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]).toUpperCase().trim() === upperKey) {
      rowIdx = i + 1;
      break;
    }
  }
  var safeReadable = formatReadableSheetData(jsonValue, 48500);
  if (rowIdx > 0) {
    sheet.getRange(rowIdx, 2).setValue(safeReadable);
  } else {
    sheet.appendRow([upperKey, safeReadable]);
  }
  invalidateSheetCache('SETTINGS');
}

function upsertSettingsExactJsonKey(keyName, jsonValue) {
  var sheet = getOrCreateSheet('SETTINGS');
  var data = sheet.getDataRange().getValues();
  var rowIdx = 0;
  var upperKey = String(keyName).toUpperCase().trim();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]).toUpperCase().trim() === upperKey) {
      rowIdx = i + 1;
      break;
    }
  }
  var serialized = '';
  try {
    serialized = JSON.stringify(jsonValue);
  } catch (err) {
    serialized = formatReadableSheetData(jsonValue, 48500);
  }
  if (serialized.length > 49500) {
    serialized = serialized.substring(0, 49500);
  }
  if (rowIdx > 0) {
    sheet.getRange(rowIdx, 2).setValue(serialized);
  } else {
    sheet.appendRow([upperKey, serialized]);
  }
  try { SpreadsheetApp.flush(); } catch (flushErr) {}
  invalidateSheetCache('SETTINGS');
}

function handleAppointBatchMonitor(payload) {
  var batchName = String(payload.batchName || payload.batch || '').trim();
  var targetUserId = String(payload.targetUserId || payload.userId || '').trim();
  var userName = sanitizeInput(String(payload.userName || targetUserId));
  var designation = sanitizeInput(String(payload.monitorType || payload.designation || 'Top-Performing Student Monitor'));
  var isMonitor = payload.isMonitor !== false;

  if (!batchName) {
    return { success: false, message: 'Batch name is required.' };
  }

  var sheet = getOrCreateSheet('SETTINGS');
  var data = sheet.getDataRange().getValues();
  var rowIdx = 0;
  var rawMonitorsMap = {};
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]).toUpperCase().trim() === 'BATCH_MONITORS_JSON') {
      rowIdx = i + 1;
      rawMonitorsMap = parseReadableSheetData(data[i][1], {}) || {};
      break;
    }
  }

  var monitorsMap = {};
  for (var bk in rawMonitorsMap) {
    if (!rawMonitorsMap.hasOwnProperty(bk)) continue;
    var normArr = normalizeBatchMonitorsEntry(rawMonitorsMap[bk]);
    if (normArr.length > 0) monitorsMap[bk] = normArr;
  }

  var currentList = normalizeBatchMonitorsEntry(monitorsMap[batchName]);
  var nextList = currentList.slice();

  if (Array.isArray(payload.monitorsList)) {
    // Authoritative multi-monitor list sync from Admin UI (capped at MAX_BATCH_MONITORS_PER_BATCH = 3)
    var cleanPassed = [];
    for (var pIdx = 0; pIdx < payload.monitorsList.length; pIdx++) {
      var item = payload.monitorsList[pIdx];
      if (!item || !item.userId) continue;
      cleanPassed.push({
        userId: String(item.userId).trim(),
        userName: sanitizeInput(String(item.userName || item.name || item.userId)),
        email: String(item.email || '-'),
        mobile: String(item.mobile || '-'),
        role: String(item.role || 'user'),
        monitorType: sanitizeInput(String(item.monitorType || item.designation || 'Top-Performing Student Monitor')),
        designation: sanitizeInput(String(item.designation || item.monitorType || 'Top-Performing Student Monitor')),
        appointedAt: String(item.appointedAt || new Date().toISOString()),
        appointedBy: sanitizeInput(String(item.appointedBy || payload.appointedBy || payload.requesterName || 'Admin'))
      });
    }
    nextList = normalizeBatchMonitorsEntry(cleanPassed);
  } else if (isMonitor && targetUserId) {
    var targetLow = targetUserId.toLowerCase();
    var existingIdx = -1;
    for (var ei = 0; ei < nextList.length; ei++) {
      if (String(nextList[ei].userId || '').trim().toLowerCase() === targetLow) {
        existingIdx = ei;
        break;
      }
    }
    if (existingIdx === -1 && nextList.length >= MAX_BATCH_MONITORS_PER_BATCH) {
      return {
        success: false,
        batchMonitors: monitorsMap,
        batchMonitorsMap: monitorsMap,
        message: 'Maximum ' + MAX_BATCH_MONITORS_PER_BATCH + ' Batch Monitors can be appointed for "' + batchName + '". Remove an existing monitor first.'
      };
    }
    var newMonitorObj = {
      userId: targetUserId,
      userName: userName,
      email: String(payload.email || '-'),
      mobile: String(payload.mobile || '-'),
      role: String(payload.role || 'user'),
      monitorType: designation,
      designation: designation,
      appointedAt: new Date().toISOString(),
      appointedBy: sanitizeInput(String(payload.appointedBy || payload.requesterName || 'Admin'))
    };
    if (existingIdx >= 0) {
      nextList[existingIdx] = newMonitorObj;
    } else {
      nextList.push(newMonitorObj);
    }
  } else {
    if (targetUserId) {
      var remLow = targetUserId.toLowerCase();
      nextList = nextList.filter(function(m) {
        return String(m.userId || '').trim().toLowerCase() !== remLow;
      });
    } else {
      nextList = [];
    }
  }

  if (nextList.length > 0) {
    monitorsMap[batchName] = nextList.slice(0, MAX_BATCH_MONITORS_PER_BATCH);
  } else {
    delete monitorsMap[batchName];
  }

  var readableStr = formatReadableSheetData(monitorsMap);
  if (rowIdx > 0) {
    sheet.getRange(rowIdx, 2).setValue(readableStr);
  } else {
    sheet.appendRow(['BATCH_MONITORS_JSON', readableStr]);
  }
  invalidateSheetCache('SETTINGS');

  handleLogActivity({
    userId: payload.requesterId || 'ADMIN',
    userName: payload.appointedBy || payload.requesterName || 'Admin',
    activityType: isMonitor ? 'APPOINT_BATCH_MONITOR' : 'REMOVE_BATCH_MONITOR',
    details: isMonitor
      ? ('Appointed ' + userName + ' (' + targetUserId + ') as ' + designation + ' for batch "' + batchName + '" (' + (monitorsMap[batchName] ? monitorsMap[batchName].length : 0) + '/' + MAX_BATCH_MONITORS_PER_BATCH + ')')
      : ('Removed Batch Monitor ' + (targetUserId ? ('(' + targetUserId + ') ') : '') + 'from batch "' + batchName + '" (' + (monitorsMap[batchName] ? monitorsMap[batchName].length : 0) + '/' + MAX_BATCH_MONITORS_PER_BATCH + ' remaining)')
  });

  return {
    success: true,
    batchMonitors: monitorsMap,
    batchMonitorsMap: monitorsMap,
    monitorsForBatch: monitorsMap[batchName] || [],
    maxMonitors: MAX_BATCH_MONITORS_PER_BATCH,
    message: isMonitor
      ? ('Appointed ' + userName + ' as Batch Monitor for "' + batchName + '" (' + (monitorsMap[batchName] ? monitorsMap[batchName].length : 0) + '/' + MAX_BATCH_MONITORS_PER_BATCH + ').')
      : ('Removed Batch Monitor for "' + batchName + '" (' + (monitorsMap[batchName] ? monitorsMap[batchName].length : 0) + '/' + MAX_BATCH_MONITORS_PER_BATCH + ' remaining).')
  };
}

function handleSaveBatchGroupMessage(payload) {
  var batchName = sanitizeInput(String(payload.batchName || payload.batch || 'General Batch').trim());
  var senderId = String(payload.authorId || payload.senderId || payload.userId || 'USER').trim();
  var senderName = sanitizeInput(String(payload.authorName || payload.senderName || payload.userName || 'Batch Member'));
  var senderRole = sanitizeInput(String(payload.authorRole || payload.senderRole || 'Student'));
  var messageText = sanitizeInput(String(payload.message || payload.messageText || '').trim());
  var msgType = sanitizeInput(String(payload.tag || payload.msgType || 'discussion'));
  var visibility = String(payload.visibility || (msgType === 'private_query' ? 'private_monitor' : 'directive')).toLowerCase().trim();
  var isPinned = Boolean(payload.pinned !== undefined ? payload.pinned : payload.isPinned);
  var targetWpm = sanitizeInput(String(payload.targetWpm || '').trim());
  var targetAcc = sanitizeInput(String(payload.targetAcc || '').trim());
  var targetDeadline = sanitizeInput(String(payload.targetDeadline || '').trim());

  if (!messageText || messageText === '-') {
    return { success: false, message: 'Message text cannot be empty.' };
  }

  var sheet = getOrCreateSheet('SETTINGS');
  var data = sheet.getDataRange().getValues();
  var rowIdx = 0;
  var messagesList = [];
  var monitorsMap = {};
  for (var i = 1; i < data.length; i++) {
    var k = String(data[i][0]).toUpperCase().trim();
    if (k === 'BATCH_GROUP_MESSAGES_JSON') {
      rowIdx = i + 1;
      messagesList = parseReadableSheetData(data[i][1], []);
      if (!Array.isArray(messagesList)) messagesList = [];
    } else if (k === 'BATCH_MONITORS_JSON') {
      monitorsMap = parseReadableSheetData(data[i][1], {}) || {};
    }
  }

  var roleLower = String(senderRole || '').toLowerCase();
  var isSuperOrAdmin = (roleLower.indexOf('superadmin') !== -1 || roleLower === 'admin' || roleLower.indexOf('instructor') !== -1);
  var appointedListForBatch = normalizeBatchMonitorsEntry(monitorsMap[batchName]);
  var primaryMonitorForBatch = appointedListForBatch.length > 0 ? appointedListForBatch[0] : null;
  var isMonitorOfTargetBatch = isUserInBatchMonitorsList(appointedListForBatch, senderId);

  // Verify non-admin sender is actually enrolled in or appointed as Batch Monitor for target batchName
  if (!isSuperOrAdmin && !isMonitorOfTargetBatch) {
    var allUsersForCheck = getSheetData('USERS');
    var senderAllowedInBatch = true;
    for (var uChk = 0; uChk < allUsersForCheck.length; uChk++) {
      if (String(allUsersForCheck[uChk].UserID) === String(senderId)) {
        var uBatchesRaw = String(allUsersForCheck[uChk].Batch || 'General Batch').split(',').map(function(b) { return b.trim().toLowerCase(); });
        senderAllowedInBatch = uBatchesRaw.indexOf(String(batchName).toLowerCase()) !== -1;
        break;
      }
    }
    if (!senderAllowedInBatch) {
      return {
        success: false,
        message: 'Access Restricted: You can only post or message inside batches in which you are enrolled or appointed as Batch Monitor.'
      };
    }
  }

  // Support 4 communication channels:
  // 1) 'directive' (Pinned / Official Announcements shown on Dashboard & Batch Hub)
  // 2) 'general_chat' (General Batch Communication shown in Batch Monitor & Communication tab only)
  // 3) 'poll' (Interactive Batch Poll shown in Batch Monitor & Communication tab only)
  // 4) 'private_monitor' (Private 1-to-1 Query to Batch Monitor)
  if (visibility === 'private_monitor' || msgType === 'private_query') {
    visibility = 'private_monitor';
    msgType = 'private_query';
    isPinned = false;
  } else if (msgType === 'poll' || visibility === 'poll' || Array.isArray(payload.pollOptions)) {
    if (!isSuperOrAdmin && !isMonitorOfTargetBatch) {
      return {
        success: false,
        message: 'Permission Denied: Only Batch Monitors, Admins, and Superadmins can create batch polls.'
      };
    }
    visibility = 'poll';
    msgType = 'poll';
  } else if (visibility === 'general_chat' || msgType === 'general_chat' || msgType === 'discussion') {
    if (!isSuperOrAdmin && !isMonitorOfTargetBatch && isPinned) {
      isPinned = false;
    }
    visibility = (isPinned && (isSuperOrAdmin || isMonitorOfTargetBatch)) ? 'directive' : 'general_chat';
  } else {
    if (!isSuperOrAdmin && !isMonitorOfTargetBatch) {
      visibility = 'general_chat';
      isPinned = false;
    } else {
      visibility = 'directive';
    }
  }

  var recipientMonitorId = String(payload.recipientMonitorId || (primaryMonitorForBatch ? primaryMonitorForBatch.userId : 'MONITOR')).trim();
  var recipientMonitorName = sanitizeInput(String(payload.recipientMonitorName || (primaryMonitorForBatch ? primaryMonitorForBatch.userName : 'Appointed Batch Monitor')));
  var studentUserId = String(payload.studentUserId || senderId).trim();
  var studentUserName = sanitizeInput(String(payload.studentUserName || senderName));

  var pollOptionsClean = [];
  if (Array.isArray(payload.pollOptions)) {
    for (var pIdx = 0; pIdx < payload.pollOptions.length; pIdx++) {
      var rawOpt = payload.pollOptions[pIdx];
      var optText = typeof rawOpt === 'string' ? rawOpt : (rawOpt && rawOpt.text ? rawOpt.text : '');
      optText = sanitizeInput(String(optText || '').trim());
      if (optText && optText !== '-') {
        pollOptionsClean.push({
          id: (rawOpt && rawOpt.id) ? String(rawOpt.id) : ('OPT-' + (pIdx + 1)),
          text: optText,
          votes: (rawOpt && Array.isArray(rawOpt.votes)) ? rawOpt.votes : []
        });
      }
    }
  }

  var nowIso = payload.createdAt || new Date().toISOString();
  var newMsg = {
    id: String(payload.id || ('BMSG-' + Date.now() + '-' + Math.floor(100 + Math.random() * 899))),
    batchName: batchName,
    authorId: senderId,
    senderId: senderId,
    authorName: senderName,
    senderName: senderName,
    authorRole: senderRole,
    senderRole: senderRole,
    visibility: visibility,
    recipientMonitorId: recipientMonitorId,
    recipientMonitorName: recipientMonitorName,
    studentUserId: studentUserId,
    studentUserName: studentUserName,
    status: visibility === 'private_monitor' ? 'open' : 'published',
    replies: Array.isArray(payload.replies) ? payload.replies : [],
    message: messageText,
    messageText: messageText,
    tag: msgType,
    msgType: msgType,
    pinned: isPinned,
    isPinned: isPinned,
    pollQuestion: msgType === 'poll' ? messageText : '',
    pollOptions: pollOptionsClean,
    pollStartTime: String(payload.pollStartTime || payload.startTime || '').trim(),
    pollEndTime: String(payload.pollEndTime || payload.endTime || '').trim(),
    allowMultiple: Boolean(payload.allowMultiple),
    targetWpm: targetWpm !== '-' ? targetWpm : '',
    targetAcc: targetAcc !== '-' ? targetAcc : '',
    targetDeadline: targetDeadline !== '-' ? targetDeadline : '',
    createdAt: nowIso,
    timestamp: nowIso
  };

  messagesList.unshift(newMsg);
  if (messagesList.length > 120) {
    messagesList = messagesList.slice(0, 120);
  }

  var readableMessagesStr = formatReadableSheetData(messagesList, 48500);
  if (rowIdx > 0) {
    sheet.getRange(rowIdx, 2).setValue(readableMessagesStr);
  } else {
    sheet.appendRow(['BATCH_GROUP_MESSAGES_JSON', readableMessagesStr]);
  }
  invalidateSheetCache('SETTINGS');

  // Also persist to dedicated BATCH_MESSAGES Google Sheet so history is never lost
  try {
    var bSheet = getOrCreateSheet('BATCH_MESSAGES');
    bSheet.appendRow([
      newMsg.id,
      newMsg.batchName,
      newMsg.authorId,
      newMsg.authorName,
      newMsg.authorRole,
      newMsg.visibility,
      newMsg.recipientMonitorId,
      newMsg.studentUserId,
      newMsg.studentUserName,
      newMsg.tag,
      newMsg.pinned ? 'TRUE' : 'FALSE',
      safeSheetCellValue(newMsg.message, 45000),
      defaultDash(newMsg.targetWpm),
      defaultDash(newMsg.targetAcc),
      defaultDash(newMsg.targetDeadline),
      '(empty list)',
      newMsg.status,
      newMsg.timestamp
    ]);
    invalidateSheetCache('BATCH_MESSAGES');
  } catch (bErr) {}

  handleLogActivity({
    userId: senderId,
    userName: senderName + ' (' + senderRole + ')',
    activityType: visibility === 'private_monitor' ? 'BATCH_MONITOR_PRIVATE_QUERY' : 'BATCH_INSTRUCTOR_DIRECTIVE',
    details: '[' + batchName + '] [' + visibility.toUpperCase() + '] ' + messageText.slice(0, 120)
  });

  return {
    success: true,
    newMessage: newMsg,
    batchGroupMessages: messagesList,
    message: visibility === 'private_monitor'
      ? ('Private query sent directly to Batch Monitor (' + recipientMonitorName + ')!')
      : 'Instructor directive posted to Main Announcement Feed!'
  };
}

function handleReplyBatchGroupMessage(payload) {
  var msgId = String(payload.messageId || payload.msgId || payload.id || '').trim();
  var replyText = sanitizeInput(String(payload.replyText || payload.message || '').trim());
  var replierId = String(payload.replierId || payload.userId || 'MONITOR').trim();
  var replierName = sanitizeInput(String(payload.replierName || payload.userName || 'Batch Monitor'));
  var replierRole = sanitizeInput(String(payload.replierRole || payload.userRole || 'Batch Monitor'));
  var newStatus = String(payload.status || '').toLowerCase().trim();

  if (!msgId) return { success: false, message: 'Message ID is required.' };
  if (!replyText && !newStatus) return { success: false, message: 'Reply message or status update is required.' };

  var sheet = getOrCreateSheet('SETTINGS');
  var data = sheet.getDataRange().getValues();
  var rowIdx = 0;
  var messagesList = [];
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]).toUpperCase().trim() === 'BATCH_GROUP_MESSAGES_JSON') {
      rowIdx = i + 1;
      messagesList = parseReadableSheetData(data[i][1], []);
      if (!Array.isArray(messagesList)) messagesList = [];
      break;
    }
  }

  var updatedMsg = null;
  var nowIso = new Date().toISOString();
  for (var m = 0; m < messagesList.length; m++) {
    if (String(messagesList[m].id) === msgId) {
      if (!Array.isArray(messagesList[m].replies)) {
        messagesList[m].replies = [];
      }
      if (replyText && replyText !== '-') {
        messagesList[m].replies.push({
          replyId: 'RPL-' + Date.now() + '-' + Math.floor(100 + Math.random() * 899),
          authorId: replierId,
          authorName: replierName,
          authorRole: replierRole,
          message: replyText,
          timestamp: nowIso
        });
      }
      if (newStatus === 'resolved' || newStatus === 'open' || newStatus === 'replied') {
        messagesList[m].status = newStatus;
      } else if (replyText && replyText !== '-') {
        var rRoleLower = String(replierRole).toLowerCase();
        messagesList[m].status = (rRoleLower.indexOf('monitor') !== -1 || rRoleLower.indexOf('instructor') !== -1 || rRoleLower.indexOf('admin') !== -1) ? 'replied' : 'open';
      }
      messagesList[m].updatedAt = nowIso;
      updatedMsg = messagesList[m];
      break;
    }
  }

  if (!updatedMsg) {
    return { success: false, message: 'Query thread not found.' };
  }

  var safeReadableMsgs = formatReadableSheetData(messagesList, 48500);
  if (rowIdx > 0) {
    sheet.getRange(rowIdx, 2).setValue(safeReadableMsgs);
  } else {
    sheet.appendRow(['BATCH_GROUP_MESSAGES_JSON', safeReadableMsgs]);
  }
  invalidateSheetCache('SETTINGS');

  // Update BATCH_MESSAGES sheet row if present
  try {
    var bSheet = DbConnectionManager.getSheet('BATCH_MESSAGES');
    if (bSheet) {
      var bData = bSheet.getDataRange().getValues();
      for (var r = 1; r < bData.length; r++) {
        if (String(bData[r][0]) === msgId) {
          bSheet.getRange(r + 1, 16).setValue(formatReadableSheetData(updatedMsg.replies || [], 45000));
          bSheet.getRange(r + 1, 17).setValue(updatedMsg.status || 'replied');
          invalidateSheetCache('BATCH_MESSAGES');
          break;
        }
      }
    }
  } catch (bErr2) {}

  return {
    success: true,
    updatedMessage: updatedMsg,
    batchGroupMessages: messagesList,
    message: 'Reply synced in real time!'
  };
}

function handleGetBatchGroupMessages(payload) {
  payload = payload || {};
  var settings = getSheetData('SETTINGS');
  var batchGroupMessages = parseBatchGroupMessagesSettings(settings);
  var batchMonitors = parseBatchMonitorsSettings(settings);
  var reqUserId = String(payload.userId || '').trim();
  if (reqUserId) {
    var usersList = getSheetData('USERS');
    var reqUser = null;
    for (var i = 0; i < usersList.length; i++) {
      if (String(usersList[i].UserID) === reqUserId) {
        reqUser = usersList[i];
        break;
      }
    }
    if (reqUser) {
      var roleLower = String(reqUser.Role || 'user').toLowerCase().trim();
      var isStaff = (roleLower === 'admin' || roleLower === 'superadmin' || roleLower === 'instructor');
      if (!isStaff) {
        var allowedBatchesLower = String(reqUser.Batch || 'General Batch')
          .split(',')
          .map(function(b) { return b.trim().toLowerCase(); })
          .filter(Boolean);
        var monitoredBatchesLower = [];
        for (var bKey in batchMonitors) {
          if (!batchMonitors.hasOwnProperty(bKey)) continue;
          if (isUserInBatchMonitorsList(batchMonitors[bKey], reqUserId)) {
            var lowB = String(bKey).trim().toLowerCase();
            monitoredBatchesLower.push(lowB);
            if (allowedBatchesLower.indexOf(lowB) === -1) allowedBatchesLower.push(lowB);
          }
        }
        batchGroupMessages = batchGroupMessages.filter(function(m) {
          var msgBatch = String(m.batchName || 'General Batch').trim().toLowerCase();
          if (allowedBatchesLower.indexOf(msgBatch) === -1) return false;
          if (String(m.visibility || '').toLowerCase() === 'private_monitor') {
            var isMonOfBatch = monitoredBatchesLower.indexOf(msgBatch) !== -1;
            var isStudentOwner = String(m.studentUserId || m.authorId || '') === reqUserId;
            return isMonOfBatch || isStudentOwner;
          }
          return true;
        });
      }
    }
  }
  return {
    success: true,
    batchGroupMessages: batchGroupMessages,
    batchMonitors: batchMonitors,
    batchMonitorsMap: batchMonitors,
    serverTimestamp: new Date().toISOString()
  };
}

function handleSaveSettings(payload) {
  payload = payload || {};
  var updatedKeys = [];
  for (var k in payload) {
    if (!Object.prototype.hasOwnProperty.call(payload, k)) continue;
    if (k === 'actorId' || k === 'actorName') continue;
    upsertSettingsJsonKey(k, payload[k]);
    updatedKeys.push(k);
  }
  return {
    success: true,
    updatedKeys: updatedKeys,
    message: 'Settings saved successfully.'
  };
}

function handleDeleteBatchGroupMessage(payload) {
  var msgId = String(payload.messageId || payload.msgId || payload.id || '').trim();
  if (!msgId) return { success: false, message: 'Message ID required.' };

  var actorId = String(payload._verifiedUserId || '').trim();
  var actorRole = String(payload._verifiedRole || 'user').toLowerCase().trim();
  var isStaff = (actorRole === 'admin' || actorRole === 'superadmin');

  var sheet = getOrCreateSheet('SETTINGS');
  var data = sheet.getDataRange().getValues();
  var rowIdx = 0;
  var messagesList = [];
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]).toUpperCase().trim() === 'BATCH_GROUP_MESSAGES_JSON') {
      rowIdx = i + 1;
      messagesList = parseReadableSheetData(data[i][1], []);
      if (!Array.isArray(messagesList)) messagesList = [];
      break;
    }
  }

  var targetMsg = null;
  for (var t = 0; t < messagesList.length; t++) {
    if (String(messagesList[t].id) === msgId) {
      targetMsg = messagesList[t];
      break;
    }
  }
  if (!targetMsg) {
    return { success: false, message: 'Message not found.' };
  }

  var msgSenderId = String(targetMsg.senderId || targetMsg.userId || '').trim();
  var msgBatchLower = String(targetMsg.batch || targetMsg.targetBatch || '').toLowerCase().trim();
  var isAuthor = Boolean(actorId && msgSenderId && msgSenderId === actorId);
  var isMonitorForBatch = false;
  if (!isStaff && !isAuthor && actorId && msgBatchLower && msgBatchLower !== 'all_batches') {
    var monitoredBatchesLower = getMonitoredBatchesForUserId(actorId).map(function(b) { return String(b || '').toLowerCase().trim(); });
    isMonitorForBatch = monitoredBatchesLower.indexOf(msgBatchLower) !== -1;
  }

  if (!isStaff && !isAuthor && !isMonitorForBatch) {
    return {
      success: false,
      unauthorized: true,
      message: 'Forbidden: Only an Admin, the assigned Batch Monitor, or the original author can delete this message.'
    };
  }

  messagesList = messagesList.filter(function(m) { return String(m.id) !== msgId; });
  if (rowIdx > 0) {
    sheet.getRange(rowIdx, 2).setValue(formatReadableSheetData(messagesList, 48500));
    invalidateSheetCache('SETTINGS');
  }
  return { success: true, batchGroupMessages: messagesList, message: 'Message removed.' };
}

function handleVoteBatchPoll(payload) {
  var pollId = String(payload.pollId || payload.messageId || payload.id || '').trim();
  var optionId = String(payload.optionId || '').trim();
  var hasOptionIdx = payload.optionIndex !== undefined && payload.optionIndex !== null && payload.optionIndex !== '';
  var optionIdx = hasOptionIdx ? parseInt(payload.optionIndex, 10) : -1;
  var actorRole = String(payload._verifiedRole || '').toLowerCase().trim();
  var isStaff = (actorRole === 'admin' || actorRole === 'superadmin');
  var voterId = String(isStaff ? (payload.voterId || payload.userId || payload._verifiedUserId || 'STUDENT') : (payload._verifiedUserId || payload.voterId || payload.userId || 'STUDENT')).trim();
  var voterName = sanitizeInput(String(payload.voterName || payload.userName || 'Student'));
  if (!pollId || (!optionId && (!hasOptionIdx || isNaN(optionIdx) || optionIdx < 0))) {
    return { success: false, message: 'Poll ID and Option ID or Option Index are required.' };
  }

  var sheet = getOrCreateSheet('SETTINGS');
  var data = sheet.getDataRange().getValues();
  var rowIdx = 0;
  var messagesList = [];
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]).toUpperCase().trim() === 'BATCH_GROUP_MESSAGES_JSON') {
      rowIdx = i + 1;
      messagesList = parseReadableSheetData(data[i][1], []);
      if (!Array.isArray(messagesList)) messagesList = [];
      break;
    }
  }

  var updatedPoll = null;
  var pollWindowError = '';
  for (var m = 0; m < messagesList.length; m++) {
    var msg = messagesList[m];
    if (String(msg.id) === pollId && Array.isArray(msg.pollOptions)) {
      var nowMs = Date.now();
      if (msg.pollStartTime) {
        var startMs = new Date(msg.pollStartTime).getTime();
        if (!isNaN(startMs) && nowMs < startMs) {
          pollWindowError = 'This poll has not started yet. Voting opens at ' + msg.pollStartTime + '.';
          break;
        }
      }
      if (msg.pollEndTime) {
        var endMs = new Date(msg.pollEndTime).getTime();
        if (!isNaN(endMs) && nowMs > endMs) {
          pollWindowError = 'Voting has closed for this poll (ended at ' + msg.pollEndTime + ').';
          break;
        }
      }
      var allowMulti = Boolean(msg.allowMultiple);
      for (var o = 0; o < msg.pollOptions.length; o++) {
        var opt = msg.pollOptions[o];
        if (!Array.isArray(opt.votes)) opt.votes = [];
        var existingIdx = -1;
        for (var v = 0; v < opt.votes.length; v++) {
          var vEntry = opt.votes[v];
          var vUid = typeof vEntry === 'string' ? vEntry : (vEntry && vEntry.userId ? vEntry.userId : '');
          if (String(vUid) === voterId) {
            existingIdx = v;
            break;
          }
        }
        var isTargetOption = optionId ? (String(opt.id) === optionId) : (o === optionIdx);
        if (isTargetOption) {
          if (existingIdx !== -1) {
            opt.votes.splice(existingIdx, 1);
          } else {
            opt.votes.push({ userId: voterId, userName: voterName, votedAt: new Date().toISOString() });
          }
        } else if (!allowMulti && existingIdx !== -1) {
          opt.votes.splice(existingIdx, 1);
        }
      }
      msg.updatedAt = new Date().toISOString();
      updatedPoll = msg;
      break;
    }
  }

  if (pollWindowError) {
    return { success: false, message: pollWindowError };
  }
  if (!updatedPoll) {
    return { success: false, message: 'Poll not found.' };
  }

  var safeReadablePollMsgs = formatReadableSheetData(messagesList, 48500);
  if (rowIdx > 0) {
    sheet.getRange(rowIdx, 2).setValue(safeReadablePollMsgs);
  } else {
    sheet.appendRow(['BATCH_GROUP_MESSAGES_JSON', safeReadablePollMsgs]);
  }
  invalidateSheetCache('SETTINGS');

  return {
    success: true,
    updatedPoll: updatedPoll,
    batchGroupMessages: messagesList,
    message: 'Poll vote recorded!'
  };
}

function handleUpdateDateSpecificBanners(payload) {
  var banners = Array.isArray(payload.banners) ? payload.banners : [];
  upsertSettingsJsonKey('DATE_SPECIFIC_BANNERS_JSON', banners);
  return {
    success: true,
    dateSpecificBanners: banners,
    message: 'Date-specific banners saved to Google Sheets.'
  };
}

function handleSaveScheduledLiveTests(payload) {
  var liveTests = Array.isArray(payload.liveTests) ? payload.liveTests : [];
  upsertSettingsJsonKey('SCHEDULED_LIVE_TESTS_JSON', liveTests);
  return {
    success: true,
    scheduledLiveTests: liveTests,
    message: 'Scheduled Live Tests synced to Google Sheets.'
  };
}

function handleSaveInstituteBatches(payload) {
  var batches = Array.isArray(payload.batches) ? payload.batches : [];
  upsertSettingsJsonKey('INSTITUTE_BATCHES_JSON', batches);
  var existingSettings = getSheetData('SETTINGS');
  var valMap = (payload.batchValidityMap && typeof payload.batchValidityMap === 'object')
    ? payload.batchValidityMap
    : parseBatchValidityMapSettings(existingSettings);
  if (payload.batchValidityMap && typeof payload.batchValidityMap === 'object') {
    upsertSettingsJsonKey('BATCH_VALIDITY_MAP_JSON', valMap);
  }
  // Track batch createdAt metadata so Member Past vs. Current vs. Upcoming scopes evaluate accurately
  var metaMap = parseInstituteBatchesMetaSettings(existingSettings);
  var todayIso = Utilities.formatDate(new Date(), DbConnectionManager.getTimeZone(), 'yyyy-MM-dd');
  for (var i = 0; i < batches.length; i++) {
    var bName = String(batches[i] || '').trim();
    if (!bName) continue;
    if (!metaMap[bName]) {
      metaMap[bName] = { name: bName, createdAt: todayIso, validityDate: valMap[bName] || '' };
    } else if (valMap[bName] !== undefined) {
      metaMap[bName].validityDate = valMap[bName];
    }
  }
  upsertSettingsJsonKey('INSTITUTE_BATCHES_META', metaMap);
  return {
    success: true,
    instituteBatches: batches,
    batchValidityMap: valMap,
    batchMetaMap: metaMap,
    message: 'Institute batches & validity schedules saved to Google Sheets.'
  };
}

function handleBulkUpdateUserBatches(payload) {
  var targetBatch = sanitizeInput(String(payload.batch || payload.batchName || 'RP-Trail').trim());
  var userIds = Array.isArray(payload.userIds) ? payload.userIds.map(function(id) { return String(id).trim(); }) : [];
  if (!userIds.length) {
    return { success: false, message: 'No user IDs provided for bulk batch update.' };
  }
  var idLookup = {};
  for (var u = 0; u < userIds.length; u++) {
    idLookup[userIds[u]] = true;
  }

  var sheet = getOrCreateSheet('USERS');
  var data = sheet.getDataRange().getValues();
  var headers = data[0] || [];
  var batchColIdx = headers.indexOf('Batch') + 1;
  if (batchColIdx === 0) {
    batchColIdx = 11;
    sheet.getRange(1, batchColIdx).setValue('Batch');
  }

  var validityDate = sanitizeInput(String(payload.validityDate || payload.enrollmentValidUntil || '').trim());
  var validUntilColIdx = headers.indexOf('BatchValidUntil') + 1;

  var updatedCount = 0;
  for (var i = 1; i < data.length; i++) {
    var uid = String(data[i][0]).trim();
    if (idLookup[uid]) {
      var curBatchVal = String(data[i][batchColIdx - 1] || '');
      var mergedVal = normalizeUserBatchesWithFreeTier(targetBatch + (curBatchVal ? (', ' + curBatchVal) : ''));
      sheet.getRange(i + 1, batchColIdx).setValue(mergedVal);
      if (validityDate && validUntilColIdx > 0) {
        sheet.getRange(i + 1, validUntilColIdx).setValue(validityDate);
      }
      updatedCount++;
    }
  }
  invalidateSheetCache('USERS');
  return {
    success: true,
    updatedCount: updatedCount,
    batch: targetBatch,
    validityDate: validityDate || '',
    message: 'Assigned ' + updatedCount + ' user(s) to batch "' + targetBatch + '"' + (validityDate ? (' (valid until ' + validityDate + ')') : '') + ' in Google Sheets.'
  };
}

// Multi-Device Cloud Storage Sync for User Preferences, Theme, Weak Words, Daily Goals & 24h Notifications
function handleSyncUserCloudState(payload) {
  var userId = String(payload.userId || '').trim();
  if (!userId || userId === 'GUEST') {
    return { success: false, message: 'Valid userId required for cloud state sync.' };
  }
  var userSheet = getOrCreateSheet('USERS');
  var users = getSheetData('USERS');
  for (var i = 0; i < users.length; i++) {
    if (String(users[i].UserID) === userId) {
      var rowIndex = i + 2;
      var existingPrefs = readUserSettingsFromRow(users[i], true);
      if (payload.cloudState && typeof payload.cloudState === 'object') {
        for (var k in payload.cloudState) {
          if (k !== 'adminVisiblePassword') existingPrefs[k] = payload.cloudState[k];
        }
      }
      existingPrefs.cloudSyncedAt = new Date().toISOString();
      syncUserReadableColumns(userSheet, rowIndex, users[i], existingPrefs);
      writeUserCloudStateRow(userId, existingPrefs);
      invalidateSheetCache('USERS');
      return {
        success: true,
        userCloudState: existingPrefs,
        syncedAt: existingPrefs.cloudSyncedAt
      };
    }
  }
  return { success: false, message: 'User not found for cloud sync.' };
}

// =========================================================================
// V.4: 1-Click Google Drive Snapshot Backup of All Sheets (RP_Skill_Backup_YYYY-MM-DD)
// =========================================================================
function handleCreateSpreadsheetBackup(payload) {
  try {
    var ss = DbConnectionManager.getSpreadsheet();
    if (!ss) {
      return { success: false, message: 'Active Google Spreadsheet could not be accessed.' };
    }
    var tz = DbConnectionManager.getTimeZone();
    var dateStamp = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');
    var timeStamp = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd_HHmm');
    var backupName = (payload && payload.customBackupName)
      ? sanitizeInput(String(payload.customBackupName).trim())
      : ('RP_Skill_Backup_' + dateStamp + '_' + Utilities.formatDate(new Date(), tz, 'HHmm'));

    var copiedFileUrl = '';
    var copiedFileId = '';
    var folderName = 'RP_Skill_Database_Backups';

    try {
      var file = DriveApp.getFileById(ss.getId());
      var folders = DriveApp.getFoldersByName(folderName);
      var targetFolder = folders.hasNext() ? folders.next() : DriveApp.createFolder(folderName);
      var copiedFile = file.makeCopy(backupName, targetFolder);
      copiedFileId = copiedFile.getId();
      copiedFileUrl = copiedFile.getUrl();
    } catch (driveErr) {
      var copiedSs = ss.copy(backupName);
      copiedFileId = copiedSs.getId();
      copiedFileUrl = copiedSs.getUrl();
    }

    handleLogActivity({
      userId: (payload && payload.actorId) || 'SUPERADMIN',
      userName: (payload && payload.actorName) || 'Admin/Superadmin',
      activityType: 'GOOGLE_DRIVE_SNAPSHOT_BACKUP',
      details: 'Created full Google Spreadsheet snapshot backup "' + backupName + '" (ID: ' + copiedFileId + ')'
    });

    return {
      success: true,
      backupName: backupName,
      backupId: copiedFileId,
      backupUrl: copiedFileUrl,
      timestamp: timeStamp,
      message: 'Snapshot Backup "' + backupName + '" created in Google Drive!'
    };
  } catch (err) {
    return {
      success: false,
      message: 'Failed to create Google Drive backup: ' + err.toString()
    };
  }
}

// =========================================================================
// V.1: Automated Daily/Weekly Batch Progress Digest Email & Time-Driven Trigger
// =========================================================================
function handleSendBatchDigestEmail(payload) {
  if (payload && payload.parentEmail && String(payload.parentEmail).indexOf('@') !== -1) {
    var pEmail = String(payload.parentEmail).toLowerCase().trim();
    var actorRole = String(payload._verifiedRole || '').toLowerCase().trim();
    var actorId = String(payload._verifiedUserId || '').trim();
    var isStaff = (actorRole === 'admin' || actorRole === 'superadmin');
    if (!isStaff) {
      var usersList = getSheetData('USERS');
      var allowedEmailMatch = false;
      for (var ui = 0; ui < usersList.length; ui++) {
        if (String(usersList[ui].UserID || '').trim() === actorId) {
          var ownEmail = String(usersList[ui].Email || '').toLowerCase().trim();
          var registeredParentEmail = String(usersList[ui].ParentEmail || '').toLowerCase().trim();
          var userSettingsObj = readUserSettingsFromRow(usersList[ui], false);
          var settingsParentEmail = String((userSettingsObj && userSettingsObj.parentEmail) || '').toLowerCase().trim();
          if (pEmail === registeredParentEmail || pEmail === settingsParentEmail || (ownEmail && pEmail === ownEmail)) {
            allowedEmailMatch = true;
          }
          break;
        }
      }
      if (!allowedEmailMatch) {
        return {
          success: false,
          unauthorized: true,
          message: 'Please save this guardian email in your Parent Details profile before sending a weekly summary.'
        };
      }
    }
    var escEmailHtml = function(val) {
      return String(val === null || val === undefined ? '' : val)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    };
    var gName = String(payload.guardianName || 'Parent / Guardian').trim();
    var snap = payload.summary || {};
    var sName = String(snap.studentName || 'Student');
    var bName = String(snap.batchName || 'General Batch');
    var subj = '📊 Weekly Progress Report for ' + sName + ' — RP Skill | Ranjan Pathshala';
    var plain = 'Dear ' + gName + ',\n\nHere is the weekly progress summary for ' + sName + ' (' + bName + '):\n' +
      '• Weekly Attendance: ' + (snap.attendance || 'N/A') + '\n' +
      '• Tests Completed: ' + (snap.testsCompleted || 0) + '\n' +
      '• Net Speed Growth: ' + (snap.netSpeed || 'N/A') + '\n' +
      '• Average Accuracy: ' + (snap.accuracy || 'N/A') + '\n' +
      '• Batch Rank: ' + (snap.batchRank || 'N/A') + '\n\nBest Regards,\nRP Skill | Ranjan Pathshala';
    var html = '<div style="font-family:Segoe UI,Arial,sans-serif;max-width:580px;margin:0 auto;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">' +
      '<div style="background:linear-gradient(135deg,#059669,#0284c7);color:#fff;padding:16px 20px;">' +
      '<h2 style="margin:0;font-size:17px;">Parent / Guardian Weekly Progress Summary</h2>' +
      '<p style="margin:4px 0 0 0;font-size:12px;opacity:0.9;">Student: ' + escEmailHtml(sName) + ' • Batch: ' + escEmailHtml(bName) + '</p></div>' +
      '<div style="padding:18px 20px;background:#fff;color:#0f172a;line-height:1.7;font-size:13.5px;">' +
      '<p>Dear <strong>' + escEmailHtml(gName) + '</strong>,</p>' +
      '<ul>' +
      '<li><strong>Weekly Attendance:</strong> ' + escEmailHtml(snap.attendance || 'N/A') + '</li>' +
      '<li><strong>Tests Completed:</strong> ' + escEmailHtml(snap.testsCompleted || 0) + '</li>' +
      '<li><strong>Net Speed Growth:</strong> ' + escEmailHtml(snap.netSpeed || 'N/A') + '</li>' +
      '<li><strong>Average Accuracy:</strong> ' + escEmailHtml(snap.accuracy || 'N/A') + '</li>' +
      '<li><strong>Current Batch Rank:</strong> ' + escEmailHtml(snap.batchRank || 'N/A') + '</li>' +
      '</ul>' +
      '<p style="font-size:12px;color:#64748b;margin-top:14px;">Best Regards,<br><strong>RP Skill | Ranjan Pathshala</strong></p></div></div>';
    var sentOk = sendPortalEmailNotification(pEmail, subj, plain, html);
    return {
      success: sentOk,
      parentEmail: pEmail,
      message: sentOk ? ('Weekly Progress Summary emailed to ' + pEmail) : ('Queued Weekly Progress Summary for ' + pEmail)
    };
  }
  var period = (payload && payload.period) ? String(payload.period).toLowerCase() : 'daily';
  var targetBatchFilter = (payload && payload.batch && payload.batch !== 'ALL') ? String(payload.batch).trim() : 'ALL';
  return sendAutomatedBatchProgressDigestEmail(period, targetBatchFilter, payload);
}

function sendAutomatedBatchProgressDigestEmail(periodOpt, batchFilterOpt, payloadOpt) {
  var isDirectTrigger = !DbConnectionManager._openedAt;
  if (isDirectTrigger) {
    DbConnectionManager.open();
  }
  try {
    var period = (typeof periodOpt === 'string' && periodOpt) ? periodOpt : 'daily';
    var batchFilter = (typeof batchFilterOpt === 'string' && batchFilterOpt) ? batchFilterOpt : 'ALL';
    var users = getSheetData('USERS');
    var history = getSheetData('TEST_HISTORY');
    var settings = getSheetData('SETTINGS');
    var monitorsMap = parseBatchMonitorsSettings(settings);
    var tz = DbConnectionManager.getTimeZone();
    var todayStr = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');
    var cutoffMs = Date.now() - (period === 'weekly' ? 7 * 86400000 : 86400000);

    var recentAttempts = history.filter(function(h) {
      var dStr = String(h.Date || h.TypingDate || h.Timestamp || '').slice(0, 10);
      if (period === 'daily' && dStr === todayStr) return true;
      var ts = new Date(h.Timestamp || h.Date || 0).getTime();
      return !isNaN(ts) && ts >= cutoffMs;
    });

    var activeUserMap = {};
    var userBestScoreMap = {};
    for (var i = 0; i < recentAttempts.length; i++) {
      var att = recentAttempts[i];
      var uid = String(att.UserID || '').trim();
      var uName = String(att.UserName || 'Student').trim();
      activeUserMap[uid] = (activeUserMap[uid] || 0) + 1;
      var wpm = parseFloat(att.NetSpeed || 0) || 0;
      var acc = parseFloat(att.AccuracyPercentage || 0) || 0;
      var marks = parseFloat(att.MarksObtained || 0) || 0;
      if (!userBestScoreMap[uid] || marks > userBestScoreMap[uid].marks || (marks === userBestScoreMap[uid].marks && wpm > userBestScoreMap[uid].wpm)) {
        userBestScoreMap[uid] = {
          userId: uid,
          name: uName,
          wpm: wpm,
          accuracy: acc,
          marks: marks,
          examName: String(att.ExamName || '-')
        };
      }
    }

    var filteredStudents = users.filter(function(u) {
      var role = String(u.Role || 'user').toLowerCase();
      if (role === 'superadmin') return false;
      if (batchFilter !== 'ALL') {
        var uBatch = String(u.Batch || 'General Batch');
        return uBatch.toLowerCase().indexOf(batchFilter.toLowerCase()) !== -1;
      }
      return true;
    });

    var missedTargetStudents = [];
    var participatingCount = 0;
    for (var s = 0; s < filteredStudents.length; s++) {
      var stu = filteredStudents[s];
      var sId = String(stu.UserID || '').trim();
      if (activeUserMap[sId]) {
        participatingCount++;
      } else {
        missedTargetStudents.push(String(stu.Name || sId) + ' (' + String(stu.Batch || 'General Batch') + ')');
      }
    }

    var topScorers = Object.keys(userBestScoreMap).map(function(k) { return userBestScoreMap[k]; });
    topScorers.sort(function(a, b) {
      if (b.wpm !== a.wpm) return b.wpm - a.wpm;
      return b.marks - a.marks;
    });
    var top3 = topScorers.slice(0, 3);

    var recipients = {};
    for (var uIdx = 0; uIdx < users.length; uIdx++) {
      var usr = users[uIdx];
      var r = String(usr.Role || '').toLowerCase().trim();
      var em = String(usr.Email || '').toLowerCase().trim();
      if ((r === 'superadmin' || r === 'admin') && em && em.indexOf('@') !== -1) {
        recipients[em] = usr.Name || 'Admin';
      }
    }
    for (var bKey in monitorsMap) {
      if (!monitorsMap.hasOwnProperty(bKey)) continue;
      var monList = normalizeBatchMonitorsEntry(monitorsMap[bKey]);
      for (var mlIdx = 0; mlIdx < monList.length; mlIdx++) {
        var mon = monList[mlIdx];
        if (mon && mon.userId) {
          for (var mIdx = 0; mIdx < users.length; mIdx++) {
            if (String(users[mIdx].UserID) === String(mon.userId)) {
              var mEmail = String(users[mIdx].Email || '').toLowerCase().trim();
              if (mEmail && mEmail.indexOf('@') !== -1) {
                recipients[mEmail] = users[mIdx].Name || 'Batch Monitor';
              }
            }
          }
        }
      }
    }

    var recipientEmails = Object.keys(recipients);
    var subject = '📊 RP Skill ' + (period === 'weekly' ? 'Weekly' : 'Daily') + ' Batch Progress Digest — ' + todayStr + (batchFilter !== 'ALL' ? ' [' + batchFilter + ']' : '');
    var top3Html = top3.length === 0
      ? '<li>No test submissions recorded in this window yet.</li>'
      : top3.map(function(t, idx) {
          return '<li><strong>#' + (idx + 1) + ' ' + t.name + '</strong> — ' + t.wpm + ' Net WPM | ' + t.accuracy + '% Acc | ' + t.marks + ' Marks (' + t.examName + ')</li>';
        }).join('');
    var missedHtml = missedTargetStudents.length === 0
      ? '<p style="color:#059669;font-weight:bold;">🎉 100% of batch students completed their practice target!</p>'
      : '<p style="font-size:13px;color:#b45309;">' + missedTargetStudents.slice(0, 40).join(', ') + (missedTargetStudents.length > 40 ? ' (+' + (missedTargetStudents.length - 40) + ' more)' : '') + '</p>';

    var htmlBody = '<div style="font-family:Segoe UI,Arial,sans-serif;max-width:640px;margin:0 auto;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">' +
      '<div style="background:linear-gradient(135deg,#1e3a8a,#4f46e5);color:#fff;padding:18px 22px;">' +
      '<h2 style="margin:0;font-size:18px;">RP Skill | Ranjan Pathshala — ' + (period === 'weekly' ? 'Weekly' : 'Daily') + ' Batch Digest</h2>' +
      '<p style="margin:4px 0 0 0;font-size:12px;opacity:0.9;">Date: ' + todayStr + ' • Batch Scope: ' + batchFilter + '</p>' +
      '</div>' +
      '<div style="padding:18px 22px;background:#ffffff;color:#1e293b;">' +
      '<p><strong>Total Students Tracked:</strong> ' + filteredStudents.length + ' | <strong>Active Participants:</strong> ' + participatingCount + ' | <strong>Total Submissions:</strong> ' + recentAttempts.length + '</p>' +
      '<h3 style="font-size:15px;color:#1e40af;margin-top:16px;">🏆 Top 3 Scorers (' + (period === 'weekly' ? 'Last 7 Days' : 'Today') + ')</h3>' +
      '<ol style="line-height:1.7;">' + top3Html + '</ol>' +
      '<h3 style="font-size:15px;color:#b45309;margin-top:16px;">⚠️ Students Who Missed Daily Target (' + missedTargetStudents.length + ')</h3>' +
      missedHtml +
      '</div></div>';

    var sentCount = 0;
    for (var eIdx = 0; eIdx < recipientEmails.length; eIdx++) {
      var ok = sendPortalEmailNotification(recipientEmails[eIdx], subject, 'RP Skill Batch Progress Digest (' + todayStr + ')', htmlBody);
      if (ok) sentCount++;
    }

    handleLogActivity({
      userId: (payloadOpt && payloadOpt.actorId) || 'SYSTEM_TRIGGER',
      userName: (payloadOpt && payloadOpt.actorName) || 'Automated Digest Engine',
      activityType: 'BATCH_DIGEST_EMAIL',
      details: 'Dispatched ' + period.toUpperCase() + ' Batch Progress Digest to ' + sentCount + ' Admin/Monitor recipient(s) (Active: ' + participatingCount + '/' + filteredStudents.length + ')'
    });

    return {
      success: true,
      sentCount: sentCount,
      recipients: recipientEmails,
      participatingCount: participatingCount,
      totalStudents: filteredStudents.length,
      recentSubmissionsCount: recentAttempts.length,
      top3: top3,
      missedCount: missedTargetStudents.length,
      message: 'Batch Progress Digest emailed to ' + sentCount + ' Admin/Monitor recipient(s)!'
    };
  } catch (err) {
    return {
      success: false,
      message: 'Error generating batch digest: ' + err.toString()
    };
  } finally {
    if (isDirectTrigger) {
      DbConnectionManager.close();
    }
  }
}

function handleSetupDailyDigestTrigger(payload) {
  try {
    var rawHour = (payload && payload.hour !== undefined) ? parseInt(payload.hour, 10) : 0;
    var hour = isNaN(rawHour) ? 0 : Math.max(0, Math.min(23, rawHour));
    var existing = ScriptApp.getProjectTriggers();
    for (var i = 0; i < existing.length; i++) {
      if (existing[i].getHandlerFunction() === 'sendAutomatedBatchProgressDigestEmail') {
        ScriptApp.deleteTrigger(existing[i]);
      }
    }
    ScriptApp.newTrigger('sendAutomatedBatchProgressDigestEmail')
      .timeBased()
      .everyDays(1)
      .atHour(hour)
      .nearMinute(0)
      .create();

    handleLogActivity({
      userId: (payload && payload.actorId) || 'SUPERADMIN',
      userName: (payload && payload.actorName) || 'Admin/Superadmin',
      activityType: 'DIGEST_TRIGGER_CONFIGURED',
      details: 'Configured daily automated Batch Progress Digest trigger at 00:00:01 AM (Admin, Superadmin & Batch Monitors)'
    });

    return {
      success: true,
      hour: hour,
      scheduledAt: '00:00:01 AM',
      message: 'Automated Daily Batch Digest Email Trigger scheduled for 00:00:01 AM daily (sends to Admin, Superadmin & each Batch Monitor)!'
    };
  } catch (err) {
    return {
      success: false,
      message: 'Could not schedule Apps Script time-driven trigger: ' + err.toString()
    };
  }
}

function handleSendWeeklyReportToAll(payload) {
  try {
    payload = payload || {};
    if (payload.autoScheduleOnly) {
      handleSaveSettings({
        AUTO_WEEKLY_REPORT_TO_ALL: payload.autoSendEnabled ? 'true' : 'false'
      });
      return {
        success: true,
        autoSendEnabled: Boolean(payload.autoSendEnabled),
        message: payload.autoSendEnabled
          ? 'Auto-Send Weekly Progress Report to All Students/Parents enabled!'
          : 'Auto-Send Weekly Progress Report paused.'
      };
    }

    var users = getSheetData('USERS');
    var history = getSheetData('TEST_HISTORY');
    var tz = DbConnectionManager.getTimeZone();
    var todayStr = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');
    var cutoffMs = Date.now() - (7 * 86400000);

    var weeklyAttempts = history.filter(function(h) {
      var ts = new Date(h.Timestamp || h.Date || 0).getTime();
      return !isNaN(ts) && ts >= cutoffMs;
    });

    var statsByUser = {};
    for (var i = 0; i < weeklyAttempts.length; i++) {
      var att = weeklyAttempts[i];
      var uid = String(att.UserID || '').trim();
      if (!uid) continue;
      if (!statsByUser[uid]) {
        statsByUser[uid] = { tests: 0, bestWpm: 0, sumAcc: 0, accCount: 0, daysSet: {} };
      }
      statsByUser[uid].tests++;
      var wpm = parseFloat(att.NetSpeed || 0) || 0;
      var acc = parseFloat(att.AccuracyPercentage || 0) || 0;
      if (wpm > statsByUser[uid].bestWpm) statsByUser[uid].bestWpm = wpm;
      if (acc > 0) {
        statsByUser[uid].sumAcc += acc;
        statsByUser[uid].accCount++;
      }
      var dKey = String(att.Date || att.Timestamp || '').slice(0, 10);
      if (dKey) statsByUser[uid].daysSet[dKey] = true;
    }

    var sentCount = 0;
    for (var u = 0; u < users.length; u++) {
      var usr = users[u];
      var status = String(usr.Status || 'active').toLowerCase();
      var email = String(usr.Email || '').trim().toLowerCase();
      if (status === 'blocked' || !email || email.indexOf('@') === -1) continue;

      var uidKey = String(usr.UserID || '').trim();
      var st = statsByUser[uidKey] || { tests: 0, bestWpm: 0, sumAcc: 0, accCount: 0, daysSet: {} };
      var presentDays = Object.keys(st.daysSet).length;
      var avgAcc = st.accCount > 0 ? (st.sumAcc / st.accCount).toFixed(1) : '0.0';
      var batchName = String(usr.Batch || 'General Batch');
      var studentName = String(usr.Name || 'Student');

      var subj = '📈 Weekly Progress Summary — ' + studentName + ' (' + batchName + ') | RP Skill';
      var htmlMsg = '<div style="font-family:Segoe UI,Arial,sans-serif;max-width:600px;margin:0 auto;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">' +
        '<div style="background:linear-gradient(135deg,#059669,#0284c7);color:#fff;padding:16px 20px;">' +
        '<h2 style="margin:0;font-size:17px;">RP Skill | Ranjan Pathshala — Weekly Progress Report</h2>' +
        '<p style="margin:4px 0 0 0;font-size:12px;opacity:0.9;">Week Ending: ' + todayStr + ' • Batch: ' + batchName + '</p>' +
        '</div>' +
        '<div style="padding:18px 20px;background:#fff;color:#0f172a;font-size:13.5px;line-height:1.7;">' +
        '<p>Dear Parent / Guardian &amp; <strong>' + studentName + '</strong>,</p>' +
        '<p>Here is the automated 7-day skill &amp; CBT performance summary:</p>' +
        '<ul>' +
        '<li><strong>Weekly Attendance:</strong> ' + presentDays + ' / 7 Days</li>' +
        '<li><strong>Tests Completed This Week:</strong> ' + st.tests + '</li>' +
        '<li><strong>Peak Net Speed:</strong> ' + Math.round(st.bestWpm) + ' WPM</li>' +
        '<li><strong>Average Accuracy:</strong> ' + avgAcc + '%</li>' +
        '</ul>' +
        '<p style="font-size:12px;color:#64748b;margin-top:14px;">— Automated Weekly Reporting Cell, RP Skill | Ranjan Pathshala</p>' +
        '</div></div>';

      if (sendPortalEmailNotification(email, subj, 'RP Skill Weekly Progress Report for ' + studentName, htmlMsg)) {
        sentCount++;
      }
    }

    // Also send the overall weekly batch digest to Admin, Superadmin & Batch Monitors
    sendAutomatedBatchProgressDigestEmail('weekly', 'ALL', payload);

    return {
      success: true,
      sentCount: sentCount,
      message: 'Weekly Progress Report sent to ' + sentCount + ' student/parent email(s) and Admin/Batch Monitors!'
    };
  } catch (err) {
    return {
      success: false,
      message: 'Failed to send weekly reports: ' + err.toString()
    };
  }
}

// =========================================================================
// V.2: ENTERPRISE UPGRADE HANDLERS (ARCHIVAL, FEE LEDGER, AUDIT DIFFS, CSV ONBOARDING, TELEGRAM WEBHOOK, FRANCHISE BRANCHES)
// =========================================================================

// 1. Automated Monthly Sheet Archival & Sharding for TEST_HISTORY (>90 days)
function handleArchiveOldTestHistoryRows(payload) {
  var rawDays = payload && (payload.daysThreshold !== undefined ? payload.daysThreshold : payload.retentionDays);
  var daysThreshold = rawDays ? Math.max(15, parseInt(rawDays, 10) || 90) : 90;
  var cutoffMs = Date.now() - (daysThreshold * 86400000);
  var mainSheet = getOrCreateSheet('TEST_HISTORY');
  var archiveSheet = getOrCreateSheet('TEST_HISTORY_ARCHIVE');
  if (!mainSheet || !archiveSheet) {
    return { success: false, message: 'Unable to access TEST_HISTORY or TEST_HISTORY_ARCHIVE sheet.' };
  }

  var data = mainSheet.getDataRange().getValues();
  if (data.length <= 1) {
    return { success: true, archivedCount: 0, remainingCount: 0, message: 'No rows in TEST_HISTORY to archive.' };
  }

  var headers = data[0];
  var keptRows = [headers];
  var archivedCount = 0;
  var nowIso = new Date().toISOString();

  var expectedHistoryCols = SHEET_SCHEMAS['TEST_HISTORY'].length;
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var tsVal = row[32] || row[10] || row[6] || '';
    var parsedTs = new Date(tsVal).getTime();
    if (!isNaN(parsedTs) && parsedTs > 0 && parsedTs < cutoffMs) {
      var archRow = row.slice(0, expectedHistoryCols);
      while (archRow.length < expectedHistoryCols) archRow.push('-');
      archRow.push(nowIso);
      archiveSheet.appendRow(archRow);
      archivedCount++;
    } else {
      keptRows.push(row);
    }
  }

  if (archivedCount > 0) {
    mainSheet.clearContents();
    mainSheet.getRange(1, 1, keptRows.length, headers.length).setValues(keptRows);
    invalidateSheetCache('TEST_HISTORY');
    invalidateSheetCache('TEST_HISTORY_ARCHIVE');
  }

  handleLogActivity({
    userId: (payload && payload.actorId) || 'SUPERADMIN',
    userName: (payload && payload.actorName) || 'Admin/Superadmin',
    activityType: 'SHEET_ARCHIVAL_SHARDING',
    details: 'Archived ' + archivedCount + ' TEST_HISTORY row(s) older than ' + daysThreshold + ' days into TEST_HISTORY_ARCHIVE.'
  });

  return {
    success: true,
    archivedCount: archivedCount,
    remainingCount: keptRows.length - 1,
    daysThreshold: daysThreshold,
    message: 'Archived ' + archivedCount + ' historical test record(s) older than ' + daysThreshold + ' days into TEST_HISTORY_ARCHIVE (' + (keptRows.length - 1) + ' active rows retained).'
  };
}

// 1B. Automated Monthly Sheet Archival for ACTIVITY_LOGS (>90 days)
function runMonthlyActivityLogsArchivalTrigger() {
  var isDirectTrigger = !DbConnectionManager._openedAt;
  if (isDirectTrigger) {
    DbConnectionManager.open();
  }
  try {
    return handleArchiveOldActivityLogs({
      retentionDays: 90,
      actorId: 'SYSTEM_TRIGGER',
      actorName: 'Monthly Archival Trigger'
    });
  } finally {
    if (isDirectTrigger) {
      DbConnectionManager.close();
    }
  }
}

function handleArchiveOldActivityLogs(payload) {
  payload = payload || {};
  var rawDays = payload.retentionDays !== undefined ? payload.retentionDays : payload.daysThreshold;
  var retentionDays = rawDays ? Math.max(7, parseInt(rawDays, 10) || 90) : 90;
  var cutoffMs = Date.now() - (retentionDays * 86400000);
  var mainSheet = getOrCreateSheet('ACTIVITY_LOGS');
  var archiveSheet = getOrCreateSheet('ACTIVITY_LOGS_ARCHIVE');
  if (!mainSheet || !archiveSheet) {
    return { success: false, message: 'Unable to access ACTIVITY_LOGS or ACTIVITY_LOGS_ARCHIVE sheet.' };
  }

  var data = mainSheet.getDataRange().getValues();
  var nowIso = new Date().toISOString();
  if (data.length <= 1) {
    upsertSettingsJsonKey('ACTIVITY_ARCHIVAL_META_JSON', {
      lastRunAt: nowIso,
      lastArchivedCount: 0,
      retentionDays: retentionDays,
      activeLogCount: 0
    });
    return {
      success: true,
      archivedCount: 0,
      remainingCount: 0,
      activeLogCount: 0,
      lastRunAt: nowIso,
      retentionDays: retentionDays,
      message: 'No rows in ACTIVITY_LOGS to archive.'
    };
  }

  var headers = data[0];
  var keptRows = [headers];
  var rowsToArchive = [];
  var expectedCols = SHEET_SCHEMAS['ACTIVITY_LOGS'].length;

  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var tsVal = row[5] || '';
    var parsedTs = new Date(tsVal).getTime();
    if (!isNaN(parsedTs) && parsedTs > 0 && parsedTs < cutoffMs) {
      var archRow = row.slice(0, expectedCols);
      while (archRow.length < expectedCols) archRow.push('-');
      archRow.push(nowIso);
      rowsToArchive.push(archRow);
    } else {
      keptRows.push(row);
    }
  }

  var archivedCount = rowsToArchive.length;
  if (archivedCount > 0) {
    var archStartRow = archiveSheet.getLastRow() + 1;
    archiveSheet.getRange(archStartRow, 1, archivedCount, expectedCols + 1).setValues(rowsToArchive);
    mainSheet.clearContents();
    mainSheet.getRange(1, 1, keptRows.length, headers.length).setValues(keptRows);
    DbConnectionManager.markDirty('ACTIVITY_LOGS');
    DbConnectionManager.markDirty('ACTIVITY_LOGS_ARCHIVE');
    invalidateSheetCache('ACTIVITY_LOGS');
    invalidateSheetCache('ACTIVITY_LOGS_ARCHIVE');
  }

  var activeRemaining = Math.max(0, keptRows.length - 1);
  upsertSettingsJsonKey('ACTIVITY_ARCHIVAL_META_JSON', {
    lastRunAt: nowIso,
    lastArchivedCount: archivedCount,
    retentionDays: retentionDays,
    activeLogCount: activeRemaining
  });

  handleLogActivity({
    userId: payload.actorId || 'SUPERADMIN',
    userName: payload.actorName || 'Admin/Superadmin',
    activityType: 'ACTIVITY_LOGS_ARCHIVAL',
    details: 'Archived ' + archivedCount + ' ACTIVITY_LOGS row(s) older than ' + retentionDays + ' days into ACTIVITY_LOGS_ARCHIVE (' + activeRemaining + ' active rows retained).'
  });

  return {
    success: true,
    archivedCount: archivedCount,
    remainingCount: activeRemaining,
    activeLogCount: activeRemaining,
    lastRunAt: nowIso,
    retentionDays: retentionDays,
    message: 'Archived ' + archivedCount + ' activity log(s) older than ' + retentionDays + ' days into ACTIVITY_LOGS_ARCHIVE (' + activeRemaining + ' active rows retained).'
  };
}

function handleGetActivityArchivalStatus(payload) {
  var triggerInstalled = false;
  try {
    var triggers = ScriptApp.getProjectTriggers();
    for (var i = 0; i < triggers.length; i++) {
      if (triggers[i].getHandlerFunction() === 'runMonthlyActivityLogsArchivalTrigger') {
        triggerInstalled = true;
        break;
      }
    }
  } catch (e) {}

  var activeLogs = getSheetData('ACTIVITY_LOGS');
  var settings = getSheetData('SETTINGS');
  var meta = { lastRunAt: '', lastArchivedCount: 0, retentionDays: 90 };
  for (var s = 0; s < settings.length; s++) {
    if (String(settings[s].Key || '').toUpperCase().trim() === 'ACTIVITY_ARCHIVAL_META_JSON') {
      var parsed = parseReadableSheetData(settings[s].Value, null);
      if (parsed && typeof parsed === 'object') {
        meta = parsed;
      }
      break;
    }
  }

  return {
    success: true,
    triggerInstalled: triggerInstalled,
    activeLogCount: activeLogs.length,
    lastArchivedCount: Number(meta.lastArchivedCount || 0) || 0,
    lastRunAt: String(meta.lastRunAt || ''),
    retentionDays: Number(meta.retentionDays || 90) || 90
  };
}

function handleSetupMonthlyActivityArchivalTrigger(payload) {
  payload = payload || {};
  var enableTrigger = payload.enabled !== false;
  try {
    var existing = ScriptApp.getProjectTriggers();
    for (var i = 0; i < existing.length; i++) {
      if (existing[i].getHandlerFunction() === 'runMonthlyActivityLogsArchivalTrigger') {
        ScriptApp.deleteTrigger(existing[i]);
      }
    }
    if (enableTrigger) {
      ScriptApp.newTrigger('runMonthlyActivityLogsArchivalTrigger')
        .timeBased()
        .onMonthDay(1)
        .atHour(3)
        .create();
    }
    handleLogActivity({
      userId: payload.actorId || 'SUPERADMIN',
      userName: payload.actorName || 'Admin/Superadmin',
      activityType: 'ACTIVITY_ARCHIVAL_TRIGGER',
      details: enableTrigger
        ? 'Installed monthly ACTIVITY_LOGS archival trigger (1st of every month at 3:00 AM, >90 days retention).'
        : 'Disabled monthly ACTIVITY_LOGS archival trigger.'
    });
    return {
      success: true,
      triggerInstalled: enableTrigger,
      message: enableTrigger
        ? 'Monthly Activity Logs Archival trigger scheduled (1st of every month at 3:00 AM)!'
        : 'Monthly Activity Logs Archival trigger disabled.'
    };
  } catch (err) {
    return {
      success: false,
      message: 'Could not configure monthly archival trigger: ' + err.toString()
    };
  }
}

// 2. Batch Fee Installment Ledger & Automated Receipt Generator
function handleSaveFeeInstallmentRecord(payload) {
  var sheet = getOrCreateSheet('FEE_LEDGER');
  var receiptNo = String(payload.receiptNo || ('RPS-RCPT-' + Date.now().toString().slice(-6))).trim();
  var userId = sanitizeInput(payload.userId || payload.studentId || '-');
  var studentName = sanitizeInput(payload.studentName || 'Student');
  var batch = sanitizeInput(payload.batch || payload.batchName || 'General Batch');
  var branch = sanitizeInput(payload.branch || 'Main Headquarter Branch');
  var installmentNo = sanitizeInput(String(payload.installmentNo || '1st Installment'));
  var amountPaid = Number(payload.amountPaid || 0);
  var dueAmount = Number(payload.dueAmount !== undefined ? payload.dueAmount : (payload.balanceDue || 0));
  var paymentMode = sanitizeInput(payload.paymentMode || 'UPI / Online');
  var validityUntil = sanitizeInput(payload.validityUntil || payload.validUntil || '-');
  var issuedBy = sanitizeInput(payload.issuedBy || 'Admin');
  var nowIso = new Date().toISOString();

  sheet.appendRow([
    receiptNo, userId, studentName, batch, branch, installmentNo,
    amountPaid, dueAmount, paymentMode, validityUntil, issuedBy, nowIso
  ]);
  invalidateSheetCache('FEE_LEDGER');

  return {
    success: true,
    receiptNo: receiptNo,
    message: 'Fee installment receipt ' + receiptNo + ' recorded in FEE_LEDGER.'
  };
}

function handleGetFeeInstallmentLedger() {
  var rows = getSheetData('FEE_LEDGER');
  return { success: true, ledger: rows };
}

// 3. Role-Based Granular Audit Log Diff Viewer
function handleRecordGranularAuditDiff(payload) {
  var sheet = getOrCreateSheet('AUDIT_DIFF_LOGS');
  var auditId = 'AUD-' + Date.now();
  var actorId = sanitizeInput(payload.actorId || 'ADMIN');
  var actorName = sanitizeInput(payload.actorName || 'Admin');
  var targetType = sanitizeInput(payload.targetType || 'EVALUATION_RULE');
  var targetKey = sanitizeInput(payload.targetKey || '-');
  var beforeJson = formatReadableSheetData(payload.before || {}, 45000);
  var afterJson = formatReadableSheetData(payload.after || {}, 45000);
  var summary = sanitizeInput(payload.summary || ('Modified ' + targetType + ' (' + targetKey + ')'));
  var nowIso = new Date().toISOString();

  sheet.appendRow([auditId, actorId, actorName, targetType, targetKey, beforeJson, afterJson, summary, nowIso]);
  invalidateSheetCache('AUDIT_DIFF_LOGS');
  return { success: true, auditId: auditId, message: 'Granular audit diff recorded.' };
}

function handleGetGranularAuditDiffs() {
  var rows = getSheetData('AUDIT_DIFF_LOGS');
  return { success: true, diffs: rows };
}

// 4. Bulk Student CSV Onboarding & Automated Welcome Credentials + Email/Mobile Verification Flow
function handleBulkOnboardStudentsCsv(payload) {
  var students = Array.isArray(payload.students) ? payload.students : [];
  if (students.length === 0) {
    return { success: false, message: 'No student records provided for bulk onboarding.' };
  }
  var requireVerification = (payload.requireVerification !== false);
  var userSheet = getOrCreateSheet('USERS');
  var existingUsers = getSheetData('USERS');
  var existingEmails = {};
  for (var i = 0; i < existingUsers.length; i++) {
    existingEmails[String(existingUsers[i].Email || '').toLowerCase().trim()] = true;
  }

  var createdCount = 0;
  var emailedCount = 0;
  var skippedCount = 0;
  var createdList = [];

  for (var s = 0; s < Math.min(students.length, 200); s++) {
    var item = students[s] || {};
    var name = sanitizeInput(String(item.name || item.Name || '').trim());
    var email = String(item.email || item.Email || '').toLowerCase().trim();
    var rawMob = String(item.mobile || item.Mobile || '').replace(/[^0-9]/g, '');
    var mobile = rawMob.length >= 10 ? rawMob.slice(-10) : '';
    var batch = sanitizeInput(String(item.batch || item.Batch || 'RP-Trail').trim());
    var branch = String(item.branch || item.Branch || 'Main Branch').trim();
    var validUntil = String(item.enrollmentValidUntil || item.validUntil || '').trim();
    var password = String(item.password || item.Password || ('RP@' + Math.floor(1000 + Math.random() * 9000))).trim();

    if (!name || name === '-' || !email || email.indexOf('@') === -1) {
      skippedCount++;
      continue;
    }
    if (existingEmails[email]) {
      skippedCount++;
      continue;
    }

    var userId = (item.userId && String(item.userId).trim().indexOf('@') === -1)
      ? sanitizeInput(String(item.userId).trim())
      : ('USR-' + (existingUsers.length + createdCount + 1) + '-' + Math.floor(1000 + Math.random() * 9000));
    var prefsObj = {
      emailVerified: !requireVerification,
      mobileVerified: !requireVerification,
      requiresContactVerification: requireVerification,
      mfaEnabled: false,
      branch: branch,
      onboardedViaCsv: true,
      mustChangePassword: true
    };
    if (validUntil) prefsObj.enrollmentValidUntil = validUntil;
    appendUserRowClean(userSheet, {
      UserID: userId,
      Name: name,
      Email: email,
      Mobile: mobile || '-',
      Password: hashPasswordWithSalt(password),
      Role: 'user',
      Status: 'active',
      SessionToken: '-',
      CreatedDate: new Date().toISOString(),
      AdminPermissions: '-',
      Batch: normalizeUserBatchesWithFreeTier(batch)
    }, prefsObj);
    existingEmails[email] = true;
    createdCount++;
    createdList.push({ userId: userId, name: name, email: email, mobile: mobile, batch: batch, branch: branch, requireVerification: requireVerification });

    if (payload.sendWelcomeEmail !== false && emailedCount < 45) {
      var verifyNote = requireVerification
        ? '\n\nIMPORTANT — First Login Verification:\nWhen you sign in for the first time, please verify both your Email ID and your 10-digit Mobile Number using the 6-digit OTP verification prompt (you can also enter or update your Mobile Number right inside that verification popup before verifying).'
        : '';
      var sent = sendPortalEmailNotification(
        email,
        'Welcome to RP Skill | Ranjan Pathshala — Account Created & Verification Steps',
        'Hello ' + name + ',\n\nYour student account has been created for Batch: ' + batch + ' (' + branch + ').\n\nLogin ID: ' + email + '\nTemporary Password: ' + password + '\nRegistered Mobile: ' + (mobile || 'To be added & verified on first login') + '\nUser ID: ' + userId + verifyNote + '\n\nSecurity Notice: Please change this temporary password after your first login.\n\nBest Regards,\nRP Skill | Ranjan Pathshala'
      );
      if (sent) emailedCount++;
    }
  }

  invalidateSheetCache('USERS');
  return {
    success: true,
    createdCount: createdCount,
    emailedCount: emailedCount,
    skippedCount: skippedCount,
    requireVerification: requireVerification,
    createdStudents: createdList,
    message: 'Bulk onboarded ' + createdCount + ' student(s) (' + (requireVerification ? 'Email & Mobile OTP verification required on first login' : 'Pre-verified') + '; ' + emailedCount + ' welcome emails dispatched, ' + skippedCount + ' skipped).'
  };
}

// 5. Telegram Bot Webhook Integration (Bot Token stored strictly in Script Properties, never in SETTINGS sheet)
function handleSaveTelegramWebhookConfig(payload) {
  var sheet = getOrCreateSheet('SETTINGS');
  var incomingBotToken = String(payload.botToken || '').trim();
  if (incomingBotToken) {
    saveSecureTelegramBotToken(incomingBotToken);
  }
  var hasToken = Boolean(getSecureTelegramBotToken());
  var cfg = {
    hasBotToken: hasToken,
    chatId: String(payload.chatId || '').trim(),
    channelLink: String(payload.channelLink || '').trim(),
    autoSendEnabled: Boolean(payload.autoSendEnabled !== false),
    enabled: Boolean(payload.enabled !== false),
    autoPingHomework: Boolean(payload.autoPingHomework !== false),
    autoPingLiveTests: Boolean(payload.autoPingLiveTests !== false),
    updatedAt: new Date().toISOString()
  };
  var data = sheet.getDataRange().getValues();
  var foundRow = -1;
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]).toUpperCase().trim() === 'TELEGRAM_WEBHOOK_CONFIG_JSON') {
      foundRow = i + 1;
      break;
    }
  }
  if (foundRow > 0) {
    sheet.getRange(foundRow, 2).setValue(formatReadableSheetData(cfg));
  } else {
    sheet.appendRow(['TELEGRAM_WEBHOOK_CONFIG_JSON', formatReadableSheetData(cfg)]);
  }
  invalidateSheetCache('SETTINGS');
  return {
    success: true,
    hasBotToken: hasToken,
    message: 'Telegram Bot Webhook configuration saved securely (Bot Token stored in Script Properties, not in Google Sheets).'
  };
}

function handleSendTelegramBatchWebhookAlert(payload) {
  var settings = getSheetData('SETTINGS');
  var savedCfg = {};
  for (var i = 0; i < settings.length; i++) {
    if (String(settings[i].Key || '').toUpperCase().trim() === 'TELEGRAM_WEBHOOK_CONFIG_JSON' && settings[i].Value && settings[i].Value !== '-') {
      savedCfg = parseReadableSheetData(settings[i].Value, {});
    }
  }
  var secureToken = getSecureTelegramBotToken();
  // Transparently migrate any legacy botToken stored in SETTINGS to Script Properties
  if (!secureToken && savedCfg.botToken) {
    saveSecureTelegramBotToken(savedCfg.botToken);
    secureToken = getSecureTelegramBotToken();
  }
  var botToken = String((payload && payload.botToken) || secureToken || '').trim();
  var chatId = String((payload && payload.chatId) || savedCfg.chatId || '').trim();
  var alertText = String((payload && (payload.text || payload.messageText)) || '📢 New Live Test / Homework Alert on RP Skill | Ranjan Pathshala!').trim();

  if (!botToken || !chatId) {
    return {
      success: false,
      simulated: true,
      message: 'Telegram Bot Token (Script Properties) or Channel Chat ID not configured yet.'
    };
  }
  try {
    var tgUrl = 'https://api.telegram.org/bot' + encodeURIComponent(botToken) + '/sendMessage';
    var res = UrlFetchApp.fetch(tgUrl, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify({
        chat_id: chatId,
        text: alertText,
        parse_mode: 'HTML'
      }),
      muteHttpExceptions: true
    });
    var code = res.getResponseCode();
    return {
      success: code >= 200 && code < 300,
      statusCode: code,
      message: (code >= 200 && code < 300)
        ? ('Telegram alert broadcast to channel ' + chatId + '!')
        : ('Telegram API responded with HTTP ' + code)
    };
  } catch (err) {
    return { success: false, message: 'Telegram webhook error: ' + err.toString() };
  }
}

// 6. Multi-Branch / Franchise Center Sub-Tenant Support
function handleSaveFranchiseBranches(payload) {
  var sheet = getOrCreateSheet('SETTINGS');
  var branches = Array.isArray(payload.branches) ? payload.branches : [];
  var data = sheet.getDataRange().getValues();
  var foundRow = -1;
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]).toUpperCase().trim() === 'FRANCHISE_BRANCHES_JSON') {
      foundRow = i + 1;
      break;
    }
  }
  if (foundRow > 0) {
    sheet.getRange(foundRow, 2).setValue(formatReadableSheetData(branches));
  } else {
    sheet.appendRow(['FRANCHISE_BRANCHES_JSON', formatReadableSheetData(branches)]);
  }
  invalidateSheetCache('SETTINGS');
  return { success: true, branches: branches, message: 'Franchise Center Sub-Tenant branches saved.' };
}

function handleGetFranchiseBranches() {
  var settings = getSheetData('SETTINGS');
  for (var i = 0; i < settings.length; i++) {
    if (String(settings[i].Key || '').toUpperCase().trim() === 'FRANCHISE_BRANCHES_JSON' && settings[i].Value && settings[i].Value !== '-') {
      return { success: true, branches: parseReadableSheetData(settings[i].Value, []) };
    }
  }
  return { success: true, branches: [] };
}

// =========================================================================
// 7. SHORTHAND NOTEBOOK PAD PHOTO SUBMISSIONS (Student -> Monitor / Admin / Superadmin)
// =========================================================================
function getMonitoredBatchesForUserId(userId) {
  var uid = String(userId || '').trim();
  if (!uid) return [];
  var settings = getSheetData('SETTINGS');
  var monitorsMap = parseBatchMonitorsSettings(settings);
  var batches = [];
  for (var batchName in monitorsMap) {
    if (!monitorsMap.hasOwnProperty(batchName)) continue;
    if (isUserInBatchMonitorsList(monitorsMap[batchName], uid)) {
      batches.push(String(batchName).trim());
    }
  }
  return batches;
}

function getOrCreateDriveMediaSubfolder(subFolderName) {
  if (typeof DriveApp === 'undefined') return null;
  var rootName = 'RP_Skill_Media_Vault';
  var rootIter = DriveApp.getFoldersByName(rootName);
  var rootFolder = rootIter.hasNext() ? rootIter.next() : DriveApp.createFolder(rootName);
  if (!subFolderName) return rootFolder;
  var subIter = rootFolder.getFoldersByName(subFolderName);
  return subIter.hasNext() ? subIter.next() : rootFolder.createFolder(subFolderName);
}

function saveShorthandPadImageToDriveOrSheet(dataUrl, padId, userId, returnMeta) {
  var raw = String(dataUrl || '').trim();
  if (!raw) return returnMeta ? { url: '', driveFileId: '', driveError: 'Empty image payload' } : '';
  if (raw.indexOf('http://') === 0 || raw.indexOf('https://') === 0) {
    return returnMeta ? { url: raw, driveFileId: '', driveError: '' } : raw;
  }

  // Store high-clarity notebook photos in dedicated Drive vault folder (RP_Skill_Media_Vault/Shorthand_Pads)
  var driveError = '';
  try {
    var commaIdx = raw.indexOf(',');
    var mimeType = 'image/jpeg';
    var base64Body = raw;
    if (raw.indexOf('data:') === 0 && commaIdx !== -1) {
      var headerPart = raw.substring(5, commaIdx);
      var semiIdx = headerPart.indexOf(';');
      if (semiIdx !== -1) {
        mimeType = headerPart.substring(0, semiIdx).trim() || 'image/jpeg';
      }
      base64Body = raw.substring(commaIdx + 1);
    }
    base64Body = String(base64Body || '').replace(/\s+/g, '');
    if (base64Body && typeof DriveApp !== 'undefined') {
      var ext = mimeType.indexOf('png') !== -1 ? 'png' : (mimeType.indexOf('webp') !== -1 ? 'webp' : 'jpg');
      var bytes = Utilities.base64Decode(base64Body);
      var safeUid = String(userId || 'USER').replace(/[^a-zA-Z0-9_-]/g, '');
      var blob = Utilities.newBlob(bytes, mimeType, padId + '_' + safeUid + '.' + ext);
      var file = null;
      try {
        var folder = getOrCreateDriveMediaSubfolder('Shorthand_Pads');
        file = folder.createFile(blob);
      } catch (subErr) {
        file = DriveApp.createFile(blob);
      }
      if (file) {
        try {
          file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
        } catch (shareErr) {}
        var fid = file.getId();
        var driveViewUrl = 'https://drive.google.com/file/d/' + fid + '/view';
        return returnMeta ? { url: driveViewUrl, driveFileId: fid, driveError: '' } : driveViewUrl;
      }
    }
  } catch (driveErr) {
    driveError = String(driveErr && driveErr.message ? driveErr.message : driveErr);
  }

  // Fallback to compressed inline image only if DriveApp authorization is unavailable and size fits Sheet cell limit
  if (raw.length > 48000) {
    return returnMeta ? { url: '', driveFileId: '', driveError: driveError || 'Drive upload unavailable and image exceeds Sheet 48KB cell limit.' } : '';
  }
  return returnMeta ? { url: raw, driveFileId: '', driveError: driveError } : raw;
}

function handleUploadShorthandPad(payload) {
  var userId = String(payload._verifiedUserId || payload.userId || '').trim();
  if (!userId) {
    return { success: false, message: 'Authentication required to upload shorthand notebook photo.' };
  }
  var imageData = String(payload.imageDataUrl || payload.imageUrl || '').trim();
  if (!imageData) {
    return { success: false, message: 'Please capture or select a shorthand notebook photo before uploading.' };
  }

  var usersList = getSheetData('USERS');
  var userName = sanitizeInput(String(payload.userName || 'Student').trim());
  var userBatch = sanitizeInput(String(payload.batch || 'General Batch').trim());
  for (var i = 0; i < usersList.length; i++) {
    if (String(usersList[i].UserID || '').trim() === userId) {
      if (usersList[i].Name) userName = String(usersList[i].Name).trim();
      if (usersList[i].Batch && String(usersList[i].Batch).trim() !== '-') {
        userBatch = String(usersList[i].Batch).trim();
      }
      break;
    }
  }

  var padId = 'PAD-' + Date.now() + '-' + Math.floor(Math.random() * 900 + 100);
  var saveRes = saveShorthandPadImageToDriveOrSheet(imageData, padId, userId, true);
  var storedImage = saveRes && saveRes.url ? saveRes.url : '';
  var driveFileId = saveRes && saveRes.driveFileId ? saveRes.driveFileId : '';
  var driveError = saveRes && saveRes.driveError ? saveRes.driveError : '';
  if (!storedImage) {
    return {
      success: false,
      driveError: driveError,
      message: 'Could not save shorthand photo to Google Drive (' + (driveError || 'Drive authorization needed — re-deploy Apps Script with Drive permission') + ').'
    };
  }

  var materialId = sanitizeInput(String(payload.materialId || '-').trim());
  var materialTitle = sanitizeInput(String(payload.materialTitle || 'Dictation Practice').trim());
  var diagnosisTag = sanitizeInput(String(payload.diagnosisTag || 'Pending Mentor Review').trim());
  var notes = sanitizeInput(String(payload.notes || '').trim()).slice(0, 600);
  var submittedAt = new Date().toISOString();

  var sheet = getOrCreateSheet('SHORTHAND_PADS');
  sheet.appendRow([
    padId,
    userId,
    userName,
    userBatch,
    materialId,
    materialTitle,
    diagnosisTag,
    notes || '-',
    storedImage,
    submittedAt,
    'Pending Review',
    '-',
    '-',
    '-',
    '-'
  ]);
  try { SpreadsheetApp.flush(); } catch (flushErr) {}
  invalidateSheetCache('SHORTHAND_PADS');

  handleLogActivity({
    userId: userId,
    userName: userName,
    activityType: 'SHORTHAND_PAD_UPLOAD',
    details: 'Uploaded shorthand notebook pad photo for "' + materialTitle + '" (' + userBatch + ') [' + diagnosisTag + ']' + (driveFileId ? (' [DriveID:' + driveFileId + ']') : '')
  });

  return {
    success: true,
    driveFileId: driveFileId,
    photoUrl: storedImage,
    driveWarning: driveError || '',
    pad: {
      PadID: padId,
      UserID: userId,
      UserName: userName,
      Batch: userBatch,
      MaterialID: materialId,
      MaterialTitle: materialTitle,
      DiagnosisTag: diagnosisTag,
      Notes: notes || '',
      ImageDataOrUrl: storedImage,
      SubmittedAt: submittedAt,
      ReviewStatus: 'Pending Review',
      ReviewedBy: '',
      ReviewerRole: '',
      ReviewerRemarks: '',
      ReviewedAt: ''
    },
    message: driveFileId
      ? 'Shorthand notebook photo saved to Google Drive & Google Sheet! Your Batch Monitor & Admin can now inspect it.'
      : 'Shorthand notebook photo saved to Google Sheet! (Re-authorize Drive scope in Apps Script if you also want Drive folder copies.)'
  };
}

function handleGetShorthandPads(payload) {
  var userId = String(payload._verifiedUserId || payload.userId || '').trim();
  var role = String(payload._verifiedRole || 'user').toLowerCase().trim();
  var isAdminOrSuper = (role === 'admin' || role === 'superadmin');
  var monitoredBatches = getMonitoredBatchesForUserId(userId);
  var monitoredBatchesLower = monitoredBatches.map(function(b) { return b.toLowerCase(); });
  var isBatchMonitor = monitoredBatchesLower.length > 0;
  var filterBatch = String(payload.batch || '').trim().toLowerCase();

  var daysWindow = Math.max(0, parseInt(payload.daysWindow || 0, 10) || 0);
  var cutoffMs = daysWindow > 0 ? (Date.now() - daysWindow * 24 * 60 * 60 * 1000) : 0;

  var allRows = getSheetData('SHORTHAND_PADS');
  var filtered = [];
  for (var i = allRows.length - 1; i >= 0; i--) {
    var row = allRows[i];
    if (!row || !row.PadID) continue;
    if (cutoffMs > 0) {
      var subTs = new Date(row.SubmittedAt || 0).getTime();
      if (isNaN(subTs) || subTs < cutoffMs) continue;
    }
    var rowUid = String(row.UserID || '').trim();
    var rowBatchList = String(row.Batch || 'General Batch').split(',').map(function(x) { return x.trim().toLowerCase(); }).filter(Boolean);

    var canView = false;
    if (isAdminOrSuper) {
      canView = true;
    } else if (rowUid === userId) {
      canView = true;
    } else if (isBatchMonitor) {
      for (var m = 0; m < rowBatchList.length; m++) {
        if (monitoredBatchesLower.indexOf(rowBatchList[m]) !== -1) {
          canView = true;
          break;
        }
      }
    }
    if (!canView) continue;

    if (filterBatch && filterBatch !== 'all' && filterBatch !== 'all_batches') {
      if (rowBatchList.indexOf(filterBatch) === -1) continue;
    }

    filtered.push({
      PadID: String(row.PadID || ''),
      UserID: rowUid,
      UserName: String(row.UserName || 'Student'),
      Batch: String(row.Batch || 'General Batch'),
      MaterialID: String(row.MaterialID || ''),
      MaterialTitle: String(row.MaterialTitle || 'Dictation Practice'),
      DiagnosisTag: String(row.DiagnosisTag || 'Pending Mentor Review'),
      Notes: (row.Notes && row.Notes !== '-') ? String(row.Notes) : '',
      ImageDataOrUrl: String(row.ImageDataOrUrl || ''),
      SubmittedAt: String(row.SubmittedAt || ''),
      ReviewStatus: String(row.ReviewStatus || 'Pending Review'),
      ReviewedBy: (row.ReviewedBy && row.ReviewedBy !== '-') ? String(row.ReviewedBy) : '',
      ReviewerRole: (row.ReviewerRole && row.ReviewerRole !== '-') ? String(row.ReviewerRole) : '',
      ReviewerRemarks: (row.ReviewerRemarks && row.ReviewerRemarks !== '-') ? String(row.ReviewerRemarks) : '',
      ReviewedAt: (row.ReviewedAt && row.ReviewedAt !== '-') ? String(row.ReviewedAt) : ''
    });
  }

  var totalCount = filtered.length;
  var page = Math.max(1, parseInt(payload.page || 1, 10) || 1);
  var pageSize = Math.min(200, Math.max(10, parseInt(payload.pageSize || payload.limit || 50, 10) || 50));
  var start = (page - 1) * pageSize;
  var pagedResults = filtered.slice(start, start + pageSize);

  return {
    success: true,
    pads: pagedResults,
    totalCount: totalCount,
    page: page,
    pageSize: pageSize,
    totalPages: Math.max(1, Math.ceil(totalCount / pageSize)),
    hasMore: (start + pageSize) < totalCount,
    canReview: isAdminOrSuper || isBatchMonitor,
    viewerRole: isAdminOrSuper ? role : (isBatchMonitor ? 'monitor' : 'student'),
    monitoredBatches: monitoredBatches
  };
}

function handleReviewShorthandPad(payload) {
  var reviewerId = String(payload._verifiedUserId || '').trim();
  var role = String(payload._verifiedRole || 'user').toLowerCase().trim();
  var isAdminOrSuper = (role === 'admin' || role === 'superadmin');
  var monitoredBatchesLower = getMonitoredBatchesForUserId(reviewerId).map(function(b) { return b.toLowerCase(); });

  var padId = String(payload.padId || '').trim();
  var reviewStatus = sanitizeInput(String(payload.reviewStatus || 'Reviewed').trim());
  var reviewRemarks = sanitizeInput(String(payload.reviewRemarks || '').trim()).slice(0, 800);
  if (!padId) {
    return { success: false, message: 'Missing Shorthand Pad submission ID.' };
  }

  var sheet = getOrCreateSheet('SHORTHAND_PADS');
  var data = sheet.getDataRange().getValues();
  var reviewerName = sanitizeInput(String(payload.reviewerName || reviewerId).trim());
  var usersList = getSheetData('USERS');
  for (var u = 0; u < usersList.length; u++) {
    if (String(usersList[u].UserID || '').trim() === reviewerId && usersList[u].Name) {
      reviewerName = String(usersList[u].Name).trim();
      break;
    }
  }

  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0] || '').trim() === padId) {
      var targetBatches = String(data[i][3] || '').split(',').map(function(b) { return b.trim().toLowerCase(); }).filter(Boolean);
      var isMonitorForTarget = false;
      for (var m = 0; m < targetBatches.length; m++) {
        if (monitoredBatchesLower.indexOf(targetBatches[m]) !== -1) {
          isMonitorForTarget = true;
          break;
        }
      }
      if (!isAdminOrSuper && !isMonitorForTarget) {
        return { success: false, message: 'Only the assigned Batch Monitor, Admin, or Superadmin can review this shorthand submission.' };
      }

      var roleLabel = role === 'superadmin' ? 'Superadmin' : (role === 'admin' ? 'Admin' : 'Batch Monitor');
      var nowIso = new Date().toISOString();
      sheet.getRange(i + 1, 11).setValue(reviewStatus || 'Reviewed');
      sheet.getRange(i + 1, 12).setValue(reviewerName);
      sheet.getRange(i + 1, 13).setValue(roleLabel);
      sheet.getRange(i + 1, 14).setValue(reviewRemarks || '-');
      sheet.getRange(i + 1, 15).setValue(nowIso);
      invalidateSheetCache('SHORTHAND_PADS');

      handleLogActivity({
        userId: reviewerId,
        userName: reviewerName,
        activityType: 'SHORTHAND_PAD_REVIEW',
        details: roleLabel + ' reviewed shorthand pad ' + padId + ' (' + reviewStatus + ')'
      });

      return {
        success: true,
        message: 'Shorthand pad review saved successfully.',
        reviewedAt: nowIso,
        reviewedBy: reviewerName,
        reviewerRole: roleLabel
      };
    }
  }
  return { success: false, message: 'Shorthand pad submission not found.' };
}

function handleDeleteShorthandPad(payload) {
  var actorId = String(payload._verifiedUserId || '').trim();
  var role = String(payload._verifiedRole || 'user').toLowerCase().trim();
  var isAdminOrSuper = (role === 'admin' || role === 'superadmin');
  var monitoredBatchesLower = getMonitoredBatchesForUserId(actorId).map(function(b) { return b.toLowerCase(); });
  var padId = String(payload.padId || '').trim();
  if (!padId) return { success: false, message: 'Missing PadID.' };

  var sheet = getOrCreateSheet('SHORTHAND_PADS');
  var data = sheet.getDataRange().getValues();
  for (var i = data.length - 1; i >= 1; i--) {
    if (String(data[i][0] || '').trim() === padId) {
      var ownerId = String(data[i][1] || '').trim();
      var targetBatches = String(data[i][3] || '').split(',').map(function(b) { return b.trim().toLowerCase(); }).filter(Boolean);
      var isMonitorForTarget = targetBatches.some(function(b) { return monitoredBatchesLower.indexOf(b) !== -1; });
      if (!isAdminOrSuper && ownerId !== actorId && !isMonitorForTarget) {
        return { success: false, message: 'Permission denied to delete this shorthand pad submission.' };
      }
      sheet.deleteRow(i + 1);
      invalidateSheetCache('SHORTHAND_PADS');
      return { success: true, message: 'Shorthand pad submission deleted.' };
    }
  }
  return { success: false, message: 'Shorthand pad submission not found.' };
}

// =========================================================================
// BATCH VALIDITY AUTO-FREE-TIER ENGINE, ADMIN LIVE TEST RANKS & BULK CONTACT VERIFICATION
// =========================================================================

function enforceBatchValidityAutoFreeTierForRow(userRow, rowIndex, userSheet, userPrefs) {
  var rawB = String((userRow && userRow.Batch) || '').trim();
  var currentBatch = (!rawB || rawB === '-' || rawB.toLowerCase() === 'general batch' || rawB.toLowerCase() === 'free tier') ? 'RP-Trail' : rawB;
  if (!userRow || !userPrefs || typeof userPrefs !== 'object') {
    return { switched: false, batch: currentBatch };
  }
  var roleVal = String(userRow.Role || 'user').toLowerCase().trim();
  if (roleVal === 'admin' || roleVal === 'superadmin' || isPrimarySuperadminEmail(userRow.Email)) {
    return { switched: false, batch: currentBatch };
  }
  var validUntil = String(userPrefs.enrollmentValidUntil || (userRow.BatchValidUntil && userRow.BatchValidUntil !== '-' ? userRow.BatchValidUntil : '') || '').trim();
  if (!validUntil || validUntil === '-') {
    return { switched: false, batch: currentBatch };
  }
  var todayIso = Utilities.formatDate(new Date(), DbConnectionManager.getTimeZone(), 'yyyy-MM-dd');
  if (todayIso > validUntil) {
    if (currentBatch.toLowerCase() !== 'rp-trail') {
      userPrefs.previousBatch = currentBatch;
      userPrefs.autoSwitchedToFreeTier = true;
      userPrefs.autoSwitchedAt = new Date().toISOString();
      try {
        if (userSheet && rowIndex >= 2) {
          setRowNamedColumns(userSheet, 'USERS', rowIndex, { 'Batch': 'RP-Trail' });
          syncUserReadableColumns(userSheet, rowIndex, userRow, userPrefs);
          invalidateSheetCache('USERS');
        }
      } catch (e) {}
      try {
        handleLogActivity({
          userId: String(userRow.UserID || ''),
          userName: String(userRow.Name || 'Student'),
          activityType: 'BATCH_VALIDITY_AUTO_FREE_TIER',
          details: 'Enrollment validity (' + validUntil + ') expired. Auto-switched from "' + currentBatch + '" to "RP-Trail".'
        });
      } catch (e2) {}
      return { switched: true, batch: 'RP-Trail', previousBatch: currentBatch };
    }
  }
  return { switched: false, batch: currentBatch };
}

function sweepExpiredBatchValiditiesToFreeTier() {
  var userSheet = getOrCreateSheet('USERS');
  var users = getSheetData('USERS');
  if (!users.length) return 0;
  var todayIso = Utilities.formatDate(new Date(), DbConnectionManager.getTimeZone(), 'yyyy-MM-dd');
  var switchedCount = 0;
  for (var i = 0; i < users.length; i++) {
    var u = users[i];
    var roleVal = String(u.Role || 'user').toLowerCase().trim();
    var emailVal = String(u.Email || '').toLowerCase().trim();
    if (roleVal === 'admin' || roleVal === 'superadmin' || isPrimarySuperadminEmail(emailVal)) continue;
    var prefs = readUserSettingsFromRow(u, false);
    var validUntil = String(prefs.enrollmentValidUntil || '').trim();
    if (!validUntil || validUntil === '-') continue;
    var rawB = String(u.Batch || '').trim();
    var curBatch = (!rawB || rawB === '-' || rawB.toLowerCase() === 'general batch' || rawB.toLowerCase() === 'free tier') ? 'RP-Trail' : rawB;
    if (todayIso > validUntil && curBatch.toLowerCase() !== 'rp-trail') {
      prefs.previousBatch = curBatch;
      prefs.autoSwitchedToFreeTier = true;
      prefs.autoSwitchedAt = new Date().toISOString();
      setRowNamedColumns(userSheet, 'USERS', i + 2, { 'Batch': 'RP-Trail' });
      syncUserReadableColumns(userSheet, i + 2, u, prefs);
      switchedCount++;
    }
  }
  if (switchedCount > 0) {
    invalidateSheetCache('USERS');
  }
  return switchedCount;
}

function handleApplyEnrollmentValidity(payload) {
  var target = String(payload.target || 'ALL_STUDENTS').trim();
  var days = parseInt(payload.days, 10);
  var explicitDate = String(payload.validUntil || '').trim();
  var autoFreeTier = (payload.autoFreeTier !== false);
  var restoreBatchIfExtended = (payload.restoreBatchIfExtended !== false);

  var validUntilIso = explicitDate;
  if (!validUntilIso && !isNaN(days)) {
    var dt = new Date(Date.now() + days * 86400000);
    validUntilIso = Utilities.formatDate(dt, DbConnectionManager.getTimeZone(), 'yyyy-MM-dd');
  }
  if (!validUntilIso) {
    return { success: false, message: 'Please specify validity days or an expiry date.' };
  }
  var todayIso = Utilities.formatDate(new Date(), DbConnectionManager.getTimeZone(), 'yyyy-MM-dd');
  var isExpiredNow = (todayIso > validUntilIso);

  var userSheet = getOrCreateSheet('USERS');
  var users = getSheetData('USERS');
  var updatedCount = 0;
  var autoFreeCount = 0;

  for (var i = 0; i < users.length; i++) {
    var u = users[i];
    var uid = String(u.UserID || '').trim();
    var emailVal = String(u.Email || '').toLowerCase().trim();
    var roleVal = String(u.Role || 'user').toLowerCase().trim();
    var rawBatchCell = String(u.Batch || '').trim();
    var curBatch = (!rawBatchCell || rawBatchCell === '-' || rawBatchCell.toLowerCase() === 'general batch' || rawBatchCell.toLowerCase() === 'free tier') ? 'RP-Trail' : rawBatchCell;
    if (roleVal === 'admin' || roleVal === 'superadmin' || isPrimarySuperadminEmail(emailVal)) continue;

    var match = false;
    if (target === 'ALL_STUDENTS') {
      match = true;
    } else if (target.indexOf('BATCH::') === 0) {
      var targetBatch = target.replace('BATCH::', '').trim().toLowerCase();
      match = curBatch.toLowerCase().split(',').map(function(x) { return x.trim(); }).indexOf(targetBatch) !== -1;
    } else if (target.indexOf('USER::') === 0) {
      match = (uid === target.replace('USER::', '').trim());
    }
    if (!match) continue;

    var prefs = readUserSettingsFromRow(u, false);
    prefs.enrollmentValidUntil = validUntilIso;
    prefs.autoFreeTierOnExpiry = autoFreeTier;

    if (isExpiredNow && autoFreeTier) {
      if (curBatch.toLowerCase() !== 'rp-trail') {
        prefs.previousBatch = curBatch;
      }
      prefs.autoSwitchedToFreeTier = true;
      prefs.autoSwitchedAt = new Date().toISOString();
      setRowNamedColumns(userSheet, 'USERS', i + 2, { 'Batch': 'RP-Trail' });
      autoFreeCount++;
    } else if (!isExpiredNow) {
      if (restoreBatchIfExtended && prefs.autoSwitchedToFreeTier && prefs.previousBatch && curBatch.toLowerCase() === 'rp-trail') {
        setRowNamedColumns(userSheet, 'USERS', i + 2, { 'Batch': normalizeUserBatchesWithFreeTier(prefs.previousBatch) });
      }
      prefs.autoSwitchedToFreeTier = false;
    }

    syncUserReadableColumns(userSheet, i + 2, u, prefs);
    updatedCount++;
  }

  invalidateSheetCache('USERS');
  handleLogActivity({
    userId: String(payload._verifiedUserId || 'ADMIN'),
    userName: String(payload.actorName || 'Admin'),
    activityType: 'ENROLLMENT_VALIDITY_UPDATE',
    details: 'Applied validity until ' + validUntilIso + ' to ' + updatedCount + ' student(s) (Target: ' + target + ', Auto-RP-Trail switched: ' + autoFreeCount + ').'
  });

  return {
    success: true,
    updatedCount: updatedCount,
    autoFreeCount: autoFreeCount,
    validUntil: validUntilIso,
    message: 'Validity set until ' + validUntilIso + ' for ' + updatedCount + ' student(s)' + (autoFreeCount > 0 ? (' (' + autoFreeCount + ' expired account(s) auto-switched to RP-Trail).') : '. Expired accounts will automatically switch to RP-Trail.')
  };
}

function handleGetAdminLiveTestRanks(payload) {
  var liveTestId = String(payload.liveTestId || '').trim();
  var batchFilter = String(payload.batch || 'ALL').trim().toLowerCase();
  var settings = getSheetData('SETTINGS');
  var liveTests = parseScheduledLiveTestsSettings(settings);
  var selectedTest = null;
  for (var i = 0; i < liveTests.length; i++) {
    if (String(liveTests[i].id || '') === liveTestId) {
      selectedTest = liveTests[i];
      break;
    }
  }
  if (!selectedTest && liveTests.length > 0 && !liveTestId) {
    selectedTest = liveTests[0];
  }
  var allHistory = getSheetData('TEST_HISTORY');
  var usersList = getSheetData('USERS');
  var userBatchMap = {};
  var userNameMap = {};
  for (var u = 0; u < usersList.length; u++) {
    var uid = String(usersList[u].UserID || '');
    userBatchMap[uid] = String(usersList[u].Batch || 'General Batch');
    userNameMap[uid] = String(usersList[u].Name || uid);
  }

  var targetTitle = selectedTest ? String(selectedTest.title || '').toLowerCase().trim() : '';
  var targetMatTitle = selectedTest ? String(selectedTest.materialTitle || '').toLowerCase().trim() : '';
  var startMs = (selectedTest && selectedTest.startTime) ? new Date(selectedTest.startTime).getTime() : 0;
  var endMs = (selectedTest && selectedTest.endTime) ? (new Date(selectedTest.endTime).getTime() + 1800000) : 0;

  var bestByUser = {};
  for (var h = 0; h < allHistory.length; h++) {
    var row = allHistory[h];
    var examName = String(row.ExamName || '').toLowerCase().trim();
    var matched = false;
    if (selectedTest) {
      if (liveTestId && examName.indexOf(liveTestId.toLowerCase()) !== -1) matched = true;
      else if (targetTitle && examName.indexOf(targetTitle) !== -1) matched = true;
      else if (targetMatTitle && examName.indexOf(targetMatTitle) !== -1) {
        if (!startMs || isNaN(startMs)) {
          matched = true;
        } else {
          var rowMs = new Date(row.Timestamp || '').getTime();
          if (!isNaN(rowMs) && rowMs >= (startMs - 600000) && (!endMs || rowMs <= endMs)) {
            matched = true;
          }
        }
      }
    } else {
      matched = examName.indexOf('live') !== -1;
    }
    if (!matched) continue;

    var rowUid = String(row.UserID || row.UserName || '');
    var uBatch = userBatchMap[rowUid] || 'General Batch';
    if (batchFilter && batchFilter !== 'all') {
      if (uBatch.toLowerCase().indexOf(batchFilter) === -1) continue;
    }

    var acc = parseFloat(row.AccuracyPercentage !== undefined ? row.AccuracyPercentage : (row.Accuracy || 0)) || 0;
    var wpm = parseFloat(row.NetSpeed !== undefined ? row.NetSpeed : (row.SpeedWPM || row.GrossSpeed || 0)) || 0;
    var computedErrs = (parseFloat(row.WrongTyped || 0) || 0) + (parseFloat(row.WordLeft || 0) || 0) + (parseFloat(row.ExtraTyped || 0) || 0);
    var errs = row.TotalErrors !== undefined ? (parseFloat(row.TotalErrors || 0) || 0) : computedErrs;
    var resolvedDisplayName = String(row.UserName || userNameMap[rowUid] || rowUid);
    var resolvedTime = String(row.Timestamp || '');
    var candidateObj = {
      userId: rowUid,
      name: resolvedDisplayName,
      userName: resolvedDisplayName,
      batch: uBatch,
      examName: String(row.ExamName || ''),
      testType: String(row.ExamCategory || row.TestType || ''),
      accuracy: acc,
      speedWpm: wpm,
      totalErrors: errs,
      fullMistakes: parseFloat(row.FullMistakes || 0) || 0,
      halfMistakes: parseFloat(row.HalfMistakes || 0) || 0,
      status: String(row.Status || ''),
      submittedAt: resolvedTime,
      timestamp: resolvedTime
    };

    var prev = bestByUser[rowUid];
    if (!prev || candidateObj.accuracy > prev.accuracy || (candidateObj.accuracy === prev.accuracy && candidateObj.speedWpm > prev.speedWpm)) {
      bestByUser[rowUid] = candidateObj;
    }
  }

  var ranked = [];
  for (var key in bestByUser) {
    if (bestByUser.hasOwnProperty(key)) ranked.push(bestByUser[key]);
  }
  ranked.sort(function(a, b) {
    if (b.accuracy !== a.accuracy) return b.accuracy - a.accuracy;
    if (b.speedWpm !== a.speedWpm) return b.speedWpm - a.speedWpm;
    return a.totalErrors - b.totalErrors;
  });
  for (var r = 0; r < ranked.length; r++) {
    ranked[r].rank = r + 1;
  }

  return {
    success: true,
    liveTest: selectedTest,
    totalParticipants: ranked.length,
    ranks: ranked
  };
}

function handleUpdateOwnContactBeforeVerify(payload) {
  var actorId = String(payload._verifiedUserId || payload.userId || '').trim();
  var newEmail = String(payload.email || '').toLowerCase().trim();
  var newMobile = String(payload.mobile || '').replace(/[^0-9]/g, '').slice(-10);
  if (!actorId) return { success: false, message: 'User session required.' };

  var userSheet = getOrCreateSheet('USERS');
  var users = getSheetData('USERS');
  var targetIdx = -1;
  for (var i = 0; i < users.length; i++) {
    var rUid = String(users[i].UserID || '').trim();
    var rEmail = String(users[i].Email || '').toLowerCase().trim();
    if (rUid === actorId) {
      targetIdx = i;
    } else if (newEmail && rEmail === newEmail) {
      return { success: false, message: 'This email address is already registered to another account.' };
    }
  }
  if (targetIdx < 0) return { success: false, message: 'Account record not found.' };

  var u = users[targetIdx];
  var targetRowIdx = targetIdx + 2;
  var curEmail = String(u.Email || '').toLowerCase().trim();
  var curMobile = String(u.Mobile || '').replace(/[^0-9]/g, '').slice(-10);
  var prefs = readUserSettingsFromRow(u, false);

  if (newEmail && newEmail.indexOf('@') !== -1 && newEmail !== curEmail) {
    setRowNamedColumns(userSheet, 'USERS', targetRowIdx, { 'Email': newEmail });
    prefs.emailVerified = false;
    curEmail = newEmail;
    u.Email = newEmail;
  }
  if (newMobile && newMobile.length === 10 && newMobile !== curMobile) {
    setRowNamedColumns(userSheet, 'USERS', targetRowIdx, { 'Mobile': newMobile });
    prefs.mobileVerified = false;
    curMobile = newMobile;
    u.Mobile = newMobile;
  }
  syncUserReadableColumns(userSheet, targetRowIdx, u, prefs);
  invalidateSheetCache('USERS');

  return {
    success: true,
    email: curEmail,
    mobile: curMobile,
    emailVerified: Boolean(prefs.emailVerified),
    mobileVerified: Boolean(prefs.mobileVerified),
    message: 'Contact details updated. Please send & verify OTP now.'
  };
}

function handleSendMobileVerificationOtp(payload) {
  var actorId = String(payload._verifiedUserId || payload.userId || '').trim();
  var mobileInput = String(payload.mobile || '').replace(/[^0-9]/g, '').slice(-10);
  if (!actorId) return { success: false, message: 'User session required.' };

  var userSheet = getOrCreateSheet('USERS');
  var data = userSheet.getDataRange().getValues();
  var userRow = null;
  var rowIdx = -1;
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0] || '').trim() === actorId) {
      userRow = data[i];
      rowIdx = i + 1;
      break;
    }
  }
  if (!userRow) return { success: false, message: 'Account not found.' };

  var targetMobile = mobileInput.length === 10 ? mobileInput : String(userRow[3] || '').replace(/[^0-9]/g, '').slice(-10);
  if (targetMobile.length !== 10) {
    return { success: false, message: 'Please enter a valid 10-digit Mobile Number first.' };
  }
  if (mobileInput.length === 10 && mobileInput !== String(userRow[3] || '').trim()) {
    userSheet.getRange(rowIdx, 4).setValue(mobileInput);
    invalidateSheetCache('USERS');
  }

  var otp = String(Math.floor(100000 + Math.random() * 900000));
  var cache = DbConnectionManager.getCache();
  if (cache) {
    cache.put('MOB_OTP_' + actorId, otp, 600);
    cache.put('WA_OTP_' + actorId, otp, 600);
  }

  var channel = 'email_fallback';
  if (isWhatsAppWebhookConfigured()) {
    var waSent = sendFreeWhatsAppOtpMessage(targetMobile, String(userRow[1] || 'Student'), otp, 'Mobile Number Verification');
    if (waSent && waSent.webhookDispatched === true) channel = 'whatsapp';
  }
  if (channel !== 'whatsapp') {
    var userEmail = String(userRow[2] || '').toLowerCase().trim();
    sendPortalEmailNotification(
      userEmail,
      'Mobile Number Verification OTP (+91-' + targetMobile + ') — RP Skill | Ranjan Pathshala',
      'Hello ' + String(userRow[1] || 'Student') + ',\n\nYou requested Mobile Number verification for +91-' + targetMobile + '.\n\nYour 6-digit Mobile Verification OTP is: ' + otp + '\n\nEnter this OTP in the Mobile Verification box on the portal to confirm +91-' + targetMobile + '.\n\nValid for 10 minutes.\nRP Skill | Ranjan Pathshala'
    );
  }

  return {
    success: true,
    channel: channel,
    mobile: targetMobile,
    message: channel === 'whatsapp'
      ? ('6-digit Mobile OTP sent via WhatsApp to +91-' + targetMobile + '.')
      : ('6-digit Mobile Verification OTP for +91-' + targetMobile + ' has been sent to your registered email (' + String(userRow[2] || '') + ') because WhatsApp gateway is not configured or unreachable.')
  };
}

function handleVerifyMobileOtp(payload) {
  var actorId = String(payload._verifiedUserId || payload.userId || '').trim();
  var code = String(payload.otpCode || payload.code || '').trim();
  var mobileInput = String(payload.mobile || '').replace(/[^0-9]/g, '').slice(-10);
  if (!actorId || code.length !== 6) {
    return { success: false, message: 'Please enter the 6-digit Mobile OTP.' };
  }
  var cache = DbConnectionManager.getCache();
  var expected = cache ? (cache.get('MOB_OTP_' + actorId) || cache.get('WA_OTP_' + actorId)) : null;
  if (!expected || String(expected) !== code) {
    return { success: false, message: 'Invalid or expired Mobile OTP. Please request a fresh code.' };
  }

  var userSheet = getOrCreateSheet('USERS');
  var users = getSheetData('USERS');
  for (var i = 0; i < users.length; i++) {
    if (String(users[i].UserID || '').trim() === actorId) {
      var prefs = readUserSettingsFromRow(users[i], false);
      prefs.mobileVerified = true;
      prefs.mobileVerifiedAt = new Date().toISOString();
      if (prefs.emailVerified) {
        prefs.requiresContactVerification = false;
      }
      if (mobileInput.length === 10) {
        setRowNamedColumns(userSheet, 'USERS', i + 2, { 'Mobile': mobileInput });
        users[i].Mobile = mobileInput;
      }
      syncUserReadableColumns(userSheet, i + 2, users[i], prefs);
      invalidateSheetCache('USERS');
      if (cache) {
        cache.remove('MOB_OTP_' + actorId);
        cache.remove('WA_OTP_' + actorId);
      }
      return {
        success: true,
        mobileVerified: true,
        emailVerified: Boolean(prefs.emailVerified),
        mobile: mobileInput.length === 10 ? mobileInput : String(users[i].Mobile || ''),
        message: 'Mobile Number verified successfully!'
      };
    }
  }
  return { success: false, message: 'User record not found.' };
}

function handleSendBulkVerificationReminders(payload) {
  var users = getSheetData('USERS');
  var sentCount = 0;
  var pendingCount = 0;
  for (var i = 0; i < users.length; i++) {
    var u = users[i];
    var roleVal = String(u.Role || 'user').toLowerCase().trim();
    if (roleVal === 'admin' || roleVal === 'superadmin' || isPrimarySuperadminEmail(u.Email)) continue;
    var prefs = readUserSettingsFromRow(u, false);
    if (prefs.emailVerified === true && prefs.mobileVerified === true) continue;
    pendingCount++;
    if (sentCount < 45 && u.Email && String(u.Email).indexOf('@') !== -1) {
      var missingList = [];
      if (prefs.emailVerified !== true) missingList.push('Email ID');
      if (prefs.mobileVerified !== true) missingList.push('Mobile Number');
      var ok = sendPortalEmailNotification(
        u.Email,
        'Action Required: Verify Your ' + missingList.join(' & ') + ' — RP Skill | Ranjan Pathshala',
        'Hello ' + String(u.Name || 'Student') + ',\n\nYour ' + missingList.join(' & ') + ' verification is currently pending on RP Skill | Ranjan Pathshala.\n\nPlease sign in to your account and open the "Verify Email & Mobile" prompt on your Dashboard to enter/confirm your details and complete OTP verification.\n\nBest Regards,\nRP Skill | Ranjan Pathshala'
      );
      if (ok) sentCount++;
    }
  }
  return {
    success: true,
    pendingCount: pendingCount,
    sentCount: sentCount,
    message: 'Dispatched ' + sentCount + ' verification reminder email(s) (' + pendingCount + ' pending account(s) detected).'
  };
}

// =========================================================================
// 8. 30-DAY BATCH LEADERBOARD, GOOGLE DRIVE AUDIO STORAGE,
//    SHORTHAND PAD ANNOTATIONS & BATCH VALIDITY MAP
// =========================================================================

function parseBatchValidityMapSettings(settingsData) {
  var rows = settingsData || getSheetData('SETTINGS');
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i].Key || '').toUpperCase().trim() === 'BATCH_VALIDITY_MAP_JSON') {
      var parsed = parseReadableSheetData(rows[i].Value, {});
      return (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) ? parsed : {};
    }
  }
  return {};
}

function handleSaveBatchValidityMap(payload) {
  var mapObj = (payload && payload.batchValidityMap && typeof payload.batchValidityMap === 'object')
    ? payload.batchValidityMap
    : {};
  upsertSettingsJsonKey('BATCH_VALIDITY_MAP_JSON', mapObj);
  return {
    success: true,
    batchValidityMap: mapObj,
    message: 'Batch validity schedules saved to Google Sheets.'
  };
}

function handleUploadAudioToDrive(payload) {
  payload = payload || {};
  var rawData = String(payload.audioDataUrl || payload.base64Data || '').trim();
  var fileName = sanitizeInput(String(payload.fileName || ('Dictation_' + Date.now() + '.mp3')).trim()).replace(/[^a-zA-Z0-9._-]/g, '_');
  if (!rawData) {
    return { success: false, message: 'Audio file data is required for Google Drive upload.' };
  }
  if (typeof DriveApp === 'undefined') {
    return { success: false, message: 'Google Drive service is not authorized for this Apps Script deployment.' };
  }
  try {
    var mimeType = String(payload.mimeType || 'audio/mpeg').trim();
    var base64Body = rawData;
    var match = rawData.match(/^data:([^;]+);base64,(.+)$/);
    if (match) {
      mimeType = match[1];
      base64Body = match[2];
    }
    var bytes = Utilities.base64Decode(base64Body);
    var blob = Utilities.newBlob(bytes, mimeType, fileName);
    var folder = getOrCreateDriveMediaSubfolder('Dictation_Audio');
    var file = folder.createFile(blob);
    try {
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    } catch (shareErr) {}
    var fileId = file.getId();
    var streamUrl = 'https://docs.google.com/uc?export=download&id=' + fileId;
    var previewUrl = 'https://drive.google.com/file/d/' + fileId + '/view';
    handleLogActivity({
      userId: String(payload._verifiedUserId || 'ADMIN'),
      userName: String(payload.requesterName || 'Administrator'),
      activityType: 'DRIVE_AUDIO_UPLOAD',
      details: 'Uploaded dictation audio "' + fileName + '" directly to Google Drive Vault (File ID: ' + fileId + ').'
    });
    return {
      success: true,
      fileId: fileId,
      fileName: fileName,
      streamUrl: streamUrl,
      previewUrl: previewUrl,
      message: 'Audio file uploaded to Google Drive Vault (RP_Skill_Media_Vault/Dictation_Audio) with fast streaming link!'
    };
  } catch (err) {
    return { success: false, message: 'Google Drive audio upload failed: ' + err.toString() };
  }
}

function handleSaveParentDetails(payload) {
  payload = payload || {};
  var actorId = String(payload._verifiedUserId || payload.userId || '').trim();
  if (!actorId) return { success: false, message: 'User session required to save Parent/Guardian details.' };

  var parentName = sanitizeInput(String(payload.parentName || '').trim());
  var parentMobile = String(payload.parentMobile || '').replace(/[^0-9]/g, '').slice(-10);
  var parentEmail = String(payload.parentEmail || '').toLowerCase().trim();
  if (parentMobile && parentMobile.length !== 10) {
    return { success: false, message: 'Parent Mobile Number must be 10 digits (or leave blank to use your own details).' };
  }

  var userSheet = getOrCreateSheet('USERS');
  var users = getSheetData('USERS');
  for (var i = 0; i < users.length; i++) {
    if (String(users[i].UserID || '').trim() === actorId) {
      var prefs = readUserSettingsFromRow(users[i], false);
      prefs.parentName = parentName;
      prefs.parentMobile = parentMobile;
      prefs.parentEmail = parentEmail;
      if (payload.weeklyOptIn !== undefined) prefs.parentWeeklyOptIn = Boolean(payload.weeklyOptIn);
      var uName = String(users[i].Name || '');
      var uEmail = String(users[i].Email || '');
      var uMob = (users[i].Mobile && String(users[i].Mobile) !== '-') ? String(users[i].Mobile) : '';
      syncUserReadableColumns(userSheet, i + 2, users[i], prefs);
      invalidateSheetCache('USERS');
      return {
        success: true,
        parentName: parentName || uName,
        parentMobile: parentMobile || uMob,
        parentEmail: parentEmail || uEmail,
        parentIsFallback: !(parentName || parentMobile || parentEmail),
        message: (parentName || parentMobile || parentEmail)
          ? 'Parent / Guardian details saved successfully to Google Sheets!'
          : 'Parent details cleared — defaulting to your own Student details.'
      };
    }
  }
  return { success: false, message: 'User account not found.' };
}

function handleGetBatchLeaderboard(payload) {
  payload = payload || {};
  var daysWindow = Math.min(365, Math.max(1, parseInt(payload.daysWindow || 30, 10) || 30));
  var requestedBatch = String(payload.batch || payload.batchName || '').trim();
  var cutoffMs = Date.now() - (daysWindow * 24 * 60 * 60 * 1000);
  var callerId = String(payload._verifiedUserId || payload.userId || '').trim();
  var callerRole = String(payload._verifiedRole || '').toLowerCase().trim();
  var isCallerAdmin = (callerRole === 'admin' || callerRole === 'superadmin');

  var users = getSheetData('USERS');
  var userMap = {};
  var batchesSet = {};
  var callerBatches = [];
  for (var u = 0; u < users.length; u++) {
    var usr = users[u];
    var uid = String(usr.UserID || '').trim();
    if (!uid) continue;
    var uBatchList = String(usr.Batch || 'RP-Trail').split(',').map(function(b) {
      var t = b.trim();
      if (!t || t === '-' || t.toLowerCase() === 'general batch' || t.toLowerCase() === 'free tier') return 'RP-Trail';
      return t;
    }).filter(Boolean);
    if (!uBatchList.length) uBatchList = ['RP-Trail'];
    uBatchList.forEach(function(b) { batchesSet[b] = true; });
    if (uid === callerId) {
      callerBatches = uBatchList.slice();
    }
    userMap[uid] = {
      userId: uid,
      name: String(usr.Name || uid),
      role: String(usr.Role || 'user').toLowerCase(),
      batches: uBatchList
    };
  }

  // Strictly scope non-admin callers to their own enrolled batch(es) only
  var allowedBatchesLower = null;
  if (!isCallerAdmin) {
    if (!callerBatches.length) callerBatches = ['RP-Trail'];
    allowedBatchesLower = callerBatches.map(function(b) { return b.toLowerCase(); });
    batchesSet = {};
    callerBatches.forEach(function(b) { batchesSet[b] = true; });
  }

  var history = getSheetData('TEST_HISTORY');
  var aggByBatchUser = {};

  for (var i = 0; i < history.length; i++) {
    var row = history[i];
    if (!row || !row.UserID) continue;
    var rawDate = row.Date || row.Timestamp || '';
    var rowMs = new Date(rawDate).getTime();
    if (isNaN(rowMs) || rowMs < cutoffMs) continue;

    var hUid = String(row.UserID).trim();
    var uInfo = userMap[hUid] || { userId: hUid, name: String(row.UserName || hUid), role: 'user', batches: ['RP-Trail'] };
    var wpm = parseFloat(row.NetSpeed || row.WPM || row.GrossSpeed || 0) || 0;
    var acc = parseFloat(row.AccuracyPercentage !== undefined ? row.AccuracyPercentage : (row.Accuracy || 0)) || 0;
    if (wpm <= 0 && acc <= 0) continue;

    var userBatches = uInfo.batches;
    for (var bIdx = 0; bIdx < userBatches.length; bIdx++) {
      var bName = userBatches[bIdx];
      if (allowedBatchesLower && allowedBatchesLower.indexOf(bName.toLowerCase()) === -1) {
        continue;
      }
      if (requestedBatch && requestedBatch !== 'ALL' && bName.toLowerCase() !== requestedBatch.toLowerCase()) {
        continue;
      }
      var compositeKey = bName + '::' + hUid;
      if (!aggByBatchUser[compositeKey]) {
        aggByBatchUser[compositeKey] = {
          userId: hUid,
          userName: uInfo.name,
          batch: bName,
          testsCount: 0,
          totalWpm: 0,
          totalAcc: 0,
          bestWpm: 0,
          bestAcc: 0,
          lastTestDate: ''
        };
      }
      var bucket = aggByBatchUser[compositeKey];
      bucket.testsCount += 1;
      bucket.totalWpm += wpm;
      bucket.totalAcc += acc;
      if (wpm > bucket.bestWpm) bucket.bestWpm = wpm;
      if (acc > bucket.bestAcc) bucket.bestAcc = acc;
      if (!bucket.lastTestDate || rowMs > new Date(bucket.lastTestDate).getTime()) {
        bucket.lastTestDate = String(rawDate);
      }
    }
  }

  var grouped = {};
  var flatLeaderboard = [];
  for (var key in aggByBatchUser) {
    if (!aggByBatchUser.hasOwnProperty(key)) continue;
    var rec = aggByBatchUser[key];
    var avgWpm = Math.round((rec.totalWpm / rec.testsCount) * 10) / 10;
    var avgAcc = Math.round((rec.totalAcc / rec.testsCount) * 10) / 10;
    var score = Math.round(((avgAcc * 0.55) + (Math.min(120, avgWpm) * 0.45)) * 100) / 100;
    if (!grouped[rec.batch]) grouped[rec.batch] = [];
    var rowItem = {
      userId: rec.userId,
      name: rec.userName,
      userName: rec.userName,
      batch: rec.batch,
      testsCount: rec.testsCount,
      avgWpm: avgWpm,
      avgAcc: avgAcc,
      avgAccuracy: avgAcc,
      bestWpm: Math.round(rec.bestWpm * 10) / 10,
      bestAccuracy: Math.round(rec.bestAcc * 10) / 10,
      compositeScore: score,
      lastTestDate: rec.lastTestDate
    };
    grouped[rec.batch].push(rowItem);
    flatLeaderboard.push(rowItem);
  }

  var sortFn = function(a, b) {
    if (b.compositeScore !== a.compositeScore) return b.compositeScore - a.compositeScore;
    if (b.avgAccuracy !== a.avgAccuracy) return b.avgAccuracy - a.avgAccuracy;
    if (b.avgWpm !== a.avgWpm) return b.avgWpm - a.avgWpm;
    return b.testsCount - a.testsCount;
  };

  var rankingsByBatch = {};
  for (var batchKey in grouped) {
    if (!grouped.hasOwnProperty(batchKey)) continue;
    grouped[batchKey].sort(sortFn);
    rankingsByBatch[batchKey] = grouped[batchKey].map(function(entry, idx) {
      entry.rank = idx + 1;
      return entry;
    });
  }

  flatLeaderboard.sort(sortFn);
  var leaderboard = flatLeaderboard.map(function(entry, idx) {
    return {
      rank: idx + 1,
      userId: entry.userId,
      name: entry.name,
      userName: entry.userName,
      batch: entry.batch,
      testsCount: entry.testsCount,
      avgWpm: entry.avgWpm,
      avgAcc: entry.avgAcc,
      avgAccuracy: entry.avgAccuracy,
      bestWpm: entry.bestWpm,
      bestAccuracy: entry.bestAccuracy,
      compositeScore: entry.compositeScore,
      lastTestDate: entry.lastTestDate
    };
  });

  return {
    success: true,
    daysWindow: daysWindow,
    batches: Object.keys(batchesSet).sort(),
    leaderboard: leaderboard,
    rankingsByBatch: rankingsByBatch,
    generatedAt: new Date().toISOString()
  };
}

function handleSaveShorthandPadAnnotation(payload) {
  payload = payload || {};
  var actorId = String(payload._verifiedUserId || payload.userId || '').trim();
  var actorRole = String(payload._verifiedRole || 'user').toLowerCase().trim();
  var padKey = String(payload.padKey || payload.testResultId || payload.padId || payload.testId || '').trim();
  if (!padKey) {
    return { success: false, message: 'Pad or Test ID is required to save annotations.' };
  }
  var settings = getSheetData('SETTINGS');
  var map = {};
  for (var i = 0; i < settings.length; i++) {
    if (String(settings[i].Key || '').toUpperCase().trim() === 'SHORTHAND_PAD_ANNOTATIONS_JSON') {
      map = parseReadableSheetData(settings[i].Value, {});
      if (!map || typeof map !== 'object' || Array.isArray(map)) map = {};
      break;
    }
  }
  var overlayUrl = '';
  if (payload.overlayDataUrl && String(payload.overlayDataUrl).indexOf('data:image/') === 0) {
    overlayUrl = saveShorthandPadImageToDriveOrSheet(payload.overlayDataUrl, 'ANN_' + padKey, actorId);
  } else if (payload.overlayUrl) {
    overlayUrl = String(payload.overlayUrl).trim();
  }
  var notesList = Array.isArray(payload.pinNotes) ? payload.pinNotes.slice(0, 40) : [];
  var cleanRemarks = sanitizeInput(String(payload.feedbackNote || payload.remarks || '').trim()).slice(0, 1000);
  var reviewerLabel = sanitizeInput(String(payload.annotatedBy || payload.reviewerName || payload.requesterName || actorId));
  map[padKey] = {
    padKey: padKey,
    padId: String(payload.padId || ''),
    testId: String(payload.testResultId || payload.testId || ''),
    studentId: String(payload.studentId || ''),
    reviewerId: actorId,
    reviewerName: reviewerLabel,
    AnnotatedBy: reviewerLabel,
    reviewerRole: actorRole,
    overlayUrl: overlayUrl,
    remarks: cleanRemarks,
    FeedbackNote: cleanRemarks,
    strokesCount: Number(payload.strokesCount || (Array.isArray(payload.strokes) ? payload.strokes.length : 0)) || 0,
    strokes: Array.isArray(payload.strokes) ? payload.strokes.slice(0, 200) : [],
    annotationSummary: sanitizeInput(String(payload.annotationSummary || '').trim()).slice(0, 400),
    pinNotes: notesList,
    updatedAt: new Date().toISOString()
  };
  upsertSettingsJsonKey('SHORTHAND_PAD_ANNOTATIONS_JSON', map);
  return {
    success: true,
    annotation: map[padKey],
    message: 'Shorthand pad annotation & mentor notes saved to Google Sheets!'
  };
}

function handleGetShorthandPadAnnotations(payload) {
  payload = payload || {};
  var lookupKeys = [
    String(payload.padKey || '').trim(),
    String(payload.testResultId || '').trim(),
    String(payload.padId || '').trim(),
    String(payload.testId || '').trim()
  ].filter(Boolean);
  var settings = getSheetData('SETTINGS');
  var map = {};
  for (var i = 0; i < settings.length; i++) {
    if (String(settings[i].Key || '').toUpperCase().trim() === 'SHORTHAND_PAD_ANNOTATIONS_JSON') {
      map = parseReadableSheetData(settings[i].Value, {});
      if (!map || typeof map !== 'object' || Array.isArray(map)) map = {};
      break;
    }
  }
  if (lookupKeys.length > 0) {
    var matched = null;
    for (var k = 0; k < lookupKeys.length; k++) {
      if (map[lookupKeys[k]]) {
        matched = map[lookupKeys[k]];
        break;
      }
    }
    if (matched) {
      if (!matched.FeedbackNote) matched.FeedbackNote = matched.remarks || '';
      if (!matched.AnnotatedBy) matched.AnnotatedBy = matched.reviewerName || 'Faculty';
    }
    return {
      success: true,
      annotation: matched || null,
      annotations: matched ? [matched] : []
    };
  }
  var allList = [];
  for (var mk in map) {
    if (map.hasOwnProperty(mk) && map[mk]) {
      var item = map[mk];
      if (!item.FeedbackNote) item.FeedbackNote = item.remarks || '';
      if (!item.AnnotatedBy) item.AnnotatedBy = item.reviewerName || 'Faculty';
      allList.push(item);
    }
  }
  return { success: true, annotations: allList, annotationsMap: map };
}

// =========================================================================
// BATCH FEE & MEMBER ALL-ACCESS PASS FEE SYSTEM (UPI/QR + FEE LEDGER)
// =========================================================================
function inferFeeBillingCycleLabel(rawCycle, rawName, validityDays) {
  var c = String(rawCycle || '').trim();
  if (c) return c;
  var nm = String(rawName || '').toLowerCase();
  var d = parseInt(validityDays || 0, 10) || 0;
  if (nm.indexOf('month') !== -1 || d === 28 || d === 30 || d === 31) return 'Monthly';
  if (nm.indexOf('quarter') !== -1 || nm.indexOf('3 month') !== -1 || d === 90 || d === 91 || d === 92) return 'Quarterly';
  if (nm.indexOf('half') !== -1 || nm.indexOf('6 month') !== -1 || d === 180 || d === 182 || d === 183) return 'Half-Yearly';
  if (nm.indexOf('annual') !== -1 || nm.indexOf('year') !== -1 || nm.indexOf('12 month') !== -1 || d >= 360) return 'Annual';
  return 'Custom';
}

function normalizeMemberBillingOptionsServer(mp, fallbackIdx) {
  var rawOpts = Array.isArray(mp.billingOptions) ? mp.billingOptions : (Array.isArray(mp.plans) ? mp.plans : []);
  var clean = [];
  for (var i = 0; i < rawOpts.length; i++) {
    var opt = rawOpts[i] || {};
    var amt = Math.max(0, Number(opt.amount !== undefined ? opt.amount : (opt.fee !== undefined ? opt.fee : 0)) || 0);
    var vDays = Math.max(1, parseInt(opt.validityDays || 30, 10) || 30);
    var label = sanitizeInput(String(opt.label || opt.name || '').trim()).slice(0, 60);
    var cycle = sanitizeInput(inferFeeBillingCycleLabel(opt.cycle, label, vDays)).slice(0, 32);
    if (!label) label = cycle === 'Custom' ? ('Option ' + (i + 1)) : cycle;
    var note = sanitizeInput(String(opt.note || opt.description || '').trim()).slice(0, 200);
    clean.push({
      id: sanitizeInput(String(opt.id || ('mo-' + (fallbackIdx || 0) + '-' + (i + 1)))),
      cycle: cycle,
      label: label,
      amount: amt,
      validityDays: vDays,
      note: note,
      allowInstallments: Boolean(opt.allowInstallments),
      installmentCount: Math.max(2, Math.min(4, parseInt(opt.installmentCount || 2, 10) || 2)),
      firstInstallmentPercent: Math.max(20, Math.min(80, parseInt(opt.firstInstallmentPercent || 50, 10) || 50))
    });
  }
  if (!clean.length) {
    var baseAmt = Math.max(0, Number(mp.amount !== undefined ? mp.amount : (mp.fee !== undefined ? mp.fee : 0)) || 0);
    var baseDays = Math.max(1, parseInt(mp.validityDays || 365, 10) || 365);
    var baseCycle = inferFeeBillingCycleLabel(mp.cycle, mp.name, baseDays);
    clean.push({
      id: 'mo-' + (fallbackIdx || 0) + '-1',
      cycle: baseCycle,
      label: baseCycle === 'Custom' ? 'Standard' : baseCycle,
      amount: baseAmt,
      validityDays: baseDays,
      note: '',
      allowInstallments: Boolean(mp.allowInstallments),
      installmentCount: 2,
      firstInstallmentPercent: Math.max(20, Math.min(80, parseInt(mp.firstInstallmentPercent || 50, 10) || 50))
    });
  }
  return clean;
}

function parseFeeConfigSettings(settings) {
  var def = {
    upiId: '',
    payeeName: 'RP Skill | Ranjan Pathshala',
    qrImageUrl: '',
    paymentInstructions: 'Scan the UPI QR or pay via UPI app, then enter your 12-digit UTR / Transaction Reference below for quick Admin approval.',
    memberFee: 0,
    memberValidityDays: 365,
    memberDescription: 'All-Access Pass: Unlocks institute batches, dictations, Pitman books, typing tests, live exams & CBT mocks.',
    batchFees: {},
    batchPlans: {},
    memberPlans: [],
    coupons: []
  };
  if (!Array.isArray(settings)) return def;
  for (var i = 0; i < settings.length; i++) {
    if (String(settings[i].Key || '').toUpperCase().trim() === 'FEE_CONFIG_SETTINGS') {
      var parsed = parseReadableSheetData(settings[i].Value, {});
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        var batchFeesObj = (parsed.batchFees && typeof parsed.batchFees === 'object' && !Array.isArray(parsed.batchFees)) ? parsed.batchFees : {};
        var rawBatchPlansObj = (parsed.batchPlans && typeof parsed.batchPlans === 'object' && !Array.isArray(parsed.batchPlans)) ? parsed.batchPlans : {};
        var batchPlansObj = {};
        for (var bpk in rawBatchPlansObj) {
          if (!rawBatchPlansObj.hasOwnProperty(bpk)) continue;
          var cleanBpk = String(bpk || '').trim();
          if (!cleanBpk || cleanBpk.toLowerCase() === 'rp-trail') continue;
          var bpList = Array.isArray(rawBatchPlansObj[bpk]) ? rawBatchPlansObj[bpk] : [];
          var normBpList = [];
          for (var bi = 0; bi < bpList.length; bi++) {
            var bp = bpList[bi] || {};
            var bpAmt = Math.max(0, Number(bp.amount !== undefined ? bp.amount : (bp.fee !== undefined ? bp.fee : 0)) || 0);
            var bpDays = Math.max(1, parseInt(bp.validityDays || 30, 10) || 30);
            var bpName = String(bp.name || ('Plan ' + (bi + 1))).trim();
            var bpCycle = inferFeeBillingCycleLabel(bp.cycle, bpName, bpDays);
            var bpNote = String(bp.note || bp.description || '').trim();
            normBpList.push({
              id: String(bp.id || ('bp-' + cleanBpk.replace(/[^a-zA-Z0-9]/g, '') + '-' + (bi + 1))),
              cycle: bpCycle,
              name: bpName || (bpCycle === 'Custom' ? 'Standard Plan' : (bpCycle + ' Plan')),
              amount: bpAmt,
              validityDays: bpDays,
              note: bpNote,
              description: bpNote,
              allowInstallments: Boolean(bp.allowInstallments),
              installmentCount: Math.max(2, Math.min(4, parseInt(bp.installmentCount || 2, 10) || 2)),
              firstInstallmentPercent: Math.max(20, Math.min(80, parseInt(bp.firstInstallmentPercent || 50, 10) || 50))
            });
          }
          if (normBpList.length) batchPlansObj[cleanBpk] = normBpList;
        }
        for (var bk in batchFeesObj) {
          if (!batchFeesObj.hasOwnProperty(bk)) continue;
          var cleanBk = String(bk || '').trim();
          if (!cleanBk || cleanBk.toLowerCase() === 'rp-trail') continue;
          if (!Array.isArray(batchPlansObj[cleanBk]) || !batchPlansObj[cleanBk].length) {
            var bf = batchFeesObj[bk];
            var amt = (typeof bf === 'object' && bf !== null) ? Math.max(0, Number(bf.amount !== undefined ? bf.amount : (bf.fee || 0)) || 0) : Math.max(0, Number(bf) || 0);
            var vDays = (typeof bf === 'object' && bf !== null) ? Math.max(1, parseInt(bf.validityDays || 30, 10) || 30) : 30;
            var desc = (typeof bf === 'object' && bf !== null) ? String(bf.description || bf.note || '').trim() : '';
            if (amt > 0 || desc || (typeof bf === 'object' && bf !== null && bf.amount !== undefined)) {
              batchPlansObj[cleanBk] = [{
                id: 'bp-' + cleanBk.replace(/[^a-zA-Z0-9]/g, '') + '-1',
                cycle: inferFeeBillingCycleLabel('', 'Standard Plan', vDays),
                name: 'Standard Plan',
                amount: amt,
                validityDays: vDays,
                note: desc,
                description: desc,
                allowInstallments: Boolean(typeof bf === 'object' && bf !== null && bf.allowInstallments),
                installmentCount: 2,
                firstInstallmentPercent: 50
              }];
            }
          }
        }
        var rawMemberPlans = Array.isArray(parsed.memberPlans) ? parsed.memberPlans : [];
        var memberPlansArr = [];
        for (var mi = 0; mi < rawMemberPlans.length; mi++) {
          var mp = rawMemberPlans[mi] || {};
          var mpName = String(mp.name || '').trim();
          if (!mpName) continue;
          var mpScope = String(mp.accessScope || 'ALL_PAST_CURRENT_UPCOMING').toUpperCase().trim();
          var mpBatches = Array.isArray(mp.includedBatches)
            ? mp.includedBatches.map(function(x) { return String(x || '').trim(); }).filter(Boolean)
            : String(mp.includedBatches || '').split(',').map(function(x) { return x.trim(); }).filter(Boolean);
          var opts = normalizeMemberBillingOptionsServer(mp, mi + 1);
          memberPlansArr.push({
            id: String(mp.id || ('mp-' + (mi + 1))),
            name: mpName,
            amount: opts[0].amount,
            validityDays: opts[0].validityDays,
            billingOptions: opts,
            accessScope: mpScope,
            includedBatches: mpBatches,
            includeUpcoming: Boolean(mp.includeUpcoming === true || mpScope === 'ALL_PAST_CURRENT_UPCOMING' || mpScope === 'CURRENT_AND_UPCOMING'),
            description: String(mp.description || '').trim()
          });
        }
        if (!memberPlansArr.length && (Number(parsed.memberFee) || 0) > 0) {
          var legDays = Math.max(1, parseInt(parsed.memberValidityDays || 365, 10) || 365);
          var legAmt = Number(parsed.memberFee) || 0;
          memberPlansArr = [{
            id: 'mp-default',
            name: 'Member All-Access Pass',
            amount: legAmt,
            validityDays: legDays,
            billingOptions: [{
              id: 'mo-default-1',
              cycle: inferFeeBillingCycleLabel('', 'Annual', legDays),
              label: inferFeeBillingCycleLabel('', 'Annual', legDays),
              amount: legAmt,
              validityDays: legDays,
              note: '',
              allowInstallments: false,
              installmentCount: 2,
              firstInstallmentPercent: 50
            }],
            accessScope: 'ALL_PAST_CURRENT_UPCOMING',
            includedBatches: [],
            includeUpcoming: true,
            description: String(parsed.memberDescription || def.memberDescription)
          }];
        }
        var couponsArr = Array.isArray(parsed.coupons) ? parsed.coupons : [];
        var firstMem = memberPlansArr.length ? memberPlansArr[0] : null;
        return {
          upiId: String(parsed.upiId || '').trim(),
          payeeName: String(parsed.payeeName || def.payeeName).trim(),
          qrImageUrl: String(parsed.qrImageUrl || '').trim(),
          paymentInstructions: String(parsed.paymentInstructions || def.paymentInstructions).trim(),
          memberFee: firstMem ? (Number(firstMem.amount) || 0) : (Number(parsed.memberFee) || 0),
          memberValidityDays: firstMem ? (parseInt(firstMem.validityDays || 365, 10) || 365) : Math.max(1, parseInt(parsed.memberValidityDays || 365, 10) || 365),
          memberDescription: firstMem ? String(firstMem.description || def.memberDescription) : String(parsed.memberDescription || def.memberDescription).trim(),
          batchFees: batchFeesObj,
          batchPlans: batchPlansObj,
          memberPlans: memberPlansArr,
          coupons: couponsArr
        };
      }
    }
  }
  return def;
}

function evaluateFeeCouponServer(feeCfg, rawCode, feeType, baseAmount) {
  var code = String(rawCode || '').trim().toUpperCase();
  var amt = Math.max(0, Number(baseAmount) || 0);
  if (!code) return { valid: false, discountAmount: 0, netAmount: amt, message: 'Please enter a coupon code.' };
  var coupons = (feeCfg && Array.isArray(feeCfg.coupons)) ? feeCfg.coupons : [];
  var match = null;
  for (var i = 0; i < coupons.length; i++) {
    if (String(coupons[i].code || '').trim().toUpperCase() === code) {
      match = coupons[i];
      break;
    }
  }
  if (!match) return { valid: false, discountAmount: 0, netAmount: amt, message: 'Coupon code "' + code + '" not found.' };
  if (match.active === false) return { valid: false, discountAmount: 0, netAmount: amt, message: 'Coupon "' + code + '" is currently inactive.' };
  var todayStr = Utilities.formatDate(new Date(), DbConnectionManager.getTimeZone(), 'yyyy-MM-dd');
  if (match.validUntil && /^\d{4}-\d{2}-\d{2}$/.test(String(match.validUntil)) && String(match.validUntil) < todayStr) {
    return { valid: false, discountAmount: 0, netAmount: amt, message: 'Coupon "' + code + '" expired on ' + match.validUntil + '.' };
  }
  var maxUses = parseInt(match.maxUses || 0, 10) || 0;
  var usedCount = parseInt(match.usedCount || 0, 10) || 0;
  if (maxUses > 0 && usedCount >= maxUses) {
    return { valid: false, discountAmount: 0, netAmount: amt, message: 'Coupon "' + code + '" has reached its maximum usage limit.' };
  }
  var applies = String(match.appliesTo || 'ALL').toUpperCase().trim();
  var fType = String(feeType || 'batch').toLowerCase().trim() === 'member' ? 'MEMBER' : 'BATCH';
  if (applies !== 'ALL' && applies !== fType) {
    return { valid: false, discountAmount: 0, netAmount: amt, message: 'Coupon "' + code + '" only applies to ' + applies + ' plans.' };
  }
  var minAmt = Math.max(0, Number(match.minAmount) || 0);
  if (minAmt > 0 && amt < minAmt) {
    return { valid: false, discountAmount: 0, netAmount: amt, message: 'Minimum fee of Rs. ' + minAmt + ' required for coupon "' + code + '".' };
  }
  var dType = String(match.discountType || 'FLAT').toUpperCase().trim();
  var val = Math.max(0, Number(match.value) || 0);
  var discount = dType === 'PERCENT' ? Math.round((amt * Math.min(100, val)) / 100) : Math.round(val);
  discount = Math.max(0, Math.min(amt, discount));
  var net = Math.max(0, amt - discount);
  return {
    valid: true,
    code: code,
    discountType: dType,
    value: val,
    discountAmount: discount,
    netAmount: net,
    message: 'Coupon "' + code + '" applied! Saved Rs. ' + discount + '.'
  };
}

function handleValidateFeeCoupon(payload) {
  payload = payload || {};
  var settings = getSheetData('SETTINGS');
  var feeCfg = parseFeeConfigSettings(settings);
  var res = evaluateFeeCouponServer(feeCfg, payload.couponCode || payload.code, payload.feeType || 'batch', payload.baseAmount || payload.amount || 0);
  return {
    success: res.valid,
    valid: res.valid,
    code: res.code || '',
    discountAmount: res.discountAmount || 0,
    netAmount: res.netAmount || 0,
    message: res.message
  };
}

function handleGetFeeConfig() {
  var settings = getSheetData('SETTINGS');
  return {
    success: true,
    feeConfig: parseFeeConfigSettings(settings),
    instituteBatches: parseInstituteBatchesSettings(settings),
    batchMetaMap: parseInstituteBatchesMetaSettings(settings)
  };
}

function handleSaveFeeConfig(payload) {
  payload = payload || {};
  var incoming = payload.feeConfig || payload;
  var cleanBatchPlans = {};
  var cleanBatchFees = {};

  if (incoming.batchPlans && typeof incoming.batchPlans === 'object' && !Array.isArray(incoming.batchPlans)) {
    for (var bpKey in incoming.batchPlans) {
      if (!incoming.batchPlans.hasOwnProperty(bpKey)) continue;
      var cleanKey = String(bpKey || '').trim();
      if (!cleanKey || cleanKey.toLowerCase() === 'rp-trail') continue;
      var arr = Array.isArray(incoming.batchPlans[bpKey]) ? incoming.batchPlans[bpKey] : [];
      var cleanArr = [];
      for (var p = 0; p < arr.length; p++) {
        var pl = arr[p] || {};
        var amt = Math.max(0, Number(pl.amount !== undefined ? pl.amount : (pl.fee || 0)) || 0);
        var pName = sanitizeInput(String(pl.name || ('Plan ' + (p + 1))).trim()).slice(0, 80);
        if (!pName && amt <= 0) continue;
        var pDays = Math.max(1, parseInt(pl.validityDays || 30, 10) || 30);
        var pCycle = sanitizeInput(inferFeeBillingCycleLabel(pl.cycle, pName, pDays)).slice(0, 32);
        var pNote = sanitizeInput(String(pl.note || pl.description || '').trim()).slice(0, 220);
        cleanArr.push({
          id: sanitizeInput(String(pl.id || ('bp-' + Date.now() + '-' + p))),
          cycle: pCycle,
          name: pName || (pCycle === 'Custom' ? 'Standard Plan' : (pCycle + ' Plan')),
          amount: amt,
          validityDays: pDays,
          note: pNote,
          description: pNote,
          allowInstallments: Boolean(pl.allowInstallments),
          installmentCount: Math.max(2, Math.min(4, parseInt(pl.installmentCount || 2, 10) || 2)),
          firstInstallmentPercent: Math.max(20, Math.min(80, parseInt(pl.firstInstallmentPercent || 50, 10) || 50))
        });
      }
      if (cleanArr.length) {
        cleanBatchPlans[cleanKey] = cleanArr;
        cleanBatchFees[cleanKey] = {
          amount: cleanArr[0].amount,
          validityDays: cleanArr[0].validityDays,
          note: cleanArr[0].note,
          description: cleanArr[0].description,
          allowInstallments: cleanArr[0].allowInstallments
        };
      }
    }
  } else if (incoming.batchFees && typeof incoming.batchFees === 'object' && !Array.isArray(incoming.batchFees)) {
    for (var bName in incoming.batchFees) {
      if (!incoming.batchFees.hasOwnProperty(bName)) continue;
      var cleanB = String(bName || '').trim();
      if (!cleanB || cleanB.toLowerCase() === 'rp-trail') continue;
      var entry = incoming.batchFees[bName];
      var bAmt = (typeof entry === 'object' && entry !== null) ? Math.max(0, Number(entry.amount !== undefined ? entry.amount : (entry.fee || 0)) || 0) : Math.max(0, Number(entry) || 0);
      var bDays = (typeof entry === 'object' && entry !== null) ? Math.max(1, parseInt(entry.validityDays || 30, 10) || 30) : 30;
      var bDesc = (typeof entry === 'object' && entry !== null) ? sanitizeInput(String(entry.note || entry.description || '').trim()).slice(0, 200) : '';
      cleanBatchFees[cleanB] = { amount: bAmt, validityDays: bDays, note: bDesc, description: bDesc };
      cleanBatchPlans[cleanB] = [{
        id: 'bp-' + cleanB.replace(/[^a-zA-Z0-9]/g, '') + '-1',
        cycle: inferFeeBillingCycleLabel('', 'Standard Plan', bDays),
        name: 'Standard Plan',
        amount: bAmt,
        validityDays: bDays,
        note: bDesc,
        description: bDesc,
        allowInstallments: false,
        installmentCount: 2,
        firstInstallmentPercent: 50
      }];
    }
  }

  var cleanMemberPlans = [];
  if (Array.isArray(incoming.memberPlans)) {
    for (var m = 0; m < incoming.memberPlans.length; m++) {
      var mp = incoming.memberPlans[m] || {};
      var mName = sanitizeInput(String(mp.name || ('Member Tier ' + (m + 1))).trim()).slice(0, 90);
      if (!mName) continue;
      var mScope = String(mp.accessScope || 'ALL_PAST_CURRENT_UPCOMING').toUpperCase().trim();
      var mBatches = Array.isArray(mp.includedBatches)
        ? mp.includedBatches.map(function(x) { return sanitizeInput(String(x || '').trim()); }).filter(Boolean)
        : String(mp.includedBatches || '').split(',').map(function(x) { return sanitizeInput(x.trim()); }).filter(Boolean);
      var cleanOpts = normalizeMemberBillingOptionsServer(mp, m + 1);
      cleanMemberPlans.push({
        id: sanitizeInput(String(mp.id || ('mp-' + Date.now() + '-' + m))),
        name: mName,
        amount: cleanOpts[0].amount,
        validityDays: cleanOpts[0].validityDays,
        billingOptions: cleanOpts,
        accessScope: mScope,
        includedBatches: mBatches,
        includeUpcoming: Boolean(mp.includeUpcoming === true || mScope === 'ALL_PAST_CURRENT_UPCOMING' || mScope === 'CURRENT_AND_UPCOMING'),
        description: sanitizeInput(String(mp.description || '').trim()).slice(0, 260)
      });
    }
  } else if ((Number(incoming.memberFee) || 0) > 0) {
    var legMDays = Math.max(1, parseInt(incoming.memberValidityDays || 365, 10) || 365);
    var legMAmt = Math.max(0, Number(incoming.memberFee) || 0);
    cleanMemberPlans.push({
      id: 'mp-default',
      name: 'Member All-Access Pass',
      amount: legMAmt,
      validityDays: legMDays,
      billingOptions: [{
        id: 'mo-default-1',
        cycle: inferFeeBillingCycleLabel('', 'Annual', legMDays),
        label: inferFeeBillingCycleLabel('', 'Annual', legMDays),
        amount: legMAmt,
        validityDays: legMDays,
        note: '',
        allowInstallments: false,
        installmentCount: 2,
        firstInstallmentPercent: 50
      }],
      accessScope: 'ALL_PAST_CURRENT_UPCOMING',
      includedBatches: [],
      includeUpcoming: true,
      description: sanitizeInput(String(incoming.memberDescription || 'All-Access Pass: Unlocks all institute batches.').trim()).slice(0, 260)
    });
  }

  var existingCfg = parseFeeConfigSettings(getSheetData('SETTINGS'));
  var existingUsedMap = {};
  if (existingCfg && Array.isArray(existingCfg.coupons)) {
    for (var ec = 0; ec < existingCfg.coupons.length; ec++) {
      var eCode = String(existingCfg.coupons[ec].code || '').trim().toUpperCase();
      if (eCode) existingUsedMap[eCode] = parseInt(existingCfg.coupons[ec].usedCount || 0, 10) || 0;
    }
  }

  var cleanCoupons = [];
  if (Array.isArray(incoming.coupons)) {
    var seenCodes = {};
    for (var c = 0; c < incoming.coupons.length; c++) {
      var cp = incoming.coupons[c] || {};
      var cCode = sanitizeInput(String(cp.code || '').trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '')).slice(0, 32);
      if (!cCode || seenCodes[cCode]) continue;
      seenCodes[cCode] = true;
      var cType = String(cp.discountType || 'FLAT').toUpperCase().trim() === 'PERCENT' ? 'PERCENT' : 'FLAT';
      var cVal = Math.max(0, Number(cp.value) || 0);
      if (cType === 'PERCENT') cVal = Math.min(100, cVal);
      var cApplies = String(cp.appliesTo || 'ALL').toUpperCase().trim();
      if (cApplies !== 'BATCH' && cApplies !== 'MEMBER') cApplies = 'ALL';
      cleanCoupons.push({
        code: cCode,
        discountType: cType,
        value: cVal,
        appliesTo: cApplies,
        minAmount: Math.max(0, Number(cp.minAmount) || 0),
        maxUses: Math.max(0, parseInt(cp.maxUses || 0, 10) || 0),
        usedCount: Math.max(existingUsedMap[cCode] || 0, parseInt(cp.usedCount || 0, 10) || 0),
        validUntil: sanitizeInput(String(cp.validUntil || '').trim()).slice(0, 10),
        active: cp.active !== false,
        note: sanitizeInput(String(cp.note || '').trim()).slice(0, 160)
      });
    }
  } else if (existingCfg && Array.isArray(existingCfg.coupons)) {
    cleanCoupons = existingCfg.coupons;
  }

  var primaryMem = cleanMemberPlans.length ? cleanMemberPlans[0] : null;
  var cfg = {
    upiId: sanitizeInput(String(incoming.upiId || '').trim()),
    payeeName: sanitizeInput(String(incoming.payeeName || 'RP Skill | Ranjan Pathshala').trim()),
    qrImageUrl: sanitizeInput(String(incoming.qrImageUrl || '').trim()),
    paymentInstructions: sanitizeInput(String(incoming.paymentInstructions || '').trim()).slice(0, 400),
    memberFee: primaryMem ? primaryMem.amount : Math.max(0, Number(incoming.memberFee) || 0),
    memberValidityDays: primaryMem ? primaryMem.validityDays : Math.max(1, parseInt(incoming.memberValidityDays || 365, 10) || 365),
    memberDescription: primaryMem ? primaryMem.description : sanitizeInput(String(incoming.memberDescription || '').trim()).slice(0, 300),
    batchFees: cleanBatchFees,
    batchPlans: cleanBatchPlans,
    memberPlans: cleanMemberPlans,
    coupons: cleanCoupons,
    updatedAt: new Date().toISOString()
  };
  upsertSettingsExactJsonKey('FEE_CONFIG_SETTINGS', cfg);
  handleLogActivity({
    userId: payload._verifiedUserId || 'ADMIN',
    userName: payload.actorName || 'Admin',
    activityType: 'FEE_CONFIG_UPDATED',
    details: 'Updated Fee Configuration (Member Plans: ' + cleanMemberPlans.length + ', Batch Plans: ' + Object.keys(cleanBatchPlans).length + ', Coupons: ' + cleanCoupons.length + ', UPI: ' + (cfg.upiId || 'Not Set') + ')'
  });
  var freshSettings = getSheetData('SETTINGS');
  return {
    success: true,
    feeConfig: cfg,
    instituteBatches: parseInstituteBatchesSettings(freshSettings),
    batchMetaMap: parseInstituteBatchesMetaSettings(freshSettings),
    message: 'UPI/QR, Batch Plans, Member Plans & Coupons saved to Google Sheets!'
  };
}

function handleSubmitStudentFeePayment(payload) {
  payload = payload || {};
  var userId = String(payload._verifiedUserId || payload.userId || '').trim();
  if (!userId) return { success: false, message: 'User authentication required.' };
  var feeType = String(payload.feeType || 'batch').toLowerCase().trim() === 'member' ? 'Member' : 'Batch';
  var planName = sanitizeInput(String(payload.planName || (feeType === 'Member' ? 'Member All-Access Pass' : 'Standard Batch Plan')).trim()).slice(0, 90);
  var validityDays = Math.max(1, parseInt(payload.validityDays || (feeType === 'Member' ? 365 : 30), 10) || 30);
  var targetBatch = feeType === 'Member'
    ? ('Member Tier: ' + planName)
    : sanitizeInput(String(payload.batchName || payload.batch || '').trim());
  if (feeType === 'Batch' && !targetBatch) {
    return { success: false, message: 'Please select a batch to pay for.' };
  }

  var amountPaid = Math.max(0, Number(payload.amountPaid !== undefined ? payload.amountPaid : (payload.amount || 0)) || 0);
  var rawRemarksInput = String(payload.remarks || payload.notes || '').trim();
  var hasZeroFeeFlag = Boolean(payload.isZeroFeeRequest === true || rawRemarksInput.indexOf('[₹0_FREE]') !== -1);

  // Server-side Coupon Validation & Plan Fee Check BEFORE enforcing UTR / positive amount
  var settings = getSheetData('SETTINGS');
  var feeCfg = parseFeeConfigSettings(settings);
  var configuredFee = null;
  var reqBillingCycle = String(payload.billingCycle || '').toLowerCase().trim();
  var reqMainPlanName = String(payload.mainPlanName || '').toLowerCase().trim();
  if (feeType === 'Batch' && feeCfg) {
    var bPlansList = (feeCfg.batchPlans && Array.isArray(feeCfg.batchPlans[targetBatch])) ? feeCfg.batchPlans[targetBatch] : [];
    var matchedBp = null;
    for (var bpi = 0; bpi < bPlansList.length; bpi++) {
      var candBp = bPlansList[bpi];
      if (!candBp) continue;
      if (String(candBp.name || '').toLowerCase().trim() === planName.toLowerCase().trim() ||
          (reqBillingCycle && String(candBp.cycle || '').toLowerCase().trim() === reqBillingCycle)) {
        matchedBp = candBp;
        break;
      }
    }
    if (!matchedBp && bPlansList.length === 1) matchedBp = bPlansList[0];
    if (matchedBp && matchedBp.amount !== undefined && !isNaN(Number(matchedBp.amount))) {
      configuredFee = Math.max(0, Number(matchedBp.amount));
    } else if (feeCfg.batchFees && feeCfg.batchFees[targetBatch]) {
      var bf = feeCfg.batchFees[targetBatch];
      var bfRaw = (bf && bf.amount !== undefined) ? bf.amount : (bf && bf.fee !== undefined ? bf.fee : undefined);
      if (bfRaw !== undefined && bfRaw !== '' && !isNaN(Number(bfRaw))) {
        configuredFee = Math.max(0, Number(bfRaw));
      }
    }
  } else if (feeType === 'Member' && feeCfg && Array.isArray(feeCfg.memberPlans)) {
    var normPlanLow = planName.toLowerCase().trim();
    for (var mfi = 0; mfi < feeCfg.memberPlans.length; mfi++) {
      var mPlan = feeCfg.memberPlans[mfi];
      if (!mPlan) continue;
      var mNameLow = String(mPlan.name || '').toLowerCase().trim();
      var isPlanMatch = (mNameLow && (mNameLow === normPlanLow || mNameLow === reqMainPlanName || normPlanLow.indexOf(mNameLow + ' —') === 0 || normPlanLow.indexOf(mNameLow + ' -') === 0));
      if (!isPlanMatch) continue;
      var mOpts = Array.isArray(mPlan.billingOptions) ? mPlan.billingOptions : [];
      var matchedOpt = null;
      for (var moi = 0; moi < mOpts.length; moi++) {
        var mo = mOpts[moi];
        var moLabelLow = String(mo.label || mo.cycle || '').toLowerCase().trim();
        if ((reqBillingCycle && (String(mo.cycle || '').toLowerCase().trim() === reqBillingCycle || moLabelLow === reqBillingCycle)) ||
            (moLabelLow && normPlanLow.indexOf(moLabelLow) !== -1)) {
          matchedOpt = mo;
          break;
        }
      }
      if (matchedOpt && matchedOpt.amount !== undefined && !isNaN(Number(matchedOpt.amount))) {
        configuredFee = Math.max(0, Number(matchedOpt.amount));
      } else {
        var mpRaw = mPlan.amount !== undefined ? mPlan.amount : mPlan.fee;
        if (mpRaw !== undefined && mpRaw !== '' && !isNaN(Number(mpRaw))) {
          configuredFee = Math.max(0, Number(mpRaw));
        }
      }
      break;
    }
  }

  var payloadTotalFee = Number(payload.totalPlanFee !== undefined ? payload.totalPlanFee : (payload.originalAmount !== undefined ? payload.originalAmount : amountPaid));
  var rawTotalFee = (!isNaN(payloadTotalFee) && payloadTotalFee >= 0) ? payloadTotalFee : amountPaid;
  if (configuredFee !== null && configuredFee === 0) {
    rawTotalFee = 0;
  }

  var couponCode = sanitizeInput(String(payload.couponCode || '').trim().toUpperCase());
  var discountAmount = 0;
  if (couponCode) {
    var cpEval = evaluateFeeCouponServer(feeCfg, couponCode, feeType, rawTotalFee);
    if (!cpEval.valid) {
      return { success: false, message: cpEval.message };
    }
    discountAmount = cpEval.discountAmount;
  } else if (payload.discountAmount !== undefined && Number(payload.discountAmount) > 0) {
    discountAmount = Math.min(rawTotalFee, Math.max(0, Number(payload.discountAmount) || 0));
  }
  var netPlanFee = Math.max(0, rawTotalFee - discountAmount);
  var isZeroFeeApprovedFlow = Boolean(netPlanFee <= 0 || (configuredFee === 0) || (hasZeroFeeFlag && amountPaid <= 1 && netPlanFee <= 0));

  var utr = sanitizeInput(String(payload.utr || payload.transactionId || '').trim());
  var normUtr = utr.toUpperCase().replace(/\s+/g, '');

  if (isZeroFeeApprovedFlow) {
    amountPaid = 0;
    if (!normUtr || normUtr.length < 4 || normUtr === '-') {
      utr = 'FREE-0-' + Date.now().toString().slice(-6);
      normUtr = utr.toUpperCase();
    }
  } else {
    if (!normUtr || normUtr.length < 4) {
      return { success: false, message: 'Please enter a valid UPI UTR / Transaction Reference ID.' };
    }
    if (amountPaid <= 0) {
      return { success: false, message: 'Payment amount must be greater than Rs. 0.' };
    }
  }

  // DUPLICATE UTR PREVENTION: Reject if same UTR already exists in Pending or Approved rows
  var existingLedger = getSheetData('FEE_LEDGER');
  for (var eIdx = 0; eIdx < existingLedger.length; eIdx++) {
    var exRow = existingLedger[eIdx];
    var exUtr = String(exRow.UTR || '').trim().toUpperCase().replace(/\s+/g, '');
    var exStatus = normalizeFeeStatusLabel(exRow.Status);
    if (exUtr && exUtr === normUtr && exStatus !== 'Rejected') {
      return {
        success: false,
        duplicateUtr: true,
        existingReceiptNo: String(exRow.ReceiptNo || ''),
        message: 'Duplicate UTR rejected: Transaction ID "' + utr + '" was already submitted under Receipt ' + (exRow.ReceiptNo || '-') + ' (' + exStatus + '). Each UTR can only be used once.'
      };
    }
  }

  // Sum previously approved payments for this student + batch (for Installment 2 / Balance tracking)
  var priorApprovedPaid = 0;
  if (feeType === 'Batch' && !isZeroFeeApprovedFlow) {
    for (var pIdx = 0; pIdx < existingLedger.length; pIdx++) {
      var pr = existingLedger[pIdx];
      if (String(pr.UserID || '') === userId &&
          String(pr.Batch || '').trim().toLowerCase() === targetBatch.toLowerCase() &&
          normalizeFeeStatusLabel(pr.Status) === 'Approved') {
        var prRem = Number(pr.RemainingBalance || pr.DueAmount || 0) || 0;
        var prTotal = Number(pr.TotalPlanFee || 0) || 0;
        if (prRem > 0 || prTotal > 0) {
          priorApprovedPaid += (Number(pr.AmountPaid || 0) || 0);
        }
      }
    }
  }
  var installmentLabel = sanitizeInput(String(payload.installmentLabel || (isZeroFeeApprovedFlow ? 'Free Enrollment (₹0 Paid)' : 'Full Payment')).trim()).slice(0, 60);
  var remainingBalance = isZeroFeeApprovedFlow ? 0 : Math.max(0, netPlanFee - priorApprovedPaid - amountPaid);
  if (installmentLabel.toLowerCase() === 'full payment' && amountPaid >= netPlanFee) {
    remainingBalance = 0;
  }

  var users = getSheetData('USERS');
  var studentName = sanitizeInput(String(payload.studentName || payload.requesterName || userId));
  for (var i = 0; i < users.length; i++) {
    if (String(users[i].UserID) === userId) {
      studentName = String(users[i].Name || studentName);
      break;
    }
  }
  var sheet = getOrCreateSheet('FEE_LEDGER');
  ensureSheetHeadersCached(sheet, 'FEE_LEDGER');
  var receiptNo = 'RPS-' + (feeType === 'Member' ? 'MEM-' : 'BAT-') + Date.now().toString().slice(-6);
  var nowIso = new Date().toISOString();
  var paymentMode = sanitizeInput(String(payload.paymentMode || (isZeroFeeApprovedFlow ? 'Free / 100% Coupon (₹0)' : 'UPI / QR')).trim());
  var defaultZeroRemark = couponCode ? ('100% Coupon (' + couponCode + ') — ₹0 Paid [₹0_FREE]') : 'Free Batch (₹0 Fee) Approval Request [₹0_FREE]';
  var remarks = sanitizeInput(rawRemarksInput || (isZeroFeeApprovedFlow ? defaultZeroRemark : '')).slice(0, 300) || '-';

  var ledgerHeaders = sheet.getLastColumn() > 0
    ? sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]
    : SHEET_SCHEMAS['FEE_LEDGER'];
  var rowMap = {
    'ReceiptNo': receiptNo,
    'UserID': userId,
    'StudentName': studentName,
    'Batch': targetBatch,
    'Branch': 'Online Portal',
    'InstallmentNo': installmentLabel,
    'AmountPaid': amountPaid,
    'DueAmount': remainingBalance,
    'PaymentMode': paymentMode,
    'ValidityUntil': 'Pending Approval',
    'IssuedBy': isZeroFeeApprovedFlow ? 'Student Self-Submit (₹0 Free)' : 'Student Self-Submit',
    'Timestamp': nowIso,
    'FeeType': feeType,
    'PlanName': planName,
    'ValidityDays': validityDays,
    'UTR': utr,
    'Status': 'Pending',
    'Remarks': remarks,
    'ReviewedBy': '-',
    'ReviewedAt': '-',
    'CouponCode': couponCode || '-',
    'DiscountAmount': discountAmount,
    'TotalPlanFee': netPlanFee,
    'InstallmentLabel': installmentLabel,
    'RemainingBalance': remainingBalance
  };
  var rowArr = [];
  for (var h = 0; h < ledgerHeaders.length; h++) {
    var col = String(ledgerHeaders[h] || '').trim();
    rowArr.push(rowMap[col] !== undefined ? rowMap[col] : '-');
  }
  sheet.appendRow(rowArr);
  invalidateSheetCache('FEE_LEDGER');
  handleLogActivity({
    userId: userId,
    userName: studentName,
    activityType: 'FEE_PAYMENT_SUBMITTED',
    details: 'Submitted ' + feeType + ' Fee (' + planName + ' · ' + installmentLabel + ' | Rs.' + amountPaid + (remainingBalance > 0 ? ' | Bal Rs.' + remainingBalance : '') + (couponCode ? ' | Coupon ' + couponCode : '') + ') for ' + targetBatch + ' | Ref: ' + utr + ' | Receipt: ' + receiptNo
  });
  return {
    success: true,
    receiptNo: receiptNo,
    amountPaid: amountPaid,
    isZeroFee: isZeroFeeApprovedFlow,
    status: 'Pending',
    remainingBalance: remainingBalance,
    discountAmount: discountAmount,
    message: isZeroFeeApprovedFlow
      ? ('₹0 Enrollment Request submitted (Receipt ' + receiptNo + '). Admin will review and approve access shortly!')
      : ('Payment submitted (Receipt ' + receiptNo + '). Admin will review your UTR and approve access shortly!')
  };
}

function handleVerifyFeePayment(payload) {
  payload = payload || {};
  var receiptNo = String(payload.receiptNo || '').trim();
  var decision = String(payload.decision || 'approve').toLowerCase().trim();
  var reviewerName = sanitizeInput(String(payload.actorName || payload.requesterName || 'Admin').trim());
  var remarks = sanitizeInput(String(payload.remarks || '').trim());
  if (!receiptNo) return { success: false, message: 'Receipt number is required.' };

  var sheet = getOrCreateSheet('FEE_LEDGER');
  ensureSheetHeadersCached(sheet, 'FEE_LEDGER');
  var rows = getSheetData('FEE_LEDGER');
  var targetRowIdx = -1;
  var rec = null;
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i].ReceiptNo) === receiptNo) {
      targetRowIdx = i + 2;
      rec = rows[i];
      break;
    }
  }
  if (targetRowIdx === -1 || !rec) {
    return { success: false, message: 'Fee receipt not found.' };
  }

  var nowIso = new Date().toISOString();
  var settings = getSheetData('SETTINGS');
  var feeCfg = parseFeeConfigSettings(settings);
  var feeType = String(rec.FeeType || (String(rec.Batch || '').indexOf('Member') !== -1 ? 'Member' : 'Batch')).trim();
  var isApprove = (decision === 'approve' || decision === 'approved' || decision === 'verified');
  var validityUntil = '-';

  if (isApprove) {
    var days = parseInt(payload.validityDays || rec.ValidityDays || 0, 10) || 0;
    var matchedMemberPlan = null;
    if (feeType === 'Member' && Array.isArray(feeCfg.memberPlans)) {
      var recPlan = String(rec.PlanName || rec.InstallmentNo || '').toLowerCase().trim();
      for (var mpIdx = 0; mpIdx < feeCfg.memberPlans.length; mpIdx++) {
        var mpNameLow = String(feeCfg.memberPlans[mpIdx].name || '').toLowerCase().trim();
        if (mpNameLow && (mpNameLow === recPlan || recPlan.indexOf(mpNameLow + ' —') === 0 || recPlan.indexOf(mpNameLow + ' -') === 0 || recPlan.indexOf(mpNameLow + ' (') === 0)) {
          matchedMemberPlan = feeCfg.memberPlans[mpIdx];
          break;
        }
      }
    }
    if (days <= 0) {
      if (feeType === 'Member') {
        days = (matchedMemberPlan && matchedMemberPlan.validityDays) || feeCfg.memberValidityDays || 365;
      } else {
        var bEntry = feeCfg.batchFees && feeCfg.batchFees[String(rec.Batch || '').trim()];
        days = (bEntry && bEntry.validityDays) ? bEntry.validityDays : 30;
      }
    }
    var expDate = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    validityUntil = payload.membershipValidUntil && String(payload.membershipValidUntil).trim()
      ? String(payload.membershipValidUntil).trim()
      : Utilities.formatDate(expDate, DbConnectionManager.getTimeZone(), 'yyyy-MM-dd');

    // Recompute accurate installment remaining balance on approval
    var recTotal = Number(rec.TotalPlanFee || 0) || Number(rec.AmountPaid || 0) || 0;
    var recRem = Math.max(0, Number(rec.RemainingBalance !== undefined && rec.RemainingBalance !== '' ? rec.RemainingBalance : (rec.DueAmount || 0)) || 0);
    if (feeType === 'Batch' && recTotal > 0) {
      var sumPaid = Number(rec.AmountPaid || 0) || 0;
      for (var sIdx = 0; sIdx < rows.length; sIdx++) {
        if (sIdx === (targetRowIdx - 2)) continue;
        var sr = rows[sIdx];
        if (String(sr.UserID || '') === String(rec.UserID || '') &&
            String(sr.Batch || '').trim().toLowerCase() === String(rec.Batch || '').trim().toLowerCase() &&
            normalizeFeeStatusLabel(sr.Status) === 'Approved') {
          var srTotal = Number(sr.TotalPlanFee || 0) || 0;
          var srRem = Number(sr.RemainingBalance || sr.DueAmount || 0) || 0;
          if (srRem > 0 || srTotal === recTotal) {
            sumPaid += (Number(sr.AmountPaid || 0) || 0);
          }
        }
      }
      recRem = Math.max(0, recTotal - sumPaid);
    }

    // Increment Coupon usedCount if a valid coupon was applied and this row wasn't already Approved
    var usedCoupon = String(rec.CouponCode || '').trim().toUpperCase();
    if (usedCoupon && usedCoupon !== '-' && normalizeFeeStatusLabel(rec.Status) !== 'Approved' && Array.isArray(feeCfg.coupons)) {
      var cpUpdated = false;
      for (var ci = 0; ci < feeCfg.coupons.length; ci++) {
        if (String(feeCfg.coupons[ci].code || '').trim().toUpperCase() === usedCoupon) {
          feeCfg.coupons[ci].usedCount = (parseInt(feeCfg.coupons[ci].usedCount || 0, 10) || 0) + 1;
          cpUpdated = true;
          break;
        }
      }
      if (cpUpdated) upsertSettingsExactJsonKey('FEE_CONFIG_SETTINGS', feeCfg);
    }

    setRowNamedColumns(sheet, 'FEE_LEDGER', targetRowIdx, {
      'Status': 'Approved',
      'ValidityUntil': validityUntil,
      'DueAmount': recRem,
      'RemainingBalance': recRem,
      'Remarks': remarks || (recRem > 0 ? ('Approved (Partial · Rs.' + recRem + ' balance remaining)') : 'Approved & Activated'),
      'ReviewedBy': reviewerName,
      'ReviewedAt': nowIso
    });

    var targetUid = String(rec.UserID || '').trim();
    var userSheet = getOrCreateSheet('USERS');
    var users = getSheetData('USERS');
    for (var u = 0; u < users.length; u++) {
      if (String(users[u].UserID) === targetUid) {
        var uRowIdx = u + 2;
        var prefs = readUserSettingsFromRow(users[u], false);
        if (feeType === 'Member') {
          var curRole = String(users[u].Role || 'user').toLowerCase().trim();
          if (curRole !== 'admin' && curRole !== 'superadmin') {
            setRowNamedColumns(userSheet, 'USERS', uRowIdx, { 'Role': 'member' });
            users[u].Role = 'member';
          }
          var resolvedPlanName = String(payload.membershipPlan || rec.PlanName || rec.InstallmentNo || (matchedMemberPlan && matchedMemberPlan.name) || 'Member All-Access Pass').trim();
          var resolvedScope = String(payload.memberAccessScope || (matchedMemberPlan && matchedMemberPlan.accessScope) || 'ALL_PAST_CURRENT_UPCOMING').toUpperCase().trim();
          var resolvedIncluded = payload.memberIncludedBatches !== undefined
            ? payload.memberIncludedBatches
            : (matchedMemberPlan && Array.isArray(matchedMemberPlan.includedBatches) ? matchedMemberPlan.includedBatches : '');
          var resolvedUpcoming = payload.memberIncludeUpcoming !== undefined
            ? Boolean(payload.memberIncludeUpcoming)
            : Boolean((matchedMemberPlan && matchedMemberPlan.includeUpcoming) || resolvedScope === 'ALL_PAST_CURRENT_UPCOMING' || resolvedScope === 'CURRENT_AND_UPCOMING');

          prefs.membershipPlan = resolvedPlanName;
          prefs.membershipValidUntil = validityUntil;
          prefs.memberAccessScope = resolvedScope;
          prefs.memberIncludedBatches = Array.isArray(resolvedIncluded) ? resolvedIncluded.join(', ') : String(resolvedIncluded || '');
          prefs.memberIncludeUpcoming = resolvedUpcoming;
          prefs.memberJoinDate = Utilities.formatDate(new Date(), DbConnectionManager.getTimeZone(), 'yyyy-MM-dd');
          prefs.feeStatus = 'Member Approved (' + resolvedPlanName + ' till ' + validityUntil + ')';
        } else {
          var batchName = String(rec.Batch || '').trim();
          var updatedBatch = normalizeUserBatchesWithFreeTier(batchName + ', ' + String(users[u].Batch || ''));
          setRowNamedColumns(userSheet, 'USERS', uRowIdx, { 'Batch': updatedBatch });
          users[u].Batch = updatedBatch;
          prefs.enrollmentValidUntil = validityUntil;
          prefs.autoSwitchedToFreeTier = false;
          prefs.feeStatus = recRem > 0
            ? ('Batch Approved (' + batchName + ' · Rs.' + recRem + ' balance due)')
            : ('Batch Approved (' + batchName + ' till ' + validityUntil + ')');
        }
        syncUserReadableColumns(userSheet, uRowIdx, users[u], prefs);
        invalidateSheetCache('USERS');
        break;
      }
    }
  } else {
    setRowNamedColumns(sheet, 'FEE_LEDGER', targetRowIdx, {
      'Status': 'Rejected',
      'ValidityUntil': '-',
      'Remarks': remarks || 'Payment could not be verified',
      'ReviewedBy': reviewerName,
      'ReviewedAt': nowIso
    });
  }

  invalidateSheetCache('FEE_LEDGER');
  return {
    success: true,
    receiptNo: receiptNo,
    status: isApprove ? 'Approved' : 'Rejected',
    validityUntil: validityUntil,
    message: isApprove
      ? ('Receipt ' + receiptNo + ' Approved! Access activated until ' + validityUntil + '.')
      : ('Receipt ' + receiptNo + ' marked as Rejected.')
  };
}

function handleGetFeeLedger(payload) {
  payload = payload || {};
  var role = String(payload._verifiedRole || 'user').toLowerCase().trim();
  var uid = String(payload._verifiedUserId || payload.userId || '').trim();
  var all = getSheetData('FEE_LEDGER').slice().reverse().map(function(r) {
    var c = {};
    for (var k in r) { if (r.hasOwnProperty(k)) c[k] = r[k]; }
    c.Status = normalizeFeeStatusLabel(r.Status);
    return c;
  });
  if (role === 'admin' || role === 'superadmin') {
    return { success: true, ledger: all };
  }
  var own = all.filter(function(r) { return String(r.UserID || '') === uid; });
  return { success: true, ledger: own };
}

function handleUpdateMemberAccessScope(payload) {
  payload = payload || {};
  var targetUserId = String(payload.targetUserId || payload.userId || '').trim();
  if (!targetUserId) return { success: false, message: 'Target User ID is required.' };
  var userSheet = getOrCreateSheet('USERS');
  var users = getSheetData('USERS');
  for (var i = 0; i < users.length; i++) {
    if (String(users[i].UserID) === targetUserId) {
      var rowIndex = i + 2;
      var prefs = readUserSettingsFromRow(users[i], false);
      var setRole = String(payload.newRole || 'member').toLowerCase().trim();
      var currentRole = String(users[i].Role || 'user').toLowerCase().trim();
      if (currentRole !== 'admin' && currentRole !== 'superadmin') {
        setRowNamedColumns(userSheet, 'USERS', rowIndex, { 'Role': setRole });
        users[i].Role = setRole;
      }
      var scope = String(payload.memberAccessScope || 'ALL_PAST_CURRENT_UPCOMING').toUpperCase().trim();
      var incBatches = Array.isArray(payload.memberIncludedBatches)
        ? payload.memberIncludedBatches.map(function(x) { return sanitizeInput(String(x || '').trim()); }).filter(Boolean).join(', ')
        : sanitizeInput(String(payload.memberIncludedBatches || '').trim());
      var incUpcoming = payload.memberIncludeUpcoming !== undefined
        ? Boolean(payload.memberIncludeUpcoming)
        : (scope === 'ALL_PAST_CURRENT_UPCOMING' || scope === 'CURRENT_AND_UPCOMING');
      var planName = sanitizeInput(String(payload.membershipPlan || prefs.membershipPlan || 'Member Pass').trim());
      var validUntil = String(payload.membershipValidUntil !== undefined ? payload.membershipValidUntil : (prefs.membershipValidUntil || '')).trim();
      var joinDate = String(payload.memberJoinDate || prefs.memberJoinDate || Utilities.formatDate(new Date(), DbConnectionManager.getTimeZone(), 'yyyy-MM-dd')).trim();

      prefs.memberAccessScope = scope;
      prefs.memberIncludedBatches = incBatches;
      prefs.memberIncludeUpcoming = incUpcoming;
      prefs.membershipPlan = planName;
      prefs.membershipValidUntil = validUntil;
      prefs.memberJoinDate = joinDate;
      prefs.feeStatus = 'Member (' + planName + (validUntil && validUntil !== '-' ? (' till ' + validUntil) : '') + ')';

      syncUserReadableColumns(userSheet, rowIndex, users[i], prefs);
      invalidateSheetCache('USERS');
      handleLogActivity({
        userId: String(payload._verifiedUserId || 'ADMIN'),
        userName: String(payload.actorName || 'Admin'),
        activityType: 'MEMBER_ACCESS_SCOPE_UPDATED',
        details: 'Set Member Access for ' + (users[i].Name || targetUserId) + ' -> Scope: ' + scope + (incBatches ? (' | Batches: ' + incBatches) : '') + ' | Upcoming: ' + (incUpcoming ? 'Yes' : 'No') + (validUntil ? (' | Valid Till: ' + validUntil) : '')
      });
      return {
        success: true,
        targetUserId: targetUserId,
        memberAccessScope: scope,
        memberIncludedBatches: incBatches,
        memberIncludeUpcoming: incUpcoming,
        membershipPlan: planName,
        membershipValidUntil: validUntil,
        memberJoinDate: joinDate,
        message: 'Member batch access updated cleanly for ' + (users[i].Name || targetUserId) + '!'
      };
    }
  }
  return { success: false, message: 'User not found.' };
}

function handleGetStreamRecord(payload) {
  payload = payload || {};
  var collection = String(payload.collection || 'materials').toLowerCase().trim();
  var offset = Math.max(0, parseInt(payload.offset || 0, 10) || 0);
  var role = String(payload._verifiedRole || 'guest').toLowerCase().trim();
  var uid = String(payload._verifiedUserId || payload.userId || '').trim();
  var isAdmin = (role === 'admin' || role === 'superadmin');

  if (collection.indexOf('admin_') === 0 && !isAdmin) {
    return { success: false, unauthorized: true, message: 'Administrator authorization required.' };
  }

  var list = [];
  var meta = {};

  if (collection === 'materials') {
    var type = String(payload.type || '').toLowerCase().trim();
    var includeScheduled = Boolean(payload.includeScheduled && isAdmin);
    var allMats = getSheetData('MATERIALS');
    if (!includeScheduled) {
      allMats = allMats.filter(isMaterialWithinScheduleWindow);
    }
    list = (!type || type === 'all') ? allMats : allMats.filter(function(m) { return isTypeMatch(m.Type, type); });
    if (offset === 0) {
      var allSubtabs = getSheetData('SUBTABS');
      meta.subtabs = (!type || type === 'all') ? allSubtabs : allSubtabs.filter(function(s) { return isTypeMatch(s.Type, type); });
    }
  } else if (collection === 'history') {
    var allH = getSheetData('TEST_HISTORY').slice().reverse();
    if (!isAdmin || payload.onlyOwn === true) {
      allH = allH.filter(function(h) { return String(h.UserID || '') === uid; });
    }
    list = allH.map(projectLightweightHistoryRow);
  } else if (collection === 'fee_ledger') {
    var allF = getSheetData('FEE_LEDGER').slice().reverse();
    if (!isAdmin || payload.onlyOwn === true) {
      allF = allF.filter(function(f) { return String(f.UserID || '') === uid; });
    }
    list = allF.map(function(r) {
      var c = {};
      for (var k in r) { if (r.hasOwnProperty(k)) c[k] = r[k]; }
      c.Status = normalizeFeeStatusLabel(r.Status);
      return c;
    });
  } else if (collection === 'admin_users') {
    list = getSheetData('USERS').map(function(u) {
      var safeU = {};
      for (var k in u) {
        if (u.hasOwnProperty(k) && k !== 'Password' && k !== 'UserPreferencesJson') safeU[k] = u[k];
      }
      var prefs = readUserSettingsFromRow(u, false);
      safeU.Password = '';
      safeU.VisiblePassword = '';
      safeU.PasswordStatus = isHashedPassword(String(u.Password || '')) ? 'Encrypted (SHA-256)' : 'Protected';
      safeU.Batch = normalizeUserBatchesWithFreeTier(safeU.Batch || 'RP-Trail');
      safeU.Role = isPrimarySuperadminEmail(safeU.Email) ? 'superadmin' : String(safeU.Role || 'user').toLowerCase().trim();
      safeU.EmailVerified = Boolean(prefs.emailVerified === true || safeU.Role === 'superadmin');
      safeU.MobileVerified = Boolean(prefs.mobileVerified === true || safeU.Role === 'superadmin');
      safeU.ParentName = String(prefs.parentName || '').trim() || String(safeU.Name || '');
      safeU.ParentMobile = String(prefs.parentMobile || '').trim() || String(safeU.Mobile || '');
      safeU.ParentEmail = String(prefs.parentEmail || '').trim() || String(safeU.Email || '');
      safeU.MemberAccessScope = String(prefs.memberAccessScope || (safeU.Role === 'member' ? 'ALL_PAST_CURRENT_UPCOMING' : ''));
      safeU.MemberIncludedBatches = String(prefs.memberIncludedBatches || '');
      safeU.MemberIncludeUpcoming = Boolean(prefs.memberIncludeUpcoming === true);
      safeU.MemberJoinDate = String(prefs.memberJoinDate || '');
      safeU.MembershipPlan = String(prefs.membershipPlan || (safeU.Role === 'member' ? 'Member All-Access Pass' : 'Standard'));
      safeU.MembershipValidUntil = String(prefs.membershipValidUntil || '');
      safeU.FeeStatus = String(prefs.feeStatus || 'Free (RP-Trail)');
      return safeU;
    });
  } else if (collection === 'admin_logs') {
    list = getSheetData('ACTIVITY_LOGS').slice().reverse();
  } else if (collection === 'admin_feedback') {
    list = getSheetData('FEEDBACK').slice().reverse();
  } else if (collection === 'admin_materials') {
    var mats = getSheetData('MATERIALS');
    var hws = getSheetData('HOMEWORK').map(function(h) {
      return { ID: h.ID, Type: 'homework', Title: h.Title, Subtab: h.TargetDate || '-', ContentOrUrl: h.Details || '-', AccessLevel: 'public' };
    });
    var anns = getSheetData('ANNOUNCEMENTS').map(function(a) {
      return { ID: a.ID, Type: 'announcement', Title: a.Title, Subtab: '-', ContentOrUrl: a.Content || '-', AccessLevel: 'public' };
    });
    list = mats.concat(hws).concat(anns);
  } else {
    return { success: false, message: 'Unknown stream collection: ' + collection };
  }

  var totalCount = list.length;
  var batchSize = Math.min(50, Math.max(1, parseInt(payload.batchSize || 15, 10) || 15));
  var items = offset < totalCount ? list.slice(offset, offset + batchSize) : [];
  var nextOffset = offset + items.length;
  var hasMore = nextOffset < totalCount;
  return {
    success: true,
    collection: collection,
    offset: offset,
    batchSize: batchSize,
    nextOffset: nextOffset,
    totalCount: totalCount,
    total: totalCount,
    items: items,
    item: items.length > 0 ? items[0] : null,
    hasMore: hasMore,
    meta: meta
  };
}

function handleGetTestHistoryDetail(payload) {
  payload = payload || {};
  var historyId = String(payload.historyId || '').trim();
  var uid = String(payload._verifiedUserId || payload.userId || '').trim();
  var role = String(payload._verifiedRole || 'user').toLowerCase().trim();
  if (!historyId) return { success: false, message: 'History ID required.' };
  var rows = getSheetData('TEST_HISTORY');
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i].HistoryID) === historyId) {
      if (role !== 'admin' && role !== 'superadmin' && String(rows[i].UserID) !== uid) {
        return { success: false, message: 'Unauthorized.' };
      }
      return { success: true, record: rows[i] };
    }
  }
  return { success: false, message: 'Test record not found.' };
}