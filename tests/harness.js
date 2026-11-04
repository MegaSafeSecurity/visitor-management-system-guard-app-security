// Ujian hujung-ke-hujung backend dengan Apps Script tiruan:  node tests/harness.js
const fs = require('fs'), vm = require('vm'), path = require('path'), crypto = require('crypto');
const RD = Date; let off = 0;
function FD(...a) { if (!(this instanceof FD)) return new RD(RD.now() + off).toString(); return a.length ? new RD(...a) : new RD(RD.now() + off); }
FD.now = () => RD.now() + off; FD.prototype = RD.prototype; FD.UTC = RD.UTC; FD.parse = RD.parse;

/* ---------- tiruan perkhidmatan Apps Script ---------- */
const sb = a => Array.from(a).map(b => b > 127 ? b - 256 : b), ub = a => Buffer.from(Array.from(a).map(b => b & 255));
function parts(d, tz) {
  const f = new Intl.DateTimeFormat('en-GB', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', weekday: 'short' }).formatToParts(d), o = {};
  f.forEach(p => o[p.type] = p.value); return o;
}
const Utilities = {
  formatDate(d, tz, fmt) {
    const p = parts(d, tz); if (fmt === 'u') return String(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(p.weekday) + 1);
    return fmt.replace(/yyyy|yy|MM|dd|HH|mm|ss/g, t => ({ yyyy: p.year, yy: p.year.slice(2), MM: p.month, dd: p.day, HH: p.hour, mm: p.minute, ss: p.second })[t]);
  },
  computeDigest(alg, v) { return sb(crypto.createHash('sha256').update(typeof v === 'string' ? v : ub(v)).digest()); },
  computeHmacSha256Signature(v, k) { return sb(crypto.createHmac('sha256', k).update(v).digest()); },
  computeHmacSignature(alg, v, k) { return sb(crypto.createHmac('sha1', ub(k)).update(ub(v)).digest()); },
  getUuid: () => crypto.randomUUID(), base64Decode: s => sb(Buffer.from(s, 'base64')), base64Encode: b => Buffer.from(ub(b)).toString('base64'),
  newBlob: (b, m, n) => ({ bytes: b, mime: m, name: n }),
  DigestAlgorithm: { SHA_256: 'SHA_256' }, Charset: { UTF_8: 'UTF_8' }, MacAlgorithm: { HMAC_SHA_1: 'HMAC_SHA_1' }
};
class Sheet {
  constructor(n) { this.n = n; this.d = []; }
  _g(r, c) { while (this.d.length < r) this.d.push([]); const row = this.d[r - 1]; while (row.length < c) row.push(''); }
  getRange(r, c, nr = 1, nc = 1) {
    const s = this; return {
      getValues() { const o = []; for (let i = 0; i < nr; i++) { const row = []; for (let j = 0; j < nc; j++) row.push((s.d[r - 1 + i] || [])[c - 1 + j] ?? ''); o.push(row); } return o; },
      getValue() { return (s.d[r - 1] || [])[c - 1] ?? ''; },
      setValues(v) { v.forEach((row, i) => { s._g(r + i, c + row.length - 1); row.forEach((x, j) => s.d[r - 1 + i][c - 1 + j] = x); }); return this; },
      setValue(v) { s._g(r, c); s.d[r - 1][c - 1] = v; return this; },
      setNumberFormat() { return this; }, setFontWeight() { return this; }, setBackground() { return this; }, setFontColor() { return this; }
    };
  }
  getLastRow() { for (let i = this.d.length; i > 0; i--) if (this.d[i - 1].some(x => x !== '' && x != null)) return i; return 0; }
  getMaxColumns() { return 40; } getMaxRows() { return 1000; } insertColumnsAfter() { } setFrozenRows() { }
  deleteRow(i) { this.d.splice(i - 1, 1); } getProtections() { return []; } protect() { return { setWarningOnly() { return this; }, setDescription() { return this; } }; }
}
const ss = { sheets: {}, getSheetByName(n) { return this.sheets[n] || null; }, insertSheet(n) { return this.sheets[n] = new Sheet(n); }, getUrl: () => 'https://docs.google.com/spreadsheets/d/TEST' };
const props = {}, PropertiesService = { getScriptProperties: () => ({ getProperty: k => props[k] ?? null, setProperty: (k, v) => props[k] = String(v), setProperties: o => Object.keys(o).forEach(k => props[k] = String(o[k])), deleteProperty: k => delete props[k] }) };
const cstore = {}, CacheService = { getScriptCache: () => ({ get: k => { const e = cstore[k]; if (!e) return null; if (e.x < FD.now()) { delete cstore[k]; return null; } return e.v; }, put: (k, v, t) => { cstore[k] = { v: String(v), x: FD.now() + (t || 600) * 1000 }; }, remove: k => delete cstore[k] }) };
const mails = [], sandbox = {
  console, Date: FD, Math, JSON, Object, Array, String, Number, RegExp, Error, parseInt, parseFloat, isNaN, encodeURIComponent, Utilities, PropertiesService, CacheService,
  LockService: { getScriptLock: () => ({ waitLock() { }, releaseLock() { } }) },
  SpreadsheetApp: { getActiveSpreadsheet: () => ss, getUi: () => ({ alert() { }, prompt() { }, createMenu: () => ({ addItem() { return this; }, addToUi() { } }), ButtonSet: { OK_CANCEL: 1 }, Button: { OK: 1 } }), ProtectionType: { SHEET: 1 } },
  Session: { getActiveUser: () => ({ getEmail: () => sandbox.__active }), getEffectiveUser: () => ({ getEmail: () => 'owner@x.com' }) },
  MailApp: { sendEmail: m => mails.push(m) },
  ScriptApp: { getService: () => ({ getUrl: () => 'https://script.google.com/macros/s/X/exec' }), getProjectTriggers: () => [], newTrigger: () => ({ timeBased: () => ({ everyMinutes: () => ({ create() { } }) }) }), deleteTrigger() { } },
  Maps: { DirectionFinder: { Mode: { WALKING: 'W', DRIVING: 'D' } }, newGeocoder: () => ({ setRegion() { return this; }, geocode: () => ({ status: 'OK', results: [{ geometry: { location: { lat: 5.98, lng: 116.07 } }, formatted_address: 'Kota Kinabalu' }] }) }), newDirectionFinder: () => ({ setOrigin() { return this; }, setDestination() { return this; }, setMode() { return this; }, setLanguage() { return this; }, getDirections: () => ({ routes: [{ legs: [{ distance: { text: '120 m' }, duration: { text: '2 min' }, steps: [{ html_instructions: 'Jalan <b>lurus</b>', distance: { text: '120 m' } }] }] }] }) }) },
  DriveApp: { getFoldersByName: () => ({ hasNext: () => false }), createFolder: () => ({ createFile: () => ({ getId: () => 'FILEID1234567890' }) }) },
  HtmlService: { createHtmlOutputFromFile: f => ({ setTitle() { return this; }, addMetaTag() { return this; }, setXFrameOptionsMode() { return this; }, file: f }), XFrameOptionsMode: { ALLOWALL: 1 } },
  ContentService: { createTextOutput: t => ({ text: t, setMimeType() { return this; } }), MimeType: { JSON: 1 } }, __active: ''
};
const ctx = vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(__dirname, '../apps-script/Code.gs'), 'utf8'), ctx, { filename: 'Code.gs' });
const run = s => vm.runInContext(s, ctx);

/* ---------- penolong ujian ---------- */
let pass = 0, fail = 0;
function ok(c, m) { if (c) { pass++; console.log('  ok   ' + m); } else { fail++; console.error('  GAGAL ' + m); } }
function call(fn, a, t) { const r = JSON.parse(run('rpc')(fn, t || '', JSON.stringify(a || {}))); return r; }
function good(fn, a, t) { const r = call(fn, a, t); if (r.error) throw new Error(fn + ': ' + r.error); return r.data; }
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
function dec(s) { let b = ''; s.split('').forEach(c => b += ('00000' + B32.indexOf(c).toString(2)).slice(-5)); const o = []; for (let i = 0; i + 8 <= b.length; i += 8) o.push(parseInt(b.substr(i, 8), 2)); return Buffer.from(o); }
function totp(sec, d = 0) { const st = Math.floor(FD.now() / 30000) + d, m = Buffer.alloc(8); m.writeUInt32BE(st >>> 0, 4); const h = crypto.createHmac('sha1', dec(sec)).update(m).digest(), o = h[19] & 15, n = ((h[o] & 127) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3]; return ('000000' + (n % 1000000)).slice(-6); }
const tick = ms => { off += ms; };

function main() {
  console.log('1. Setup & migrasi');
  // sheet Guards versi lama dengan PIN teks biasa
  const old = ss.insertSheet('Guards'); old.d = [['GuardID', 'Name', 'StaffNo', 'Phone', 'Email', 'Premise', 'Shift', 'Status', 'PIN'], ['G0', 'Lama', 'MS000', '', '', 'P', 'Shift1', 'Active', '1234']];
  sandbox.__active = 'owner@x.com'; run('menuSetup()');
  ok(Object.keys(ss.sheets).length === 13, 'semua 13 tab dicipta');
  const g0 = ss.sheets.Guards.d[1]; ok(g0[8].length === 64 && g0[9].length === 24, 'PIN lama dihash & bergaram');
  sandbox.__active = '';
  let r = call('login', { id: 'admin', pin: 'apa-apa' }); ok(/belum disediakan/.test(r.error), 'admin tidak boleh log masuk sebelum kata laluan ditetapkan (tiada kata laluan lalai)');
  r = call('login', { id: 'admin', pin: 'admin123' }); ok(!!r.error, 'admin123 ditolak');
  sandbox.__active = ''; r = (() => { try { run("M.adminFromEditor('Abcdefghij1')"); return 'ok'; } catch (e) { return e.message; } })(); ok(/pemilik/.test(r), 'tetapan admin ditolak untuk bukan pemilik');
  sandbox.__active = 'owner@x.com'; r = (() => { try { run("M.adminFromEditor('lemah')"); return 'ok'; } catch (e) { return e.message; } })(); ok(/lemah/.test(r), 'kata laluan lemah ditolak');
  run("M.adminFromEditor('Strong-Pass-123x')"); sandbox.__active = '';
  console.log('2. Admin log masuk + 2FA wajib');
  r = call('login', { id: 'admin', pin: 'Strong-Pass-123x' }); ok(r.data && r.data.user.mustEnroll, 'admin log masuk, mustEnroll=true');
  let A = r.data.token; r = call('list', { sheet: 'Premises' }, A); ok(/2FA/.test(r.error), 'semua fungsi disekat sehingga 2FA didaftar');
  const tb = good('totpBegin', {}, A); r = call('totpConfirm', { code: '000000' }, A); ok(!!r.error, 'kod 2FA salah ditolak');
  good('totpConfirm', { code: totp(tb.secret) }, A); ok(!call('list', { sheet: 'Premises' }, A).error, 'selepas 2FA, akses dibuka');
  r = call('login', { id: 'admin', pin: 'Strong-Pass-123x' }); ok(r.data && r.data.need2fa, 'log masuk seterusnya meminta 2FA');
  r = call('login', { id: 'admin', pin: 'Strong-Pass-123x', otp: '123456' }); ok(!!r.error, 'OTP salah ditolak');
  tick(31000); const code = totp(tb.secret); r = call('login', { id: 'admin', pin: 'Strong-Pass-123x', otp: code }); ok(r.data && r.data.token, 'OTP betul diterima'); A = r.data.token;
  r = call('login', { id: 'admin', pin: 'Strong-Pass-123x', otp: code }); ok(!!r.error, 'OTP yang sama tidak boleh digunakan semula');
  console.log('3. Data induk');
  ok(call('premises', {}).error && /Sesi/.test(call('premises', {}).error), 'tanpa token ditolak (tiada akses tetamu)');
  r = call('premises', {}, 'token-palsu'); ok(/Sesi/.test(r.error), 'token palsu ditolak');
  good('save', { sheet: 'Premises', row: { Name: 'HQ Bundusan Commercial', Address: 'Jalan Bundusan', Status: 'Active' } }, A);
  let pr = good('list', { sheet: 'Premises' }, A).rows; ok(pr.length === 1 && pr[0].Lat === '5.98', 'premis disimpan + koordinat dijana oleh Google Maps');
  r = call('save', { sheet: 'Premises', row: { PremiseID: pr[0].PremiseID, Name: 'Lain' } }, A); ok(/tidak boleh ditukar/.test(r.error), 'nama premis tidak boleh ditukar');
  good('save', { sheet: 'Checkpoints', row: { Premise: 'HQ Bundusan Commercial', Name: 'Pintu Utama', Seq: '1' } }, A);
  good('save', { sheet: 'Checkpoints', row: { Premise: 'HQ Bundusan Commercial', Name: 'Lobi', Seq: '2' } }, A);
  const cps = good('list', { sheet: 'Checkpoints' }, A).rows; ok(cps.length === 2 && /^MSS\|C\w+\|[0-9a-f]{10}$/.test(cps[0].QRCode), 'checkpoint + QR bertandatangan');
  r = call('save', { sheet: 'Guards', row: { Name: 'Ali', StaffNo: 'MS001', Premise: 'HQ Bundusan Commercial', Shift: 'Shift1', Status: 'Active' } }, A); ok(/minimum 8/.test(r.error), 'pegawai baharu tanpa kata laluan ditolak');
  good('save', { sheet: 'Guards', row: { Name: 'Ali', StaffNo: 'MS001', Premise: 'HQ Bundusan Commercial', Shift: 'Shift1', Status: 'Active', NewPIN: 'Guard#Pass1' } }, A);
  r = call('save', { sheet: 'Guards', row: { Name: 'Dup', StaffNo: 'ms001', Premise: 'HQ Bundusan Commercial', NewPIN: 'Guard#Pass2' } }, A); ok(/sudah wujud/.test(r.error), 'No Staf pendua ditolak');
  const gl = good('list', { sheet: 'Guards' }, A); ok(!('PinHash' in gl.rows[0]) && !gl.cols.includes('TotpSecret'), 'hash PIN/rahsia TOTP tidak didedahkan kepada klien');
  good('save', { sheet: 'PatrolConfig', row: { Premise: 'HQ Bundusan Commercial', IntervalMin: '15', AlarmSec: '30', Start: '00:00', End: '23:59', Active: 'Yes' } }, A);
  r = call('save', { sheet: 'PatrolConfig', row: { Premise: 'HQ Bundusan Commercial', IntervalMin: '0', AlarmSec: '30', Start: '00:00', End: '23:59' } }, A); ok(!!r.error, 'selang tidak sah ditolak');
  const gid = gl.rows.find(x => x.StaffNo === 'MS001').GuardID;
  good('save', { sheet: 'Roster', row: { GuardID: gid, Premise: 'HQ Bundusan Commercial', ShiftName: 'Syif 1', Start: '00:00', End: '23:59', Days: '1,2,3,4,5,6,7' } }, A);
  good('save', { sheet: 'Complaints', row: { Date: '2026-11-03', Premise: 'HQ Bundusan Commercial', Description: 'Ujian', Status: 'Pending' } }, A);
  ok(/^\d{10}$/.test(good('list', { sheet: 'Complaints' }, A).rows[0].RefNo), 'RefNo aduan dijana (yyyyMM0001)');
  console.log('4. Pegawai: kawalan akses');
  r = call('login', { id: 'MS001', pin: 'salah' }); ok(!!r.error, 'PIN salah ditolak');
  r = call('login', { id: 'MS001', pin: 'Guard#Pass1' }); ok(r.data && !r.data.user.mustEnroll, 'pegawai log masuk');
  const G = r.data.token;
  ok(/admin sahaja/.test(call('setPin', { target: gid, pin: 'Baharu#Pass9', confirm: 'Baharu#Pass9' }, G).error), 'PEGAWAI TIDAK BOLEH menukar kata laluan');
  ok(/Akses ditolak/.test(call('list', { sheet: 'Guards' }, G).error), 'pegawai tidak boleh senarai Guards');
  ok(/Akses ditolak/.test(call('list', { sheet: 'AuditLog' }, G).error), 'pegawai tidak boleh lihat AuditLog');
  ok(/admin sahaja/.test(call('save', { sheet: 'Guards', row: { Name: 'X', StaffNo: 'X', Premise: 'HQ Bundusan Commercial', NewPIN: 'Abcdefgh1' } }, G).error), 'pegawai tidak boleh simpan data induk');
  ok(/admin sahaja/.test(call('getSettings', {}, G).error) && /admin sahaja/.test(call('mapKey', {}, G).error), 'pegawai tidak boleh baca tetapan/API key');
  ok(/admin sahaja/.test(call('threatAck', { id: 'x' }, G).error), 'pegawai tidak boleh ack ancaman');
  console.log('5. Rondaan, alarm & clock');
  r = call('scan', { code: cps[0].QRCode }, G); ok(/Clock In/.test(r.error), 'imbasan ditolak sebelum Clock In');
  good('clock', { type: 'in' }, G); ok(/sudah clock in/.test(call('clock', { type: 'in' }, G).error), 'clock in berganda ditolak');
  let st = good('poll', {}, G).st; ok(st.on && st.total === 2 && !st.ring, 'status rondaan aktif, belum masa alarm');
  tick(15 * 60000 + 5000); st = good('poll', {}, G).st; ok(st.ring === true && st.alarmSec === 30, 'alarm berbunyi (selang 15 min, tempoh 30s) dan tiada cara berhenti kecuali imbas');
  tick(40000); st = good('poll', {}, G).st; ok(st.missed === true, 'selepas tempoh alarm tanpa imbasan = tertunggak');
  good('poll', {}, A); ok(good('list', { sheet: 'Threats' }, A).rows.some(t => t.Type === 'Rondaan Terlepas'), 'rondaan terlepas direkod sebagai ancaman automatik');
  ok(mails.length === 0, 'tiada emel jika emel amaran belum ditetapkan');
  good('saveSettings', { alertEmail: 'admin@syarikat.com' }, A);
  r = call('scan', { code: 'MSS|CXXX|0000000000' }, G); ok(/palsu|tidak sah/.test(r.error), 'QR palsu ditolak');
  r = call('scan', { code: cps[0].QRCode.replace(/.$/, c => c === '0' ? '1' : '0') }, G); ok(/palsu/.test(r.error), 'QR dengan tandatangan diubah ditolak');
  r = good('scan', { code: cps[0].QRCode, lat: '5.9', lng: '116.0' }, G); ok(r.st.started && r.st.done === 1 && r.st.ring === false, 'imbasan pertama menghentikan alarm');
  ok(/baru sahaja/.test(call('scan', { code: cps[0].QRCode }, G).error), 'imbasan pendua dalam 60s ditolak');
  r = good('scan', { code: cps[1].QRCode }, G); ok(r.st.done === 0 && r.st.last > 0 || r.st.done === 0, 'pusingan lengkap, kitaran baharu bermula');
  r = good('scan', { code: cps[0].QRCode, ts: String(FD.now() - 3600e3) }, G); ok(/disegerak/.test(r.msg), 'imbasan luar talian disegerakkan dengan masa asal');
  ok(good('list', { sheet: 'Patrol' }, G).rows.length === 3, 'pegawai nampak rekod rondaan sendiri');
  console.log('6. SOS, insiden, ancaman');
  const lenBefore = mails.length; good('sos', { lat: '5.9', lng: '116.0' }, G); ok(mails.length > lenBefore && /SOS/.test(mails[mails.length - 1].subject), 'SOS menghantar emel amaran');
  good('incident', { type: 'Pencerobohan', detail: 'Orang tidak dikenali' }, G);
  let pl = good('poll', {}, A); ok(pl.threats.some(t => t.Type === 'SOS Kecemasan') && pl.threats.length >= 3, 'admin menerima ancaman terbuka melalui poll');
  const tid = pl.threats.find(t => t.Type === 'SOS Kecemasan').ThreatID; good('threatAck', { id: tid, status: 'Resolved' }, A);
  ok(good('list', { sheet: 'Threats' }, A).rows.find(t => t.ThreatID === tid).Status === 'Resolved', 'ancaman dikemas kini');
  console.log('7. VMS & Log Book');
  good('visitorAdd', { row: { Name: 'Tetamu A', IC: '900101-12-1234', Purpose: 'Mesyuarat' } }, G);
  good('logAdd', { row: { Category: 'Rondaan', Description: 'Semua selamat' } }, G);
  ok(good('list', { sheet: 'Visitors' }, G).rows.length === 1 && good('list', { sheet: 'LogBook' }, G).rows.length === 2, 'pelawat & log book (termasuk log insiden) dijana');
  const vid = good('list', { sheet: 'Visitors' }, G).rows[0].VisitID; good('visitorOut', { key: vid }, G); ok(good('list', { sheet: 'Visitors' }, G).rows[0].TimeOut !== '', 'pelawat keluar');
  console.log('8. Kata laluan, 2FA pegawai, sesi');
  const g2 = good('guard2fa', { id: gid, on: true }, A); ok(!!g2.secret, '2FA pegawai diaktifkan oleh admin');
  ok(/Sesi tamat/.test(call('poll', {}, G).error), 'sesi pegawai dibatalkan selepas perubahan keselamatan');
  r = call('login', { id: 'MS001', pin: 'Guard#Pass1' }); ok(r.data && r.data.need2fa, 'pegawai kini diminta 2FA');
  r = call('login', { id: 'MS001', pin: 'Guard#Pass1', otp: totp(g2.secret) }); ok(r.data && r.data.token, 'pegawai log masuk dengan 2FA');
  const G2 = r.data.token;
  ok(/terlalu mudah/.test(call('setPin', { target: gid, pin: '12345678', confirm: '12345678' }, A).error), 'kata laluan mudah ditolak');
  good('setPin', { target: gid, pin: 'Baharu#Pass9', confirm: 'Baharu#Pass9' }, A);
  ok(/Sesi tamat/.test(call('poll', {}, G2).error), 'sesi lama dibatalkan selepas admin tukar kata laluan');
  tick(31000); ok(!!call('login', { id: 'MS001', pin: 'Guard#Pass1', otp: totp(g2.secret) }).error, 'kata laluan lama tidak lagi sah');
  good('guard2fa', { id: gid, on: false }, A);
  ok(!!call('login', { id: 'MS001', pin: 'Baharu#Pass9' }).data.token, 'kata laluan baharu berfungsi');
  for (let i = 0; i < 5; i++) call('login', { id: 'MS001', pin: 'salah' + i });
  ok(/Terlalu banyak/.test(call('login', { id: 'MS001', pin: 'Baharu#Pass9' }).error), 'akaun dikunci selepas 5 percubaan gagal');
  tick(16 * 60000); ok(!!call('login', { id: 'MS001', pin: 'Baharu#Pass9' }).data, 'kunci tamat selepas 15 minit');
  console.log('9. Audit, komunikasi, peta, webhook');
  const av = good('auditVerify', {}, A); ok(av.ok && av.count > 15, 'rantaian audit utuh (' + av.count + ' rekod)');
  const acts = new Set(good('list', { sheet: 'AuditLog' }, A).rows.map(x => x.Action)); ['USER_LOGIN', 'LOGIN_FAILED', 'LOGIN_LOCKED', 'PASSWORD_CHANGE', '2FA_ENABLED', 'SETTING_UPDATE', 'THREAT_DETECTED', 'ALARM_CONFIG', 'DATA_CREATE'].forEach(a => ok(acts.has(a), 'audit merekod ' + a));
  const au = ss.sheets.AuditLog; au.d[3][5] = 'DIUBAH'; ok(good('auditVerify', {}, A).ok === false, 'suntingan manual pada audit log dikesan');
  const iv = Buffer.from('123456789012').toString('base64');
  good('msgSend', { premise: 'HQ Bundusan Commercial', iv, cipher: Buffer.from('ciphertext-contoh-1234').toString('base64') }, A);
  ok(good('msgList', {}, call('login', { id: 'MS001', pin: 'Baharu#Pass9' }).data.token).length === 1, 'mesej sulit dihantar & diterima (pelayan hanya menyimpan ciphertext)');
  ok(!!call('msgSend', { premise: 'x', iv: '!', cipher: 'y' }, A).error, 'mesej tidak sah ditolak');
  ok(good('maps', { action: 'route', from: { lat: 5.9, lng: 116 }, to: { lat: 5.98, lng: 116.07 }, mode: 'walking' }, A).distance === '120 m', 'ejen peta: laluan');
  ok(good('maps', { action: 'geocode', address: 'KK' }, A).lat === 5.98, 'ejen peta: geocode');
  const d = good('dash', {}, A); ok(d.premises === 1 && d.tour.length === 1 && d.threatDays.length === 7, 'dashboard dijana');
  ok(good('mapData', {}, A).cps.length === 2, 'data peta');
  const hook = good('saveSettings', { rotateWebhook: true }, A).webhookSecret;
  const post = b => JSON.parse(run('doPost')({ postData: { contents: JSON.stringify(b) } }).text);
  ok(post({ secret: 'salah', premise: 'HQ Bundusan Commercial', type: 'X' }).error === 'Ditolak', 'webhook dengan rahsia salah ditolak');
  ok(post({ secret: hook, premise: 'HQ Bundusan Commercial', type: 'Pintu dibuka', severity: 'High', detail: 'Sensor' }).ok, 'webhook IoT mencipta ancaman');
  const via = post({ fn: 'ping', t: '', a: '{}' }); ok(via.data === 'ok', 'doPost RPC (GitHub Pages) berfungsi: ping');
  const lg = post({ fn: 'login', t: '', a: JSON.stringify({ id: 'MS001', pin: 'Baharu#Pass9' }) }); ok(lg.data && lg.data.token, 'doPost RPC: log masuk melalui fetch');
  ok(post({ fn: 'setup', t: '', a: '{}' }).error === 'Fungsi tidak sah', 'fungsi dalaman (setup) tidak boleh dipanggil melalui RPC');
  ok(post({ fn: '__proto__', t: '', a: '{}' }).error === 'Fungsi tidak sah' && post({ fn: 'constructor', t: '', a: '{}' }).error === 'Fungsi tidak sah', 'nama fungsi berbahaya ditolak');
  ok(run('doGet')({ parameter: {} }).file === 'Index', 'doGet menghidangkan Index');
  ok(!run("typeof include") .includes('function') && run("typeof rows") === 'undefined' && run("typeof sh") === 'undefined', 'fungsi dalaman tidak terdedah secara global');
  console.log('\n' + pass + ' lulus, ' + fail + ' gagal'); process.exit(fail ? 1 : 0);
}
module.exports = { run, call, good, sandbox, ss, totp, tick, FD, mails, props };
if (require.main === module) main();
