/**
 * Visitor Management System & Guard App
 * MEGA SAFE SECURITY SERVICES SDN. BHD.
 *
 * Install this file in a Google Apps Script project bound to the target
 * Google Spreadsheet. All timestamps use Asia/Kuala_Lumpur.
 *
 * Design rule: Employee ID, Site ID and Checkpoint ID are immutable keys.
 * Names are read dynamically from their master tables, while audit records
 * retain a snapshot for historical evidence. Updating a name never rotates a
 * QR credential and never breaks roster, attendance or patrol records.
 */

const VMS = Object.freeze({
  TZ: 'Asia/Kuala_Lumpur',
  APP_NAME: 'MEGA SAFE Visitor & Guard Operations',
  SESSION_SECONDS: 1800,
  MAX_IMAGE_BYTES: 2 * 1024 * 1024,
  SHEETS: {
    dashboard: 'VMS DASHBOARD',
    employees: 'EMPLOYEES',
    sites: 'SITES',
    checkpoints: 'CHECKPOINTS',
    roster: 'DUTY ROSTER',
    attendance: 'ATTENDANCE LOG',
    visitors: 'VISITOR LOG',
    logbook: 'SECURITY LOG BOOK',
    patrol: 'CHECKPOINT LOG',
    report: 'DAILY SITE REPORT',
    settings: 'SETTINGS',
    audit: 'AUDIT LOG'
  },
  HEADERS: {
    'EMPLOYEES': [
      'Employee ID', 'Full Name', 'Phone', 'Position', 'Default Site ID',
      'Status', 'QR Revision', 'Created At', 'Updated At', 'Notes'
    ],
    'SITES': [
      'Site ID', 'Site Name', 'Address', 'Latitude', 'Longitude',
      'GPS Radius (m)', 'Status', 'Contact Person', 'Contact Phone', 'Notes', 'Updated At'
    ],
    'CHECKPOINTS': [
      'Checkpoint ID', 'Site ID', 'Checkpoint Name', 'Zone', 'Latitude',
      'Longitude', 'GPS Radius (m)', 'Status', 'QR Revision', 'Notes', 'Updated At'
    ],
    'DUTY ROSTER': [
      'Roster ID', 'Duty Date', 'Employee ID', 'Site ID', 'Shift Code',
      'Start Time', 'End Time', 'Status', 'Notes', 'Created At', 'Updated At'
    ],
    'ATTENDANCE LOG': [
      'Event ID', 'Timestamp', 'Shift Date', 'Employee ID', 'Employee Name Snapshot',
      'Site ID', 'Site Name Snapshot', 'Event Type', 'Roster ID', 'Latitude',
      'Longitude', 'GPS Accuracy (m)', 'Distance From Site (m)', 'Status',
      'Notes', 'Request ID'
    ],
    'VISITOR LOG': [
      'Visitor ID', 'Check-in Timestamp', 'Check-out Timestamp', 'Visit Date',
      'Site ID', 'Site Name Snapshot', 'Visitor Name', 'ID/Passport (Masked)',
      'Company', 'Phone', 'Host / Unit', 'Purpose', 'Vehicle No', 'Badge No',
      'Check-in Guard ID', 'Check-in Guard Name Snapshot', 'Check-out Guard ID',
      'Check-out Guard Name Snapshot', 'Check-in Latitude', 'Check-in Longitude',
      'Check-out Latitude', 'Check-out Longitude', 'Status', 'Notes',
      'Check-in Photo File ID', 'Check-in Photo Link', 'Check-out Photo File ID',
      'Check-out Photo Link', 'Check-in Request ID', 'Check-out Request ID', 'Updated At'
    ],
    'SECURITY LOG BOOK': [
      'Log ID', 'Timestamp', 'Log Date', 'Shift Date', 'Site ID', 'Site Name Snapshot',
      'Guard ID', 'Guard Name Snapshot', 'Category', 'Priority', 'Subject',
      'Details', 'Action Taken', 'Reported To', 'Latitude', 'Longitude',
      'GPS Accuracy (m)', 'Photo File ID', 'Photo Link', 'Status', 'Revision',
      'Request ID', 'Updated At'
    ],
    'CHECKPOINT LOG': [
      'Event ID', 'Timestamp', 'Shift Date', 'Site ID', 'Site Name Snapshot',
      'Guard ID', 'Guard Name Snapshot', 'Checkpoint ID', 'Checkpoint Name Snapshot',
      'Zone Snapshot', 'Latitude', 'Longitude', 'GPS Accuracy (m)',
      'Distance From Checkpoint (m)', 'Status', 'Photo File ID', 'Photo Link',
      'Notes', 'Request ID'
    ],
    'DAILY SITE REPORT': [
      'Report Date', 'Site ID', 'Site Name', 'Rostered Guards', 'Checked In',
      'Open Attendance Exceptions', 'Checkpoint Checks', 'Checkpoint Exceptions',
      'Log Book Entries', 'Log Book Open', 'Visitor Check-ins', 'Visitors On Site', 'Last Generated At'
    ],
    'SETTINGS': ['Setting', 'Value', 'Description'],
    'AUDIT LOG': ['Audit ID', 'Timestamp', 'Actor', 'Action', 'Entity Type', 'Entity ID', 'Detail']
  },
  SHIFTS: Object.freeze({
    DAY: { start: '07:00', end: '19:00' },
    NIGHT: { start: '19:00', end: '07:00' },
    AM: { start: '07:00', end: '15:00' },
    PM: { start: '15:00', end: '23:00' }
  })
});

/** Menu for the bound Google Sheet. */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('VMS Guard App')
    .addItem('1. Create / repair sheets', 'setupVms')
    .addItem('2. Set or change admin password', 'setAdminPassword')
    .addItem('Generate today report', 'generateTodayReport')
    .addToUi();
}

/** Web app entry point. QR links use ?m=guard or ?m=checkpoint. */
function doGet(e) {
  const q = (e && e.parameter) || {};
  const t = HtmlService.createTemplateFromFile('index');
  t.boot = JSON.stringify({
    mode: cleanEnum_(q.m, ['guard', 'checkpoint'], 'home'),
    employeeId: tryCleanId_(q.e),
    employeeRevision: Number(q.r || 0),
    employeeSignature: cleanSignature_(q.s),
    checkpointId: tryCleanId_(q.c),
    checkpointRevision: Number(q.cr || 0),
    checkpointSignature: cleanSignature_(q.cs)
  });
  return t.evaluate()
    .setTitle(VMS.APP_NAME)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.SAMEORIGIN)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, viewport-fit=cover');
}

/**
 * Create the complete schema without deleting existing data. Run once from the
 * bound spreadsheet, then set the admin password from the custom menu.
 */
function setupVms() {
  const lock = LockService.getDocumentLock();
  lock.waitLock(30000);
  try {
    const ss = getSpreadsheet_();
    ss.setSpreadsheetTimeZone(VMS.TZ);
    Object.keys(VMS.HEADERS).forEach(function(name) {
      ensureSheet_(ss, name, VMS.HEADERS[name]);
    });
    seedSettings_();
    styleSheets_();
    buildDashboard_();
    PropertiesService.getScriptProperties().setProperty('VMS_SPREADSHEET_ID', ss.getId());
    audit_('SYSTEM', 'SETUP', 'SYSTEM', ss.getId(), 'Schema verified without deleting body data.');
    return 'VMS sheets are ready. Next, choose VMS Guard App > Set or change admin password.';
  } finally {
    lock.releaseLock();
  }
}

/** Set the admin credential without writing any password into the spreadsheet. */
function setAdminPassword() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.prompt(
    'VMS admin password',
    'Use a unique password with at least 12 characters. It is stored as a salted hash in Script Properties, not in Google Sheets.',
    ui.ButtonSet.OK_CANCEL
  );
  if (response.getSelectedButton() !== ui.Button.OK) return;
  const value = String(response.getResponseText() || '');
  if (value.length < 12) throw new Error('Use at least 12 characters for the admin password.');
  const salt = Utilities.getUuid() + Utilities.getUuid();
  const props = PropertiesService.getScriptProperties();
  props.setProperties({
    ADMIN_SALT: salt,
    ADMIN_HASH: sha256_(salt + '|' + value),
    VMS_SIGNING_SECRET: props.getProperty('VMS_SIGNING_SECRET') || Utilities.getUuid() + Utilities.getUuid()
  });
  audit_('SYSTEM', 'PASSWORD_CHANGED', 'SYSTEM', 'ADMIN', 'Admin password changed from bound spreadsheet menu.');
  ui.alert('Admin password saved. You can now deploy the web app.');
}

function generateTodayReport() {
  return rebuildDailyReport_({ date: dateKey_(new Date()) }, 'SHEET_MENU');
}

/** Minimal public view: it deliberately exposes no staff directory or audit data. */
function getPublicDashboard() {
  ensureReady_();
  const today = dateKey_(new Date());
  const attendance = objects_(VMS.SHEETS.attendance).filter(function(x) { return dateKey_(x['Shift Date']) === today; });
  const patrol = objects_(VMS.SHEETS.patrol).filter(function(x) { return dateKey_(x['Shift Date']) === today; });
  const visitors = objects_(VMS.SHEETS.visitors);
  return {
    appName: VMS.APP_NAME,
    today: formatDate_(new Date(), 'dd/MM/yyyy'),
    attendanceEvents: attendance.length,
    patrolChecks: patrol.length,
    visitorCheckins: visitors.filter(function(x) { return dateKey_(x['Visit Date']) === today; }).length,
    visitorsOnSite: visitors.filter(function(x) { return String(x.Status).toUpperCase() === 'CHECKED-IN'; }).length
  };
}

/** Resolve QR URL context and return only the information needed by a guard. */
function getGuardContext(p) {
  ensureReady_();
  p = p || {};
  const result = { appName: VMS.APP_NAME, guard: null, checkpoint: null };
  if (p.employeeId && p.employeeRevision && p.employeeSignature) {
    const employee = verifyEmployeeCredential_(p);
    result.guard = publicGuard_(employee);
  }
  if (p.checkpointId && p.checkpointRevision && p.checkpointSignature) {
    const checkpoint = verifyCheckpointCredential_(p);
    const site = siteById_(checkpoint['Site ID']);
    result.checkpoint = {
      id: checkpoint['Checkpoint ID'], name: checkpoint['Checkpoint Name'], zone: checkpoint.Zone,
      siteId: checkpoint['Site ID'], siteName: site ? site['Site Name'] : checkpoint['Site ID']
    };
  }
  return result;
}

/** Active sites for a credentialed guard. This avoids exposing the HR directory publicly. */
function getGuardSites(p) {
  verifyEmployeeCredential_(p || {});
  return objects_(VMS.SHEETS.sites)
    .filter(function(x) { return x['Site ID'] && String(x.Status).toUpperCase() === 'ACTIVE'; })
    .map(function(x) { return { id: x['Site ID'], name: x['Site Name'] }; });
}

/** Returns only the minimum personal data needed for a guard to check a visitor out. */
function getActiveVisitors(p) {
  ensureReady_();
  const guard = verifyEmployeeCredential_(p || {});
  const site = activeSiteForGuard_(guard, cleanId_(p.siteId));
  return objects_(VMS.SHEETS.visitors)
    .filter(function(x) { return x['Site ID'] === site['Site ID'] && String(x.Status).toUpperCase() === 'CHECKED-IN'; })
    .sort(function(a, b) { return new Date(b['Check-in Timestamp']) - new Date(a['Check-in Timestamp']); })
    .map(function(x) {
      return {
        id: x['Visitor ID'], name: x['Visitor Name'], company: x.Company,
        host: x['Host / Unit'], badge: x['Badge No'],
        checkedIn: formatDate_(x['Check-in Timestamp'], 'dd/MM HH:mm')
      };
    });
}

/** Guard-led visitor registration. Sensitive document numbers are masked before they reach Sheets. */
function submitVisitorCheckin(p) {
  ensureReady_();
  const guard = verifyEmployeeCredential_(p || {});
  const site = activeSiteForGuard_(guard, cleanId_(p.siteId));
  const visitorName = cleanText_(p.visitorName, 120);
  const host = cleanText_(p.host, 120);
  const purpose = cleanText_(p.purpose, 240);
  if (!visitorName || !host || !purpose) throw new Error('Visitor name, host / unit and purpose are required.');
  const location = validatedLocation_(p, site, 'site');
  const requestId = requestId_(p.requestId);
  const lock = LockService.getDocumentLock();
  lock.waitLock(30000);
  try {
    const duplicate = rowByKey_(VMS.SHEETS.visitors, 'Check-in Request ID', requestId);
    if (duplicate) return { ok: true, duplicate: true, id: duplicate.object['Visitor ID'], message: 'This visitor check-in was already recorded.' };
    const now = new Date();
    const visitorId = 'VIS-' + Utilities.getUuid().slice(0, 8).toUpperCase();
    const evidence = saveEvidence_(p.photoDataUrl, 'visitor-checkin', visitorId);
    const row = [
      visitorId, now, '', dateKey_(now), site['Site ID'], site['Site Name'], visitorName,
      maskDocument_(p.documentNumber), cleanText_(p.company, 120), cleanText_(p.phone, 40), host,
      purpose, cleanText_(p.vehicleNo, 40), cleanText_(p.badgeNo, 40), guard['Employee ID'],
      guard['Full Name'], '', '', location.lat, location.lng, '', '', 'CHECKED-IN',
      cleanText_(p.notes, 500), evidence.id, evidence.url, '', '', requestId, '', now
    ];
    append_(VMS.SHEETS.visitors, row);
    audit_('GUARD:' + guard['Employee ID'], 'VISITOR_CHECKED_IN', 'VISITOR', visitorId, site['Site ID'] + ' / ' + visitorName);
    return { ok: true, id: visitorId, message: 'Visitor checked in. Reference: ' + visitorId };
  } finally {
    lock.releaseLock();
  }
}

/** The checkout updates the original visitor row, retaining the immutable check-in evidence. */
function submitVisitorCheckout(p) {
  ensureReady_();
  const guard = verifyEmployeeCredential_(p || {});
  const visitorId = cleanId_(p.visitorId);
  const requestId = requestId_(p.requestId);
  const lock = LockService.getDocumentLock();
  lock.waitLock(30000);
  try {
    const duplicate = rowByKey_(VMS.SHEETS.visitors, 'Check-out Request ID', requestId);
    if (duplicate) {
      if (duplicate.object['Visitor ID'] !== visitorId) {
        throw new Error('This request identifier was already used for a different visitor.');
      }
      return { ok: true, duplicate: true, id: visitorId, message: 'This visitor check-out was already recorded.' };
    }
    const current = rowByKey_(VMS.SHEETS.visitors, 'Visitor ID', visitorId);
    if (!current || String(current.object.Status).toUpperCase() !== 'CHECKED-IN') throw new Error('Visitor state changed. Reload the active visitor list.');
    const site = activeSiteForGuard_(guard, current.object['Site ID']);
    const location = validatedLocation_(p, site, 'site');
    const now = new Date();
    const evidence = saveEvidence_(p.photoDataUrl, 'visitor-checkout', visitorId);
    const row = [
      current.object['Visitor ID'], current.object['Check-in Timestamp'], now, current.object['Visit Date'],
      current.object['Site ID'], current.object['Site Name Snapshot'], current.object['Visitor Name'],
      current.object['ID/Passport (Masked)'], current.object.Company, current.object.Phone,
      current.object['Host / Unit'], current.object.Purpose, current.object['Vehicle No'], current.object['Badge No'],
      current.object['Check-in Guard ID'], current.object['Check-in Guard Name Snapshot'], guard['Employee ID'],
      guard['Full Name'], current.object['Check-in Latitude'], current.object['Check-in Longitude'],
      location.lat, location.lng, 'CHECKED-OUT', current.object.Notes,
      current.object['Check-in Photo File ID'], current.object['Check-in Photo Link'], evidence.id, evidence.url,
      current.object['Check-in Request ID'], requestId, now
    ];
    writeKeyedRow_(sheet_(VMS.SHEETS.visitors), current, row);
    audit_('GUARD:' + guard['Employee ID'], 'VISITOR_CHECKED_OUT', 'VISITOR', visitorId, site['Site ID'] + ' / ' + current.object['Visitor Name']);
    return { ok: true, id: visitorId, message: 'Visitor checked out.' };
  } finally {
    lock.releaseLock();
  }
}

/** Sign in to protected HR/admin actions. The session token expires in 30 minutes. */
function adminLogin(p) {
  ensureReady_();
  const password = String((p || {}).password || '');
  if (!verifyAdminPassword_(password)) throw new Error('Admin password is incorrect.');
  const token = Utilities.getUuid() + Utilities.getUuid();
  CacheService.getScriptCache().put('vms-admin-' + token, JSON.stringify({ role: 'ADMIN', createdAt: new Date().toISOString() }), VMS.SESSION_SECONDS);
  return { token: token, expiresIn: VMS.SESSION_SECONDS };
}

function adminLogout(p) {
  const token = String((p || {}).token || '');
  if (token) CacheService.getScriptCache().remove('vms-admin-' + token);
  return { ok: true };
}

/** Admin-only catalog used for forms, dashboards and QR card printing. */
function getAdminData(p) {
  requireAdmin_(p);
  const employees = objects_(VMS.SHEETS.employees).filter(hasKey_('Employee ID'));
  const sites = objects_(VMS.SHEETS.sites).filter(hasKey_('Site ID'));
  const checkpoints = objects_(VMS.SHEETS.checkpoints).filter(hasKey_('Checkpoint ID'));
  return {
    employees: employees.map(function(x) {
      return {
        id: x['Employee ID'], name: x['Full Name'], phone: x.Phone, position: x.Position,
        defaultSiteId: x['Default Site ID'], status: x.Status, qrRevision: Number(x['QR Revision'] || 1), notes: x.Notes
      };
    }),
    sites: sites.map(function(x) {
      return {
        id: x['Site ID'], name: x['Site Name'], address: x.Address,
        latitude: x.Latitude, longitude: x.Longitude, status: x.Status,
        radius: x['GPS Radius (m)'], contactPerson: x['Contact Person'],
        contactPhone: x['Contact Phone'], notes: x.Notes
      };
    }),
    checkpoints: checkpoints.map(function(x) {
      return {
        id: x['Checkpoint ID'], siteId: x['Site ID'], name: x['Checkpoint Name'],
        zone: x.Zone, latitude: x.Latitude, longitude: x.Longitude,
        radius: x['GPS Radius (m)'], status: x.Status,
        qrRevision: Number(x['QR Revision'] || 1), notes: x.Notes
      };
    }),
    recent: recentAdminActivity_(),
    checkpointEvidence: objects_(VMS.SHEETS.patrol).slice(-30).reverse().map(function(x) {
      return {
        timestamp: formatDate_(x.Timestamp, 'dd/MM HH:mm'), site: x['Site Name Snapshot'],
        checkpoint: x['Checkpoint Name Snapshot'], guard: x['Guard Name Snapshot'],
        status: x.Status, photoUrl: x['Photo Link']
      };
    }),
    visitorActivity: objects_(VMS.SHEETS.visitors).slice(-30).reverse().map(function(x) {
      return {
        id: x['Visitor ID'], checkin: formatDate_(x['Check-in Timestamp'], 'dd/MM HH:mm'),
        site: x['Site Name Snapshot'], name: x['Visitor Name'], host: x['Host / Unit'],
        badge: x['Badge No'], status: x.Status
      };
    })
  };
}

/** Upsert by stable Employee ID. The QR revision is intentionally preserved. */
function saveEmployee(p) {
  requireAdmin_(p);
  const id = cleanId_(p.id);
  const name = cleanText_(p.name, 120);
  if (!id || !name) throw new Error('Employee ID and full name are required.');
  const siteId = cleanId_(p.defaultSiteId);
  if (siteId && !siteById_(siteId)) throw new Error('Default Site ID was not found.');
  const status = cleanEnum_(p.status, ['ACTIVE', 'INACTIVE'], 'ACTIVE');
  const sheet = sheet_(VMS.SHEETS.employees);
  const existing = rowByKey_(VMS.SHEETS.employees, 'Employee ID', id);
  const now = new Date();
  const revision = existing ? Number(existing.object['QR Revision'] || 1) : 1;
  const row = [
    id, name, cleanText_(p.phone, 40), cleanText_(p.position, 80), siteId,
    status, revision, existing ? existing.object['Created At'] : now, now, cleanText_(p.notes, 500)
  ];
  writeKeyedRow_(sheet, existing, row);
  audit_('ADMIN', existing ? 'EMPLOYEE_UPDATED' : 'EMPLOYEE_CREATED', 'EMPLOYEE', id, 'Name and profile updated; QR revision remains ' + revision + '.');
  return { ok: true, employee: { id: id, name: name, qrRevision: revision } };
}

function saveSite(p) {
  requireAdmin_(p);
  const id = cleanId_(p.id), name = cleanText_(p.name, 120);
  if (!id || !name) throw new Error('Site ID and site name are required.');
  const lat = requiredCoordinate_(p.latitude, 'Latitude', -90, 90);
  const lng = requiredCoordinate_(p.longitude, 'Longitude', -180, 180);
  const radius = numberInRange_(p.radius, 10, 2000, 'GPS radius');
  const existing = rowByKey_(VMS.SHEETS.sites, 'Site ID', id);
  const row = [
    id, name, cleanText_(p.address, 300), lat, lng, radius,
    cleanEnum_(p.status, ['ACTIVE', 'INACTIVE'], 'ACTIVE'), cleanText_(p.contactPerson, 100),
    cleanText_(p.contactPhone, 40), cleanText_(p.notes, 500), new Date()
  ];
  writeKeyedRow_(sheet_(VMS.SHEETS.sites), existing, row);
  audit_('ADMIN', existing ? 'SITE_UPDATED' : 'SITE_CREATED', 'SITE', id, 'Site master record saved.');
  return { ok: true, id: id };
}

/** Upsert by stable Checkpoint ID. Name edits do not invalidate printed QR labels. */
function saveCheckpoint(p) {
  requireAdmin_(p);
  const id = cleanId_(p.id), siteId = cleanId_(p.siteId), name = cleanText_(p.name, 120);
  if (!id || !siteId || !name) throw new Error('Checkpoint ID, Site ID and checkpoint name are required.');
  if (!siteById_(siteId)) throw new Error('Site ID was not found. Create the site first.');
  const existing = rowByKey_(VMS.SHEETS.checkpoints, 'Checkpoint ID', id);
  const revision = existing ? Number(existing.object['QR Revision'] || 1) : 1;
  const row = [
    id, siteId, name, cleanText_(p.zone, 80),
    requiredCoordinate_(p.latitude, 'Latitude', -90, 90), requiredCoordinate_(p.longitude, 'Longitude', -180, 180),
    numberInRange_(p.radius, 5, 1000, 'GPS radius'), cleanEnum_(p.status, ['ACTIVE', 'INACTIVE'], 'ACTIVE'),
    revision, cleanText_(p.notes, 500), new Date()
  ];
  writeKeyedRow_(sheet_(VMS.SHEETS.checkpoints), existing, row);
  audit_('ADMIN', existing ? 'CHECKPOINT_UPDATED' : 'CHECKPOINT_CREATED', 'CHECKPOINT', id, 'Checkpoint saved; QR revision remains ' + revision + '.');
  return { ok: true, id: id, qrRevision: revision };
}

function saveRoster(p) {
  requireAdmin_(p);
  const id = cleanId_(p.rosterId) || ('ROS-' + Utilities.getUuid().slice(0, 8).toUpperCase());
  const dutyDate = parseDate_(p.dutyDate);
  const employeeId = cleanId_(p.employeeId), siteId = cleanId_(p.siteId);
  if (!dutyDate || !employeeId || !siteId) throw new Error('Duty date, Employee ID and Site ID are required.');
  const employee = employeeById_(employeeId), site = siteById_(siteId);
  if (!employee || String(employee.Status).toUpperCase() !== 'ACTIVE') throw new Error('Employee must exist and be ACTIVE.');
  if (!site || String(site.Status).toUpperCase() !== 'ACTIVE') throw new Error('Site must exist and be ACTIVE.');
  const times = shiftTimes_(p.shiftCode, p.startTime, p.endTime);
  if (!times) throw new Error('Use a configured shift code or enter valid start and end times.');
  const existing = rowByKey_(VMS.SHEETS.roster, 'Roster ID', id);
  const row = [
    id, dutyDate, employeeId, siteId, cleanText_(p.shiftCode, 20).toUpperCase(), times.start, times.end,
    cleanEnum_(p.status, ['SCHEDULED', 'CANCELLED'], 'SCHEDULED'), cleanText_(p.notes, 500),
    existing ? existing.object['Created At'] : new Date(), new Date()
  ];
  writeKeyedRow_(sheet_(VMS.SHEETS.roster), existing, row);
  audit_('ADMIN', existing ? 'ROSTER_UPDATED' : 'ROSTER_CREATED', 'ROSTER', id, employeeId + ' / ' + siteId + ' / ' + dateKey_(dutyDate));
  return { ok: true, id: id };
}

/** Revoke a lost card without touching the employee's master identity. */
function rotateEmployeeQr(p) {
  requireAdmin_(p);
  const id = cleanId_(p.employeeId);
  const found = rowByKey_(VMS.SHEETS.employees, 'Employee ID', id);
  if (!found) throw new Error('Employee ID was not found.');
  const next = Number(found.object['QR Revision'] || 1) + 1;
  sheet_(VMS.SHEETS.employees).getRange(found.row, 7).setValue(next);
  sheet_(VMS.SHEETS.employees).getRange(found.row, 9).setValue(new Date());
  audit_('ADMIN', 'EMPLOYEE_QR_ROTATED', 'EMPLOYEE', id, 'New QR revision: ' + next + '. Previous card is invalid.');
  return qrForEmployee_(employeeById_(id));
}

function rotateCheckpointQr(p) {
  requireAdmin_(p);
  const id = cleanId_(p.checkpointId);
  const found = rowByKey_(VMS.SHEETS.checkpoints, 'Checkpoint ID', id);
  if (!found) throw new Error('Checkpoint ID was not found.');
  const next = Number(found.object['QR Revision'] || 1) + 1;
  sheet_(VMS.SHEETS.checkpoints).getRange(found.row, 9).setValue(next);
  sheet_(VMS.SHEETS.checkpoints).getRange(found.row, 11).setValue(new Date());
  audit_('ADMIN', 'CHECKPOINT_QR_ROTATED', 'CHECKPOINT', id, 'New QR revision: ' + next + '.');
  return qrForCheckpoint_(checkpointById_(id));
}

function getEmployeeQr(p) {
  requireAdmin_(p);
  const employee = employeeById_(cleanId_(p.employeeId));
  if (!employee) throw new Error('Employee ID was not found.');
  return qrForEmployee_(employee);
}

function getCheckpointQr(p) {
  requireAdmin_(p);
  const checkpoint = checkpointById_(cleanId_(p.checkpointId));
  if (!checkpoint) throw new Error('Checkpoint ID was not found.');
  return qrForCheckpoint_(checkpoint);
}

/** Guard check-in/check-out: idempotent under retries and protected by a document lock. */
function submitAttendance(p) {
  ensureReady_();
  const guard = verifyEmployeeCredential_(p || {});
  const site = siteById_(cleanId_(p.siteId));
  if (!site || String(site.Status).toUpperCase() !== 'ACTIVE') throw new Error('Site is not active.');
  const eventType = cleanEnum_(p.eventType, ['CHECK-IN', 'CHECK-OUT'], '');
  if (!eventType) throw new Error('Choose CHECK-IN or CHECK-OUT.');
  const location = validatedLocation_(p, site, 'site');
  const now = new Date();
  const roster = activeRoster_(guard['Employee ID'], site['Site ID'], now);
  if (!roster && setting_('ALLOW_OFF_ROSTER', 'NO') !== 'YES') throw new Error('No active roster matches this guard and site. Contact the supervisor.');
  const requestId = requestId_(p.requestId);
  const lock = LockService.getDocumentLock();
  lock.waitLock(30000);
  try {
    const duplicate = rowByKey_(VMS.SHEETS.attendance, 'Request ID', requestId);
    if (duplicate) return { ok: true, duplicate: true, message: 'This attendance request was already recorded.' };
    validateAttendanceSequence_(guard['Employee ID'], eventType);
    const row = [
      'ATT-' + Utilities.getUuid(), now, shiftDateFor_(roster, now), guard['Employee ID'], guard['Full Name'],
      site['Site ID'], site['Site Name'], eventType, roster ? roster['Roster ID'] : '',
      location.lat, location.lng, location.accuracy, location.distance, roster ? 'PENDING REVIEW' : 'REVIEW',
      cleanText_(p.notes, 500), requestId
    ];
    append_(VMS.SHEETS.attendance, row);
    audit_('GUARD:' + guard['Employee ID'], eventType, 'ATTENDANCE', row[0], site['Site ID'] + ' / ' + Math.round(location.distance) + 'm');
    return { ok: true, message: eventType + ' recorded at ' + formatDate_(now, 'dd/MM/yyyy HH:mm:ss'), status: row[13] };
  } finally {
    lock.releaseLock();
  }
}

/** Patrol checkpoint with optional compressed photo evidence. */
function submitPatrolCheck(p) {
  ensureReady_();
  const guard = verifyEmployeeCredential_(p || {});
  const checkpoint = verifyCheckpointCredential_(p || {});
  const site = siteById_(checkpoint['Site ID']);
  if (!site || String(checkpoint.Status).toUpperCase() !== 'ACTIVE') throw new Error('Checkpoint is inactive or site is missing.');
  const location = validatedLocation_(p, checkpoint, 'checkpoint');
  const requestId = requestId_(p.requestId);
  const lock = LockService.getDocumentLock();
  lock.waitLock(30000);
  try {
    const duplicate = rowByKey_(VMS.SHEETS.patrol, 'Request ID', requestId);
    if (duplicate) return { ok: true, duplicate: true, message: 'This checkpoint request was already recorded.' };
    const evidence = saveEvidence_(p.photoDataUrl, 'checkpoint', checkpoint['Checkpoint ID']);
    const now = new Date();
    const roster = activeRoster_(guard['Employee ID'], site['Site ID'], now);
    const status = roster ? 'COMPLETED' : 'OFF ROSTER REVIEW';
    const row = [
      'PAT-' + Utilities.getUuid(), now, shiftDateFor_(roster, now), site['Site ID'], site['Site Name'],
      guard['Employee ID'], guard['Full Name'], checkpoint['Checkpoint ID'], checkpoint['Checkpoint Name'], checkpoint.Zone,
      location.lat, location.lng, location.accuracy, location.distance, status,
      evidence.id, evidence.url, cleanText_(p.notes, 500), requestId
    ];
    append_(VMS.SHEETS.patrol, row);
    audit_('GUARD:' + guard['Employee ID'], 'CHECKPOINT_CHECK', 'CHECKPOINT', checkpoint['Checkpoint ID'], 'Distance ' + Math.round(location.distance) + 'm.');
    return { ok: true, message: 'Checkpoint recorded.', photoUrl: evidence.url, status: status };
  } finally {
    lock.releaseLock();
  }
}

/** Guard security log book with optional photo evidence. */
function submitLogbookEntry(p) {
  ensureReady_();
  const guard = verifyEmployeeCredential_(p || {});
  const site = siteById_(cleanId_(p.siteId));
  if (!site || String(site.Status).toUpperCase() !== 'ACTIVE') throw new Error('Choose an active site.');
  const subject = cleanText_(p.subject, 160), details = cleanText_(p.details, 4000);
  if (!subject || !details) throw new Error('Subject and details are required for the log book.');
  const location = validatedLocation_(p, site, 'site');
  const requestId = requestId_(p.requestId);
  const lock = LockService.getDocumentLock();
  lock.waitLock(30000);
  try {
    const duplicate = rowByKey_(VMS.SHEETS.logbook, 'Request ID', requestId);
    if (duplicate) return { ok: true, duplicate: true, message: 'This log book entry was already recorded.' };
    const now = new Date();
    const evidence = saveEvidence_(p.photoDataUrl, 'logbook', site['Site ID']);
    const roster = activeRoster_(guard['Employee ID'], site['Site ID'], now);
    const status = cleanEnum_(p.status, ['OPEN', 'MONITORING', 'CLOSED'], 'OPEN');
    const row = [
      'LOG-' + Utilities.getUuid(), now, dateKey_(now), shiftDateFor_(roster, now), site['Site ID'], site['Site Name'],
      guard['Employee ID'], guard['Full Name'], cleanEnum_(p.category, ['GENERAL', 'VISITOR', 'INCIDENT', 'SAFETY', 'MAINTENANCE', 'HANDOVER'], 'GENERAL'),
      cleanEnum_(p.priority, ['LOW', 'NORMAL', 'HIGH', 'CRITICAL'], 'NORMAL'), subject, details,
      cleanText_(p.actionTaken, 2000), cleanText_(p.reportedTo, 160), location.lat, location.lng, location.accuracy,
      evidence.id, evidence.url, status, 1, requestId, now
    ];
    append_(VMS.SHEETS.logbook, row);
    audit_('GUARD:' + guard['Employee ID'], 'LOGBOOK_CREATED', 'LOGBOOK', row[0], site['Site ID'] + ' / ' + row[8]);
    return { ok: true, message: 'Security log book entry recorded.', id: row[0], photoUrl: evidence.url };
  } finally {
    lock.releaseLock();
  }
}

function rebuildDailyReport(p) {
  requireAdmin_(p);
  return rebuildDailyReport_(p, 'ADMIN');
}

/**
 * REPORT function is intentionally generated from immutable IDs and dates.
 * It never relies on the name text stored in roster or attendance.
 */
function rebuildDailyReport_(p, actor) {
  ensureReady_();
  const date = parseDate_(p && p.date);
  if (!date) throw new Error('Enter a valid report date (YYYY-MM-DD).');
  const day = dateKey_(date);
  const sites = objects_(VMS.SHEETS.sites).filter(function(x) { return x['Site ID'] && String(x.Status).toUpperCase() === 'ACTIVE'; });
  const roster = objects_(VMS.SHEETS.roster).filter(function(x) { return dateKey_(x['Duty Date']) === day && String(x.Status).toUpperCase() === 'SCHEDULED'; });
  const attendance = objects_(VMS.SHEETS.attendance).filter(function(x) { return dateKey_(x['Shift Date']) === day; });
  const patrol = objects_(VMS.SHEETS.patrol).filter(function(x) { return dateKey_(x['Shift Date']) === day; });
  const logbook = objects_(VMS.SHEETS.logbook).filter(function(x) { return dateKey_(x['Log Date']) === day; });
  const visitors = objects_(VMS.SHEETS.visitors);
  const checkpoints = objects_(VMS.SHEETS.checkpoints).filter(function(x) { return String(x.Status).toUpperCase() === 'ACTIVE'; });
  const rows = sites.map(function(site) {
    const siteRoster = roster.filter(function(x) { return x['Site ID'] === site['Site ID']; });
    const siteAttendance = attendance.filter(function(x) { return x['Site ID'] === site['Site ID']; });
    const sitePatrol = patrol.filter(function(x) { return x['Site ID'] === site['Site ID']; });
    const siteLogbook = logbook.filter(function(x) { return x['Site ID'] === site['Site ID']; });
    const siteVisitorCheckins = visitors.filter(function(x) { return x['Site ID'] === site['Site ID'] && dateKey_(x['Visit Date']) === day; });
    const siteVisitorsOnSite = visitors.filter(function(x) { return x['Site ID'] === site['Site ID'] && String(x.Status).toUpperCase() === 'CHECKED-IN'; });
    const checkedIn = unique_(siteAttendance.filter(function(x) { return x['Event Type'] === 'CHECK-IN'; }).map(function(x) { return x['Employee ID']; })).length;
    const expected = checkpoints.filter(function(x) { return x['Site ID'] === site['Site ID']; }).length;
    const patrolGuards = unique_(sitePatrol.map(function(x) { return x['Guard ID']; })).length;
    const attendanceException = Math.max(0, siteRoster.length - checkedIn);
    const checkpointException = expected && patrolGuards ? Math.max(0, expected - unique_(sitePatrol.map(function(x) { return x['Checkpoint ID']; })).length) : expected;
    return [day, site['Site ID'], site['Site Name'], siteRoster.length, checkedIn, attendanceException,
      sitePatrol.length, checkpointException, siteLogbook.length,
      siteLogbook.filter(function(x) { return String(x.Status).toUpperCase() !== 'CLOSED'; }).length,
      siteVisitorCheckins.length, siteVisitorsOnSite.length, new Date()];
  });
  const reportSheet = sheet_(VMS.SHEETS.report);
  const old = records_(VMS.SHEETS.report);
  old.forEach(function(record) {
    if (dateKey_(record.object['Report Date']) === day) reportSheet.getRange(record.row, 1, 1, VMS.HEADERS[VMS.SHEETS.report].length).clearContent();
  });
  if (rows.length) reportSheet.getRange(reportSheet.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
  audit_(actor, 'REPORT_GENERATED', 'REPORT', day, rows.length + ' active site rows.');
  return { ok: true, date: day, sites: rows.length };
}

/* ------------------------------ QR payloads ------------------------------ */

function qrForEmployee_(employee) {
  const id = employee['Employee ID'];
  const revision = Number(employee['QR Revision'] || 1);
  const signature = sign_('EMPLOYEE', id, revision);
  const url = webAppUrl_() + '?m=guard&e=' + encodeURIComponent(id) + '&r=' + revision + '&s=' + encodeURIComponent(signature);
  return { id: id, name: employee['Full Name'], revision: revision, url: url, qrImage: qrImageUrl_(url) };
}

function qrForCheckpoint_(checkpoint) {
  const id = checkpoint['Checkpoint ID'];
  const revision = Number(checkpoint['QR Revision'] || 1);
  const signature = sign_('CHECKPOINT', id, revision);
  const url = webAppUrl_() + '?m=checkpoint&c=' + encodeURIComponent(id) + '&cr=' + revision + '&cs=' + encodeURIComponent(signature);
  return { id: id, name: checkpoint['Checkpoint Name'], revision: revision, url: url, qrImage: qrImageUrl_(url) };
}

/** Google-hosted QR rendering is only for the printable image; validation is local and signed. */
function qrImageUrl_(payload) {
  return 'https://chart.googleapis.com/chart?cht=qr&chs=300x300&chld=M%7C1&chl=' + encodeURIComponent(payload);
}

function webAppUrl_() {
  const url = ScriptApp.getService().getUrl();
  if (!url) throw new Error('Deploy the script as a Web app before generating QR cards.');
  return url;
}

function verifyEmployeeCredential_(p) {
  const id = cleanId_(p.employeeId);
  const employee = employeeById_(id);
  if (!employee || String(employee.Status).toUpperCase() !== 'ACTIVE') throw new Error('Employee QR is inactive or no longer valid.');
  const revision = Number(p.employeeRevision || 0);
  if (revision !== Number(employee['QR Revision'] || 1) || !safeEqual_(String(p.employeeSignature || ''), sign_('EMPLOYEE', id, revision))) {
    throw new Error('Employee QR is invalid or has been replaced.');
  }
  return employee;
}

function verifyCheckpointCredential_(p) {
  const id = cleanId_(p.checkpointId);
  const checkpoint = checkpointById_(id);
  if (!checkpoint || String(checkpoint.Status).toUpperCase() !== 'ACTIVE') throw new Error('Checkpoint QR is inactive or invalid.');
  const revision = Number(p.checkpointRevision || 0);
  if (revision !== Number(checkpoint['QR Revision'] || 1) || !safeEqual_(String(p.checkpointSignature || ''), sign_('CHECKPOINT', id, revision))) {
    throw new Error('Checkpoint QR is invalid or has been replaced.');
  }
  return checkpoint;
}

/* ------------------------------- validations ------------------------------ */

function requireAdmin_(p) {
  ensureReady_();
  const token = String((p || {}).token || '');
  const cached = token && CacheService.getScriptCache().get('vms-admin-' + token);
  if (!cached) throw new Error('Admin session expired. Sign in again.');
  return JSON.parse(cached);
}

function ensureReady_() {
  const ss = getSpreadsheet_();
  if (!ss.getSheetByName(VMS.SHEETS.employees)) throw new Error('Run setupVms() once from the bound spreadsheet first.');
  const props = PropertiesService.getScriptProperties();
  if (!props.getProperty('VMS_SIGNING_SECRET')) props.setProperty('VMS_SIGNING_SECRET', Utilities.getUuid() + Utilities.getUuid());
}

function verifyAdminPassword_(password) {
  const props = PropertiesService.getScriptProperties();
  const salt = props.getProperty('ADMIN_SALT'), expected = props.getProperty('ADMIN_HASH');
  if (!salt || !expected) throw new Error('Admin password is not configured. Use VMS Guard App > Set or change admin password in the bound spreadsheet.');
  return safeEqual_(sha256_(salt + '|' + password), expected);
}

function validatedLocation_(p, target, targetType) {
  const lat = requiredCoordinate_(p.latitude, 'Latitude', -90, 90);
  const lng = requiredCoordinate_(p.longitude, 'Longitude', -180, 180);
  const accuracy = numberInRange_(p.accuracy, 0, Number(setting_('GPS_MAX_ACCURACY_M', 100)), 'GPS accuracy');
  const distance = distanceMeters_(lat, lng, Number(target.Latitude), Number(target.Longitude));
  const radius = Number(target['GPS Radius (m)'] || setting_('DEFAULT_GPS_RADIUS_M', 150));
  if (!Number.isFinite(distance) || distance > radius) {
    throw new Error('You are outside the permitted ' + targetType + ' radius (' + Math.round(distance || 0) + 'm).');
  }
  return { lat: lat, lng: lng, accuracy: accuracy, distance: Math.round(distance * 10) / 10 };
}

/** Visitor transactions need both a valid QR bearer and an active duty assignment. */
function activeSiteForGuard_(guard, siteId) {
  const site = siteById_(siteId);
  if (!site || String(site.Status).toUpperCase() !== 'ACTIVE') throw new Error('Choose an active site.');
  const roster = activeRoster_(guard['Employee ID'], site['Site ID'], new Date());
  if (!roster && setting_('ALLOW_OFF_ROSTER', 'NO') !== 'YES') {
    throw new Error('No active roster matches this guard and site. Contact the supervisor.');
  }
  return site;
}

/** Keeps a useful audit match key while avoiding storage of a full government document number. */
function maskDocument_(value) {
  const text = cleanText_(value, 80).replace(/\s+/g, '').toUpperCase();
  if (!text) return '';
  return text.length <= 4 ? '***' + text : '****' + text.slice(-4);
}

function validateAttendanceSequence_(employeeId, eventType) {
  const last = objects_(VMS.SHEETS.attendance)
    .filter(function(x) { return x['Employee ID'] === employeeId; })
    .sort(function(a, b) { return new Date(b.Timestamp) - new Date(a.Timestamp); })[0];
  if (eventType === 'CHECK-IN' && last && last['Event Type'] === 'CHECK-IN') throw new Error('Clock out the current open session before checking in again.');
  if (eventType === 'CHECK-OUT' && (!last || last['Event Type'] !== 'CHECK-IN')) throw new Error('A valid check-in is required before clock out.');
}

function activeRoster_(employeeId, siteId, now) {
  const candidates = objects_(VMS.SHEETS.roster).filter(function(x) {
    return x['Employee ID'] === employeeId && x['Site ID'] === siteId && String(x.Status).toUpperCase() === 'SCHEDULED';
  });
  for (let i = 0; i < candidates.length; i++) {
    const row = candidates[i];
    const start = combineDateTime_(row['Duty Date'], row['Start Time']);
    let end = combineDateTime_(row['Duty Date'], row['End Time']);
    if (end <= start) end.setDate(end.getDate() + 1);
    if (now >= new Date(start.getTime() - 3 * 3600000) && now <= new Date(end.getTime() + 3 * 3600000)) return row;
  }
  return null;
}

function shiftDateFor_(roster, now) {
  return roster ? dateKey_(roster['Duty Date']) : dateKey_(now);
}

function shiftTimes_(code, start, end) {
  if (validTime_(start) && validTime_(end)) return { start: String(start), end: String(end) };
  return VMS.SHIFTS[String(code || '').toUpperCase()] || null;
}

/* ------------------------------ media storage ----------------------------- */

function saveEvidence_(dataUrl, kind, entityId) {
  if (!dataUrl) return { id: '', url: '' };
  const match = String(dataUrl).match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=\s]+)$/i);
  if (!match) throw new Error('Photo must be a JPG, PNG or WEBP image.');
  const bytes = Utilities.base64Decode(match[2].replace(/\s/g, ''));
  if (!bytes.length || bytes.length > VMS.MAX_IMAGE_BYTES) throw new Error('Compressed photo must be below 2 MB.');
  const extension = match[1].toLowerCase() === 'image/png' ? 'png' : match[1].toLowerCase() === 'image/webp' ? 'webp' : 'jpg';
  const name = kind + '_' + cleanId_(entityId) + '_' + formatDate_(new Date(), 'yyyyMMdd_HHmmss') + '_' + Utilities.getUuid().slice(0, 8) + '.' + extension;
  const file = mediaFolder_().createFile(Utilities.newBlob(bytes, match[1], name));
  file.setDescription('VMS evidence. Access is controlled by the owner Drive folder.');
  return { id: file.getId(), url: file.getUrl() };
}

function mediaFolder_() {
  const props = PropertiesService.getScriptProperties();
  const existing = props.getProperty('VMS_MEDIA_FOLDER_ID');
  if (existing) return DriveApp.getFolderById(existing);
  const folder = DriveApp.createFolder('VMS Private Evidence - ' + getSpreadsheet_().getName());
  props.setProperty('VMS_MEDIA_FOLDER_ID', folder.getId());
  return folder;
}

/* ------------------------------ sheet helpers ----------------------------- */

function getSpreadsheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (ss) return ss;
  const spreadsheetId = PropertiesService.getScriptProperties().getProperty('VMS_SPREADSHEET_ID');
  if (spreadsheetId) return SpreadsheetApp.openById(spreadsheetId);
  throw new Error('Bind this script to the target Google Spreadsheet and run setupVms() before using the web app.');
}

function ensureSheet_(ss, name, headers) {
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  const first = sh.getRange(1, 1, 1, headers.length).getDisplayValues()[0];
  const hasHeader = first.some(function(x) { return x !== ''; });
  if ((hasHeader && headers.some(function(header, i) { return first[i] !== header; })) ||
      (!hasHeader && sh.getLastRow() > 1)) {
    throw new Error('Sheet "' + name + '" has different headers. Rename it or use a new spreadsheet; setup will not overwrite it.');
  }
  if (!hasHeader) sh.getRange(1, 1, 1, headers.length).setValues([headers]);
  sh.setFrozenRows(1);
  sh.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#10243A').setFontColor('#FFFFFF').setWrap(true);
  sh.autoResizeColumns(1, headers.length);
  return sh;
}

function styleSheets_() {
  const ss = getSpreadsheet_();
  Object.keys(VMS.HEADERS).forEach(function(name) {
    const sh = ss.getSheetByName(name);
    sh.setHiddenGridlines(true);
    sh.getRange(1, 1, Math.max(2, sh.getMaxRows()), VMS.HEADERS[name].length).setVerticalAlignment('middle');
    sh.getRange(1, 1, 1, VMS.HEADERS[name].length).setHorizontalAlignment('center');
    sh.getRange('A:A').setNumberFormat('@');
  });
  sheet_(VMS.SHEETS.dashboard).setTabColor('#10243A');
  sheet_(VMS.SHEETS.settings).setTabColor('#64748B');
}

function buildDashboard_() {
  const sh = sheet_(VMS.SHEETS.dashboard);
  sh.getRange('A1:H1').breakApart();
  sh.getRange('A1:H6').clear();
  sh.setHiddenGridlines(true);
  sh.getRange('A1:H1').merge().setValue(VMS.APP_NAME).setFontSize(18).setFontWeight('bold').setFontColor('#FFFFFF').setBackground('#10243A').setHorizontalAlignment('left');
  sh.getRange('A3:H3').setValues([['Today', 'Active guards', 'Scheduled today', 'Check-ins today', 'Checkpoint checks', 'Open log entries', 'Visitors on site', 'Last setup']]);
  sh.getRange('A4:H4').setValues([[
    '=TODAY()', '=COUNTIF(EMPLOYEES!F:F,"ACTIVE")', '=COUNTIFS(\'DUTY ROSTER\'!B:B,TODAY(),\'DUTY ROSTER\'!H:H,"SCHEDULED")',
    '=COUNTIFS(\'ATTENDANCE LOG\'!C:C,TEXT(TODAY(),"yyyy-mm-dd"),\'ATTENDANCE LOG\'!H:H,"CHECK-IN")',
    '=COUNTIF(\'CHECKPOINT LOG\'!C:C,TEXT(TODAY(),"yyyy-mm-dd"))', '=COUNTIFS(\'SECURITY LOG BOOK\'!A2:A,"<>",\'SECURITY LOG BOOK\'!T2:T,"<>CLOSED")',
    '=COUNTIF(\'VISITOR LOG\'!W:W,"CHECKED-IN")', new Date()
  ]]);
  sh.getRange('A3:H3').setFontWeight('bold').setBackground('#E8EEF4').setHorizontalAlignment('center');
  sh.getRange('A4:H4').setFontSize(14).setFontWeight('bold').setHorizontalAlignment('center').setBackground('#FFFFFF');
  sh.getRange('A4').setNumberFormat('dd/MM/yyyy');
  sh.getRange('H4').setNumberFormat('dd/MM/yyyy HH:mm');
  sh.getRange('A6').setValue('Data source: master sheets are the source of truth. Employee ID, Site ID, Checkpoint ID and Visitor ID must not be reused.').setFontColor('#475467');
  sh.setColumnWidths(1, 8, 135);
}

function seedSettings_() {
  const defaults = [
    ['GPS_MAX_ACCURACY_M', '100', 'Maximum GPS accuracy accepted by guard submissions.'],
    ['DEFAULT_GPS_RADIUS_M', '150', 'Fallback site/checkpoint radius.'],
    ['ALLOW_OFF_ROSTER', 'NO', 'YES permits attendance outside an active roster. Keep NO for normal operations.']
  ];
  const sh = sheet_(VMS.SHEETS.settings);
  const current = objects_(VMS.SHEETS.settings).map(function(x) { return x.Setting; });
  defaults.filter(function(row) { return current.indexOf(row[0]) < 0; }).forEach(function(row) { sh.appendRow(row); });
}

function objects_(sheetName) {
  return records_(sheetName).map(function(record) { return record.object; });
}

/** Keeps physical sheet row numbers accurate even when a report rebuild has left blank rows. */
function records_(sheetName) {
  const sh = sheet_(sheetName), values = sh.getDataRange().getValues();
  if (values.length < 2) return [];
  const headers = values[0].map(String);
  return values.slice(1).map(function(row, index) {
    if (!row.some(function(value) { return value !== '' && value !== null; })) return null;
    const out = {};
    headers.forEach(function(header, i) { out[header] = row[i]; });
    return { row: index + 2, object: out };
  }).filter(Boolean);
}

function rowByKey_(sheetName, header, key) {
  if (!key || VMS.HEADERS[sheetName].indexOf(header) < 0) return null;
  const wanted = String(key).trim().toUpperCase();
  return records_(sheetName).find(function(record) {
    return String(record.object[header] || '').trim().toUpperCase() === wanted;
  }) || null;
}

function writeKeyedRow_(sheet, existing, row) {
  if (existing) sheet.getRange(existing.row, 1, 1, row.length).setValues([row]);
  else sheet.getRange(sheet.getLastRow() + 1, 1, 1, row.length).setValues([row]);
}

function append_(sheetName, row) {
  const sh = sheet_(sheetName);
  sh.getRange(sh.getLastRow() + 1, 1, 1, row.length).setValues([row]);
}

function sheet_(name) {
  const sh = getSpreadsheet_().getSheetByName(name);
  if (!sh) throw new Error('Missing sheet "' + name + '". Run setupVms() from the bound spreadsheet.');
  return sh;
}

function employeeById_(id) {
  return findBy_(VMS.SHEETS.employees, 'Employee ID', id);
}

function siteById_(id) {
  return findBy_(VMS.SHEETS.sites, 'Site ID', id);
}

function checkpointById_(id) {
  return findBy_(VMS.SHEETS.checkpoints, 'Checkpoint ID', id);
}

function findBy_(sheetName, field, id) {
  const wanted = String(id || '').trim().toUpperCase();
  return objects_(sheetName).find(function(x) { return String(x[field] || '').trim().toUpperCase() === wanted; }) || null;
}

function setting_(key, fallback) {
  const row = findBy_(VMS.SHEETS.settings, 'Setting', key);
  return row && row.Value !== '' ? String(row.Value).toUpperCase() : String(fallback).toUpperCase();
}

function audit_(actor, action, entityType, entityId, detail) {
  const sh = getSpreadsheet_().getSheetByName(VMS.SHEETS.audit);
  if (!sh) return;
  sh.appendRow(['AUD-' + Utilities.getUuid(), new Date(), actor, action, entityType, entityId, cleanText_(detail, 1000)]);
}

function recentAdminActivity_() {
  return objects_(VMS.SHEETS.audit).slice(-20).reverse().map(function(x) {
    return { timestamp: formatDate_(x.Timestamp, 'dd/MM HH:mm'), actor: x.Actor, action: x.Action, entity: x['Entity Type'] + ' ' + x['Entity ID'], detail: x.Detail };
  });
}

/* -------------------------------- utilities -------------------------------- */

function publicGuard_(employee) {
  const site = siteById_(employee['Default Site ID']);
  return { id: employee['Employee ID'], name: employee['Full Name'], position: employee.Position, defaultSiteId: employee['Default Site ID'], defaultSiteName: site ? site['Site Name'] : '' };
}

function sign_(scope, id, revision) {
  const secret = PropertiesService.getScriptProperties().getProperty('VMS_SIGNING_SECRET');
  const bytes = Utilities.computeHmacSha256Signature(scope + '|' + id + '|' + revision, secret);
  return Utilities.base64EncodeWebSafe(bytes).replace(/=+$/g, '');
}

function sha256_(value) {
  return Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, value)).replace(/=+$/g, '');
}

function safeEqual_(a, b) {
  a = String(a); b = String(b);
  let different = a.length ^ b.length;
  const longest = Math.max(a.length, b.length);
  for (let i = 0; i < longest; i++) different |= (a.charCodeAt(i % Math.max(a.length, 1)) || 0) ^ (b.charCodeAt(i % Math.max(b.length, 1)) || 0);
  return different === 0;
}

function cleanId_(value) {
  const id = String(value || '').trim().toUpperCase();
  if (!id) return '';
  if (!/^[A-Z0-9][A-Z0-9_-]{1,47}$/.test(id)) throw new Error('IDs must use 2–48 letters, numbers, hyphens or underscores.');
  return id;
}

function tryCleanId_(value) {
  try { return cleanId_(value); } catch (ignore) { return ''; }
}

function cleanSignature_(value) {
  const signature = String(value || '');
  return /^[A-Za-z0-9_-]{20,120}$/.test(signature) ? signature : '';
}

function cleanText_(value, max) {
  let text = String(value === undefined || value === null ? '' : value).trim();
  if (text.length > max) throw new Error('Text is too long. Maximum is ' + max + ' characters.');
  if (/^[=+\-@]/.test(text)) text = "'" + text;
  return text;
}

function cleanEnum_(value, allowed, fallback) {
  const text = String(value || '').trim().toUpperCase();
  return allowed.indexOf(text) >= 0 ? text : fallback;
}

function requiredCoordinate_(value, label, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < min || number > max) throw new Error(label + ' is invalid.');
  return number;
}

function numberInRange_(value, min, max, label) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < min || number > max) throw new Error(label + ' must be between ' + min + ' and ' + max + '.');
  return number;
}

function requestId_(value) {
  const id = String(value || '').trim();
  if (!/^[A-Za-z0-9_-]{8,100}$/.test(id)) throw new Error('Invalid request identifier. Refresh the page and try again.');
  return id;
}

function validTime_(value) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(String(value || ''));
}

function parseDate_(value) {
  if (value instanceof Date && !isNaN(value)) return new Date(value.getFullYear(), value.getMonth(), value.getDate());
  if (!value) return null;
  const text = String(value);
  const exact = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (exact) return new Date(Number(exact[1]), Number(exact[2]) - 1, Number(exact[3]));
  const date = new Date(text);
  return isNaN(date) ? null : new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function dateKey_(value) {
  const date = parseDate_(value);
  return date ? Utilities.formatDate(date, VMS.TZ, 'yyyy-MM-dd') : '';
}

function formatDate_(value, pattern) {
  const date = value instanceof Date ? value : new Date(value);
  return Utilities.formatDate(date, VMS.TZ, pattern);
}

function combineDateTime_(dateValue, timeValue) {
  const date = parseDate_(dateValue);
  const match = String(timeValue || '00:00').match(/^(\d{1,2}):(\d{2})/);
  if (!date || !match) return new Date('invalid');
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), Number(match[1]), Number(match[2]), 0, 0);
}

function distanceMeters_(lat1, lng1, lat2, lng2) {
  if (![lat1, lng1, lat2, lng2].every(Number.isFinite)) return NaN;
  const radians = function(x) { return x * Math.PI / 180; };
  const dLat = radians(lat2 - lat1), dLng = radians(lng2 - lng1);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(radians(lat1)) * Math.cos(radians(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function hasKey_(field) { return function(x) { return String(x[field] || '').trim() !== ''; }; }
function unique_(items) { return Array.from(new Set(items.filter(Boolean))); }
