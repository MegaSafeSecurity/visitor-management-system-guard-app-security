/** MEGA SAFE SECURITY SERVICES SDN BHD - Guard Tour, VMS, Log Book (v6 secure) */
const TZ = 'Asia/Kuala_Lumpur', FOLDER = 'MegaSafe_Photos', VER = 'v6';
const S = {
  Guards: ['GuardID','Name','StaffNo','Phone','Email','Premise','Shift','Status','PIN','TwoFA','PinHash','Salt'],
  Premises: ['PremiseID','Name','Address','Status','PatrolMin','AlarmSec'],
  Checkpoints: ['CPID','Premise','Name','QRCode','Status'],
  Patrol: ['Timestamp','GuardID','Guard','Premise','Checkpoint','Lat','Lng','PhotoURL','Remark'],
  Attendance: ['Date','GuardID','Guard','Premise','Shift','ClockIn','ClockOut'],
  Visitors: ['VisitID','TimeIn','Name','IC','Phone','Vehicle','Purpose','Host','Premise','PhotoURL','TimeOut','Guard'],
  LogBook: ['Timestamp','Premise','Guard','Category','Description','PhotoURL'],
  Complaints: ['RefNo','Date','Premise','Description','Status'],
  AuditLog: ['Time','Actor','Action','Target','Detail'],
  Threats: ['ID','Time','Level','Type','Actor','Detail']
};
const SECRET = {Guards: ['PIN','PinHash','Salt']};
const PFX = {Guards:'G',Premises:'P',Checkpoints:'C',Complaints:'CP'};
const LOCK_MAX = 5, LOCK_SEC = 900;

function doGet() {
  var html = Utilities.newBlob(Utilities.base64Decode(PAGE_B64.join(''))).getDataAsString('UTF-8')
    .split('__LOGO__').join(LOGO).split('__EXEC__').join(ScriptApp.getService().getUrl());
  return HtmlService.createHtmlOutput(html)
    .setTitle('Mega Safe Security Services Sdn Bhd')
    .addMetaTag('viewport', 'width=device-width,initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function doPost(e) {
  try { const p = JSON.parse(e.postData.contents); return ContentService.createTextOutput(rpc(p.fn, p.t, p.a)).setMimeType(ContentService.MimeType.JSON); }
  catch (er) { return ContentService.createTextOutput(JSON.stringify({error: 'Permintaan tidak sah'})); }
}

/* ---------- setup (run once from the editor) ---------- */
function setup() {
  const ss = getSS();
  Object.keys(S).forEach(n => {
    const sh = ss.getSheetByName(n) || ss.insertSheet(n);
    sh.getRange(1, 1, 1, S[n].length).setValues([S[n]]).setFontWeight('bold').setBackground('#0a1a3a').setFontColor('#ffffff');
    sh.getRange(2, 1, 999, S[n].length).setNumberFormat('@'); sh.setFrozenRows(1);
  });
  ensureHeaders(); initAdmin(); pepper();
  try { rtSheet(); } catch (e) { Logger.log('Realtime sheet: ' + e.message); }
  try { installTriggers(); } catch (e) { Logger.log('Trigger: ' + e.message); }
  Logger.log('Setup selesai.');
}
function initAdmin() {
  const p = props(); if (p.getProperty('ADMIN_HASH')) return;
  const pw = p.getProperty('INIT_ADMIN_PASSWORD');
  if (!pw || pw.length < 12) { Logger.log('GAGAL: tetapkan INIT_ADMIN_PASSWORD (min 12 aksara) di Project Settings > Script properties, kemudian jalankan setup() semula.'); return; }
  const s = rnd().slice(0, 16); p.setProperty('ADMIN_SALT', s); p.setProperty('ADMIN_HASH', hashPw(pw, s)); p.deleteProperty('INIT_ADMIN_PASSWORD');
  Logger.log('Admin disediakan. INIT_ADMIN_PASSWORD telah dipadam.');
}
function resetAdmin2FA() { props().deleteProperty('TS_admin'); props().deleteProperty('LC_admin'); audit('editor', '2FA_RESET', 'admin', 'Dijalankan daripada editor'); }
function resetAdminPassword() {
  const p = props(); ['ADMIN_HASH', 'ADMIN_SALT', 'TS_admin', 'LC_admin'].forEach(k => p.deleteProperty(k));
  audit('editor', 'ADMIN_RESET', 'admin', 'Kata laluan + 2FA admin dipadam daripada editor');
  Logger.log('Tetapkan INIT_ADMIN_PASSWORD di Script properties, kemudian jalankan setup().');
}
function installTriggers() {
  ScriptApp.getProjectTriggers().forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('monitor').timeBased().everyMinutes(5).create();
}
function ensureHeaders() {
  const p = props(); if (p.getProperty('HDR') === 'v6') return;
  Object.keys(S).forEach(n => {
    const s = sh(n); if (!s) return;
    const cur = s.getRange(1, 1, 1, S[n].length).getValues()[0];
    if (cur.join('|') !== S[n].join('|')) {
      s.getRange(1, 1, 1, S[n].length).setValues([S[n]]).setFontWeight('bold').setBackground('#0a1a3a').setFontColor('#ffffff');
      s.getRange(2, 1, 999, S[n].length).setNumberFormat('@');
    }
  });
  const ps = sh('Premises'), pv = ps.getDataRange().getValues();
  for (let i = 1; i < pv.length; i++) if (pv[i][0] !== '') {
    if (pv[i][4] === '' || pv[i][4] == null) ps.getRange(i + 1, 5).setValue('60');
    if (pv[i][5] === '' || pv[i][5] == null) ps.getRange(i + 1, 6).setValue('60');
  }
  const gs = sh('Guards'), gv = gs.getDataRange().getValues();
  for (let i = 1; i < gv.length; i++) if (gv[i][0] !== '' && gv[i][8] !== '' && !gv[i][10]) {
    const salt = rnd().slice(0, 16);
    gs.getRange(i + 1, 9, 1, 4).setValues([['', gv[i][9] || 'No', hashPw(String(gv[i][8]), salt), salt]]);
  }
  p.setProperty('HDR', 'v6');
}

/* ---------- helpers ---------- */
function props() { return PropertiesService.getScriptProperties(); }
function getSS() {
  let s = SpreadsheetApp.getActiveSpreadsheet(); if (s) return s;
  const id = props().getProperty('SSID'); if (id) return SpreadsheetApp.openById(id);
  s = SpreadsheetApp.create('Mega Safe Security System'); props().setProperty('SSID', s.getId()); return s;
}
function sh(n) { return getSS().getSheetByName(n); }
function now() { return Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm:ss'); }
function fmt(v) { return v instanceof Date ? Utilities.formatDate(v, TZ, 'yyyy-MM-dd HH:mm:ss') : v; }
function rows(n) {
  const v = sh(n).getDataRange().getValues(), h = v.shift();
  return v.filter(r => r[0] !== '').map(r => { const o = {}; h.forEach((k, i) => o[k] = fmt(r[i])); return o; });
}
function tailRows(n, k) {
  const s = sh(n), last = s.getLastRow(); if (last < 2) return [];
  const st = Math.max(2, last - k + 1), v = s.getRange(st, 1, last - st + 1, S[n].length).getValues();
  return v.filter(r => r[0] !== '').map(r => { const o = {}; S[n].forEach((c, i) => o[c] = fmt(r[i])); return o; });
}
function add(n, o) {
  const s = sh(n), rg = s.getRange(s.getLastRow() + 1, 1, 1, S[n].length);
  rg.setNumberFormat('@'); rg.setValues([S[n].map(k => o[k] == null ? '' : String(o[k]).slice(0, 2000))]);
}
function rowIndex(n, key) {
  const c = sh(n).getRange(1, 1, sh(n).getLastRow(), 1).getValues();
  for (let i = 1; i < c.length; i++) if (String(c[i][0]) === String(key)) return i + 1;
  return -1;
}
function uid(n) { return (PFX[n] || 'X') + Utilities.formatDate(new Date(), TZ, 'yyMMddHHmmss') + Math.floor(Math.random() * 90 + 10); }
function saveImg(data, tag) {
  if (!data) return '';
  const m = String(data).match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+\/=]+)$/); if (!m) return '';
  const it = DriveApp.getFoldersByName(FOLDER), fo = it.hasNext() ? it.next() : DriveApp.createFolder(FOLDER);
  const f = fo.createFile(Utilities.newBlob(Utilities.base64Decode(m[2]), m[1], tag + '_' + now().replace(/[: ]/g, '-') + '.jpg'));
  f.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return 'https://drive.google.com/thumbnail?id=' + f.getId() + '&sz=w1000';
}

/* ---------- crypto: salted + peppered iterated HMAC, TOTP (RFC 6238) ---------- */
function b64(d) { return Utilities.base64EncodeWebSafe(d); }
function rnd() { return b64(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, Utilities.getUuid() + Utilities.getUuid() + Date.now() + Math.random())); }
function pepper() { let v = props().getProperty('PEPPER'); if (!v) { v = rnd(); props().setProperty('PEPPER', v); } return v; }
function hashPw(pw, salt) {
  const key = Utilities.newBlob(pepper() + salt).getBytes();
  let d = Utilities.computeHmacSha256Signature(Utilities.newBlob(String(pw)).getBytes(), key);
  for (let i = 0; i < 300; i++) d = Utilities.computeHmacSha256Signature(d, key);
  return b64(d);
}
function same(a, b) { a = String(a); b = String(b); if (a.length !== b.length) return false; let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i); return r === 0; }
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
function b32enc(by) { let bits = '', o = ''; by.forEach(b => bits += ((b & 255) + 256).toString(2).slice(1)); for (let i = 0; i < bits.length; i += 5) o += B32[parseInt(bits.substr(i, 5).padEnd(5, '0'), 2)]; return o; }
function b32dec(s) { let bits = ''; s.split('').forEach(c => bits += ('00000' + B32.indexOf(c).toString(2)).slice(-5)); const out = []; for (let i = 0; i + 8 <= bits.length; i += 8) { const v = parseInt(bits.substr(i, 8), 2); out.push(v > 127 ? v - 256 : v); } return out; }
function totp(secret, ctr) {
  const m = []; let c = ctr; for (let i = 7; i >= 0; i--) { m[i] = c & 255; c = Math.floor(c / 256); }
  const h = Utilities.computeHmacSignature(Utilities.MacAlgorithm.HMAC_SHA_1, m.map(x => x > 127 ? x - 256 : x), b32dec(secret)).map(x => x & 255);
  const o = h[19] & 15, n = ((h[o] & 127) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3];
  return String(n % 1000000).padStart(6, '0');
}
function newSecret() { return b32enc(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, Utilities.getUuid() + Utilities.getUuid() + Date.now()).slice(0, 20)); }
function checkTotp(id, secret, code) {
  const cur = Math.floor(Date.now() / 30000), p = props(), last = Number(p.getProperty('LC_' + id) || 0);
  code = String(code || '').replace(/\s/g, '');
  for (let w = -1; w <= 1; w++) if (cur + w > last && same(totp(secret, cur + w), code)) { p.setProperty('LC_' + id, String(cur + w)); return true; }
  return false;
}

/* ---------- audit, threats, realtime log sheet ---------- */
function san(v) { v = String(v == null ? '' : v).slice(0, 900); return /^[=+\-@]/.test(v) ? "'" + v : v; }
function audit(actor, action, target, detail) {
  try { add('AuditLog', {Time: now(), Actor: san(actor && actor.id ? actor.id : actor), Action: action, Target: san(target), Detail: san(detail)}); } catch (e) {}
}
function threat(level, type, actor, detail) {
  const r = {ID: String(Date.now()), Time: now(), Level: level, Type: type, Actor: san(actor), Detail: san(detail)};
  try { add('Threats', r); } catch (e) {}
  try { rtSheet().getSheetByName('Log').appendRow(S.Threats.map(k => r[k])); } catch (e) {}
}
function rtSheet() {
  const p = props(); let ss = null, id = p.getProperty('RT_ID');
  if (id) { try { ss = SpreadsheetApp.openById(id); } catch (e) {} }
  if (!ss) { ss = SpreadsheetApp.create('Mega Safe - Realtime Security Log'); p.setProperty('RT_ID', ss.getId()); const s = ss.getSheets()[0]; s.setName('Log'); s.appendRow(S.Threats); s.setFrozenRows(1); }
  return ss;
}
function monitor() {
  const c = CacheService.getScriptCache();
  tailRows('Attendance', 500).filter(x => !x.ClockOut).forEach(a => {
    const g = H.alarm({role: 'guard', id: a.GuardID, premise: a.Premise});
    if (g.on && Date.now() > g.due + 5 * 60000) {
      const k = 'PM_' + a.GuardID + '_' + g.due;
      if (!c.get(k)) { c.put(k, '1', 21600); threat('Medium', 'PATROL_MISSED', a.GuardID, a.Guard + ' @ ' + a.Premise + ' terlepas ronda'); }
    }
  });
}

/* ---------- sessions + RPC ---------- */
const PUBLIC = ['ping', 'login', 'verify2fa'], PASSIVE = ['alarm', 'feed'];
function auth(t, passive) {
  const c = CacheService.getScriptCache(), raw = t && c.get('t' + t);
  if (!raw) throw new Error('Sesi tamat. Sila log masuk semula.');
  const u = JSON.parse(raw);
  if (u.role === 'admin' && Date.now() - u.last > 30 * 60000) { c.remove('t' + t); throw new Error('Sesi tamat kerana tidak aktif.'); }
  if (!passive) { u.last = Date.now(); c.put('t' + t, JSON.stringify(u), 21600); }
  return u;
}
function rpc(fn, t, a) {
  try {
    a = JSON.parse(a || '{}');
    if (!H[fn]) throw new Error('Fungsi tidak sah');
    const u = PUBLIC.indexOf(fn) >= 0 ? null : auth(t, PASSIVE.indexOf(fn) >= 0);
    return JSON.stringify({data: H[fn](u, a, t)});
  } catch (e) { return JSON.stringify({error: String(e.message || e)}); }
}
function needAdmin(u) { if (u.role !== 'admin') { threat('High', 'UNAUTHORIZED', u.id, 'Cuba tindakan admin'); throw new Error('Akses admin sahaja.'); } }
function bad(id, type) {
  const c = CacheService.getScriptCache(), k = 'FL_' + id, n = Number(c.get(k) || 0) + 1; c.put(k, String(n), 900);
  if (n >= LOCK_MAX) { c.put('LK_' + id, '1', LOCK_SEC); c.remove(k); threat('High', 'ACCOUNT_LOCK', id, 'Dikunci 15 minit selepas ' + n + ' percubaan gagal'); }
  else threat(type === '2fa' ? 'Medium' : 'Low', type === '2fa' ? 'BAD_2FA' : 'LOGIN_FAIL', id, 'Percubaan ' + n + ' daripada ' + LOCK_MAX);
  throw new Error(type === '2fa' ? 'Kod pengesahan tidak sah.' : 'ID atau PIN tidak sah.');
}
function startSession(user) {
  const t = rnd(); user.last = Date.now();
  CacheService.getScriptCache().put('t' + t, JSON.stringify(user), 21600);
  audit(user, 'LOGIN', user.id, '');
  return {token: t, user: {role: user.role, id: user.id, name: user.name, premise: user.premise, shift: user.shift}};
}

const H = {
  ping() { return VER; },
  login(u, a) {
    if (!sh('Guards') || !sh('Threats')) setup();
    ensureHeaders();
    const id = String(a.id || '').trim().toLowerCase().slice(0, 40), pw = String(a.pin || '').slice(0, 200), c = CacheService.getScriptCache();
    if (!id || !pw) throw new Error('Isi ID dan kata laluan.');
    if (c.get('LK_' + id)) throw new Error('Akaun dikunci sementara. Cuba lagi dalam 15 minit.');
    let user = null, ok = false, two = false;
    if (id === 'admin') {
      const h = props().getProperty('ADMIN_HASH'), s = props().getProperty('ADMIN_SALT');
      if (!h) throw new Error('Admin belum disediakan. Ikut README: tetapkan INIT_ADMIN_PASSWORD dan jalankan setup().');
      ok = same(hashPw(pw, s), h); user = {role: 'admin', id: 'admin', name: 'Administrator'}; two = true;
    } else {
      const g = rows('Guards').find(x => String(x.StaffNo).toLowerCase() === id);
      const hh = hashPw(pw, g ? g.Salt : 'x');
      ok = !!(g && g.Status === 'Active' && g.PinHash && same(hh, g.PinHash));
      if (ok) { user = {role: 'guard', id: g.GuardID, name: g.Name, premise: g.Premise, shift: g.Shift}; two = g.TwoFA === 'Yes'; }
    }
    if (!ok) bad(id, 'pw');
    c.remove('FL_' + id);
    if (!two) return startSession(user);
    const sec = props().getProperty('TS_' + user.id), ticket = rnd(), rec = {user: user, lid: id, secret: sec || newSecret(), enroll: !sec, tries: 0};
    c.put('TK_' + ticket, JSON.stringify(rec), 300);
    if (sec) return {step: 'totp', ticket: ticket};
    return {step: 'enroll', ticket: ticket, secret: rec.secret, uri: 'otpauth://totp/Mega%20Safe:' + encodeURIComponent(user.name) + '?secret=' + rec.secret + '&issuer=Mega%20Safe&digits=6&period=30'};
  },
  verify2fa(u, a) {
    const c = CacheService.getScriptCache(), k = 'TK_' + a.ticket, raw = c.get(k);
    if (!raw) throw new Error('Sesi pengesahan tamat. Log masuk semula.');
    const r = JSON.parse(raw);
    if (c.get('LK_' + r.lid)) throw new Error('Akaun dikunci sementara.');
    if (!checkTotp(r.user.id, r.secret, a.code)) { r.tries++; if (r.tries >= 5) c.remove(k); else c.put(k, JSON.stringify(r), 300); bad(r.lid, '2fa'); }
    if (r.enroll) { props().setProperty('TS_' + r.user.id, r.secret); audit(r.user, '2FA_ENROL', r.user.id, 'Peranti pengesah didaftarkan'); }
    c.remove(k); return startSession(r.user);
  },
  logout(u, a, t) { CacheService.getScriptCache().remove('t' + t); audit(u, 'LOGOUT', u.id, ''); return true; },
  chpw(u, a) {
    needAdmin(u);
    const p = props(), np = String(a.next || '');
    if (!same(hashPw(String(a.cur || ''), p.getProperty('ADMIN_SALT')), p.getProperty('ADMIN_HASH'))) { threat('Medium', 'BAD_PW_CHANGE', 'admin', 'Kata laluan semasa salah'); throw new Error('Kata laluan semasa salah.'); }
    if (!checkTotp('admin', p.getProperty('TS_admin'), a.code)) { threat('Medium', 'BAD_2FA', 'admin', 'Tukar kata laluan'); throw new Error('Kod 2FA tidak sah.'); }
    if (np.length < 12) throw new Error('Kata laluan baharu mesti sekurang-kurangnya 12 aksara.');
    if (np === a.cur) throw new Error('Kata laluan baharu mesti berbeza.');
    const s = rnd().slice(0, 16); p.setProperty('ADMIN_SALT', s); p.setProperty('ADMIN_HASH', hashPw(np, s));
    audit(u, 'ADMIN_PASSWORD_CHANGE', 'admin', 'Kata laluan admin ditukar'); return true;
  },
  settings(u) {
    needAdmin(u);
    return {ver: VER, ss: getSS().getUrl(), rt: rtSheet().getUrl(), maps: !!props().getProperty('MAPS_KEY')};
  },
  reset2fa(u, a) { needAdmin(u); props().deleteProperty('TS_' + a.key); props().deleteProperty('LC_' + a.key); audit(u, '2FA_RESET', a.key, 'Admin set semula peranti pengesah'); return true; },
  list(u, a) {
    const n = a.sheet; if (!S[n]) throw new Error('Sheet tidak sah');
    const guardOk = ['Premises', 'Visitors', 'LogBook', 'Patrol', 'Attendance'];
    if (u.role !== 'admin' && guardOk.indexOf(n) < 0) { threat('High', 'UNAUTHORIZED', u.id, 'Akses ' + n); throw new Error('Akses ditolak.'); }
    let r = rows(n);
    if (u.role !== 'admin' && (n === 'Patrol' || n === 'Attendance')) r = r.filter(x => x.GuardID === u.id);
    if (u.role !== 'admin' && (n === 'Visitors' || n === 'LogBook')) r = r.filter(x => x.Premise === u.premise);
    if (u.role !== 'admin' && n === 'Premises') r = r.filter(x => x.Name === u.premise);
    const hide = SECRET[n] || [], cols = S[n].filter(c => hide.indexOf(c) < 0);
    r = r.map(x => { const o = {}; cols.forEach(c => o[c] = x[c]); return o; });
    if (['Patrol','Attendance','Visitors','LogBook','Complaints','AuditLog','Threats'].indexOf(n) >= 0) r.reverse();
    return {cols: cols, rows: r.slice(0, 500)};
  },
  save(u, a) {
    needAdmin(u);
    const n = a.sheet; if (!PFX[n]) throw new Error('Sheet tidak sah');
    const o = a.row, key = S[n][0];
    const old = o[key] ? rows(n).find(r => String(r[key]) === String(o[key])) : null;
    if (!o[key]) o[key] = uid(n);
    if (old) S[n].forEach(k => { if (o[k] == null && old[k] != null) o[k] = old[k]; });
    if (n === 'Premises') {
      const pm = parseInt(o.PatrolMin === '' || o.PatrolMin == null ? 60 : o.PatrolMin, 10), as = parseInt(o.AlarmSec === '' || o.AlarmSec == null ? 60 : o.AlarmSec, 10);
      if (!(pm >= 1 && pm <= 1440)) throw new Error('Selang ronda mesti antara 1 dan 1440 minit.');
      if (!(as >= 0 && as <= 3600)) throw new Error('Tempoh bunyi mesti antara 0 dan 3600 saat.');
      o.PatrolMin = pm; o.AlarmSec = as;
    }
    if (n === 'Checkpoints') o.QRCode = 'MSS|' + o.CPID;
    if (n === 'Guards') {
      if (!o.StaffNo || !o.Name) throw new Error('Nama dan No Staf wajib.');
      const dup = rows('Guards').find(g => String(g.StaffNo).toLowerCase() === String(o.StaffNo).toLowerCase() && g.GuardID !== o.GuardID);
      if (dup) throw new Error('No Staf sudah wujud.');
      const pin = String(o.PIN || '');
      if (pin) {
        if (!/^\d{6,12}$/.test(pin)) throw new Error('PIN mesti 6 hingga 12 digit.');
        o.Salt = rnd().slice(0, 16); o.PinHash = hashPw(pin, o.Salt); audit(u, 'PIN_SET', o.StaffNo, 'PIN pegawai ditetapkan');
      } else if (!old || !o.PinHash) throw new Error('PIN wajib untuk pegawai baharu (6-12 digit).');
      o.PIN = ''; o.TwoFA = o.TwoFA === 'Yes' ? 'Yes' : 'No';
    }
    const ch = []; S[n].forEach(k => {
      if ((SECRET[n] || []).indexOf(k) >= 0) return;
      const b = old ? String(old[k]) : '', c2 = String(o[k] == null ? '' : o[k]); if (!old || b !== c2) ch.push(k + ': ' + (old ? b + ' -> ' : '') + c2);
    });
    const i = rowIndex(n, o[key]);
    if (i > 0) sh(n).getRange(i, 1, 1, S[n].length).setValues([S[n].map(k => o[k] == null ? '' : String(o[k]))]); else add(n, o);
    audit(u, old ? 'EDIT' : 'CREATE', n + ':' + o[key], ch.join('; ')); return true;
  },
  del(u, a) {
    needAdmin(u);
    if (!PFX[a.sheet]) throw new Error('Sheet tidak sah');
    const i = rowIndex(a.sheet, a.key); if (i > 0) sh(a.sheet).deleteRow(i);
    if (a.sheet === 'Guards') { props().deleteProperty('TS_' + a.key); props().deleteProperty('LC_' + a.key); }
    audit(u, 'DELETE', a.sheet + ':' + a.key, ''); return true;
  },
  feed(u, a) {
    needAdmin(u);
    const t = tailRows('Threats', 300), since = Date.now() - 86400000, cnt = {}; let score = 0, high1 = false;
    const ev = t.filter(x => Number(x.ID) >= since);
    ev.forEach(x => { cnt[x.Type] = (cnt[x.Type] || 0) + 1; score += x.Level === 'High' ? 5 : x.Level === 'Medium' ? 2 : 1; if (x.Level === 'High' && Number(x.ID) > Date.now() - 3600000) high1 = true; });
    return {level: (high1 || score >= 15) ? 'High' : score >= 5 ? 'Medium' : 'Low', score: score, cnt: cnt, total: ev.length, latest: t.slice(-12).reverse(), max: t.length ? Number(t[t.length - 1].ID) : 0};
  },
  dash(u) {
    needAdmin(u);
    const today = now().slice(0, 10), pat = rows('Patrol'), g = rows('Guards'), pr = rows('Premises').filter(p => p.Status !== 'Inactive');
    const att = rows('Attendance').filter(x => x.Date === today);
    const tour = pr.map(p => {
      const last = pat.filter(x => x.Premise === p.Name).pop();
      const t = last ? new Date(last.Timestamp.replace(' ', 'T') + '+08:00').getTime() : 0;
      const onDuty = att.filter(x => x.Premise === p.Name && !x.ClockOut).length;
      const lim = new Date().getTime() - 2 * (parseInt(p.PatrolMin, 10) || 60) * 60000;
      return {premise: p.Name, last: last ? last.Timestamp : '-', status: !onDuty ? 'Understaffed' : (t < lim ? 'Critical' : 'OK')};
    });
    return {
      premises: pr.length, guards: g.filter(x => x.Status === 'Active').length, inactive: g.filter(x => x.Status !== 'Active').length,
      patrolToday: pat.filter(x => x.Timestamp.slice(0, 10) === today).length, onDuty: att.filter(x => !x.ClockOut).length,
      visitorsIn: rows('Visitors').filter(x => !x.TimeOut).length, complaints: rows('Complaints').filter(x => x.Status === 'Pending').length, tour: tour
    };
  },
  scan(u, a) {
    if (u.role !== 'guard') throw new Error('Untuk pegawai sahaja.');
    const cp = rows('Checkpoints').find(x => x.QRCode === String(a.code).trim() && x.Status !== 'Inactive');
    if (!cp) { threat('Medium', 'QR_INVALID', u.id, 'Kod QR tidak sah: ' + String(a.code).slice(0, 40)); throw new Error('Kod QR tidak sah atau checkpoint tidak aktif.'); }
    if (cp.Premise !== u.premise) { threat('Medium', 'QR_WRONG_PREMISE', u.id, u.name + ' mengimbas ' + cp.Name + ' (' + cp.Premise + ')'); throw new Error('Checkpoint ini bukan di premis anda (' + u.premise + ').'); }
    add('Patrol', {Timestamp: now(), GuardID: u.id, Guard: u.name, Premise: cp.Premise, Checkpoint: cp.Name, Lat: a.lat, Lng: a.lng, PhotoURL: saveImg(a.photo, 'patrol'), Remark: a.remark});
    return 'Berjaya: ' + cp.Name + ' (' + cp.Premise + ')';
  },
  clock(u, a) {
    if (u.role !== 'guard') throw new Error('Untuk pegawai sahaja.');
    const d = now().slice(0, 10), tm = now(), v = sh('Attendance').getDataRange().getValues();
    let idx = -1;
    for (let i = v.length - 1; i > 0; i--) if (v[i][1] === u.id && !v[i][6] && v[i][0] !== '') { idx = i + 1; break; }
    if (a.type === 'in') {
      if (idx > 0) throw new Error('Anda sudah clock in.');
      add('Attendance', {Date: d, GuardID: u.id, Guard: u.name, Premise: u.premise, Shift: u.shift, ClockIn: tm}); return 'Clock In ' + tm;
    }
    if (idx < 0) throw new Error('Tiada rekod clock in yang terbuka.');
    sh('Attendance').getRange(idx, 7).setValue(tm); return 'Clock Out ' + tm;
  },
  visitorAdd(u, a) {
    const o = a.row; o.VisitID = 'V' + Utilities.formatDate(new Date(), TZ, 'yyMMddHHmmss'); o.TimeIn = now(); o.Guard = u.name;
    o.Premise = u.role === 'guard' ? u.premise : o.Premise; o.PhotoURL = saveImg(a.photo, 'visitor'); o.TimeOut = ''; add('Visitors', o); return true;
  },
  visitorOut(u, a) {
    const v = rows('Visitors').find(x => x.VisitID === a.key); if (!v) throw new Error('Rekod tiada');
    if (u.role === 'guard' && v.Premise !== u.premise) { threat('High', 'UNAUTHORIZED', u.id, 'Visitor premis lain'); throw new Error('Akses ditolak.'); }
    sh('Visitors').getRange(rowIndex('Visitors', a.key), 11).setValue(now()); return true;
  },
  logAdd(u, a) {
    const o = a.row; o.Timestamp = now(); o.Guard = u.name; o.Premise = u.role === 'guard' ? u.premise : o.Premise; o.PhotoURL = saveImg(a.photo, 'log'); add('LogBook', o); return true;
  },
  alarm(u) {
    if (u.role !== 'guard') return {on: false, reason: 'admin', now: Date.now()};
    const pr = rows('Premises').find(p => p.Name === u.premise) || {}, iv = parseInt(pr.PatrolMin, 10) || 60;
    const sec = (pr.AlarmSec === '' || pr.AlarmSec == null) ? 60 : (parseInt(pr.AlarmSec, 10) || 0);
    const open = tailRows('Attendance', 300).filter(x => x.GuardID === u.id && !x.ClockOut).pop();
    if (!open) return {on: false, reason: 'clockin', now: Date.now()};
    const ms = s => new Date(String(s).replace(' ', 'T') + '+08:00').getTime();
    let base = ms(open.ClockIn); const lp = tailRows('Patrol', 300).filter(x => x.GuardID === u.id).pop();
    if (lp && ms(lp.Timestamp) > base) base = ms(lp.Timestamp);
    return {on: true, iv: iv, sec: sec, due: base + iv * 60000, now: Date.now()};
  },
  premises(u) { return rows('Premises').filter(p => p.Status !== 'Inactive').map(p => p.Name); },
  maps(u, a) {
    const q = String(a.q || '').trim().slice(0, 200); if (!q) throw new Error('Taip pertanyaan.');
    let m = q.match(/^(?:laluan|route|arah|directions?)\s+(?:dari|from)\s+(.+?)\s+(?:ke|to)\s+(.+)$/i);
    if (m) return mapRoute(m[1], m[2], a.mode);
    m = q.match(/^(?:cari|find|search)\s+(.+)$/i); if (m) return mapPlaces(m[1]);
    return {type: 'geocode', items: mapGeo(q)};
  }
};

/* ---------- Google Maps tools ---------- */
function mapGeo(q) {
  const r = Maps.newGeocoder().setRegion('my').geocode(q);
  return (r.results || []).slice(0, 5).map(x => ({name: x.formatted_address, lat: x.geometry.location.lat, lng: x.geometry.location.lng}));
}
function mapRoute(o, d, mode) {
  const M = Maps.DirectionFinder.Mode, md = M[String(mode || 'DRIVING').toUpperCase()] || M.DRIVING;
  const r = Maps.newDirectionFinder().setOrigin(o).setDestination(d).setMode(md).setRegion('my').getDirections();
  if (r.status !== 'OK' || !r.routes.length) throw new Error('Laluan tidak dijumpai (' + r.status + ').');
  const l = r.routes[0].legs[0];
  return {type: 'route', from: l.start_address, to: l.end_address, distance: l.distance.text, duration: l.duration.text,
    steps: l.steps.slice(0, 40).map(s => String(s.html_instructions).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() + ' (' + s.distance.text + ')'),
    url: 'https://www.google.com/maps/dir/?api=1&origin=' + encodeURIComponent(o) + '&destination=' + encodeURIComponent(d)};
}
function mapPlaces(q) {
  const k = props().getProperty('MAPS_KEY');
  if (!k) throw new Error('Carian tempat memerlukan MAPS_KEY (Places API) dalam Script properties. Lihat README.');
  const r = UrlFetchApp.fetch('https://places.googleapis.com/v1/places:searchText', {method: 'post', contentType: 'application/json', muteHttpExceptions: true,
    headers: {'X-Goog-Api-Key': k, 'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.location,places.rating,places.nationalPhoneNumber,places.googleMapsUri'},
    payload: JSON.stringify({textQuery: q, languageCode: 'ms', regionCode: 'MY', maxResultCount: 8})});
  const j = JSON.parse(r.getContentText());
  if (r.getResponseCode() !== 200) throw new Error('Places API: ' + ((j.error && j.error.message) || r.getResponseCode()));
  return {type: 'places', items: (j.places || []).map(p => ({name: p.displayName && p.displayName.text, addr: p.formattedAddress, lat: p.location && p.location.latitude, lng: p.location && p.location.longitude, rating: p.rating, tel: p.nationalPhoneNumber, url: p.googleMapsUri}))};
}

/* ---------- PAPARAN (dijana oleh scripts/build-single.js, jangan ubah) ---------- */
const LOGO = 'data:image/png;base64,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';
const PAGE_B64 = [
  'PCFET0NUWVBFIGh0bWw+CjxodG1sIGxhbmc9Im1zIj48aGVhZD48YmFzZSB0YXJnZXQ9Il90b3AiPjxtZXRhIGNoYXJzZXQ9InV0Zi04Ij4KPH',
  'RpdGxlPk1lZ2EgU2FmZSBTZWN1cml0eSBTZXJ2aWNlcyBTZG4gQmhkPC90aXRsZT4KPHN0eWxlPgo6cm9vdHstLW5hdnk6IzBhMWEzYTstLW5h',
  'dnkyOiMxMzI2NGY7LS1nb2xkOiNiODg2MmY7LS1yZWQ6I2UxMWQyYTstLWJnOiNmMmY0Zjg7LS1pbms6IzE0MjEzZDstLW11dDojNmI3Nzk0fQ',
  'oqe2JveC1zaXppbmc6Ym9yZGVyLWJveH1ib2R5e21hcmdpbjowO2ZvbnQ6MTRweC8xLjQ1ICJTZWdvZSBVSSIsUm9ib3RvLEFyaWFsLHNhbnMt',
  'c2VyaWY7Y29sb3I6dmFyKC0taW5rKTtiYWNrZ3JvdW5kOnZhcigtLWJnKX0KI2xvZ2lue21pbi1oZWlnaHQ6MTAwdmg7ZGlzcGxheTpncmlkO3',
  'BsYWNlLWl0ZW1zOmNlbnRlcjtiYWNrZ3JvdW5kOnZhcigtLW5hdnkpfQoubGJ7YmFja2dyb3VuZDojZmZmO3BhZGRpbmc6MjhweDtib3JkZXIt',
  'cmFkaXVzOjEwcHg7d2lkdGg6bWluKDM2MHB4LDkydncpO3RleHQtYWxpZ246Y2VudGVyO2JvcmRlci10b3A6NHB4IHNvbGlkIHZhcigtLXJlZC',
  'l9Ci5sYiBpbWd7aGVpZ2h0OjExMHB4fS5sYiBoMnttYXJnaW46OHB4IDAgMnB4O2ZvbnQtc2l6ZToxN3B4fS5sYiBwe21hcmdpbjowIDAgMTRw',
  'eDtjb2xvcjp2YXIoLS1tdXQpO2ZvbnQtc2l6ZToxMnB4fQppbnB1dCxzZWxlY3QsdGV4dGFyZWF7d2lkdGg6MTAwJTtwYWRkaW5nOjlweDtib3',
  'JkZXI6MXB4IHNvbGlkICNjZGQzZTA7Ym9yZGVyLXJhZGl1czo2cHg7Zm9udDppbmhlcml0O21hcmdpbjo0cHggMCA4cHg7YmFja2dyb3VuZDoj',
  'ZmZmfQpidXR0b257Y3Vyc29yOnBvaW50ZXI7Ym9yZGVyOjA7Ym9yZGVyLXJhZGl1czo2cHg7cGFkZGluZzo5cHggMTRweDtmb250OmluaGVyaX',
  'Q7Zm9udC13ZWlnaHQ6NjAwO2JhY2tncm91bmQ6dmFyKC0tZ29sZCk7Y29sb3I6I2ZmZn0KYnV0dG9uLnJ7YmFja2dyb3VuZDp2YXIoLS1yZWQp',
  'fWJ1dHRvbi5ne2JhY2tncm91bmQ6I2U1ZTlmMjtjb2xvcjp2YXIoLS1pbmspfWJ1dHRvbi5ze3BhZGRpbmc6NHB4IDlweDtmb250LXNpemU6MT',
  'JweH0KI2FwcHtkaXNwbGF5Om5vbmU7bWluLWhlaWdodDoxMDB2aH0KYXNpZGV7cG9zaXRpb246Zml4ZWQ7aW5zZXQ6MCBhdXRvIDAgMDt3aWR0',
  'aDoyMzBweDtiYWNrZ3JvdW5kOnZhcigtLW5hdnkpO2NvbG9yOiNjZmQ3ZWE7cGFkZGluZzoxNHB4IDA7b3ZlcmZsb3c6YXV0bzt0cmFuc2l0aW',
  '9uOi4yc30KYXNpZGUgLmJye2Rpc3BsYXk6ZmxleDtnYXA6MTBweDthbGlnbi1pdGVtczpjZW50ZXI7cGFkZGluZzowIDE2cHggMTRweDtib3Jk',
  'ZXItYm90dG9tOjFweCBzb2xpZCAjMjIzNzY1O2NvbG9yOiNmZmY7Zm9udC13ZWlnaHQ6NzAwO2ZvbnQtc2l6ZToxMnB4fQphc2lkZSAuYnIgaW',
  '1ne2hlaWdodDo0NnB4fWFzaWRlIGF7ZGlzcGxheTpibG9jaztwYWRkaW5nOjEwcHggMThweDtjdXJzb3I6cG9pbnRlcjtib3JkZXItbGVmdDoz',
  'cHggc29saWQgdHJhbnNwYXJlbnR9CmFzaWRlIGE6aG92ZXJ7YmFja2dyb3VuZDp2YXIoLS1uYXZ5Mil9YXNpZGUgYS5vbntiYWNrZ3JvdW5kOn',
  'ZhcigtLW5hdnkyKTtib3JkZXItY29sb3I6dmFyKC0tZ29sZCk7Y29sb3I6I2ZmZjtmb250LXdlaWdodDo2MDB9Cm1haW57bWFyZ2luLWxlZnQ6',
  'MjMwcHh9aGVhZGVye2JhY2tncm91bmQ6I2ZmZjtwYWRkaW5nOjEwcHggMThweDtkaXNwbGF5OmZsZXg7anVzdGlmeS1jb250ZW50OnNwYWNlLW',
  'JldHdlZW47YWxpZ24taXRlbXM6Y2VudGVyO2JvcmRlci1ib3R0b206MXB4IHNvbGlkICNkZGUyZWU7cG9zaXRpb246c3RpY2t5O3RvcDowO3ot',
  'aW5kZXg6NX0KaGVhZGVyIGJ7Y29sb3I6dmFyKC0tbmF2eSl9I21lbnV7ZGlzcGxheTpub25lfSNje3BhZGRpbmc6MThweH0KLmt7ZGlzcGxheT',
  'pncmlkO2dyaWQtdGVtcGxhdGUtY29sdW1uczpyZXBlYXQoYXV0by1maXQsbWlubWF4KDE3MHB4LDFmcikpO2dhcDoxMnB4O21hcmdpbi1ib3R0',
  'b206MTZweH0KLmNhcmR7YmFja2dyb3VuZDojZmZmO2JvcmRlci1yYWRpdXM6OHB4O3BhZGRpbmc6MTRweDtib3JkZXI6MXB4IHNvbGlkICNlMG',
  'U1ZjB9LmsgLmNhcmQgYntmb250LXNpemU6MjhweDtkaXNwbGF5OmJsb2NrfS5rIC5jYXJkIHNwYW57Y29sb3I6dmFyKC0tbXV0KTtmb250LXNp',
  'emU6MTJweH0KLmsgLmNhcmQuYWx7Ym9yZGVyLXRvcDozcHggc29saWQgdmFyKC0tcmVkKX0KLnR3e292ZXJmbG93OmF1dG87YmFja2dyb3VuZD',
  'ojZmZmO2JvcmRlcjoxcHggc29saWQgI2UwZTVmMDtib3JkZXItcmFkaXVzOjhweH10YWJsZXtib3JkZXItY29sbGFwc2U6Y29sbGFwc2U7d2lk',
  'dGg6MTAwJTttaW4td2lkdGg6NTYwcHh9CnRoe2JhY2tncm91bmQ6dmFyKC0tbmF2eSk7Y29sb3I6I2ZmZjt0ZXh0LWFsaWduOmxlZnQ7cGFkZG',
  'luZzo4cHggMTBweDtmb250LXdlaWdodDo2MDA7d2hpdGUtc3BhY2U6bm93cmFwfXRke3BhZGRpbmc6N3B4IDEwcHg7Ym9yZGVyLXRvcDoxcHgg',
  'c29saWQgI2VkZjBmNjt2ZXJ0aWNhbC1hbGlnbjptaWRkbGV9CnRyOm50aC1jaGlsZChldmVuKSB0ZHtiYWNrZ3JvdW5kOiNmOGY5ZmN9LnRie2',
  'Rpc3BsYXk6ZmxleDtnYXA6OHB4O21hcmdpbjowIDAgMTBweDtmbGV4LXdyYXA6d3JhcDthbGlnbi1pdGVtczpjZW50ZXJ9LnRiIGlucHV0e21h',
  'eC13aWR0aDoyNjBweDttYXJnaW46MH0KLmJke3BhZGRpbmc6MnB4IDhweDtib3JkZXItcmFkaXVzOjEwcHg7Zm9udC1zaXplOjExcHg7Zm9udC',
  '13ZWlnaHQ6NzAwO2NvbG9yOiNmZmZ9Lk9LLC5BY3RpdmUsLkxvd3tiYWNrZ3JvdW5kOiMxNmEzNGF9LkNyaXRpY2FsLC5JbmFjdGl2ZSwuSGln',
  'aHtiYWNrZ3JvdW5kOnZhcigtLXJlZCl9LlVuZGVyc3RhZmZlZCwuUGVuZGluZywuTWVkaXVte2JhY2tncm91bmQ6I2Q5NzcwNn0KLnRoe2hlaW',
  'dodDo0NHB4O2JvcmRlci1yYWRpdXM6NHB4O2N1cnNvcjp6b29tLWlufQojbWR7cG9zaXRpb246Zml4ZWQ7aW5zZXQ6MDtiYWNrZ3JvdW5kOiMw',
  'MDA5O2Rpc3BsYXk6bm9uZTtwbGFjZS1pdGVtczpjZW50ZXI7ei1pbmRleDoyMDtwYWRkaW5nOjEycHh9I21kPmRpdntiYWNrZ3JvdW5kOiNmZm',
  'Y7Ym9yZGVyLXJhZGl1czoxMHB4O3BhZGRpbmc6MThweDt3aWR0aDptaW4oNDgwcHgsMTAwJSk7bWF4LWhlaWdodDo5MnZoO292ZXJmbG93OmF1',
  'dG99CiNhbG1CYXJ7cG9zaXRpb246Zml4ZWQ7dG9wOjA7bGVmdDowO3JpZ2h0OjA7ei1pbmRleDo0MDtiYWNrZ3JvdW5kOnZhcigtLXJlZCk7Y2',
  '9sb3I6I2ZmZjtwYWRkaW5nOjEycHggMTZweDtkaXNwbGF5Om5vbmU7anVzdGlmeS1jb250ZW50OnNwYWNlLWJldHdlZW47YWxpZ24taXRlbXM6',
  'Y2VudGVyO2dhcDoxMHB4O2ZsZXgtd3JhcDp3cmFwO2ZvbnQtc2l6ZToxNXB4fSNhbG1CYXIgYnV0dG9ue2JhY2tncm91bmQ6I2ZmZjtjb2xvcj',
  'p2YXIoLS1yZWQpfSNhbG1CYXIgYnV0dG9uLmd7YmFja2dyb3VuZDojZmZmZmZmMzM7Y29sb3I6I2ZmZn0KI3RvYXN0e3Bvc2l0aW9uOmZpeGVk',
  'O2JvdHRvbToxNnB4O2xlZnQ6NTAlO3RyYW5zZm9ybTp0cmFuc2xhdGVYKC01MCUpO2JhY2tncm91bmQ6dmFyKC0tbmF2eSk7Y29sb3I6I2ZmZj',
  'twYWRkaW5nOjEwcHggMTZweDtib3JkZXItcmFkaXVzOjhweDtkaXNwbGF5Om5vbmU7ei1pbmRleDozMDttYXgtd2lkdGg6OTB2d30KbGFiZWx7',
  'Zm9udC1zaXplOjEycHg7Y29sb3I6dmFyKC0tbXV0KTtmb250LXdlaWdodDo2MDB9LmJpZ3tkaXNwbGF5OmdyaWQ7Z3JpZC10ZW1wbGF0ZS1jb2',
  'x1bW5zOjFmciAxZnI7Z2FwOjEwcHg7bWFyZ2luLWJvdHRvbToxMnB4fS5iaWcgYnV0dG9ue3BhZGRpbmc6MThweH0KQG1lZGlhKG1heC13aWR0',
  'aDo4MDBweCl7YXNpZGV7dHJhbnNmb3JtOnRyYW5zbGF0ZVgoLTEwMCUpO3otaW5kZXg6MTV9YXNpZGUub3t0cmFuc2Zvcm06bm9uZX1tYWlue2',
  '1hcmdpbi1sZWZ0OjB9I21lbnV7ZGlzcGxheTppbmxpbmUtYmxvY2t9fQo8L3N0eWxlPjwvaGVhZD48Ym9keT4KPGRpdiBpZD0ibG9naW4iPjxk',
  'aXYgY2xhc3M9ImxiIj48aW1nIHNyYz0iX19MT0dPX18iIGFsdD0iTWVnYSBTYWZlIj48aDI+TWVnYSBTYWZlIFNlY3VyaXR5IFNlcnZpY2VzIF',
  'NkbiBCaGQ8L2gyPjxwPkd1YXJkIFRvdXIsIFZpc2l0b3IgUmVnaXN0ZXIgJmFtcDsgU2VjdXJpdHkgTG9nIEJvb2s8L3A+CjxpbnB1dCBpZD0i',
  'bGlkIiBwbGFjZWhvbGRlcj0iTm8gU3RhZiAvIGFkbWluIiBhdXRvY29tcGxldGU9InVzZXJuYW1lIj48aW5wdXQgaWQ9ImxwdyIgdHlwZT0icG',
  'Fzc3dvcmQiIHBsYWNlaG9sZGVyPSJQSU4iIGF1dG9jb21wbGV0ZT0iY3VycmVudC1wYXNzd29yZCIgb25rZXlkb3duPSJpZihldmVudC5rZXk9',
  'PSdFbnRlcicpZG9Mb2dpbigpIj48YnV0dG9uIGlkPSJsYnRuIiB0eXBlPSJidXR0b24iIHN0eWxlPSJ3aWR0aDoxMDAlIj5Mb2cgTWFzdWs8L2',
  'J1dHRvbj48ZGl2IGlkPSJsMiIgc3R5bGU9ImRpc3BsYXk6bm9uZSI+PGRpdiBpZD0iZW5yIiBzdHlsZT0iZm9udC1zaXplOjEycHg7Y29sb3I6',
  'IzZiNzc5NDt0ZXh0LWFsaWduOmxlZnQiPjwvZGl2PjxpbnB1dCBpZD0ibGNvZGUiIGlucHV0bW9kZT0ibnVtZXJpYyIgYXV0b2NvbXBsZXRlPS',
  'JvbmUtdGltZS1jb2RlIiBtYXhsZW5ndGg9IjgiIHBsYWNlaG9sZGVyPSJLb2QgNiBkaWdpdCI+PGJ1dHRvbiBpZD0ibGJ0bjIiIHR5cGU9ImJ1',
  'dHRvbiIgc3R5bGU9IndpZHRoOjEwMCUiPlNhaGthbjwvYnV0dG9uPjwvZGl2Pgo8cHJlIGlkPSJkYmciIHN0eWxlPSJkaXNwbGF5Om5vbmU7dG',
  'V4dC1hbGlnbjpsZWZ0O2ZvbnQtc2l6ZToxMHB4O2NvbG9yOiM2Yjc3OTQ7d2hpdGUtc3BhY2U6cHJlLXdyYXA7bWFyZ2luOjhweCAwIDAiPjwv',
  'cHJlPjxkaXYgaWQ9Imxtc2ciIHN0eWxlPSJjb2xvcjojZTExZDJhO2ZvbnQtc2l6ZToxM3B4O21hcmdpbi10b3A6MTBweDttaW4taGVpZ2h0Oj',
  'E4cHgiPjwvZGl2PjwvZGl2PjwvZGl2Pgo8ZGl2IGlkPSJhcHAiPjxhc2lkZSBpZD0ic2QiPjxkaXYgY2xhc3M9ImJyIj48aW1nIHNyYz0iX19M',
  'T0dPX18iPjxzcGFuPk1FR0EgU0FGRTxicj5TRUNVUklUWSBTRVJWSUNFUzwvc3Bhbj48L2Rpdj48bmF2IGlkPSJuYXYiPjwvbmF2PjwvYXNpZG',
  'U+CjxtYWluPjxoZWFkZXI+PGRpdj48YnV0dG9uIGlkPSJtZW51IiBjbGFzcz0iZyBzIiBvbmNsaWNrPSJzZC5jbGFzc0xpc3QudG9nZ2xlKCdv',
  'JykiPuKYsDwvYnV0dG9uPiA8YiBpZD0idHRsIj48L2I+PC9kaXY+PGRpdj48c3BhbiBpZD0iYWxtSGRyIiBzdHlsZT0iY29sb3I6dmFyKC0tcm',
  'VkKTtmb250LXdlaWdodDo3MDA7bWFyZ2luLXJpZ2h0OjhweCI+PC9zcGFuPjxzcGFuIGlkPSJ1c3IiPjwvc3Bhbj4gPGJ1dHRvbiBjbGFzcz0i',
  'ZyBzIiBvbmNsaWNrPSJkb0xvZ291dCgpIj5LZWx1YXI8L2J1dHRvbj48L2Rpdj48L2hlYWRlcj48ZGl2IGlkPSJjIj48L2Rpdj48L21haW4+PC',
  '9kaXY+CjxkaXYgaWQ9ImFsbUJhciI+PGI+4o+wIE1hc2Egcm9uZGEhIEltYmFzIGNoZWNrcG9pbnQgc2VrYXJhbmcuPC9iPjxzcGFuPjxidXR0',
  'b24gb25jbGljaz0iYWxtR28oKSI+SW1iYXMgc2VrYXJhbmc8L2J1dHRvbj48L3NwYW4+PC9kaXY+CjxkaXYgaWQ9Im1kIj48ZGl2IGlkPSJtYi',
  'I+PC9kaXY+PC9kaXY+PGRpdiBpZD0idG9hc3QiPjwvZGl2Pgo8c2NyaXB0IHNyYz0iaHR0cHM6Ly9jZG4uanNkZWxpdnIubmV0L25wbS9odG1s',
  'NS1xcmNvZGVAMi4zLjgvaHRtbDUtcXJjb2RlLm1pbi5qcyI+PC9zY3JpcHQ+CjxzY3JpcHQgc3JjPSJodHRwczovL2Nkbi5qc2RlbGl2ci5uZX',
  'QvbnBtL3FyY29kZS1nZW5lcmF0b3JAMS40LjQvcXJjb2RlLm1pbi5qcyI+PC9zY3JpcHQ+CjxzY3JpcHQ+CmxldCBULFUsUEFHRSxQUkVNPVtd',
  'LFFSPW51bGw7CmNvbnN0ICQ9cz0+ZG9jdW1lbnQucXVlcnlTZWxlY3RvcihzKSxlc2M9cz0+U3RyaW5nKHM9PW51bGw/Jyc6cykucmVwbGFjZS',
  'gvWyY8PiJdL2csYz0+KHsnJic6JyZhbXA7JywnPCc6JyZsdDsnLCc+JzonJmd0OycsJyInOicmcXVvdDsnfVtjXSkpOwpmdW5jdGlvbiB0b2Fz',
  'dChtKXt2YXIgbD1kb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnbG1zZycpO2lmKGwmJmRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdsb2dpbicpLn',
  'N0eWxlLmRpc3BsYXkhPSdub25lJylsLnRleHRDb250ZW50PW07Y29uc3QgdD0kKCcjdG9hc3QnKTt0LnRleHRDb250ZW50PW07dC5zdHlsZS5k',
  'aXNwbGF5PSdibG9jayc7Y2xlYXJUaW1lb3V0KHQuX3QpO3QuX3Q9c2V0VGltZW91dCgoKT0+dC5zdHlsZS5kaXNwbGF5PSdub25lJyw0MDAwKX',
  '0KdmFyIEVYRUM9J19fRVhFQ19fJyxUUj0nZ3NyJzsKZnVuY3Rpb24gdmlhRmV0Y2goZm4sYSl7cmV0dXJuIGZldGNoKEVYRUMse21ldGhvZDon',
  'UE9TVCcsaGVhZGVyczp7J0NvbnRlbnQtVHlwZSc6J3RleHQvcGxhaW47Y2hhcnNldD11dGYtOCd9LGJvZHk6SlNPTi5zdHJpbmdpZnkoe2ZuOm',
  'ZuLHQ6VHx8JycsYTpKU09OLnN0cmluZ2lmeShhfHx7fSl9KX0pLnRoZW4ocj0+ci50ZXh0KCkpfQpmdW5jdGlvbiBycGMoZm4sYSxtcyl7cmV0',
  'dXJuIG5ldyBQcm9taXNlKHI9Pnt2YXIgZD0wLHRvPXNldFRpbWVvdXQoKCk9PntpZighZCl7ZD0xO3RvYXN0KCdUaWFkYSByZXNwb25zIGRhcm',
  'kgc2VydmVyLicpO3IobnVsbCl9fSxtc3x8NjAwMDApOwogdmFyIG9rPXg9PntpZihkKXJldHVybjtkPTE7Y2xlYXJUaW1lb3V0KHRvKTt0cnl7',
  'eD1KU09OLnBhcnNlKHgpfWNhdGNoKGUpe3RvYXN0KCdSZXNwb25zIHNlcnZlciB0aWRhayBzYWguIFNlbWFrIGRlcGxveW1lbnQuJyk7cmV0dX',
  'JuIHIobnVsbCl9aWYoeC5lcnJvcil7dG9hc3QoeC5lcnJvcik7cihudWxsKX1lbHNlIHIoeC5kYXRhKX07CiB2YXIgYmFkPWU9PntpZihkKXJl',
  'dHVybjtkPTE7Y2xlYXJUaW1lb3V0KHRvKTt0b2FzdCgoZSYmZS5tZXNzYWdlKXx8U3RyaW5nKGUpKTtyKG51bGwpfTsKIGlmKFRSPT0nZmV0Y2',
  'gnKXZpYUZldGNoKGZuLGEpLnRoZW4ob2spLmNhdGNoKGJhZCk7ZWxzZSBnb29nbGUuc2NyaXB0LnJ1bi53aXRoU3VjY2Vzc0hhbmRsZXIob2sp',
  'LndpdGhGYWlsdXJlSGFuZGxlcihiYWQpLnJwYyhmbixUfHwnJyxKU09OLnN0cmluZ2lmeShhfHx7fSkpfSl9CmNvbnN0IExCTD17UElOOidQSU',
  '4gYmFoYXJ1ICg2LTEyIGRpZ2l0LCBrb3NvbmdrYW4gamlrYSB0aWRhayBkaXR1a2FyKScsVHdvRkE6J1dhamliIDJGQSB1bnR1ayBwZWdhd2Fp',
  'IGluaScsUGF0cm9sTWluOidTZWxhbmcgcm9uZGEgKG1pbml0KScsQWxhcm1TZWM6J1RlbXBvaCBidW55aSBhbGFybSAoc2FhdCwgMCA9IHNlaG',
  'luZ2dhIHJvbmRhIGRpYnVhdCknfTsKY29uc3QgUEc9ewogZGFzaDp7dDonRGFzaGJvYXJkJyxyOidhJ30sdGVybTp7dDonVGVybWluYWwgUGVn',
  'YXdhaScscjonZyd9LAogR3VhcmRzOnt0OidIUiAtIFBlZ2F3YWknLHI6J2EnLGU6MSxmOlsnTmFtZScsJ1N0YWZmTm8nLCdQaG9uZScsJ0VtYW',
  'lsJywnUHJlbWlzZTpAUCcsJ1NoaWZ0OlNoaWZ0MXxTaGlmdDJ8U2hpZnQzJywnU3RhdHVzOkFjdGl2ZXxJbmFjdGl2ZScsJ1R3b0ZBOk5vfFll',
  'cycsJ1BJTjpAUyddfSwKIFByZW1pc2VzOnt0OidQcmVtaXMnLHI6J2EnLGU6MSxmOlsnTmFtZScsJ0FkZHJlc3MnLCdQYXRyb2xNaW46QE4nLC',
  'dBbGFybVNlYzpATicsJ1N0YXR1czpBY3RpdmV8SW5hY3RpdmUnXX0sCiBDaGVja3BvaW50czp7dDonQ2hlY2twb2ludCAmIFFSJyxyOidhJyxl',
  'OjEsZjpbJ1ByZW1pc2U6QFAnLCdOYW1lJywnU3RhdHVzOkFjdGl2ZXxJbmFjdGl2ZSddfSwKIFBhdHJvbDp7dDonTGFwb3JhbiBSb25kYWFuJy',
  'xyOidhZyd9LEF0dGVuZGFuY2U6e3Q6J0tlaGFkaXJhbicscjonYWcnfSwKIFZpc2l0b3JzOnt0OidEYWZ0YXIgUGVsYXdhdCAoVk1TKScscjon',
  'YWcnLHY6MX0sTG9nQm9vazp7dDonU2VjdXJpdHkgTG9nIEJvb2snLHI6J2FnJyxsOjF9LAogQ29tcGxhaW50czp7dDonQWR1YW4nLHI6J2EnLG',
  'U6MSxmOlsnRGF0ZTpARCcsJ1ByZW1pc2U6QFAnLCdEZXNjcmlwdGlvbjpAVCcsJ1N0YXR1czpQZW5kaW5nfEp1c3RpZmllZHxBcHByb3ZlZHxS',
  'ZWplY3RlZCddfSwKIG1hcHM6e3Q6J1BldGEgJiBMYWx1YW4nLHI6J2FnJ30sQXVkaXRMb2c6e3Q6J0xvZyBBdWRpdCcscjonYSd9LFRocmVhdH',
  'M6e3Q6J0xvZyBBbmNhbWFuJyxyOidhJ30sc2V0dGluZ3M6e3Q6J1RldGFwYW4nLHI6J2EnfX07CndpbmRvdy5hZGRFdmVudExpc3RlbmVyKCd1',
  'bmhhbmRsZWRyZWplY3Rpb24nLGZ1bmN0aW9uKGUpe2xnKCdSQUxBVDogJysoZS5yZWFzb24mJmUucmVhc29uLm1lc3NhZ2V8fGUucmVhc29uKS',
  'l9KTsKd2luZG93Lm9uZXJyb3I9ZnVuY3Rpb24obSxzLGwpe2xnKCdSQUxBVCBKUzogJyttKycgYicrbCk7dmFyIHQ9ZG9jdW1lbnQuZ2V0RWxl',
  'bWVudEJ5SWQoJ3RvYXN0Jyk7dC50ZXh0Q29udGVudD0nUmFsYXQgSlM6ICcrbSsnIChiYXJpcyAnK2wrJyknO3Quc3R5bGUuZGlzcGxheT0nYm',
  'xvY2snfTsKCnZhciBBTE09e29uOmZhbHNlLGl2OjAsc2VjOjAsZHVlOjAsb2ZmOjAsbGI6MCxhYzpudWxsLHdsOm51bGwsd2h5OicnfTsKZnVu',
  'Y3Rpb24gYXVkaW9DdHgoKXt0cnl7dmFyIEE9d2luZG93LkF1ZGlvQ29udGV4dHx8d2luZG93LndlYmtpdEF1ZGlvQ29udGV4dDtpZighQUxNLm',
  'FjJiZBKUFMTS5hYz1uZXcgQSgpO2lmKEFMTS5hYyYmQUxNLmFjLnN0YXRlPT0nc3VzcGVuZGVkJylBTE0uYWMucmVzdW1lKCl9Y2F0Y2goZSl7',
  'fX0KZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLGF1ZGlvQ3R4KTtkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCd0b3VjaHN0YX',
  'J0JyxhdWRpb0N0eCk7CmZ1bmN0aW9uIGJlZXAobil7YXVkaW9DdHgoKTt0cnl7dmFyIGE9QUxNLmFjO2Zvcih2YXIgaT0wO2k8KG58fDMpO2kr',
  'Kyl7dmFyIG89YS5jcmVhdGVPc2NpbGxhdG9yKCksZz1hLmNyZWF0ZUdhaW4oKTtvLnR5cGU9J3NxdWFyZSc7by5mcmVxdWVuY3kudmFsdWU9OD',
  'gwO2cuZ2Fpbi52YWx1ZT0uMjU7by5jb25uZWN0KGcpO2cuY29ubmVjdChhLmRlc3RpbmF0aW9uKTtvLnN0YXJ0KGEuY3VycmVudFRpbWUraSou',
  'MzUpO28uc3RvcChhLmN1cnJlbnRUaW1lK2kqLjM1Ky4yNSl9fWNhdGNoKGUpe310cnl7bmF2aWdhdG9yLnZpYnJhdGUmJm5hdmlnYXRvci52aW',
  'JyYXRlKFszMDAsMTUwLDMwMCwxNTAsMzAwXSl9Y2F0Y2goZSl7fX0KYXN5bmMgZnVuY3Rpb24gd2FrZSgpe3RyeXtpZihuYXZpZ2F0b3Iud2Fr',
  'ZUxvY2smJkFMTS5vbiYmIUFMTS53bClBTE0ud2w9YXdhaXQgbmF2aWdhdG9yLndha2VMb2NrLnJlcXVlc3QoJ3NjcmVlbicpfWNhdGNoKGUpe3',
  '19CmFzeW5jIGZ1bmN0aW9uIGFsbVN5bmMoKXtpZighVXx8VS5yb2xlIT0nZ3VhcmQnfHwhVClyZXR1cm47dmFyIGQ9YXdhaXQgcnBjKCdhbGFy',
  'bScpO2lmKCFkKXJldHVybjtBTE0ub249ISFkLm9uO0FMTS53aHk9ZC5yZWFzb258fCcnO2lmKGQub24pe0FMTS5pdj1kLml2O0FMTS5zZWM9ZC',
  '5zZWM7QUxNLmR1ZT1kLmR1ZTtBTE0ub2ZmPWQubm93LURhdGUubm93KCk7d2FrZSgpfWFsbVRpY2soKX0KZnVuY3Rpb24gYWxtU3RvcCgpe0FM',
  'TS5vbj1mYWxzZTtBTE0ud2h5PScnO3RyeXtBTE0ud2wmJkFMTS53bC5yZWxlYXNlKCl9Y2F0Y2goZSl7fUFMTS53bD1udWxsO3ZhciBiPWRvY3',
  'VtZW50LmdldEVsZW1lbnRCeUlkKCdhbG1CYXInKTtpZihiKWIuc3R5bGUuZGlzcGxheT0nbm9uZSc7dmFyIGg9ZG9jdW1lbnQuZ2V0RWxlbWVu',
  'dEJ5SWQoJ2FsbUhkcicpO2lmKGgpaC50ZXh0Q29udGVudD0nJ30KZnVuY3Rpb24gYWxtR28oKXtzY2FuVUkoKX0KZnVuY3Rpb24gYWxtVGljay',
  'gpe3ZhciB0PWRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdhbG1UeHQnKSxoPWRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdhbG1IZHInKSxiYXI9',
  'ZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2FsbUJhcicpLHg9Jycsc3Q9J0FsYXJtIGJlcm11bGEgc2VsZXBhcyBDbG9jayBJbi4nOwogaWYoVS',
  'YmVS5yb2xlPT0nZ3VhcmQnKXsKICBpZighQUxNLm9uKXtiYXIuc3R5bGUuZGlzcGxheT0nbm9uZSc7eD0nJ30KICBlbHNle3ZhciBub3c9RGF0',
  'ZS5ub3coKStBTE0ub2ZmLGw9QUxNLmR1ZS1ub3c7CiAgIGlmKGw+MCl7YmFyLnN0eWxlLmRpc3BsYXk9J25vbmUnO3ZhciBzPU1hdGguY2VpbC',
  'hsLzEwMDApLGhoPU1hdGguZmxvb3Iocy8zNjAwKSxtbT1NYXRoLmZsb29yKHMlMzYwMC82MCksc3M9cyU2MDt4PSdSb25kYSBzZXRlcnVzbnlh',
  'ICcrKGhoP2hoKyc6JzonJykrU3RyaW5nKG1tKS5wYWRTdGFydCgyLCcwJykrJzonK1N0cmluZyhzcykucGFkU3RhcnQoMiwnMCcpO3N0PSdTZW',
  'xhbmcgcm9uZGE6ICcrQUxNLml2KycgbWluaXQgKGRpdGV0YXBrYW4gYWRtaW4pLid9CiAgIGVsc2V7YmFyLnN0eWxlLmRpc3BsYXk9J2ZsZXgn',
  'O3ZhciBvdmVyPW5vdy1BTE0uZHVlO2lmKEFMTS5zZWM9PTB8fG92ZXI8QUxNLnNlYyoxMDAwKXtpZihEYXRlLm5vdygpLUFMTS5sYj44MDAwKX',
  'tBTE0ubGI9RGF0ZS5ub3coKTtiZWVwKDMpfXg9J+KPsCBNQVNBIFJPTkRBISd9ZWxzZSB4PSfij7AgUk9OREEgVEVSTEVQQVMgJytNYXRoLmZs',
  'b29yKG92ZXIvNjAwMDApKycgbWluJztzdD0nQWxhcm0gaGFueWEgYmVyaGVudGkgc2VsZXBhcyBhbmRhIG1lbmdpbWJhcyBjaGVja3BvaW50Li',
  'd9fX0KIGlmKHQpdC5pbm5lckhUTUw9KHg/JzxkaXYgc3R5bGU9ImZvbnQtc2l6ZToxOHB4O2ZvbnQtd2VpZ2h0OjcwMCI+Jyt4Kyc8L2Rpdj4n',
  'OicnKSsnPGRpdiBzdHlsZT0iY29sb3I6dmFyKC0tbXV0KTtmb250LXdlaWdodDo0MDA7Zm9udC1zaXplOjEycHg7bWFyZ2luLXRvcDoycHgiPi',
  'crc3QrJzwvZGl2Pic7aWYoaCloLnRleHRDb250ZW50PXh9CnNldEludGVydmFsKGFsbVRpY2ssMTAwMCk7c2V0SW50ZXJ2YWwoYWxtU3luYyw2',
  'MDAwMCk7ZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcigndmlzaWJpbGl0eWNoYW5nZScsZnVuY3Rpb24oKXtpZighZG9jdW1lbnQuaGlkZGVuKX',
  't3YWtlKCk7YWxtU3luYygpfX0pOwoKdmFyIFRIUj17b246MCxtYXg6LTF9OwpmdW5jdGlvbiB0aHJTdGFydCgpe1RIUi5tYXg9LTE7VEhSLm9u',
  'Kys7dGhyUG9sbChUSFIub24pfQphc3luYyBmdW5jdGlvbiB0aHJQb2xsKGlkKXtpZihpZCE9PVRIUi5vbnx8UEFHRSE9J2Rhc2gnfHwhVSlyZX',
  'R1cm47Y29uc3QgZD1hd2FpdCBycGMoJ2ZlZWQnKTtpZighZClyZXR1cm47aWYoaWQ9PT1USFIub24mJlBBR0U9PSdkYXNoJyl7dGhyUmVuZGVy',
  'KGQpO2lmKFRIUi5tYXg+PTAmJmQubWF4PlRIUi5tYXgmJmQubGF0ZXN0WzBdJiZkLmxhdGVzdFswXS5MZXZlbD09J0hpZ2gnKWJlZXAoMyk7VE',
  'hSLm1heD1kLm1heH1zZXRUaW1lb3V0KCgpPT50aHJQb2xsKGlkKSw1MDAwKX0KZnVuY3Rpb24gdGhyUmVuZGVyKGQpe3ZhciBlbD0kKCcjdGhy',
  'Jyk7aWYoIWVsKXJldHVybjt2YXIgY3M9T2JqZWN0LmtleXMoZC5jbnQpLm1hcChrPT5gPGRpdiBjbGFzcz0iY2FyZCI+PGI+JHtkLmNudFtrXX',
  '08L2I+PHNwYW4+JHtlc2Moayl9PC9zcGFuPjwvZGl2PmApLmpvaW4oJycpfHwnPGRpdiBzdHlsZT0iY29sb3I6dmFyKC0tbXV0KSI+VGlhZGEg',
  'YW5jYW1hbiBkaWtlc2FuIGRhbGFtIDI0IGphbS48L2Rpdj4nOwogZWwuaW5uZXJIVE1MPWA8ZGl2IGNsYXNzPSJjYXJkIiBzdHlsZT0ibWFyZ2',
  'luLWJvdHRvbToxNHB4Ij48ZGl2IHN0eWxlPSJkaXNwbGF5OmZsZXg7anVzdGlmeS1jb250ZW50OnNwYWNlLWJldHdlZW47YWxpZ24taXRlbXM6',
  'Y2VudGVyO2ZsZXgtd3JhcDp3cmFwO2dhcDo2cHgiPjxiPkFuYWxpc2lzIEFuY2FtYW4gKDI0IGphbSk8L2I+PHNwYW4+PHNwYW4gY2xhc3M9Im',
  'JkICR7ZC5sZXZlbH0iPlRhaGFwICR7ZC5sZXZlbH08L3NwYW4+IDxzbWFsbCBzdHlsZT0iY29sb3I6dmFyKC0tbXV0KSI+PHNwYW4gc3R5bGU9',
  'ImNvbG9yOiMxNmEzNGEiPuKXjzwvc3Bhbj4gTElWRSwga2VtYXMga2luaSBzZXRpYXAgNSBzYWF0PC9zbWFsbD48L3NwYW4+PC9kaXY+PGRpdi',
  'BjbGFzcz0iayIgc3R5bGU9Im1hcmdpbjoxMHB4IDAgMCI+JHtjc308L2Rpdj48ZGl2IGNsYXNzPSJ0dyIgc3R5bGU9Im1hcmdpbi10b3A6MTBw',
  'eCI+PHRhYmxlPjx0cj48dGg+TWFzYTwvdGg+PHRoPlRhaGFwPC90aD48dGg+SmVuaXM8L3RoPjx0aD5QZW5nZ3VuYTwvdGg+PHRoPkJ1dGlyYW',
  '48L3RoPjwvdHI+JHtkLmxhdGVzdC5tYXAoeD0+YDx0cj48dGQ+JHtlc2MoeC5UaW1lKX08L3RkPjx0ZD48c3BhbiBjbGFzcz0iYmQgJHtlc2Mo',
  'eC5MZXZlbCl9Ij4ke2VzYyh4LkxldmVsKX08L3NwYW4+PC90ZD48dGQ+JHtlc2MoeC5UeXBlKX08L3RkPjx0ZD4ke2VzYyh4LkFjdG9yKX08L3',
  'RkPjx0ZD4ke2VzYyh4LkRldGFpbCl9PC90ZD48L3RyPmApLmpvaW4oJycpfHwnPHRyPjx0ZCBjb2xzcGFuPTU+VGlhZGEgcmVrb2QuPC90ZD48',
  'L3RyPid9PC90YWJsZT48L2Rpdj48L2Rpdj5gfQphc3luYyBmdW5jdGlvbiByZXNldDJmYShrKXtpZihjb25maXJtKCdTZXQgc2VtdWxhIHBlcm',
  'FudGkgcGVuZ2VzYWggcGVnYXdhaSBpbmk/IFBlZ2F3YWkgYWthbiBtZW5kYWZ0YXIgc2VtdWxhIHBhZGEgbG9nIG1hc3VrIHNldGVydXNueWEu',
  'JykmJmF3YWl0IHJwYygncmVzZXQyZmEnLHtrZXk6a30pKXRvYXN0KCcyRkEgZGlzZXRrYW4gc2VtdWxhJyl9CmZ1bmN0aW9uIHNob3dNYXBzKC',
  'l7JCgnI2MnKS5pbm5lckhUTUw9YDxkaXYgY2xhc3M9ImNhcmQiPjxiPkVqZW4gUGV0YSBHb29nbGU8L2I+PHAgc3R5bGU9ImNvbG9yOnZhcigt',
  'LW11dCk7Zm9udC1zaXplOjEycHg7bWFyZ2luOjRweCAwIDhweCI+Q29udG9oOiA8aT5sYWx1YW4gZGFyaSBLb3RhIEtpbmFiYWx1IGtlIFNhbm',
  'Rha2FuPC9pPiB8IDxpPmNhcmkgYmFsYWkgcG9saXMgZGkgVGF3YXU8L2k+IHwgPGk+TWVuYXJhIFR1biBNdXN0YXBoYTwvaT48L3A+PGRpdiBj',
  'bGFzcz0idGIiPjxpbnB1dCBpZD0ibXEiIHN0eWxlPSJtYXgtd2lkdGg6NDIwcHgiIHBsYWNlaG9sZGVyPSJUYWlwIHBlcnRhbnlhYW4uLi4iIG',
  '9ua2V5ZG93bj0iaWYoZXZlbnQua2V5PT0nRW50ZXInKW1hcEdvKCkiPjxzZWxlY3QgaWQ9Im1tIiBzdHlsZT0ibWF4LXdpZHRoOjE1MHB4O21h',
  'cmdpbjowIj48b3B0aW9uIHZhbHVlPSJEUklWSU5HIj5NZW1hbmR1PC9vcHRpb24+PG9wdGlvbiB2YWx1ZT0iV0FMS0lORyI+QmVyamFsYW48L2',
  '9wdGlvbj48b3B0aW9uIHZhbHVlPSJUUkFOU0lUIj5QZW5nYW5na3V0YW4gYXdhbTwvb3B0aW9uPjxvcHRpb24gdmFsdWU9IkJJQ1lDTElORyI+',
  'QmVyYmFzaWthbDwvb3B0aW9uPjwvc2VsZWN0PjxidXR0b24gb25jbGljaz0ibWFwR28oKSI+Q2FyaTwvYnV0dG9uPjwvZGl2PjwvZGl2PjxkaX',
  'YgaWQ9Im1yMiIgc3R5bGU9Im1hcmdpbi10b3A6MTJweCI+PC9kaXY+YH0KYXN5bmMgZnVuY3Rpb24gbWFwR28oKXtjb25zdCBkPWF3YWl0IHJw',
  'YygnbWFwcycse3E6JCgnI21xJykudmFsdWUsbW9kZTokKCcjbW0nKS52YWx1ZX0pO2lmKCFkKXJldHVybjtsZXQgaD0nJzsKIGlmKGQudHlwZT',
  '09J3JvdXRlJyloPWA8ZGl2IGNsYXNzPSJjYXJkIj48Yj4ke2VzYyhkLmZyb20pfSAmcmFycjsgJHtlc2MoZC50byl9PC9iPjxwPkphcmFrIDxi',
  'PiR7ZXNjKGQuZGlzdGFuY2UpfTwvYj4gfCBNYXNhIDxiPiR7ZXNjKGQuZHVyYXRpb24pfTwvYj48L3A+PG9sPiR7ZC5zdGVwcy5tYXAocz0+YD',
  'xsaT4ke2VzYyhzKX08L2xpPmApLmpvaW4oJycpfTwvb2w+PGEgaHJlZj0iJHtlc2MoZC51cmwpfSIgdGFyZ2V0PSJfYmxhbmsiIHJlbD0ibm9v',
  'cGVuZXIiPkJ1a2EgZGkgR29vZ2xlIE1hcHM8L2E+PC9kaXY+YDsKIGVsc2UgaD1kLml0ZW1zLmxlbmd0aD9kLml0ZW1zLm1hcChwPT5gPGRpdi',
  'BjbGFzcz0iY2FyZCIgc3R5bGU9Im1hcmdpbi1ib3R0b206OHB4Ij48Yj4ke2VzYyhwLm5hbWUpfTwvYj4ke3AuYWRkcj8nPGJyPicrZXNjKHAu',
  'YWRkcik6Jyd9JHtwLnJhdGluZz8nPGJyPlBlbmlsYWlhbjogJytlc2MocC5yYXRpbmcpOicnfSR7cC50ZWw/Jzxicj5UZWw6ICcrZXNjKHAudG',
  'VsKTonJ308YnI+PGEgdGFyZ2V0PSJfYmxhbmsiIHJlbD0ibm9vcGVuZXIiIGhyZWY9IiR7ZXNjKHAudXJsfHwoJ2h0dHBzOi8vd3d3Lmdvb2ds',
  'ZS5jb20vbWFwcy9zZWFyY2gvP2FwaT0xJnF1ZXJ5PScrcC5sYXQrJywnK3AubG5nKSl9Ij5CdWthIGRpIEdvb2dsZSBNYXBzPC9hPjwvZGl2Pm',
  'ApLmpvaW4oJycpOic8ZGl2IGNsYXNzPSJjYXJkIj5UaWFkYSBrZXB1dHVzYW4uPC9kaXY+JzsKICQoJyNtcjInKS5pbm5lckhUTUw9aH0KYXN5',
  'bmMgZnVuY3Rpb24gc2hvd1NldHRpbmdzKCl7Y29uc3Qgcz1hd2FpdCBycGMoJ3NldHRpbmdzJyk7aWYoIXMpcmV0dXJuOyQoJyNjJykuaW5uZX',
  'JIVE1MPWA8ZGl2IGNsYXNzPSJjYXJkIiBzdHlsZT0ibWF4LXdpZHRoOjQ2MHB4O21hcmdpbi1ib3R0b206MTRweCI+PGI+VHVrYXIga2F0YSBs',
  'YWx1YW4gQWRtaW48L2I+PHAgc3R5bGU9ImNvbG9yOnZhcigtLW11dCk7Zm9udC1zaXplOjEycHgiPkhhbnlhIEFkbWluIGJvbGVoIG1lbnVrYX',
  'Iga2F0YSBsYWx1YW4uIFBlZ2F3YWkgdGlkYWsgYm9sZWggbWVudWthciBQSU4gc2VuZGlyaTsgQWRtaW4gbWVuZXRhcGthbm55YSBkaSBtZW51',
  'IEhSIC0gUGVnYXdhaS48L3A+PGxhYmVsPkthdGEgbGFsdWFuIHNlbWFzYTwvbGFiZWw+PGlucHV0IGlkPSJwdzAiIHR5cGU9InBhc3N3b3JkIi',
  'BhdXRvY29tcGxldGU9ImN1cnJlbnQtcGFzc3dvcmQiPjxsYWJlbD5LYXRhIGxhbHVhbiBiYWhhcnUgKG1pbiAxMiBha3NhcmEpPC9sYWJlbD48',
  'aW5wdXQgaWQ9InB3MSIgdHlwZT0icGFzc3dvcmQiIGF1dG9jb21wbGV0ZT0ibmV3LXBhc3N3b3JkIj48bGFiZWw+VWxhbmcga2F0YSBsYWx1YW',
  '4gYmFoYXJ1PC9sYWJlbD48aW5wdXQgaWQ9InB3MiIgdHlwZT0icGFzc3dvcmQiIGF1dG9jb21wbGV0ZT0ibmV3LXBhc3N3b3JkIj48bGFiZWw+',
  'S29kIDJGQSAoNiBkaWdpdCk8L2xhYmVsPjxpbnB1dCBpZD0icHczIiBpbnB1dG1vZGU9Im51bWVyaWMiIG1heGxlbmd0aD0iOCI+PGJ1dHRvbi',
  'BvbmNsaWNrPSJjaHB3KCkiPlNpbXBhbjwvYnV0dG9uPjwvZGl2Pgo8ZGl2IGNsYXNzPSJjYXJkIiBzdHlsZT0ibWF4LXdpZHRoOjQ2MHB4Ij48',
  'Yj5TaXN0ZW08L2I+PHA+VmVyc2k6ICR7ZXNjKHMudmVyKX08YnI+R29vZ2xlIE1hcHMgUGxhY2VzIEFQSTogPGI+JHtzLm1hcHM/J0FrdGlmJz',
  'onQmVsdW0gZGl0ZXRhcGthbiAoTUFQU19LRVkpJ308L2I+PC9wPjxwPjxhIHRhcmdldD0iX2JsYW5rIiByZWw9Im5vb3BlbmVyIiBocmVmPSIk',
  'e2VzYyhzLnNzKX0iPkJ1a2EgR29vZ2xlIFNoZWV0IHV0YW1hPC9hPjxicj48YSB0YXJnZXQ9Il9ibGFuayIgcmVsPSJub29wZW5lciIgaHJlZj',
  '0iJHtlc2Mocy5ydCl9Ij5CdWthIEdvb2dsZSBTaGVldCBMb2cgTWFzYSBOeWF0YTwvYT48L3A+PC9kaXY+YH0KYXN5bmMgZnVuY3Rpb24gY2hw',
  'dygpe2lmKCQoJyNwdzEnKS52YWx1ZSE9JCgnI3B3MicpLnZhbHVlKXJldHVybiB0b2FzdCgnS2F0YSBsYWx1YW4gYmFoYXJ1IHRpZGFrIHNlcG',
  'FkYW4uJyk7aWYoYXdhaXQgcnBjKCdjaHB3Jyx7Y3VyOiQoJyNwdzAnKS52YWx1ZSxuZXh0OiQoJyNwdzEnKS52YWx1ZSxjb2RlOiQoJyNwdzMn',
  'KS52YWx1ZX0pKXtbJ3B3MCcsJ3B3MScsJ3B3MicsJ3B3MyddLmZvckVhY2goaT0+JCgnIycraSkudmFsdWU9JycpO3RvYXN0KCdLYXRhIGxhbH',
  'VhbiBhZG1pbiBkaXR1a2FyLicpfX0KZnVuY3Rpb24gcXVpZXRMb2dvdXQoKXt0cnl7aWYoVFI9PSdmZXRjaCcpdmlhRmV0Y2goJ2xvZ291dCcs',
  'e30pLmNhdGNoKGZ1bmN0aW9uKCl7fSk7ZWxzZSBnb29nbGUuc2NyaXB0LnJ1bi53aXRoU3VjY2Vzc0hhbmRsZXIoZnVuY3Rpb24oKXt9KS53aX',
  'RoRmFpbHVyZUhhbmRsZXIoZnVuY3Rpb24oKXt9KS5ycGMoJ2xvZ291dCcsVCwne30nKX1jYXRjaChlKXt9fQpmdW5jdGlvbiBkb0xvZ291dCgp',
  'e2lmKFQpcXVpZXRMb2dvdXQoKTthbG1TdG9wKCk7VD1udWxsO1RJQ0tFVD1udWxsO3Nob3cyKDApO1U9bnVsbDtQQUdFPW51bGw7Y2xvc2VNKC',
  'k7JCgnI2FwcCcpLnN0eWxlLmRpc3BsYXk9J25vbmUnOyQoJyNsb2dpbicpLnN0eWxlLmRpc3BsYXk9Jyc7JCgnI2xpZCcpLnZhbHVlPScnOyQo',
  'JyNscHcnKS52YWx1ZT0nJzskKCcjYycpLmlubmVySFRNTD0nJzskKCcjbmF2JykuaW5uZXJIVE1MPScnOyQoJyN1c3InKS50ZXh0Q29udGVudD',
  '0nJzt2YXIgbT0kKCcjbG1zZycpLGQ9JCgnI2RiZycpO20udGV4dENvbnRlbnQ9Jyc7aWYoZClkLnRleHRDb250ZW50PScnOyQoJyNsaWQnKS5m',
  'b2N1cygpfQpmdW5jdGlvbiBsZyhzKXt2YXIgZD1kb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnZGJnJyk7aWYoZCl7ZC50ZXh0Q29udGVudD0oZC',
  '50ZXh0Q29udGVudCsnXG4nK25ldyBEYXRlKCkudG9Mb2NhbGVUaW1lU3RyaW5nKCkrJyAnK3MpLnNwbGl0KCdcbicpLnNsaWNlKC03KS5qb2lu',
  'KCdcbicpfX0KdmFyIFRJQ0tFVD1udWxsOwpmdW5jdGlvbiBzaG93MihvbixlbnIpeyQoJyNsaWQnKS5zdHlsZS5kaXNwbGF5PW9uPydub25lJz',
  'onJzskKCcjbHB3Jykuc3R5bGUuZGlzcGxheT1vbj8nbm9uZSc6Jyc7JCgnI2xidG4nKS5zdHlsZS5kaXNwbGF5PW9uPydub25lJzonJzskKCcj',
  'bDInKS5zdHlsZS5kaXNwbGF5PW9uPydibG9jayc6J25vbmUnOyQoJyNlbnInKS5pbm5lckhUTUw9ZW5yfHwnJzskKCcjbGNvZGUnKS52YWx1ZT',
  '0nJztpZihvbikkKCcjbGNvZGUnKS5mb2N1cygpfQpmdW5jdGlvbiBlbnJVSShkKXtyZXR1cm4gJzxiPkRhZnRhciBhcGxpa2FzaSBwZW5nZXNh',
  'aDwvYj4gKEdvb2dsZSBBdXRoZW50aWNhdG9yLCBNaWNyb3NvZnQgQXV0aGVudGljYXRvciBhdGF1IEF1dGh5KS4gSW1iYXMga29kIFFSIGF0YX',
  'UgbWFzdWtrYW4ga3VuY2kgaW5pIHNlY2FyYSBtYW51YWw6PGRpdiBpZD0icXJib3giIHN0eWxlPSJ0ZXh0LWFsaWduOmNlbnRlcjttYXJnaW46',
  'OHB4IDAiPjwvZGl2Pjxjb2RlIHN0eWxlPSJ3b3JkLWJyZWFrOmJyZWFrLWFsbDtkaXNwbGF5OmJsb2NrO2JhY2tncm91bmQ6I2YyZjRmODtwYW',
  'RkaW5nOjZweDtib3JkZXItcmFkaXVzOjZweCI+Jytlc2MoZC5zZWNyZXQpKyc8L2NvZGU+PHA+S2VtdWRpYW4gbWFzdWtrYW4ga29kIDYgZGln',
  'aXQgZGkgYmF3YWguIEtvZCBkaWphbmEgZGkgdGVsZWZvbiB3YWxhdXB1biB0aWFkYSBkYXRhIGludGVybmV0LjwvcD4nfQpmdW5jdGlvbiBkcm',
  'F3UVIodSl7dHJ5e2lmKHdpbmRvdy5xcmNvZGUpe3ZhciBxPXFyY29kZSgwLCdNJyk7cS5hZGREYXRhKHUpO3EubWFrZSgpOyQoJyNxcmJveCcp',
  'LmlubmVySFRNTD1xLmNyZWF0ZUltZ1RhZyg0KX19Y2F0Y2goZSl7fX0KYXN5bmMgZnVuY3Rpb24gZG9Mb2dpbigpe3ZhciBtPSQoJyNsbXNnJy',
  'k7bS5zdHlsZS5jb2xvcj0nIzZiNzc5NCc7bS50ZXh0Q29udGVudD0nU2VkYW5nIGxvZyBtYXN1ay4uLic7CiB0cnl7Y29uc3QgZD1hd2FpdCBy',
  'cGMoJ2xvZ2luJyx7aWQ6JCgnI2xpZCcpLnZhbHVlLHBpbjokKCcjbHB3JykudmFsdWV9KTtpZighZCl7bS5zdHlsZS5jb2xvcj0nI2UxMWQyYS',
  'c7cmV0dXJufQogaWYoZC5zdGVwKXtUSUNLRVQ9ZC50aWNrZXQ7c2hvdzIoMSxkLnN0ZXA9PSdlbnJvbGwnP2VuclVJKGQpOic8Yj5QZW5nZXNh',
  'aGFuIGR1YSBmYWt0b3I8L2I+PGJyPk1hc3Vra2FuIGtvZCA2IGRpZ2l0IGRhcmlwYWRhIGFwbGlrYXNpIHBlbmdlc2FoIGFuZGEuJyk7aWYoZC',
  '5zdGVwPT0nZW5yb2xsJylkcmF3UVIoZC51cmkpO20udGV4dENvbnRlbnQ9Jyc7cmV0dXJufQogYXdhaXQgZmluaXNoTG9naW4oZCl9Y2F0Y2go',
  'ZSl7bS5zdHlsZS5jb2xvcj0nI2UxMWQyYSc7bS50ZXh0Q29udGVudD0nUmFsYXQ6ICcrZS5tZXNzYWdlfX0KYXN5bmMgZnVuY3Rpb24gZG9WZX',
  'JpZnkoKXt2YXIgbT0kKCcjbG1zZycpO20uc3R5bGUuY29sb3I9JyM2Yjc3OTQnO20udGV4dENvbnRlbnQ9J01lbmdlc2Foa2FuLi4uJzsKIHRy',
  'eXtjb25zdCBkPWF3YWl0IHJwYygndmVyaWZ5MmZhJyx7dGlja2V0OlRJQ0tFVCxjb2RlOiQoJyNsY29kZScpLnZhbHVlfSk7aWYoIWQpe20uc3',
  'R5bGUuY29sb3I9JyNlMTFkMmEnO2lmKC90YW1hdHxkaWt1bmNpLy50ZXN0KG0udGV4dENvbnRlbnQpKXtUSUNLRVQ9bnVsbDtzaG93MigwKX1y',
  'ZXR1cm59YXdhaXQgZmluaXNoTG9naW4oZCl9Y2F0Y2goZSl7bS5zdHlsZS5jb2xvcj0nI2UxMWQyYSc7bS50ZXh0Q29udGVudD0nUmFsYXQ6IC',
  'crZS5tZXNzYWdlfX0KYXN5bmMgZnVuY3Rpb24gZmluaXNoTG9naW4oZCl7VD1kLnRva2VuO1U9ZC51c2VyO1RJQ0tFVD1udWxsO2NvbnN0IHA9',
  'YXdhaXQgcnBjKCdwcmVtaXNlcycpO1BSRU09cHx8W107JCgnI3VzcicpLnRleHRDb250ZW50PVUubmFtZTsKICQoJyNuYXYnKS5pbm5lckhUTU',
  'w9T2JqZWN0LmtleXMoUEcpLmZpbHRlcihrPT5QR1trXS5yLmluY2x1ZGVzKFUucm9sZT09J2FkbWluJz8nYSc6J2cnKSkubWFwKGs9PmA8YSBk',
  'YXRhLWs9IiR7a30iIG9uY2xpY2s9ImdvUGFnZSgnJHtrfScpIj4ke1BHW2tdLnR9PC9hPmApLmpvaW4oJycpOwogJCgnI2xvZ2luJykuc3R5bG',
  'UuZGlzcGxheT0nbm9uZSc7JCgnI2FwcCcpLnN0eWxlLmRpc3BsYXk9J2Jsb2NrJzskKCcjbHB3JykudmFsdWU9Jyc7c2hvdzIoMCk7JCgnI2xt',
  'c2cnKS50ZXh0Q29udGVudD0nJztpZihVLnJvbGU9PSdndWFyZCcpYWxtU3luYygpO2F3YWl0IGdvUGFnZShVLnJvbGU9PSdhZG1pbic/J2Rhc2',
  'gnOid0ZXJtJyl9CmFzeW5jIGZ1bmN0aW9uIGdvUGFnZShrKXtQQUdFPWs7c2QuY2xhc3NMaXN0LnJlbW92ZSgnbycpO2RvY3VtZW50LnF1ZXJ5',
  'U2VsZWN0b3JBbGwoJyNuYXYgYScpLmZvckVhY2goYT0+YS5jbGFzc0xpc3QudG9nZ2xlKCdvbicsYS5kYXRhc2V0Lms9PWspKTskKCcjdHRsJy',
  'kudGV4dENvbnRlbnQ9UEdba10udDskKCcjYycpLmlubmVySFRNTD0nTWVtdWF0a2FuLi4uJzsKIGlmKGs9PSdkYXNoJylyZXR1cm4gc2hvd0Rh',
  'c2goKTtpZihrPT0ndGVybScpcmV0dXJuIHNob3dUZXJtKCk7aWYoaz09J21hcHMnKXJldHVybiBzaG93TWFwcygpO2lmKGs9PSdzZXR0aW5ncy',
  'cpcmV0dXJuIHNob3dTZXR0aW5ncygpO3Nob3dUYWJsZShrKX0KYXN5bmMgZnVuY3Rpb24gc2hvd0Rhc2goKXtjb25zdCBkPWF3YWl0IHJwYygn',
  'ZGFzaCcpO2lmKCFkKXskKCcjYycpLmlubmVySFRNTD0nPGRpdiBjbGFzcz0iY2FyZCI+R2FnYWwgbWVtdWF0a2FuIERhc2hib2FyZC4gVGVrYW',
  '4gbWVudSBEYXNoYm9hcmQgdW50dWsgY3ViYSBsYWdpLjwvZGl2Pic7cmV0dXJufWNvbnN0IGM9KG4sbCxhKT0+YDxkaXYgY2xhc3M9ImNhcmQg',
  'JHthJiZuPydhbCc6Jyd9Ij48Yj4ke259PC9iPjxzcGFuPiR7bH08L3NwYW4+PC9kaXY+YDsKICQoJyNjJykuaW5uZXJIVE1MPWA8ZGl2IGlkPS',
  'J0aHIiPjwvZGl2PjxkaXYgY2xhc3M9ImsiPiR7YyhkLnByZW1pc2VzLCdQcmVtaXMgYWt0aWYnKX0ke2MoZC5ndWFyZHMsJ1BlZ2F3YWkgYWt0',
  'aWYgKCcrZC5pbmFjdGl2ZSsnIHRpZGFrIGFrdGlmKScpfSR7YyhkLm9uRHV0eSwnU2VkYW5nIGJlcnR1Z2FzJyl9JHtjKGQucGF0cm9sVG9kYX',
  'ksJ1JvbmRhYW4gaGFyaSBpbmknKX0ke2MoZC52aXNpdG9yc0luLCdQZWxhd2F0IGRpIGRhbGFtJyl9JHtjKGQuY29tcGxhaW50cywnQWR1YW4g',
  'YmVsdW0gc2VsZXNhaScsMSl9PC9kaXY+CiA8aDM+U3RhdHVzIFJvbmRhYW4gKENyaXRpY2FsID0gdGlhZGEgcm9uZGEgbWVsZWJpaGkgMiBrYW',
  'xpIHNlbGFuZyk8L2gzPjxkaXYgY2xhc3M9InR3Ij48dGFibGU+PHRyPjx0aD5QcmVtaXM8L3RoPjx0aD5Sb25kYWFuIFRlcmFraGlyPC90aD48',
  'dGg+U3RhdHVzPC90aD48L3RyPiR7ZC50b3VyLm1hcCh0PT5gPHRyPjx0ZD4ke2VzYyh0LnByZW1pc2UpfTwvdGQ+PHRkPiR7ZXNjKHQubGFzdC',
  'l9PC90ZD48dGQ+PHNwYW4gY2xhc3M9ImJkICR7dC5zdGF0dXN9Ij4ke3Quc3RhdHVzfTwvc3Bhbj48L3RkPjwvdHI+YCkuam9pbignJyl8fCc8',
  'dHI+PHRkIGNvbHNwYW49Mz5UaWFkYSBwcmVtaXMuIFRhbWJhaCBkaSBtZW51IFByZW1pcy48L3RkPjwvdHI+J308L3RhYmxlPjwvZGl2PmA7dG',
  'hyU3RhcnQoKX0KZnVuY3Rpb24gY2VsbChrLHYpe2lmKGs9PSdQaG90b1VSTCcpcmV0dXJuIHY/YDxpbWcgY2xhc3M9InRoIiBzcmM9IiR7ZXNj',
  'KHYpfSIgb25jbGljaz0iem9vbUltZygnJHtlc2Modil9JykiPmA6Jyc7aWYoaz09J1N0YXR1cyd8fGs9PSdMZXZlbCcpcmV0dXJuIGA8c3Bhbi',
  'BjbGFzcz0iYmQgJHtlc2Modil9Ij4ke2VzYyh2KX08L3NwYW4+YDtpZihrPT0nUElOJylyZXR1cm4gJ+KAouKAouKAouKAoic7cmV0dXJuIGVz',
  'Yyh2KX0KYXN5bmMgZnVuY3Rpb24gc2hvd1RhYmxlKGspe2NvbnN0IGQ9YXdhaXQgcnBjKCdsaXN0Jyx7c2hlZXQ6a30pO2lmKCFkKXskKCcjYy',
  'cpLmlubmVySFRNTD0nPGRpdiBjbGFzcz0iY2FyZCI+R2FnYWwgbWVtdWF0a2FuIGRhdGEuIFRla2FuIG1lbnUgdW50dWsgY3ViYSBsYWdpLjwv',
  'ZGl2Pic7cmV0dXJufWNvbnN0IGc9UEdba107REFUQT1kOwogJCgnI2MnKS5pbm5lckhUTUw9YDxkaXYgY2xhc3M9InRiIj48aW5wdXQgaWQ9In',
  'EiIHBsYWNlaG9sZGVyPSJDYXJpLi4uIiBvbmlucHV0PSJmaWx0ZXJSb3dzKCkiPiR7Zy5lfHxnLnZ8fGcubD9gPGJ1dHRvbiBvbmNsaWNrPSJv',
  'cGVuRm9ybSgnJHtrfScpIj4rIFRhbWJhaDwvYnV0dG9uPmA6Jyd9JHtrPT0nQ2hlY2twb2ludHMnPyc8YnV0dG9uIGNsYXNzPSJnIiBvbmNsaW',
  'NrPSJhbGxRUigpIj5DZXRhayBzZW11YSBRUjwvYnV0dG9uPic6Jyd9JHsoVS5yb2xlIT0nYWRtaW4nJiZrPT0nUGF0cm9sJyk/JzxidXR0b24g',
  'b25jbGljaz0ic2NhblVJKCkiPkltYmFzIENoZWNrcG9pbnQ8L2J1dHRvbj4nOicnfTxidXR0b24gY2xhc3M9ImciIG9uY2xpY2s9ImdvUGFnZS',
  'gnJHtrfScpIj5NdWF0IHNlbXVsYTwvYnV0dG9uPjwvZGl2PgogPGRpdiBjbGFzcz0idHciPjx0YWJsZSBpZD0idGIiPjx0cj4ke2QuY29scy5t',
  'YXAoYz0+YDx0aD4ke2N9PC90aD5gKS5qb2luKCcnKX08dGg+PC90aD48L3RyPiR7ZC5yb3dzLm1hcCgocixpKT0+YDx0cj4ke2QuY29scy5tYX',
  'AoYz0+YDx0ZD4ke2NlbGwoYyxyW2NdKX08L3RkPmApLmpvaW4oJycpfTx0ZCBzdHlsZT0id2hpdGUtc3BhY2U6bm93cmFwIj4ke2FjdHMoayxy',
  'LGkpfTwvdGQ+PC90cj5gKS5qb2luKCcnKXx8YDx0cj48dGQgY29sc3Bhbj0yMD5UaWFkYSByZWtvZC48L3RkPjwvdHI+YH08L3RhYmxlPjwvZG',
  'l2PmB9CmxldCBEQVRBO2Z1bmN0aW9uIGZpbHRlclJvd3MoKXtjb25zdCBxPSQoJyNxJykudmFsdWUudG9Mb3dlckNhc2UoKTtkb2N1bWVudC5x',
  'dWVyeVNlbGVjdG9yQWxsKCcjdGIgdHInKS5mb3JFYWNoKCh0LGkpPT57aWYoaSl0LnN0eWxlLmRpc3BsYXk9dC50ZXh0Q29udGVudC50b0xvd2',
  'VyQ2FzZSgpLmluY2x1ZGVzKHEpPycnOidub25lJ30pfQpmdW5jdGlvbiBhY3RzKGsscixpKXtsZXQgaD0nJztpZihQR1trXS5lKWgrPWA8YnV0',
  'dG9uIGNsYXNzPSJzIGciIG9uY2xpY2s9Im9wZW5Gb3JtKCcke2t9Jywke2l9KSI+RWRpdDwvYnV0dG9uPiA8YnV0dG9uIGNsYXNzPSJzIHIiIG',
  '9uY2xpY2s9ImRvRGVsKCcke2t9JywnJHtlc2MocltEQVRBLmNvbHNbMF1dKX0nKSI+UGFkYW08L2J1dHRvbj4gYDsKIGlmKGs9PSdHdWFyZHMn',
  'KWgrPWA8YnV0dG9uIGNsYXNzPSJzIGciIG9uY2xpY2s9InJlc2V0MmZhKCcke2VzYyhyLkd1YXJkSUQpfScpIj5SZXNldCAyRkE8L2J1dHRvbj',
  '4gYDsKIGlmKGs9PSdDaGVja3BvaW50cycpaCs9YDxidXR0b24gY2xhc3M9InMiIG9uY2xpY2s9InNob3dRUignJHtlc2Moci5RUkNvZGUpfScs',
  'JyR7ZXNjKHIuTmFtZSl9JywnJHtlc2Moci5QcmVtaXNlKX0nKSI+UVI8L2J1dHRvbj5gOwogaWYoaz09J1Zpc2l0b3JzJyYmIXIuVGltZU91dC',
  'loKz1gPGJ1dHRvbiBjbGFzcz0icyIgb25jbGljaz0idm91dCgnJHtyLlZpc2l0SUR9JykiPktlbHVhcjwvYnV0dG9uPmA7cmV0dXJuIGh9CmZ1',
  'bmN0aW9uIHpvb21JbWcodSl7JCgnI21iJykuaW5uZXJIVE1MPWA8aW1nIHNyYz0iJHt1LnJlcGxhY2UoJ3N6PXcxMDAwJywnc3o9dzE2MDAnKX',
  '0iIHN0eWxlPSJ3aWR0aDoxMDAlIj48YnV0dG9uIGNsYXNzPSJnIiBzdHlsZT0id2lkdGg6MTAwJTttYXJnaW4tdG9wOjhweCIgb25jbGljaz0i',
  'Y2xvc2VNKCkiPlR1dHVwPC9idXR0b24+YDttZC5zdHlsZS5kaXNwbGF5PSdncmlkJ30KZnVuY3Rpb24gY2xvc2VNKCl7bWQuc3R5bGUuZGlzcG',
  'xheT0nbm9uZSc7aWYoUVIpe1FSLnN0b3AoKS5jYXRjaCgoKT0+e30pO1FSPW51bGx9fQpmdW5jdGlvbiBvcHRzKHMsdil7Y29uc3QgbD1zPT0n',
  'QFAnP1BSRU06cy5zcGxpdCgnfCcpO3JldHVybiBsLm1hcChvPT5gPG9wdGlvbiAke289PXY/J3NlbGVjdGVkJzonJ30+JHtlc2Mobyl9PC9vcH',
  'Rpb24+YCkuam9pbignJyl9CmZ1bmN0aW9uIG9wZW5Gb3JtKGssaSl7Y29uc3QgZz1QR1trXSxyb3c9aSE9bnVsbD9EQVRBLnJvd3NbaV06e307',
  'bGV0IGY9Zy5mOwogaWYoZy52KWY9WydOYW1lJywnSUMnLCdQaG9uZScsJ1ZlaGljbGUnLCdQdXJwb3NlJywnSG9zdCcsLi4uKFUucm9sZT09J2',
  'FkbWluJz9bJ1ByZW1pc2U6QFAnXTpbXSksJ1Bob3RvOkBGJ107CiBpZihnLmwpZj1bJ0NhdGVnb3J5OlJvbmRhYW58SW5zaWRlbnxLZWphZGlh',
  'bnxTZXJhaGFuIFR1Z2FzfEtlbmRlcmFhbnxMYWluLWxhaW4nLC4uLihVLnJvbGU9PSdhZG1pbic/WydQcmVtaXNlOkBQJ106W10pLCdEZXNjcm',
  'lwdGlvbjpAVCcsJ1Bob3RvOkBGJ107CiAkKCcjbWInKS5pbm5lckhUTUw9YDxoMz4ke2cudH08L2gzPmArZi5tYXAoeD0+e2NvbnN0W24sb109',
  'eC5zcGxpdCgnOicpO2NvbnN0IGlkPSdmXycrbjtsZXQgZWw9IW8/YDxpbnB1dCBpZD0iJHtpZH0iIHZhbHVlPSIke2VzYyhyb3dbbl0pfSI+YD',
  'pvPT0nQFQnP2A8dGV4dGFyZWEgaWQ9IiR7aWR9IiByb3dzPTM+JHtlc2Mocm93W25dKX08L3RleHRhcmVhPmA6bz09J0BEJz9gPGlucHV0IGlk',
  'PSIke2lkfSIgdHlwZT0iZGF0ZSIgdmFsdWU9IiR7ZXNjKHJvd1tuXXx8bmV3IERhdGUoKS50b0lTT1N0cmluZygpLnNsaWNlKDAsMTApKX0iPm',
  'A6bz09J0BTJz9gPGlucHV0IGlkPSIke2lkfSIgdHlwZT0icGFzc3dvcmQiIGF1dG9jb21wbGV0ZT0ibmV3LXBhc3N3b3JkIiBpbnB1dG1vZGU9',
  'Im51bWVyaWMiIG1heGxlbmd0aD0iMTIiPmA6bz09J0BOJz9gPGlucHV0IGlkPSIke2lkfSIgdHlwZT0ibnVtYmVyIiBtaW49IjAiIHZhbHVlPS',
  'Ike2VzYyhyb3dbbl09PT11bmRlZmluZWR8fHJvd1tuXT09PScnPzYwOnJvd1tuXSl9Ij5gOm89PSdARic/YDxpbnB1dCBpZD0iJHtpZH0iIHR5',
  'cGU9ImZpbGUiIGFjY2VwdD0iaW1hZ2UvKiIgY2FwdHVyZT0iZW52aXJvbm1lbnQiPmA6YDxzZWxlY3QgaWQ9IiR7aWR9Ij4ke29wdHMobyxyb3',
  'dbbl0pfTwvc2VsZWN0PmA7cmV0dXJuIGA8bGFiZWw+JHtMQkxbbl18fG59PC9sYWJlbD4ke2VsfWB9KS5qb2luKCcnKStgPGJ1dHRvbiBvbmNs',
  'aWNrPSJkb1N1Ym1pdCgnJHtrfScsJHtpPT1udWxsPy0xOml9KSI+U2ltcGFuPC9idXR0b24+IDxidXR0b24gY2xhc3M9ImciIG9uY2xpY2s9Im',
  'Nsb3NlTSgpIj5CYXRhbDwvYnV0dG9uPmA7bWQuc3R5bGUuZGlzcGxheT0nZ3JpZCd9CmZ1bmN0aW9uIHJlYWRJbWcoaW5wKXtyZXR1cm4gbmV3',
  'IFByb21pc2Uocj0+e2NvbnN0IGY9aW5wJiZpbnAuZmlsZXNbMF07aWYoIWYpcmV0dXJuIHIoJycpO2NvbnN0IGltPW5ldyBJbWFnZSgpLHU9VV',
  'JMLmNyZWF0ZU9iamVjdFVSTChmKTtpbS5vbmxvYWQ9KCk9Pntjb25zdCBzPU1hdGgubWluKDEsMTAyNC9NYXRoLm1heChpbS53aWR0aCxpbS5o',
  'ZWlnaHQpKSxjPWRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2NhbnZhcycpO2Mud2lkdGg9aW0ud2lkdGgqcztjLmhlaWdodD1pbS5oZWlnaHQqcz',
  'tjLmdldENvbnRleHQoJzJkJykuZHJhd0ltYWdlKGltLDAsMCxjLndpZHRoLGMuaGVpZ2h0KTtyKGMudG9EYXRhVVJMKCdpbWFnZS9qcGVnJywu',
  'NykpfTtpbS5vbmVycm9yPSgpPT5yKCcnKTtpbS5zcmM9dX0pfQphc3luYyBmdW5jdGlvbiBkb1N1Ym1pdChrLGkpe2NvbnN0IGc9UEdba10scm',
  '93PWk+PTA/ey4uLkRBVEEucm93c1tpXX06e307CiBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKCcjbWIgW2lkXj1mX10nKS5mb3JFYWNoKGU9',
  'PntpZihlLnR5cGUhPSdmaWxlJylyb3dbZS5pZC5zbGljZSgyKV09ZS52YWx1ZX0pOwogbGV0IG9rO2lmKGcudnx8Zy5sKXtjb25zdCBwaG90bz',
  '1hd2FpdCByZWFkSW1nKCQoJyNmX1Bob3RvJykpO29rPWF3YWl0IHJwYyhnLnY/J3Zpc2l0b3JBZGQnOidsb2dBZGQnLHtyb3cscGhvdG99KX1l',
  'bHNlIG9rPWF3YWl0IHJwYygnc2F2ZScse3NoZWV0Omsscm93fSk7CiBpZihvayl7Y2xvc2VNKCk7dG9hc3QoJ0Rpc2ltcGFuJyk7aWYoaz09J0',
  'd1YXJkcyd8fGs9PSdQcmVtaXNlcycpe2NvbnN0IHA9YXdhaXQgcnBjKCdwcmVtaXNlcycpO1BSRU09cHx8UFJFTX1nb1BhZ2Uoayl9fQphc3lu',
  'YyBmdW5jdGlvbiBkb0RlbChrLGtleSl7aWYoY29uZmlybSgnUGFkYW0gcmVrb2QgaW5pPycpJiZhd2FpdCBycGMoJ2RlbCcse3NoZWV0Omssa2',
  'V5fSkpe3RvYXN0KCdEaXBhZGFtJyk7Z29QYWdlKGspfX0KYXN5bmMgZnVuY3Rpb24gdm91dChrZXkpe2lmKGF3YWl0IHJwYygndmlzaXRvck91',
  'dCcse2tleX0pKXt0b2FzdCgnUGVsYXdhdCBrZWx1YXInKTtnb1BhZ2UoJ1Zpc2l0b3JzJyl9fQpjb25zdCBxdXJsPShjLHMpPT4naHR0cHM6Ly',
  '9hcGkucXJzZXJ2ZXIuY29tL3YxL2NyZWF0ZS1xci1jb2RlLz9zaXplPScrcysneCcrcysnJmRhdGE9JytlbmNvZGVVUklDb21wb25lbnQoYyk7',
  'CmZ1bmN0aW9uIHNob3dRUihjLG4scCl7JCgnI21iJykuaW5uZXJIVE1MPWA8ZGl2IHN0eWxlPSJ0ZXh0LWFsaWduOmNlbnRlciI+PGgzPiR7bn',
  '08L2gzPjxwPiR7cH08L3A+PGltZyBzcmM9IiR7cXVybChjLDMwMCl9IiB3aWR0aD0yNjA+PHA+PGNvZGU+JHtjfTwvY29kZT48L3A+PGJ1dHRv',
  'biBvbmNsaWNrPSJ3aW5kb3cucHJpbnQoKSI+Q2V0YWs8L2J1dHRvbj4gPGJ1dHRvbiBjbGFzcz0iZyIgb25jbGljaz0iY2xvc2VNKCkiPlR1dH',
  'VwPC9idXR0b24+PC9kaXY+YDttZC5zdHlsZS5kaXNwbGF5PSdncmlkJ30KZnVuY3Rpb24gYWxsUVIoKXtjb25zdCB3PXdpbmRvdy5vcGVuKCcn',
  'KTt3LmRvY3VtZW50LndyaXRlKCc8Ym9keSBzdHlsZT0iZm9udC1mYW1pbHk6QXJpYWw7ZGlzcGxheTpmbGV4O2ZsZXgtd3JhcDp3cmFwO2dhcD',
  'oxNHB4Ij4nK0RBVEEucm93cy5maWx0ZXIocj0+ci5TdGF0dXMhPSdJbmFjdGl2ZScpLm1hcChyPT5gPGRpdiBzdHlsZT0iYm9yZGVyOjJweCBz',
  'b2xpZCAjYjg4NjJmO3BhZGRpbmc6MTBweDt0ZXh0LWFsaWduOmNlbnRlcjt3aWR0aDoyMzBweCI+PGI+TUVHQSBTQUZFIFNFQ1VSSVRZPC9iPj',
  'xicj48aW1nIHNyYz0iJHtxdXJsKHIuUVJDb2RlLDIwMCl9Ij48YnI+PGI+JHtyLk5hbWV9PC9iPjxicj4ke3IuUHJlbWlzZX08L2Rpdj5gKS5q',
  'b2luKCcnKSsnPHNjcmlwdD5zZXRUaW1lb3V0KCgpPT5wcmludCgpLDEyMDApPFwvc2NyaXB0PicpO3cuZG9jdW1lbnQuY2xvc2UoKX0KZnVuY3',
  'Rpb24gc2hvd1Rlcm0oKXskKCcjYycpLmlubmVySFRNTD1gPGRpdiBjbGFzcz0iY2FyZCIgc3R5bGU9Im1hcmdpbi1ib3R0b206MTJweCI+PGI+',
  'JHtlc2MoVS5uYW1lKX08L2I+PGJyPjxzcGFuIHN0eWxlPSJjb2xvcjp2YXIoLS1tdXQpIj4ke2VzYyhVLnByZW1pc2UpfSDCtyAke2VzYyhVLn',
  'NoaWZ0KX08L3NwYW4+PC9kaXY+CiA8ZGl2IGNsYXNzPSJjYXJkIiBzdHlsZT0ibWFyZ2luLWJvdHRvbToxMnB4Ij48Yj5BbGFybSBSb25kYWFu',
  'PC9iPjxkaXYgaWQ9ImFsbVR4dCIgc3R5bGU9Im1hcmdpbi10b3A6NnB4Ij48L2Rpdj48L2Rpdj4KIDxkaXYgY2xhc3M9ImJpZyI+PGJ1dHRvbi',
  'BvbmNsaWNrPSJkb0Nsb2NrKCdpbicpIj5DbG9jayBJbjwvYnV0dG9uPjxidXR0b24gY2xhc3M9InIiIG9uY2xpY2s9ImRvQ2xvY2soJ291dCcp',
  'Ij5DbG9jayBPdXQ8L2J1dHRvbj48YnV0dG9uIG9uY2xpY2s9InNjYW5VSSgpIj5JbWJhcyBRUiBDaGVja3BvaW50PC9idXR0b24+PGJ1dHRvbi',
  'BvbmNsaWNrPSJvcGVuRm9ybSgnVmlzaXRvcnMnKSI+RGFmdGFyIFBlbGF3YXQ8L2J1dHRvbj48YnV0dG9uIGNsYXNzPSJnIiBvbmNsaWNrPSJv',
  'cGVuRm9ybSgnTG9nQm9vaycpIj5UdWxpcyBMb2cgQm9vazwvYnV0dG9uPjxidXR0b24gY2xhc3M9ImciIG9uY2xpY2s9ImdvUGFnZSgnUGF0cm',
  '9sJykiPlJvbmRhYW4gU2F5YTwvYnV0dG9uPjwvZGl2PmA7YWxtVGljaygpfQphc3luYyBmdW5jdGlvbiBkb0Nsb2NrKHQpe2NvbnN0IG09YXdh',
  'aXQgcnBjKCdjbG9jaycse3R5cGU6dH0pO2lmKG0pe3RvYXN0KG0pO2FsbVN5bmMoKX19CmZ1bmN0aW9uIHNjYW5VSSgpeyQoJyNtYicpLmlubm',
  'VySFRNTD1gPGgzPkltYmFzIFFSIENoZWNrcG9pbnQ8L2gzPjxkaXYgaWQ9InJkIiBzdHlsZT0id2lkdGg6MTAwJSI+PC9kaXY+PGxhYmVsPkF0',
  'YXUgdGFpcCBrb2QgUVI8L2xhYmVsPjxpbnB1dCBpZD0ibWMiIHBsYWNlaG9sZGVyPSJNU1N8Qy4uLiI+PGxhYmVsPkNhdGF0YW48L2xhYmVsPj',
  'xpbnB1dCBpZD0ibXIiPjxsYWJlbD5HYW1iYXIgYnVrdGk8L2xhYmVsPjxpbnB1dCBpZD0ibXAiIHR5cGU9ImZpbGUiIGFjY2VwdD0iaW1hZ2Uv',
  'KiIgY2FwdHVyZT0iZW52aXJvbm1lbnQiPjxidXR0b24gb25jbGljaz0iZG9TY2FuKCQoJyNtYycpLnZhbHVlKSI+SGFudGFyPC9idXR0b24+ID',
  'xidXR0b24gY2xhc3M9ImciIG9uY2xpY2s9ImNsb3NlTSgpIj5CYXRhbDwvYnV0dG9uPmA7bWQuc3R5bGUuZGlzcGxheT0nZ3JpZCc7CiBpZih3',
  'aW5kb3cuSHRtbDVRcmNvZGUpe1FSPW5ldyBIdG1sNVFyY29kZSgncmQnKTtRUi5zdGFydCh7ZmFjaW5nTW9kZTonZW52aXJvbm1lbnQnfSx7Zn',
  'BzOjEwLHFyYm94OjIwMH0sYz0+eyQoJyNtYycpLnZhbHVlPWM7dG9hc3QoJ1FSIGRpa2VzYW46ICcrYyl9KS5jYXRjaCgoKT0+eyQoJyNyZCcp',
  'LnRleHRDb250ZW50PSdLYW1lcmEgdGlkYWsgdGVyc2VkaWEsIHRhaXAga29kIHNlY2FyYSBtYW51YWwuJ30pfX0KYXN5bmMgZnVuY3Rpb24gZG',
  '9TY2FuKGNvZGUpe2lmKCFjb2RlKXJldHVybiB0b2FzdCgnSW1iYXMgYXRhdSB0YWlwIGtvZCBRUicpO2NvbnN0IHBob3RvPWF3YWl0IHJlYWRJ',
  'bWcoJCgnI21wJykpLHJlbWFyaz0kKCcjbXInKS52YWx1ZTsKIGNvbnN0IHBvcz1hd2FpdCBuZXcgUHJvbWlzZShyPT5uYXZpZ2F0b3IuZ2VvbG',
  '9jYXRpb24/bmF2aWdhdG9yLmdlb2xvY2F0aW9uLmdldEN1cnJlbnRQb3NpdGlvbihwPT5yKHAuY29vcmRzKSwoKT0+cih7fSkse3RpbWVvdXQ6',
  'NTAwMH0pOnIoe30pKTsKIGNvbnN0IG09YXdhaXQgcnBjKCdzY2FuJyx7Y29kZSxyZW1hcmsscGhvdG8sbGF0OnBvcy5sYXRpdHVkZXx8JycsbG',
  '5nOnBvcy5sb25naXR1ZGV8fCcnfSk7aWYobSl7Y2xvc2VNKCk7dG9hc3QobSk7YWxtU3luYygpO2lmKFBBR0U9PSdQYXRyb2wnKWdvUGFnZSgn',
  'UGF0cm9sJyl9fQooYXN5bmMgZnVuY3Rpb24oKXt2YXIgbD1kb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnbG1zZycpO2wuc3R5bGUuY29sb3I9Jy',
  'M2Yjc3OTQnO2wudGV4dENvbnRlbnQ9J01lbnlhbWJ1bmcga2Ugc2VydmVyLi4uJzt2YXIgZD1hd2FpdCBycGMoJ3BpbmcnLHt9LDYwMDApOwpp',
  'ZighZCl7VFI9J2ZldGNoJztsLnRleHRDb250ZW50PSdDdWJhIHNhbWJ1bmdhbiBhbHRlcm5hdGlmLi4uJztkPWF3YWl0IHJwYygncGluZycse3',
  '0sMjAwMDApfQppZihkKXtsLnN0eWxlLmNvbG9yPScjMTZhMzRhJztsLnRleHRDb250ZW50PSdTZXJ2ZXIgc2VkaWEgKCcrZCsnLCAnK1RSKycp',
  'JztzZXRUaW1lb3V0KCgpPT57bC50ZXh0Q29udGVudD0nJztsLnN0eWxlLmNvbG9yPScjZTExZDJhJ30sMzAwMCl9ZWxzZSBsLnN0eWxlLmNvbG',
  '9yPScjZTExZDJhJ30pKCk7CmRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdsYnRuJykuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLGRvTG9naW4p',
  'O2RvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdsYnRuMicpLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJyxkb1ZlcmlmeSk7ZG9jdW1lbnQuZ2V0RW',
  'xlbWVudEJ5SWQoJ2xjb2RlJykuYWRkRXZlbnRMaXN0ZW5lcigna2V5ZG93bicsZnVuY3Rpb24oZSl7aWYoZS5rZXk9PSdFbnRlcicpZG9WZXJp',
  'ZnkoKX0pOwo8L3NjcmlwdD48L2JvZHk+PC9odG1sPgo='
];
