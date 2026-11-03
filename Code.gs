/**
 * MEGA SAFE SECURITY SERVICES SDN BHD
 * Guard Tour · Visitor Register (VMS) · Security Log Book  —  v5.0
 *
 * Semua logik dibungkus dalam objek M (IIFE) supaya fungsi dalaman TIDAK boleh dipanggil
 * terus dari pelayar melalui google.script.run. Hanya fungsi global di bahagian bawah
 * (doGet, doPost, rpc, include, onOpen, menu*, tickWatchdog) yang terdedah.
 */
const TZ = 'Asia/Kuala_Lumpur';
const FOLDER = 'MegaSafe_Photos';

const M = (function () {
  /* ------------------------------------------------------------------ SKEMA */
  // Lajur baharu SENTIASA ditambah di hujung supaya data lama tidak rosak.
  const S = {
    Guards: ['GuardID', 'Name', 'StaffNo', 'Phone', 'Email', 'Premise', 'Shift', 'Status', 'PinHash', 'Salt', 'TotpSecret', 'TotpOn', 'PasskeyOn'],
    Premises: ['PremiseID', 'Name', 'Address', 'Status', 'Lat', 'Lng'],
    Checkpoints: ['CPID', 'Premise', 'Name', 'QRCode', 'Status', 'Lat', 'Lng', 'Seq'],
    PatrolConfig: ['Premise', 'IntervalMin', 'AlarmSec', 'Start', 'End', 'Active'],
    Roster: ['RosterID', 'GuardID', 'Guard', 'Premise', 'ShiftName', 'Start', 'End', 'Days'],
    Patrol: ['Timestamp', 'GuardID', 'Guard', 'Premise', 'Checkpoint', 'Lat', 'Lng', 'PhotoURL', 'Remark', 'CPID', 'Source'],
    Attendance: ['Date', 'GuardID', 'Guard', 'Premise', 'Shift', 'ClockIn', 'ClockOut'],
    Visitors: ['VisitID', 'TimeIn', 'Name', 'IC', 'Phone', 'Vehicle', 'Purpose', 'Host', 'Premise', 'PhotoURL', 'TimeOut', 'Guard'],
    LogBook: ['Timestamp', 'Premise', 'Guard', 'Category', 'Description', 'PhotoURL'],
    Complaints: ['RefNo', 'Date', 'Premise', 'Description', 'Status', 'Action'],
    Threats: ['ThreatID', 'Timestamp', 'Premise', 'Type', 'Severity', 'Guard', 'Detail', 'Lat', 'Lng', 'Status', 'AckBy', 'AckAt'],
    AuditLog: ['Seq', 'Timestamp', 'Action', 'Actor', 'Target', 'Detail', 'Device', 'PrevHash', 'Hash'],
    Messages: ['MsgID', 'Timestamp', 'Premise', 'FromID', 'FromName', 'IV', 'Cipher']
  };
  // Medan yang boleh disunting melalui save() (whitelist)
  const EDIT = {
    Guards: ['Name', 'StaffNo', 'Phone', 'Email', 'Premise', 'Shift', 'Status'],
    Premises: ['Name', 'Address', 'Status', 'Lat', 'Lng'],
    Checkpoints: ['Premise', 'Name', 'Status', 'Lat', 'Lng', 'Seq'],
    PatrolConfig: ['Premise', 'IntervalMin', 'AlarmSec', 'Start', 'End', 'Active'],
    Roster: ['GuardID', 'Premise', 'ShiftName', 'Start', 'End', 'Days'],
    Complaints: ['Date', 'Premise', 'Description', 'Status', 'Action']
  };
  const VIS = { Guards: ['GuardID', 'Name', 'StaffNo', 'Phone', 'Email', 'Premise', 'Shift', 'Status', 'TotpOn', 'PasskeyOn'] };
  const PFX = { Guards: 'G', Premises: 'P', Checkpoints: 'C', Roster: 'R' };
  const PUB = ['login', 'ping'];
  const ENROLL_OK = ['totpBegin', 'totpConfirm', 'logout', 'me'];
  const CTX = { dev: '' };
  const P = () => PropertiesService.getScriptProperties();
  const CA = () => CacheService.getScriptCache();

  /* ---------------------------------------------------------------- UTILITI */
  let _ss = null;
  function getSS() {
    if (_ss) return _ss;
    let s = SpreadsheetApp.getActiveSpreadsheet();
    if (!s) {
      const id = P().getProperty('SSID');
      if (id) s = SpreadsheetApp.openById(id);
      else { s = SpreadsheetApp.create('Mega Safe Security System'); P().setProperty('SSID', s.getId()); }
    }
    return (_ss = s);
  }
  const sh = n => getSS().getSheetByName(n);
  const now = () => Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm:ss');
  const fmtMs = ms => Utilities.formatDate(new Date(ms), TZ, 'yyyy-MM-dd HH:mm:ss');
  const fmt = v => v instanceof Date ? Utilities.formatDate(v, TZ, 'yyyy-MM-dd HH:mm:ss') : v;
  const tsOf = s => { const t = new Date(String(s).replace(' ', 'T') + '+08:00').getTime(); return isNaN(t) ? 0 : t; };
  const hex = b => b.map(x => ('0' + (x & 255).toString(16)).slice(-2)).join('');
  const sb = a => a.map(b => b > 127 ? b - 256 : b);
  const sha = s => hex(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(s), Utilities.Charset.UTF_8));
  function eq(a, b) { a = String(a); b = String(b); if (a.length !== b.length) return false; let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i); return r === 0; }
  function hashPin(pin, salt) { let h = String(pin) + salt; for (let i = 0; i < 2000; i++) h = sha(salt + h); return h; }
  const newSalt = () => sha(Utilities.getUuid() + Math.random() + Date.now()).slice(0, 24);
  const rnd = () => Math.floor(Math.random() * 90 + 10);
  function ownerOnly() {
    const a = Session.getActiveUser().getEmail(), e = Session.getEffectiveUser().getEmail();
    if (!a || a !== e) throw new Error('Akses pemilik sahaja.');
  }
  const bump = () => CA().put('ver', String(Date.now()), 21600);
  const stKey = prem => 'st_' + sha(prem).slice(0, 12);

  function rows(n, tail) {
    const s = sh(n); if (!s) return [];
    const lr = s.getLastRow(); if (lr < 2) return [];
    const k = S[n], start = tail && lr - tail > 1 ? lr - tail + 1 : 2;
    const v = s.getRange(start, 1, lr - start + 1, k.length).getValues();
    return v.filter(r => r[0] !== '').map(r => { const o = {}; k.forEach((c, i) => o[c] = fmt(r[i])); return o; });
  }
  function rowArr(n, o) { return S[n].map(c => o[c] == null ? '' : String(o[c])); }
  function rawAdd(n, o) {
    const s = sh(n), r = s.getLastRow() + 1;
    s.getRange(r, 1, 1, S[n].length).setNumberFormat('@').setValues([rowArr(n, o)]);
  }
  function withLock(fn) { const L = LockService.getScriptLock(); L.waitLock(20000); try { return fn(); } finally { L.releaseLock(); } }
  const add = (n, o) => withLock(() => rawAdd(n, o));
  function upd(n, i, o) { withLock(() => sh(n).getRange(i, 1, 1, S[n].length).setNumberFormat('@').setValues([rowArr(n, o)])); }
  function setCell(n, i, c, v) { withLock(() => sh(n).getRange(i, c).setNumberFormat('@').setValue(v)); }
  function rowIndex(n, key) {
    const s = sh(n), lr = s.getLastRow(); if (lr < 2) return -1;
    const c = s.getRange(1, 1, lr, 1).getValues();
    for (let i = 1; i < c.length; i++) if (String(c[i][0]) === String(key)) return i + 1;
    return -1;
  }
  function rowAt(n, i) { const v = sh(n).getRange(i, 1, 1, S[n].length).getValues()[0], o = {}; S[n].forEach((c, j) => o[c] = fmt(v[j])); return o; }
  function uid(n) { return (PFX[n] || 'X') + Utilities.formatDate(new Date(), TZ, 'yyMMddHHmmss') + rnd(); }
  function refNo() {
    const pre = Utilities.formatDate(new Date(), TZ, 'yyyyMM');
    const n = rows('Complaints').filter(x => String(x.RefNo).indexOf(pre) === 0).length + 1;
    return pre + ('0000' + n).slice(-4);
  }
  const hm = s => { const m = String(s).match(/^(\d{1,2}):(\d{2})/); return m ? (+m[1]) * 60 + (+m[2]) : -1; };
  const minsNow = () => hm(Utilities.formatDate(new Date(), TZ, 'HH:mm'));
  const validHM = s => /^([01]?\d|2[0-3]):[0-5]\d$/.test(String(s));

  /* ----------------------------------------------------------------- SETUP */
  function ensureSecrets() {
    const p = P();
    if (!p.getProperty('QR_SECRET')) p.setProperty('QR_SECRET', sha(Utilities.getUuid() + Math.random() + Date.now()) + sha(Math.random()));
  }
  function setup() {
    const ss = getSS();
    // migrasi PIN teks biasa (versi lama) -> hash
    const g = ss.getSheetByName('Guards');
    let legacy = null;
    if (g && g.getLastRow() >= 1 && g.getRange(1, 9).getValue() === 'PIN') {
      legacy = g.getLastRow() > 1 ? g.getRange(2, 1, g.getLastRow() - 1, 9).getValues() : [];
    }
    Object.keys(S).forEach(n => {
      const k = S[n];
      let s = ss.getSheetByName(n) || ss.insertSheet(n);
      if (s.getMaxColumns() < k.length) s.insertColumnsAfter(s.getMaxColumns(), k.length - s.getMaxColumns());
      s.getRange(1, 1, 1, k.length).setValues([k]).setFontWeight('bold').setBackground('#0a1a3a').setFontColor('#ffffff');
      s.getRange(2, 1, Math.max(s.getMaxRows() - 1, 1), k.length).setNumberFormat('@');
      s.setFrozenRows(1);
    });
    if (legacy) {
      legacy.forEach((r, i) => {
        if (r[0] === '') return;
        const pin = String(r[8]), salt = newSalt();
        ss.getSheetByName('Guards').getRange(i + 2, 9, 1, 2).setNumberFormat('@').setValues([[hashPin(pin, salt), salt]]);
      });
    }
    ensureSecrets();
    // tandatangani semula QR checkpoint lama
    rows('Checkpoints').forEach(c => {
      const i = rowIndex('Checkpoints', c.CPID), code = qrCode(c.CPID);
      if (i > 0 && c.QRCode !== code) setCell('Checkpoints', i, 4, code);
    });
    const au = ss.getSheetByName('AuditLog'); if (au && !au.getProtections(SpreadsheetApp.ProtectionType.SHEET).length) au.protect().setWarningOnly(true).setDescription('Audit log - jangan ubah');
    return 'Setup siap. Sheet: ' + ss.getUrl();
  }
  function ready() { if (!sh('Guards') || !sh('AuditLog') || !sh('Messages')) setup(); }
  function qrSig(cpid) {
    return hex(Utilities.computeHmacSha256Signature(String(cpid), P().getProperty('QR_SECRET') || '')).slice(0, 10);
  }
  const qrCode = cpid => 'MSS|' + cpid + '|' + qrSig(cpid);

  /* ----------------------------------------------------------------- AUDIT */
  function audit(action, actor, target, detail) {
    try {
      withLock(() => {
        const p = P(), prev = p.getProperty('AUDIT_LAST') || 'GENESIS', seq = (+p.getProperty('AUDIT_SEQ') || 0) + 1, t = now();
        const dev = CTX.dev || '', d = String(detail || '').slice(0, 500);
        const h = sha([prev, seq, t, action, actor, target, d, dev].join('|'));
        rawAdd('AuditLog', { Seq: seq, Timestamp: t, Action: action, Actor: actor, Target: target || '-', Detail: d, Device: dev, PrevHash: prev, Hash: h });
        p.setProperties({ AUDIT_LAST: h, AUDIT_SEQ: String(seq) });
      });
    } catch (e) { console.error('audit gagal: ' + e); }
  }
  function verifyAudit() {
    const r = rows('AuditLog'); let prev = 'GENESIS';
    for (let i = 0; i < r.length; i++) {
      const x = r[i], h = sha([prev, x.Seq, x.Timestamp, x.Action, x.Actor, x.Target, x.Detail, x.Device].join('|'));
      if (x.PrevHash !== prev || x.Hash !== h) return { ok: false, count: r.length, brokenAt: x.Seq };
      prev = h;
    }
    return { ok: r.length === 0 || prev === P().getProperty('AUDIT_LAST'), count: r.length, brokenAt: null };
  }

  /* ------------------------------------------------------------------ TOTP */
  const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  function b32enc(bytes) { let b = '', o = ''; bytes.forEach(x => b += ((x & 255) + 256).toString(2).slice(1)); for (let i = 0; i < b.length; i += 5) o += B32[parseInt((b.substr(i, 5) + '0000').slice(0, 5), 2)]; return o; }
  function b32dec(s) { let b = ''; s.split('').forEach(c => b += ('00000' + B32.indexOf(c).toString(2)).slice(-5)); const o = []; for (let i = 0; i + 8 <= b.length; i += 8) o.push(parseInt(b.substr(i, 8), 2)); return o; }
  function newSecret() { return b32enc(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, Utilities.getUuid() + Math.random() + Date.now() + Utilities.getUuid()).slice(0, 20)); }
  function totpAt(secret, step) {
    const msg = [0, 0, 0, 0, (step >>> 24) & 255, (step >>> 16) & 255, (step >>> 8) & 255, step & 255];
    const h = Utilities.computeHmacSignature(Utilities.MacAlgorithm.HMAC_SHA_1, sb(msg), sb(b32dec(secret))).map(b => b & 255);
    const o = h[19] & 15, n = ((h[o] & 127) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3];
    return ('000000' + (n % 1000000)).slice(-6);
  }
  function verifyTotp(secret, code, id) {
    code = String(code).replace(/\s/g, ''); if (!/^\d{6}$/.test(code) || !secret) return false;
    const c = CA(), k = 'otp_' + id + '_' + code; if (c.get(k)) return false; // elak guna semula
    const st = Math.floor(Date.now() / 30000);
    for (let d = -1; d <= 1; d++) if (eq(totpAt(secret, st + d), code)) { c.put(k, '1', 120); return true; }
    return false;
  }
  const otpUri = (label, secret) => 'otpauth://totp/' + encodeURIComponent('MegaSafe:' + label) + '?secret=' + secret + '&issuer=MegaSafe&digits=6&period=30';

  /* ---------------------------------------------------------------- SESI */
  function auth(t) {
    if (!t) throw new Error('Sesi tamat. Sila log masuk semula.');
    const c = CA().get('tk_' + t);
    if (!c) throw new Error('Sesi tamat. Sila log masuk semula.');
    const u = JSON.parse(c), rev = +(CA().get('rev_' + u.id) || 0);
    if (rev && u.iat < rev) { CA().remove('tk_' + t); throw new Error('Sesi tamat. Sila log masuk semula.'); }
    return u;
  }
  const revoke = id => CA().put('rev_' + id, String(Date.now()), 21600);
  const putSession = (t, u) => CA().put('tk_' + t, JSON.stringify(u), 21600);
  const needAdmin = u => { if (!u || u.role !== 'admin') throw new Error('Akses admin sahaja.'); };

  /* ----------------------------------------------------------- JADUAL SYIF */
  function inShift(gid) {
    const r = rows('Roster').filter(x => x.GuardID === gid);
    if (!r.length) return true; // tiada roster = tiada sekatan
    const dow = +Utilities.formatDate(new Date(), TZ, 'u'), prev = dow === 1 ? 7 : dow - 1, m = minsNow(), G = 30;
    return r.some(x => {
      const days = String(x.Days).split(',').map(Number), a = hm(x.Start), b = hm(x.End);
      if (a < 0 || b < 0) return false;
      if (a < b) return days.indexOf(dow) >= 0 && m >= a - G && m <= b;
      return (days.indexOf(dow) >= 0 && m >= a - G) || (days.indexOf(prev) >= 0 && m < b);
    });
  }
  function openAtt(gid) {
    const s = sh('Attendance'), lr = s.getLastRow(); if (lr < 2) return 0;
    const st = Math.max(2, lr - 299), v = s.getRange(st, 1, lr - st + 1, 7).getValues();
    for (let i = v.length - 1; i >= 0; i--) if (v[i][1] === gid && !v[i][6] && tsOf(fmt(v[i][5])) > Date.now() - 20 * 3600e3) return st + i;
    return 0;
  }

  /* ------------------------------------------------------ KONFIG & ALARM */
  function cfg(prem) {
    const c = rows('PatrolConfig').find(x => x.Premise === prem);
    return { interval: Math.max(1, +(c && c.IntervalMin) || 60), alarm: Math.max(5, +(c && c.AlarmSec) || 60), start: (c && c.Start) || '00:00', end: (c && c.End) || '23:59', active: !c || c.Active !== 'No' };
  }
  function inWin(a, b) { const m = minsNow(); return a <= b ? (m >= a && m <= b) : (m >= a || m <= b); }
  function state(prem) {
    const c = CA(), ck = stKey(prem), hit = c.get(ck);
    if (hit) { const o = JSON.parse(hit); o.now = Date.now(); return o; }
    const cf = cfg(prem);
    const cps = rows('Checkpoints').filter(x => x.Premise === prem && x.Status !== 'Inactive').sort((a, b) => ((+a.Seq || 999) - (+b.Seq || 999)) || String(a.CPID).localeCompare(String(b.CPID)));
    const open = rows('Attendance', 400).filter(x => x.Premise === prem && !x.ClockOut && tsOf(x.ClockIn) > Date.now() - 20 * 3600e3);
    const pat = rows('Patrol', 1500).filter(x => x.Premise === prem && x.CPID).map(p => ({ t: tsOf(p.Timestamp), k: p.CPID })).sort((a, b) => a.t - b.t);
    let set = {}, last = 0;
    pat.forEach(p => { if (cps.some(x => x.CPID === p.k)) { set[p.k] = p.t; if (cps.every(x => set[x.CPID])) { last = p.t; set = {}; } } });
    const base = last || (open.length ? Math.min.apply(null, open.map(x => tsOf(x.ClockIn))) : 0);
    const nowMs = Date.now(), a = hm(cf.start), b = hm(cf.end);
    const on = cps.length > 0 && cf.active && open.length > 0 && base > 0 && inWin(a, b);
    const due = base ? base + cf.interval * 60000 : 0;
    const started = Object.keys(set).some(k => set[k] >= due);
    const st = {
      prem: prem, on: on, due: due, now: nowMs, interval: cf.interval, alarmSec: cf.alarm, started: started,
      total: cps.length, done: Object.keys(set).length, last: last,
      cps: cps.map(x => ({ CPID: x.CPID, Name: x.Name, QRCode: x.QRCode, done: !!set[x.CPID], at: set[x.CPID] ? fmtMs(set[x.CPID]) : '' })),
      ring: on && nowMs >= due && !started && nowMs < due + cf.alarm * 1000,
      missed: on && nowMs >= due + cf.alarm * 1000 && !started,
      onDuty: open.map(x => x.Guard)
    };
    c.put(ck, JSON.stringify(st), 4);
    return st;
  }
  const dropState = prem => CA().remove(stKey(prem));

  /* ------------------------------------------------------------- ANCAMAN */
  function mail(subject, body, key) {
    try {
      const to = P().getProperty('ALERT_EMAIL'); if (!to) return;
      const c = CA(), k = 'ml_' + sha(key || subject).slice(0, 14); if (c.get(k)) return;
      c.put(k, '1', 300);
      MailApp.sendEmail({ to: to, subject: '[MEGA SAFE] ' + subject, body: body + '\n\nMasa: ' + now() });
    } catch (e) { console.error('mel gagal: ' + e); }
  }
  function threat(prem, type, sev, guard, detail, lat, lng) {
    const id = 'T' + Utilities.formatDate(new Date(), TZ, 'yyMMddHHmmss') + rnd();
    add('Threats', { ThreatID: id, Timestamp: now(), Premise: prem, Type: type, Severity: sev, Guard: guard || '', Detail: detail || '', Lat: lat || '', Lng: lng || '', Status: 'Open' });
    audit('THREAT_DETECTED', guard || 'SISTEM', prem, type + ' | ' + sev + ' | ' + (detail || ''));
    bump();
    mail('Ancaman ' + sev + ': ' + type + ' @ ' + prem, 'Premis: ' + prem + '\nJenis: ' + type + '\nTahap: ' + sev + '\nPegawai: ' + (guard || '-') + '\nButiran: ' + (detail || '-'), id);
    return id;
  }
  function watchdog(force) {
    const c = CA(); if (!force && c.get('wd')) return; c.put('wd', '1', 50);
    rows('Premises').filter(p => p.Status !== 'Inactive').forEach(p => {
      const st = state(p.Name), k = 'miss_' + sha(p.Name + st.due).slice(0, 14);
      if (st.on && st.missed && !c.get(k)) {
        c.put(k, '1', 21600);
        threat(p.Name, 'Rondaan Terlepas', 'High', 'SISTEM', 'Tiada imbasan checkpoint sejak ' + fmtMs(st.due) + ' (selang ' + st.interval + ' minit).', '', '');
      }
    });
  }

  /* ------------------------------------------------------------- GAMBAR */
  function folder() { const it = DriveApp.getFoldersByName(FOLDER); return it.hasNext() ? it.next() : DriveApp.createFolder(FOLDER); }
  function saveImg(data, tag) {
    if (!data) return '';
    const m = String(data).match(/^data:(image\/(?:jpeg|png));base64,([A-Za-z0-9+/=]+)$/); if (!m) return '';
    if (m[2].length > 4 * 1024 * 1024) throw new Error('Gambar terlalu besar.');
    const f = folder().createFile(Utilities.newBlob(Utilities.base64Decode(m[2]), m[1], tag + '_' + now().replace(/[: ]/g, '-') + '.jpg'));
    return f.getId(); // fail kekal PRIVAT; dipaparkan melalui handler photo()
  }

  /* ------------------------------------------------------------- HANDLER */
  const H = {
    ping() { return 'ok'; },

    login(u, a) {
      ready();
      const id = String(a.id || '').trim(), pin = String(a.pin || ''), otp = String(a.otp || '').trim();
      if (!id || !pin) throw new Error('Masukkan ID dan kata laluan.');
      const c = CA(), lk = 'f_' + sha(id.toLowerCase()).slice(0, 16), fails = +(c.get(lk) || 0);
      if (fails >= 5) { audit('LOGIN_LOCKED', id, '-', 'Akaun dikunci 15 minit selepas 5 percubaan gagal'); throw new Error('Terlalu banyak percubaan. Cuba semula selepas 15 minit.'); }
      const p = P(); let user = null, sec = null, totpOn = false;
      if (id.toLowerCase() === 'admin') {
        const hs = p.getProperty('ADMIN_HASH'), salt = p.getProperty('ADMIN_SALT');
        if (!hs) throw new Error('Admin belum disediakan. Jalankan menu Mega Safe > Tetapkan kata laluan admin dalam Google Sheet.');
        if (eq(hashPin(pin, salt), hs)) { user = { role: 'admin', id: 'admin', name: 'Administrator Mega Safe' }; sec = p.getProperty('ADMIN_TOTP'); totpOn = p.getProperty('ADMIN_TOTP_ON') === '1'; }
      } else {
        const g = rows('Guards').find(x => String(x.StaffNo).toLowerCase() === id.toLowerCase());
        if (g && g.Status === 'Active' && g.Salt && eq(hashPin(pin, g.Salt), g.PinHash)) {
          user = { role: 'guard', id: g.GuardID, name: g.Name, premise: g.Premise, shift: g.Shift }; sec = g.TotpSecret; totpOn = g.TotpOn === '1';
        } else if (!g) hashPin(pin, 'x'); // samakan masa tindak balas
      }
      if (user && totpOn) { if (!otp) return { need2fa: true }; if (!verifyTotp(sec, otp, user.id)) user = null; }
      if (!user) { c.put(lk, String(fails + 1), 900); audit('LOGIN_FAILED', id, '-', 'ID/kata laluan/kod 2FA salah atau akaun tidak aktif'); throw new Error('ID, kata laluan atau kod 2FA salah, atau akaun tidak aktif.'); }
      c.remove(lk);
      user.mustEnroll = user.role === 'admin' && !totpOn;
      user.iat = Date.now();
      const t = Utilities.getUuid() + Utilities.getUuid();
      putSession(t, user);
      audit('USER_LOGIN', user.name, '-', totpOn ? 'Log masuk dengan Pengesahan Dua Faktor (2FA) berjaya' : 'Log masuk berjaya (2FA belum diaktifkan)');
      return { token: t, user: { role: user.role, id: user.id, name: user.name, premise: user.premise, shift: user.shift, mustEnroll: user.mustEnroll } };
    },
    logout(u) { CA().remove('tk_' + u.token); audit('USER_LOGOUT', u.name, '-', 'Log keluar'); return true; },
    me(u) { return { role: u.role, id: u.id, name: u.name, premise: u.premise, shift: u.shift, mustEnroll: !!u.mustEnroll }; },
    premises(u) { return rows('Premises').filter(p => p.Status !== 'Inactive' && (u.role === 'admin' || p.Name === u.premise)).map(p => p.Name); },
    guardsLite(u) { needAdmin(u); return rows('Guards').map(g => ({ id: g.GuardID, name: g.Name, staff: g.StaffNo, premise: g.Premise, status: g.Status })); },

    list(u, a) {
      const n = a.sheet; if (!S[n] || n === 'Messages') throw new Error('Sheet tidak sah');
      const guardOk = ['Premises', 'Visitors', 'LogBook', 'Patrol', 'Attendance'];
      if (u.role !== 'admin' && guardOk.indexOf(n) < 0) throw new Error('Akses ditolak.');
      let r = rows(n, n === 'AuditLog' || n === 'Patrol' || n === 'Attendance' ? 2000 : 0);
      if (u.role !== 'admin') {
        if (n === 'Patrol' || n === 'Attendance') r = r.filter(x => x.GuardID === u.id);
        else if (n === 'Premises') r = r.filter(x => x.Name === u.premise);
        else r = r.filter(x => x.Premise === u.premise);
      }
      if (['Patrol', 'Attendance', 'Visitors', 'LogBook', 'Complaints', 'Threats', 'AuditLog'].indexOf(n) >= 0) r.reverse();
      const cols = VIS[n] || S[n];
      return { cols: cols, rows: r.slice(0, 500).map(x => { const o = {}; cols.forEach(k => o[k] = x[k]); return o; }) };
    },

    save(u, a) {
      needAdmin(u);
      const n = a.sheet; if (!EDIT[n]) throw new Error('Sheet tidak sah');
      const inp = a.row || {}, key = S[n][0];
      const id = n === 'PatrolConfig' ? inp.Premise : inp[key];
      const idx = id ? rowIndex(n, id) : -1, old = idx > 0 ? rowAt(n, idx) : {};
      const o = Object.assign({}, old);
      EDIT[n].forEach(k => { if (inp[k] != null) o[k] = String(inp[k]).trim().slice(0, 1000); });
      const premNames = rows('Premises').map(p => p.Name);
      const isNew = idx < 0;
      if (!o[key]) o[key] = n === 'PatrolConfig' ? o.Premise : n === 'Complaints' ? refNo() : uid(n);
      let changed = EDIT[n].filter(k => String(old[k] == null ? '' : old[k]) !== String(o[k] == null ? '' : o[k]));
      let extra = '';

      if (n === 'Guards') {
        if (!o.Name || !o.StaffNo) throw new Error('Nama dan No Staf diperlukan.');
        if (String(o.StaffNo).toLowerCase() === 'admin') throw new Error('No Staf "admin" dilarang.');
        if (premNames.indexOf(o.Premise) < 0) throw new Error('Pilih premis yang sah.');
        if (['Active', 'Inactive'].indexOf(o.Status) < 0) o.Status = 'Active';
        const dup = rows('Guards').find(g => String(g.StaffNo).toLowerCase() === String(o.StaffNo).toLowerCase() && g.GuardID !== o.GuardID);
        if (dup) throw new Error('No Staf sudah wujud.');
        const np = String(inp.NewPIN || '');
        if (isNew && np.length < 8) throw new Error('Kata laluan awal pegawai diperlukan (minimum 8 aksara).');
        if (np) { if (np.length < 8) throw new Error('Kata laluan minimum 8 aksara.'); o.Salt = newSalt(); o.PinHash = hashPin(np, o.Salt); }
        if (isNew) { o.TotpOn = '0'; o.PasskeyOn = '0'; }
        if (o.Status === 'Inactive' && old.Status !== 'Inactive') revoke(o.GuardID);
        if (np && !isNew) { audit('PASSWORD_CHANGE', u.name, o.Name, 'Admin menetapkan kata laluan baharu untuk pegawai'); revoke(o.GuardID); }
      } else if (n === 'Premises') {
        if (!o.Name) throw new Error('Nama premis diperlukan.');
        if (!isNew && old.Name !== o.Name) throw new Error('Nama premis tidak boleh ditukar. Tandakan Inactive dan cipta premis baharu.');
        if (isNew && premNames.indexOf(o.Name) >= 0) throw new Error('Nama premis sudah wujud.');
        if (['Active', 'Inactive'].indexOf(o.Status) < 0) o.Status = 'Active';
        if ((!o.Lat || !o.Lng) && o.Address) { try { const g = geocode(o.Address); if (g) { o.Lat = String(g.lat); o.Lng = String(g.lng); extra = ' (koordinat dijana dari Google Maps)'; } } catch (e) { } }
      } else if (n === 'Checkpoints') {
        if (!o.Name || premNames.indexOf(o.Premise) < 0) throw new Error('Nama dan premis yang sah diperlukan.');
        if (['Active', 'Inactive'].indexOf(o.Status) < 0) o.Status = 'Active';
        o.QRCode = qrCode(o.CPID);
        if (o.Seq && isNaN(+o.Seq)) throw new Error('Urutan mesti nombor.');
      } else if (n === 'Roster') {
        const g = rows('Guards').find(x => x.GuardID === o.GuardID); if (!g) throw new Error('Pilih pegawai yang sah.');
        o.Guard = g.Name; if (!o.Premise) o.Premise = g.Premise;
        if (premNames.indexOf(o.Premise) < 0) throw new Error('Premis tidak sah.');
        if (!validHM(o.Start) || !validHM(o.End)) throw new Error('Masa mula/tamat tidak sah (HH:MM).');
        if (!/^[1-7](,[1-7])*$/.test(o.Days || '')) throw new Error('Pilih sekurang-kurangnya satu hari bertugas.');
        extra = ' ' + o.Start + '-' + o.End + ' hari ' + o.Days;
        changed = changed.concat(['Guard']);
      } else if (n === 'PatrolConfig') {
        if (premNames.indexOf(o.Premise) < 0) throw new Error('Pilih premis yang sah.');
        const iv = +o.IntervalMin, al = +o.AlarmSec;
        if (!(iv >= 1 && iv <= 720)) throw new Error('Selang rondaan mesti 1-720 minit.');
        if (!(al >= 5 && al <= 600)) throw new Error('Tempoh bunyi alarm mesti 5-600 saat.');
        if (!validHM(o.Start) || !validHM(o.End)) throw new Error('Waktu aktif tidak sah (HH:MM).');
        if (['Yes', 'No'].indexOf(o.Active) < 0) o.Active = 'Yes';
        extra = ' selang ' + iv + ' min, alarm ' + al + ' saat, ' + o.Start + '-' + o.End + ', aktif=' + o.Active;
      } else if (n === 'Complaints') {
        if (!o.Description || !o.Date) throw new Error('Tarikh dan butiran diperlukan.');
        if (['Pending', 'Justified', 'Approved', 'Rejected', 'Resolved', 'Settled'].indexOf(o.Status) < 0) o.Status = 'Pending';
      }
      if (idx > 0) upd(n, idx, o); else add(n, o);
      const act = n === 'PatrolConfig' ? 'ALARM_CONFIG' : n === 'Premises' && changed.indexOf('Lat') >= 0 ? 'SETTING_UPDATE' : (isNew ? 'DATA_CREATE' : 'DATA_UPDATE');
      audit(act, u.name, n + ':' + (o.Name || o.RefNo || o.Premise || o[key]), (isNew ? 'Baharu' : 'Ubah medan: ' + (changed.join(', ') || '-')) + extra);
      if (o.Premise) dropState(o.Premise);
      if (n === 'Premises' || n === 'Checkpoints' || n === 'PatrolConfig') CA().remove('wd');
      bump();
      return true;
    },

    del(u, a) {
      needAdmin(u);
      const n = a.sheet; if (!EDIT[n]) throw new Error('Sheet tidak sah');
      const i = rowIndex(n, a.key); if (i < 0) throw new Error('Rekod tiada');
      const o = rowAt(n, i);
      if (n === 'Premises') {
        if (rows('Guards').some(g => g.Premise === o.Name) || rows('Checkpoints').some(c => c.Premise === o.Name))
          throw new Error('Premis masih digunakan oleh pegawai/checkpoint. Tandakan sebagai Inactive.');
      }
      withLock(() => sh(n).deleteRow(i));
      if (n === 'Guards') revoke(o.GuardID);
      audit('DATA_DELETE', u.name, n + ':' + (o.Name || o.RefNo || o.Premise || a.key), 'Rekod dipadam');
      if (o.Premise) dropState(o.Premise);
      bump();
      return true;
    },

    setPin(u, a) {
      needAdmin(u);
      const t = String(a.target || ''), np = String(a.pin || '');
      if (np.length < 8) throw new Error('Kata laluan minimum 8 aksara.');
      if (np !== String(a.confirm || '')) throw new Error('Pengesahan kata laluan tidak sepadan.');
      if (/^(.)\1+$/.test(np) || /^(0123|1234|password|12345678)/i.test(np)) throw new Error('Kata laluan terlalu mudah diteka.');
      if (t === 'admin') {
        const s = newSalt(); P().setProperties({ ADMIN_SALT: s, ADMIN_HASH: hashPin(np, s) });
        audit('PASSWORD_CHANGE', u.name, 'Administrator', 'Admin menukar kata laluan sendiri'); revoke('admin');
        return 'Kata laluan admin dikemas kini. Sila log masuk semula.';
      }
      const i = rowIndex('Guards', t); if (i < 0) throw new Error('Pegawai tiada.');
      const g = rowAt('Guards', i); g.Salt = newSalt(); g.PinHash = hashPin(np, g.Salt);
      upd('Guards', i, g); revoke(g.GuardID);
      audit('PASSWORD_CHANGE', u.name, g.Name, 'Pentadbir mengemas kini kata laluan keselamatan untuk pegawai ' + g.Name);
      return 'Kata laluan ' + g.Name + ' dikemas kini.';
    },

    /* ---- 2FA ---- */
    totpBegin(u) {
      if (u.role !== 'admin') throw new Error('Pegawai: minta pentadbir mengaktifkan 2FA.');
      const s = newSecret(); CA().put('tp_' + u.id, s, 600);
      return { secret: s, uri: otpUri('Administrator', s) };
    },
    totpConfirm(u, a) {
      if (u.role !== 'admin') throw new Error('Akses admin sahaja.');
      const s = CA().get('tp_' + u.id); if (!s) throw new Error('Sesi pendaftaran tamat. Mulakan semula.');
      if (!verifyTotp(s, a.code, u.id + '_enrol')) throw new Error('Kod tidak betul.');
      P().setProperties({ ADMIN_TOTP: s, ADMIN_TOTP_ON: '1' });
      u.mustEnroll = false; putSession(u.token, u); CA().remove('tp_' + u.id);
      audit('2FA_ENABLED', u.name, 'Administrator', 'Pengesahan dua faktor admin diaktifkan');
      return true;
    },
    guard2fa(u, a) {
      needAdmin(u);
      const i = rowIndex('Guards', a.id); if (i < 0) throw new Error('Pegawai tiada.');
      const g = rowAt('Guards', i);
      if (a.on) {
        const s = newSecret(); g.TotpSecret = s; g.TotpOn = '1'; upd('Guards', i, g); revoke(g.GuardID);
        audit('2FA_ENABLED', u.name, g.Name, 'Admin mengaktifkan 2FA untuk pegawai');
        return { secret: s, uri: otpUri(g.StaffNo, s), name: g.Name };
      }
      g.TotpSecret = ''; g.TotpOn = '0'; upd('Guards', i, g); revoke(g.GuardID);
      audit('2FA_DISABLED', u.name, g.Name, 'Admin menyahaktifkan 2FA pegawai');
      return { off: true };
    },
    passkeyMark(u) {
      if (u.role !== 'guard') throw new Error('Untuk pegawai sahaja.');
      const i = rowIndex('Guards', u.id); if (i < 0) throw new Error('Pegawai tiada.');
      const g = rowAt('Guards', i); g.PasskeyOn = '1'; upd('Guards', i, g);
      audit('PASSKEY_ENROLLED', u.name, '-', 'Pendaftaran kunci pas luar talian (Offline Passkey) pada peranti mudah alih');
      return true;
    },

    /* ---- tetapan ---- */
    getSettings(u) {
      needAdmin(u); const p = P(), k = p.getProperty('MAPS_KEY') || '';
      return {
        alertEmail: p.getProperty('ALERT_EMAIL') || '', hasMapsKey: !!k, mapsKeyMasked: k ? k.slice(0, 6) + '…' + k.slice(-4) : '',
        webhook: !!p.getProperty('WEBHOOK_SECRET'), sheetUrl: getSS().getUrl(), execUrl: ScriptApp.getService().getUrl(),
        triggers: ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === 'tickWatchdog').length,
        totp: p.getProperty('ADMIN_TOTP_ON') === '1'
      };
    },
    saveSettings(u, a) {
      needAdmin(u); const p = P(), ch = []; let out = { ok: true };
      if (a.alertEmail != null) {
        const e = String(a.alertEmail).trim();
        if (e && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) throw new Error('Emel tidak sah.');
        if (e !== (p.getProperty('ALERT_EMAIL') || '')) { e ? p.setProperty('ALERT_EMAIL', e) : p.deleteProperty('ALERT_EMAIL'); ch.push('ALERT_EMAIL'); }
      }
      if (a.mapsKey != null && String(a.mapsKey).trim() !== '') {
        const k = String(a.mapsKey).trim(); if (!/^[A-Za-z0-9_\-]{20,80}$/.test(k)) throw new Error('Format Google Maps API key tidak sah.');
        p.setProperty('MAPS_KEY', k); ch.push('MAPS_KEY');
      }
      if (a.clearMapsKey) { p.deleteProperty('MAPS_KEY'); ch.push('MAPS_KEY (dibuang)'); }
      if (a.rotateWebhook) { const s = sha(Utilities.getUuid() + Math.random()); p.setProperty('WEBHOOK_SECRET', s); out.webhookSecret = s; ch.push('WEBHOOK_SECRET (dijana semula)'); }
      if (ch.length) audit('SETTING_UPDATE', u.name, 'Tetapan Sistem', 'Diubah: ' + ch.join(', '));
      return out;
    },
    mapKey(u) { needAdmin(u); return P().getProperty('MAPS_KEY') || ''; },
    auditVerify(u) { needAdmin(u); return verifyAudit(); },

    /* ---- Google Maps agent ---- */
    maps(u, a) {
      const act = a.action;
      if (act === 'geocode') { const g = geocode(String(a.address || '')); if (!g) throw new Error('Alamat tidak ditemui.'); return g; }
      if (act === 'route') {
        const pt = x => x && x.lat !== '' && x.lat != null && x.lng !== '' && x.lng != null ? [+x.lat, +x.lng] : null;
        const f = pt(a.from), t = pt(a.to); if (!f || !t) throw new Error('Koordinat asal/destinasi tiada. Tetapkan Lat/Lng pada Premis/Checkpoint.');
        const mode = a.mode === 'walking' ? Maps.DirectionFinder.Mode.WALKING : Maps.DirectionFinder.Mode.DRIVING;
        const d = Maps.newDirectionFinder().setOrigin(f[0], f[1]).setDestination(t[0], t[1]).setMode(mode).setLanguage('ms').getDirections();
        if (!d.routes || !d.routes.length) throw new Error('Laluan tidak ditemui.');
        const l = d.routes[0].legs[0];
        return { distance: l.distance.text, duration: l.duration.text, steps: l.steps.map(s => String(s.html_instructions).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() + ' (' + s.distance.text + ')'), link: 'https://www.google.com/maps/dir/?api=1&origin=' + f[0] + ',' + f[1] + '&destination=' + t[0] + ',' + t[1] + '&travelmode=' + (a.mode === 'walking' ? 'walking' : 'driving') };
      }
      if (act === 'places') {
        needAdmin(u); const k = P().getProperty('MAPS_KEY'); if (!k) throw new Error('Tetapkan Google Maps API key di Tetapan dahulu (aktifkan Places API).');
        const body = { textQuery: String(a.query || '').slice(0, 120) };
        if (a.lat && a.lng) body.locationBias = { circle: { center: { latitude: +a.lat, longitude: +a.lng }, radius: 3000 } };
        const r = UrlFetchApp.fetch('https://places.googleapis.com/v1/places:searchText', { method: 'post', contentType: 'application/json', headers: { 'X-Goog-Api-Key': k, 'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.location' }, payload: JSON.stringify(body), muteHttpExceptions: true });
        if (r.getResponseCode() !== 200) throw new Error('Places API: ' + r.getContentText().slice(0, 160));
        return (JSON.parse(r.getContentText()).places || []).slice(0, 8).map(p => ({ name: p.displayName && p.displayName.text, address: p.formattedAddress, lat: p.location && p.location.latitude, lng: p.location && p.location.longitude }));
      }
      throw new Error('Tindakan peta tidak sah.');
    },
    mapData(u) {
      needAdmin(u);
      return {
        premises: rows('Premises').filter(p => p.Status !== 'Inactive'),
        cps: rows('Checkpoints').filter(c => c.Status !== 'Inactive').map(c => ({ CPID: c.CPID, Premise: c.Premise, Name: c.Name, Lat: c.Lat, Lng: c.Lng, Seq: c.Seq })),
        threats: rows('Threats', 100).filter(t => t.Status === 'Open').reverse(),
        last: rows('Patrol', 60).filter(p => p.Lat && p.Lng).reverse().slice(0, 15).map(p => ({ Timestamp: p.Timestamp, Guard: p.Guard, Premise: p.Premise, Checkpoint: p.Checkpoint, Lat: p.Lat, Lng: p.Lng }))
      };
    },

    /* ---- dashboard & masa nyata ---- */
    dash(u) {
      needAdmin(u);
      const today = now().slice(0, 10), pat = rows('Patrol', 1500), gs = rows('Guards'), pr = rows('Premises').filter(p => p.Status !== 'Inactive');
      const attAll = rows('Attendance', 600), att = attAll.filter(x => x.Date === today || (!x.ClockOut && tsOf(x.ClockIn) > Date.now() - 20 * 3600e3));
      const openAtt = att.filter(x => !x.ClockOut && tsOf(x.ClockIn) > Date.now() - 20 * 3600e3);
      const tour = pr.map(p => {
        const st = state(p.Name), last = pat.filter(x => x.Premise === p.Name).pop();
        return { premise: p.Name, last: last ? last.Timestamp : '-', next: st.due ? fmtMs(st.due) : '-', done: st.done, total: st.total, status: !st.onDuty.length ? 'Understaffed' : (st.missed ? 'Critical' : 'OK') };
      });
      const guards = gs.filter(g => g.Status === 'Active').map(g => {
        const o = openAtt.find(x => x.GuardID === g.GuardID);
        const hasRoster = rows('Roster').some(r => r.GuardID === g.GuardID);
        return { name: g.Name, staff: g.StaffNo, premise: g.Premise, shift: g.Shift, status: o ? 'Bertugas' : (hasRoster && inShift(g.GuardID) ? 'Belum Lapor' : 'Off Duty'), since: o ? o.ClockIn : '' };
      });
      const th = rows('Threats', 500), days = [];
      for (let i = 6; i >= 0; i--) { const d = Utilities.formatDate(new Date(Date.now() - i * 864e5), TZ, 'yyyy-MM-dd'); days.push({ d: d.slice(5), n: th.filter(x => x.Timestamp.slice(0, 10) === d).length }); }
      const byType = {}; th.filter(x => tsOf(x.Timestamp) > Date.now() - 30 * 864e5).forEach(x => byType[x.Type] = (byType[x.Type] || 0) + 1);
      const cm = rows('Complaints');
      return {
        premises: pr.length, guards: gs.filter(x => x.Status === 'Active').length, inactive: gs.filter(x => x.Status !== 'Active').length,
        patrolToday: pat.filter(x => x.Timestamp.slice(0, 10) === today).length, onDuty: openAtt.length,
        visitorsIn: rows('Visitors', 500).filter(x => !x.TimeOut).length,
        complaints: cm.filter(x => x.Status === 'Pending').length, threatsOpen: th.filter(x => x.Status === 'Open').length,
        tour: tour, guardList: guards, threatDays: days, threatTypes: byType,
        complaintStats: { Pending: cm.filter(x => x.Status === 'Pending').length, Justified: cm.filter(x => x.Status === 'Justified').length, Approved: cm.filter(x => x.Status === 'Approved').length, Rejected: cm.filter(x => x.Status === 'Rejected').length },
        recentThreats: th.slice(-6).reverse(), recentComplaints: cm.slice(-6).reverse(),
        totpOn: P().getProperty('ADMIN_TOTP_ON') === '1'
      };
    },
    poll(u) {
      const o = { now: Date.now(), ver: CA().get('ver') || '0' };
      if (u.role === 'admin') { watchdog(false); o.threats = rows('Threats', 60).filter(t => t.Status === 'Open').reverse().slice(0, 10); }
      else o.st = state(u.premise);
      return o;
    },
    patrolState(u) { if (!u.premise) throw new Error('Untuk pegawai sahaja.'); return state(u.premise); },

    /* ---- operasi pegawai ---- */
    scan(u, a) {
      const parts = String(a.code || '').trim().split('|');
      if (parts[0] !== 'MSS' || parts.length < 3) throw new Error('Kod QR tidak sah.');
      if (!eq(qrSig(parts[1]), parts[2])) throw new Error('Kod QR palsu atau tidak sah.');
      const cp = rows('Checkpoints').find(x => x.CPID === parts[1] && x.Status !== 'Inactive');
      if (!cp) throw new Error('Checkpoint tidak aktif atau tiada.');
      if (u.role === 'guard') {
        if (cp.Premise !== u.premise) throw new Error('Checkpoint ini bukan di premis anda (' + u.premise + ').');
        if (!inShift(u.id)) throw new Error('Anda di luar waktu syif. Hubungi pentadbir.');
      }
      let t = Date.now(), src = 'Online';
      if (a.ts) { const x = +a.ts; if (x > t - 864e5 && x < t + 120000) { t = x; src = 'Offline'; } }
      if (u.role === 'guard' && src === 'Online' && !openAtt(u.id)) throw new Error('Sila Clock In dahulu sebelum mengimbas.');
      const recent = rows('Patrol', 120).find(x => x.GuardID === u.id && x.CPID === cp.CPID && Math.abs(tsOf(x.Timestamp) - t) < 60000);
      if (recent) throw new Error('Checkpoint ini baru sahaja diimbas.');
      add('Patrol', { Timestamp: fmtMs(t), GuardID: u.id, Guard: u.name, Premise: cp.Premise, Checkpoint: cp.Name, Lat: a.lat || '', Lng: a.lng || '', PhotoURL: saveImg(a.photo, 'patrol'), Remark: String(a.remark || '').slice(0, 300), CPID: cp.CPID, Source: src });
      dropState(cp.Premise); bump();
      const st = state(cp.Premise);
      return { msg: 'Berjaya: ' + cp.Name + ' (' + st.done + '/' + st.total + ')' + (src === 'Offline' ? ' [disegerak dari luar talian]' : ''), st: st };
    },
    clock(u, a) {
      if (u.role !== 'guard') throw new Error('Untuk pegawai sahaja.');
      const t = now(), idx = openAtt(u.id);
      if (a.type === 'in') {
        if (idx > 0) throw new Error('Anda sudah clock in.');
        if (!inShift(u.id)) throw new Error('Anda di luar waktu syif. Clock In ditolak.');
        add('Attendance', { Date: t.slice(0, 10), GuardID: u.id, Guard: u.name, Premise: u.premise, Shift: u.shift, ClockIn: t });
      } else {
        if (idx < 1) throw new Error('Tiada rekod clock in yang terbuka.');
        setCell('Attendance', idx, 7, t);
      }
      dropState(u.premise); bump();
      return (a.type === 'in' ? 'Clock In ' : 'Clock Out ') + t;
    },
    visitorAdd(u, a) {
      const r = a.row || {}; if (!r.Name) throw new Error('Nama pelawat diperlukan.');
      const o = { VisitID: 'V' + Utilities.formatDate(new Date(), TZ, 'yyMMddHHmmss') + rnd(), TimeIn: now(), Guard: u.name, Premise: u.role === 'guard' ? u.premise : r.Premise, PhotoURL: saveImg(a.photo, 'visitor') };
      ['Name', 'IC', 'Phone', 'Vehicle', 'Purpose', 'Host'].forEach(k => o[k] = String(r[k] || '').slice(0, 200));
      add('Visitors', o); bump(); return true;
    },
    visitorOut(u, a) {
      const i = rowIndex('Visitors', a.key); if (i < 0) throw new Error('Rekod tiada');
      const r = rowAt('Visitors', i); if (u.role !== 'admin' && r.Premise !== u.premise) throw new Error('Akses ditolak.');
      setCell('Visitors', i, 11, now()); bump(); return true;
    },
    logAdd(u, a) {
      const r = a.row || {}; if (!r.Description) throw new Error('Butiran diperlukan.');
      add('LogBook', { Timestamp: now(), Premise: u.role === 'guard' ? u.premise : r.Premise, Guard: u.name, Category: String(r.Category || 'Lain-lain').slice(0, 40), Description: String(r.Description).slice(0, 1500), PhotoURL: saveImg(a.photo, 'log') });
      bump(); return true;
    },
    sos(u, a) {
      if (u.role !== 'guard') throw new Error('Untuk pegawai sahaja.');
      threat(u.premise, 'SOS Kecemasan', 'Critical', u.name, 'Butang SOS ditekan oleh pegawai.' + (a.offline ? ' (dihantar dari baris gilir luar talian)' : ''), a.lat, a.lng);
      return 'SOS dihantar. Pentadbir telah dimaklumkan.';
    },
    incident(u, a) {
      if (u.role !== 'guard') throw new Error('Untuk pegawai sahaja.');
      const types = ['Pencerobohan', 'Kebakaran', 'Kecurian', 'Kemalangan', 'Aktiviti Mencurigakan', 'Lain-lain'], ty = types.indexOf(a.type) >= 0 ? a.type : 'Lain-lain';
      if (!a.detail) throw new Error('Butiran insiden diperlukan.');
      threat(u.premise, ty, 'High', u.name, String(a.detail).slice(0, 300), a.lat, a.lng);
      add('LogBook', { Timestamp: now(), Premise: u.premise, Guard: u.name, Category: 'Insiden', Description: ty + ': ' + String(a.detail).slice(0, 1400), PhotoURL: saveImg(a.photo, 'incident') });
      return 'Insiden dilaporkan kepada pentadbir.';
    },
    threatAck(u, a) {
      needAdmin(u);
      const i = rowIndex('Threats', a.id); if (i < 0) throw new Error('Rekod tiada');
      const st = ['Acknowledged', 'Resolved', 'False Alarm'].indexOf(a.status) >= 0 ? a.status : 'Acknowledged';
      withLock(() => sh('Threats').getRange(i, 10, 1, 3).setNumberFormat('@').setValues([[st, u.name, now()]]));
      audit('THREAT_UPDATE', u.name, a.id, 'Status ancaman -> ' + st); bump(); return true;
    },
    photo(u, a) {
      const id = String(a.id || ''); if (!/^[A-Za-z0-9_-]{10,80}$/.test(id)) throw new Error('ID gambar tidak sah.');
      const f = DriveApp.getFileById(id), par = f.getParents(); let ok = false;
      while (par.hasNext()) if (par.next().getName() === FOLDER) ok = true;
      if (!ok) throw new Error('Gambar tidak dibenarkan.');
      return 'data:' + f.getMimeType() + ';base64,' + Utilities.base64Encode(f.getBlob().getBytes());
    },

    /* ---- komunikasi E2EE: pelayan hanya menyimpan teks sulit (ciphertext) ---- */
    msgList(u, a) {
      const prem = u.role === 'admin' ? String(a.premise || '') : u.premise;
      return rows('Messages', 200).filter(m => m.Premise === prem).slice(-80);
    },
    msgSend(u, a) {
      const prem = u.role === 'admin' ? String(a.premise || '') : u.premise;
      if (!prem) throw new Error('Pilih premis.');
      if (!/^[A-Za-z0-9+/=]{10,40}$/.test(a.iv || '') || !/^[A-Za-z0-9+/=]{10,6000}$/.test(a.cipher || '')) throw new Error('Mesej tidak sah.');
      add('Messages', { MsgID: 'M' + Utilities.formatDate(new Date(), TZ, 'yyMMddHHmmss') + rnd(), Timestamp: now(), Premise: prem, FromID: u.id, FromName: u.name, IV: a.iv, Cipher: a.cipher });
      bump(); return true;
    }
  };

  function geocode(addr) {
    const r = Maps.newGeocoder().setRegion('my').geocode(addr);
    if (r.status !== 'OK' || !r.results.length) return null;
    const g = r.results[0].geometry.location; return { lat: g.lat, lng: g.lng, formatted: r.results[0].formatted_address };
  }

  /* --------------------------------------------------------------- API */
  function rpc(fn, t, a) {
    try {
      a = JSON.parse(a || '{}'); CTX.dev = String(a._dev || '').slice(0, 80);
      if (!Object.prototype.hasOwnProperty.call(H, fn)) throw new Error('Fungsi tidak sah');
      let u = null;
      if (PUB.indexOf(fn) < 0) {
        u = auth(t); u.token = t;
        if (u.mustEnroll && ENROLL_OK.indexOf(fn) < 0) throw new Error('Sila aktifkan 2FA dahulu.');
      }
      return JSON.stringify({ data: H[fn](u, a) });
    } catch (e) { return JSON.stringify({ error: String(e.message || e) }); }
  }
  function ingest(body) {
    const sec = P().getProperty('WEBHOOK_SECRET');
    if (!sec || !eq(String(body.secret || ''), sec)) throw new Error('Ditolak');
    const prem = String(body.premise || ''); if (rows('Premises').map(p => p.Name).indexOf(prem) < 0) throw new Error('Premis tidak sah');
    const sev = ['Low', 'Medium', 'High', 'Critical'].indexOf(body.severity) >= 0 ? body.severity : 'High';
    CTX.dev = 'webhook';
    threat(prem, String(body.type || 'Amaran IoT').slice(0, 60), sev, 'IoT', String(body.detail || '').slice(0, 300), '', '');
    return { ok: true };
  }

  /* ------------------------------------------------------------ PEMILIK */
  function promptAdminPassword() {
    ownerOnly(); ready();
    const ui = SpreadsheetApp.getUi();
    const r = ui.prompt('Tetapkan kata laluan Admin', 'Minimum 10 aksara (huruf besar, kecil, nombor):', ui.ButtonSet.OK_CANCEL);
    if (r.getSelectedButton() !== ui.Button.OK) return;
    const pw = r.getResponseText();
    if (pw.length < 10 || !/[A-Z]/.test(pw) || !/[a-z]/.test(pw) || !/\d/.test(pw)) { ui.alert('Kata laluan terlalu lemah. Cuba lagi.'); return; }
    const s = newSalt(); P().setProperties({ ADMIN_SALT: s, ADMIN_HASH: hashPin(pw, s) });
    CTX.dev = 'editor'; audit('PASSWORD_CHANGE', 'Pemilik Skrip', 'Administrator', 'Kata laluan admin ditetapkan melalui menu Google Sheet');
    revoke('admin'); ui.alert('Selesai. Log masuk di web app dengan ID "admin". 2FA akan diminta didaftarkan pada log masuk pertama.');
  }
  function reset2FA() {
    ownerOnly(); P().deleteProperty('ADMIN_TOTP'); P().setProperty('ADMIN_TOTP_ON', '0'); revoke('admin');
    CTX.dev = 'editor'; audit('2FA_DISABLED', 'Pemilik Skrip', 'Administrator', '2FA admin direset oleh pemilik skrip (pemulihan)');
    return '2FA admin direset. Admin perlu mendaftar semula pada log masuk berikutnya.';
  }
  function installTriggers() {
    ownerOnly();
    ScriptApp.getProjectTriggers().forEach(t => { if (t.getHandlerFunction() === 'tickWatchdog') ScriptApp.deleteTrigger(t); });
    ScriptApp.newTrigger('tickWatchdog').timeBased().everyMinutes(5).create();
    return 'Trigger pemantauan rondaan (setiap 5 minit) dipasang.';
  }
  function webLogo() { return 'ok'; }

  return {
    rpc: rpc, ingest: ingest, setup: function () { ownerOnly(); return setup(); }, promptAdminPassword: promptAdminPassword,
    reset2FA: reset2FA, installTriggers: installTriggers, watchdog: function () { watchdog(true); }, webLogo: webLogo
  };
})();

/* ===================== FUNGSI GLOBAL YANG TERDEDAH ===================== */
function doGet(e) {
  if (e && e.parameter && e.parameter.ping) return ContentService.createTextOutput('OK');
  return HtmlService.createTemplateFromFile('Index').evaluate()
    .setTitle('Mega Safe Security Services Sdn Bhd')
    .addMetaTag('viewport', 'width=device-width,initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
function doPost(e) {
  let out;
  try { out = M.ingest(JSON.parse(e.postData.contents)); } catch (er) { out = { error: String(er.message || er) }; }
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}
function rpc(fn, t, a) { return M.rpc(fn, t, a); }
function include(f) { return HtmlService.createHtmlOutputFromFile(f).getContent(); }
function tickWatchdog() { M.watchdog(); }

// Menu Google Sheet (hanya pemilik; semua disemak dengan ownerOnly)
function onOpen() {
  try {
    SpreadsheetApp.getUi().createMenu('Mega Safe')
      .addItem('1. Setup / Naik taraf sheet', 'menuSetup')
      .addItem('2. Tetapkan kata laluan Admin', 'menuAdminPassword')
      .addItem('3. Pasang pemantau rondaan (trigger)', 'menuTriggers')
      .addItem('4. Reset 2FA Admin (pemulihan)', 'menuReset2FA')
      .addToUi();
  } catch (e) { }
}
function menuSetup() { const m = M.setup(); try { SpreadsheetApp.getUi().alert(m); } catch (e) { } return m; }
function menuAdminPassword() { M.promptAdminPassword(); }
function menuTriggers() { const m = M.installTriggers(); try { SpreadsheetApp.getUi().alert(m); } catch (e) { } return m; }
function menuReset2FA() { const m = M.reset2FA(); try { SpreadsheetApp.getUi().alert(m); } catch (e) { } return m; }
