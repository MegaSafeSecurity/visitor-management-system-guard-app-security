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

//#region PAGE
function doGet() {
  return HtmlService.createTemplateFromFile('Index').evaluate()
    .setTitle('Mega Safe Security Services Sdn Bhd')
    .addMetaTag('viewport', 'width=device-width,initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
function include(f) { return HtmlService.createHtmlOutputFromFile(f).getContent(); }
//#endregion

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
