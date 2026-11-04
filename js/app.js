'use strict';
/* Mega Safe Security Services Sdn Bhd - antara muka (v5.0)
   Berjalan di GitHub Pages (fetch ke Apps Script) atau di dalam Apps Script (google.script.run). */
let T = null, U = null, PAGE = '', PREM = [], GL = [], DS = {}, QR = null, ST = null, OFF = 0, OFFMODE = false, LASTVER = '', SEEN = {}, NETFAIL = false, MAPK = null, POLLN = 0, PSEL = '', TAB = 'scan', LTAB = 'log', MTAB = 'prem', SELP = null, MD = null, GM = null, CPREM = '', CLKSEC = 0;
const $ = s => document.querySelector(s);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const DEV = ((navigator.userAgent.match(/\(([^)]+)\)/) || [0, ''])[1]).slice(0, 60);
function ls(k, v) { try { if (v === undefined) return JSON.parse(localStorage.getItem(k) || 'null'); if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch (e) { return null; } }
function toast(m) {
  const l = $('#login'); if (l && l.style.display !== 'none') { $('#lmsg').style.color = '#e11d2a'; $('#lmsg').textContent = m; }
  const t = $('#toast'); t.textContent = m; t.style.display = 'block'; clearTimeout(t._t); t._t = setTimeout(() => t.style.display = 'none', 4500);
}
window.onerror = function (m, s, l) { const t = $('#toast'); t.textContent = 'Ralat: ' + m + ' (baris ' + l + ')'; t.style.display = 'block'; };

/* ================= SAMBUNGAN KE PELAYAN (dwi-mod) ================= */
const API = String(window.MEGASAFE_API || '').trim();
const GSR = (window.google && google.script && google.script.run) || null;
function rawCall(fn, a) {
  const body = JSON.stringify(a);
  if (GSR && !API) return new Promise((ok, no) => GSR.withSuccessHandler(ok).withFailureHandler(no).rpc(fn, T || '', body));
  if (!API) return Promise.reject(new Error('URL Web App belum ditetapkan dalam js/config.js'));
  const ac = new AbortController(), tm = setTimeout(() => ac.abort(), 60000);
  return fetch(API, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ fn: fn, t: T || '', a: body }), redirect: 'follow', signal: ac.signal })
    .then(r => r.text()).finally(() => clearTimeout(tm));
}
function rpc(fn, a, quiet) {
  return new Promise(r => {
    NETFAIL = false; a = Object.assign({}, a || {}, { _dev: DEV });
    rawCall(fn, a).then(x => {
      let o; try { o = JSON.parse(x); } catch (e) { if (!quiet) toast('Respons pelayan tidak sah. Pastikan kod terkini di-deploy (Manage deployments > New version) dengan akses "Anyone".'); return r(null); }
      if (o.error) { if (/Sesi tamat/.test(o.error) && T && fn !== 'poll') forceOut(o.error); else if (!quiet) toast(o.error); r(null); } else r(o.data);
    }).catch(e => { NETFAIL = true; if (!quiet) toast(API ? 'Tidak dapat menyambung ke pelayan. Semak internet dan URL dalam js/config.js.' : (e && e.message || 'Tiada sambungan')); r(null); });
  });
}
function forceOut(m) { toast(m || 'Sesi tamat'); setTimeout(() => location.reload(), 1500); }

/* ================= BUNYI ALARM ================= */
let AC = null;
function audioCtx() { try { const A = window.AudioContext || window.webkitAudioContext; if (!AC) AC = new A(); if (AC.state === 'suspended') AC.resume(); } catch (e) { } return AC; }
document.addEventListener('click', audioCtx); document.addEventListener('touchstart', audioCtx, { passive: true });
function beep(n) {
  const a = audioCtx();
  if (a) for (let i = 0; i < (n || 3); i++) [880, 660].forEach((f, j) => { const o = a.createOscillator(), g = a.createGain(); o.type = 'square'; o.frequency.value = f; g.gain.value = .25; o.connect(g); g.connect(a.destination); const t = a.currentTime + i * .7 + j * .3; o.start(t); o.stop(t + .25); });
  try { navigator.vibrate && navigator.vibrate([300, 150, 300, 150, 300]); } catch (e) { }
}
let WL = null; async function wake() { try { if (navigator.wakeLock) WL = await navigator.wakeLock.request('screen'); } catch (e) { } }
document.addEventListener('visibilitychange', () => { if (!document.hidden && U && U.role === 'guard') wake(); });

/* ================= MASA (zon Asia/Kuala_Lumpur, diselaras dengan pelayan) ================= */
const nowS = () => Date.now() + OFF;
function klParts(ms) {
  const f = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kuala_Lumpur', hourCycle: 'h23', weekday: 'short', hour: '2-digit', minute: '2-digit' }).formatToParts(new Date(ms)), o = {};
  f.forEach(p => o[p.type] = p.value);
  return { dow: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(o.weekday) + 1, min: (+o.hour) * 60 + (+o.minute) };
}
const hmm = s => { const m = String(s).match(/^(\d{1,2}):(\d{2})/); return m ? (+m[1]) * 60 + (+m[2]) : -1; };
function rosterActive(r) { // sama dengan semakan pelayan (toleransi 30 minit)
  const k = klParts(nowS()), prev = k.dow === 1 ? 7 : k.dow - 1, days = String(r.Days).split(',').map(Number), a = hmm(r.Start), b = hmm(r.End), G = 30;
  if (a < 0 || b < 0) return false;
  if (a < b) return days.indexOf(k.dow) >= 0 && k.min >= a - G && k.min <= b;
  return (days.indexOf(k.dow) >= 0 && k.min >= a - G) || (days.indexOf(prev) >= 0 && k.min < b);
}
const fmtD = ms => { const s = Math.max(0, Math.ceil(ms / 1000)), h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60); return (h ? h + 'j ' : '') + String(m).padStart(2, '0') + 'm ' + String(s % 60).padStart(2, '0') + 's'; };
const DAYN = ['', 'Isnin', 'Selasa', 'Rabu', 'Khamis', 'Jumaat', 'Sabtu', 'Ahad'];

/* ================= NAVIGASI ================= */
const NAV = [
  { h: 'MENU UTAMA' },
  { k: 'dash', t: 'Dashboard (Overview)', r: 'a', c: 'g' }, { k: 'map', t: 'Central Monitoring', r: 'a' }, { k: 'Attendance', t: 'Attendance Record', r: 'ag' },
  { k: 'reports', t: 'Active Reports / View', r: 'a' }, { k: 'term', t: 'Guard Mobile Terminal', r: 'ag', c: 'g' }, { k: 'Visitors', t: 'Visitor Register (VMS)', r: 'ag' }, { k: 'logs', t: 'Security Log Book', r: 'ag' },
  { h: 'PENGURUSAN & HR', r: 'a' },
  { k: 'hr', t: 'HR Master', r: 'a', c: 'o' }, { k: 'manage', t: 'Manage Premises & QR', r: 'a' }, { k: 'roster', t: 'Duty Roster & Report', r: 'a' }, { k: 'settings', t: 'Tetapan & Kata Laluan', r: 'a', c: 'x' }];
const TITLES = {}; NAV.forEach(n => { if (n.k) TITLES[n.k] = n.t; });
function buildNav() {
  const role = U.role === 'admin' ? 'a' : 'g'; let h = '', pend = '';
  NAV.forEach(n => {
    if (n.h) { pend = n.r && n.r.indexOf(role) < 0 ? '' : `<h6>${n.h}</h6>`; return; }
    if (n.r.indexOf(role) < 0 || (OFFMODE && n.k !== 'term')) return;
    if (pend) { h += pend; pend = ''; }
    h += `<a data-k="${n.k}" onclick="goPage('${n.k}')"><i class="${n.c || ''}"></i>${n.t}</a>`;
  });
  $('#nav').innerHTML = h;
  const ps = $('#psel');
  if (U.role === 'admin') { ps.disabled = false; ps.innerHTML = '<option value="">Semua Premis</option>' + PREM.map(p => `<option ${p === PSEL ? 'selected' : ''}>${esc(p)}</option>`).join(''); }
  else { ps.innerHTML = `<option>${esc(U.premise || '-')}</option>`; ps.disabled = true; }
}
function setPSel(v) { PSEL = v; SELP = v || SELP; goPage(PAGE); }
const curPrem = () => U.role === 'admin' ? (PSEL || PREM[0] || '') : U.premise;
async function goPage(k) {
  PAGE = k; sd.classList.remove('o');
  document.querySelectorAll('#nav a').forEach(a => a.classList.toggle('on', a.dataset.k === k));
  $('#c').innerHTML = '<div class="card mut">Memuatkan...</div>'; window.scrollTo(0, 0);
  const f = { dash: showDash, map: showMap, term: showTerm, settings: showSettings, reports: showReports, hr: showHR, manage: showManage, roster: showRoster, logs: showLogs, Attendance: () => showSheet('Attendance'), Visitors: () => showSheet('Visitors') }[k];
  if (f) await f();
}

/* ================= LOG MASUK ================= */
async function doLogin() {
  const m = $('#lmsg'); m.style.color = '#e11d2a'; m.textContent = '';
  const id = $('#lid').value.trim(), pin = $('#lpw').value;
  if (!id || !pin) { m.textContent = 'Masukkan ID dan kata laluan.'; return; }
  $('#lbtn').disabled = true; const d = await rpc('login', { id, pin, otp: $('#lotp').value }); $('#lbtn').disabled = false;
  if (!d) return;
  if (d.need2fa) { $('#s2').style.display = ''; $('#lotp').focus(); m.style.color = '#6b7794'; m.textContent = 'Masukkan kod 2FA daripada aplikasi Authenticator.'; return; }
  T = d.token; U = d.user; $('#lpw').value = ''; $('#lotp').value = ''; await startApp();
}
async function startApp() {
  $('#login').style.display = 'none'; $('#app').style.display = 'block';
  $('#usr').textContent = U.name; $('#rol').textContent = U.role === 'admin' ? 'Administrator' : 'Pegawai Keselamatan'; $('#av').textContent = (U.name || '?')[0].toUpperCase();
  $('#sir').style.display = U.role === 'admin' ? '' : 'none'; $('#bell').style.display = U.role === 'admin' ? '' : 'none';
  if (U.mustEnroll) { buildNav(); return enrol2FA(); }
  PREM = (await rpc('premises')) || []; if (U.role === 'admin') GL = (await rpc('guardsLite')) || [];
  buildNav();
  if (U.role === 'guard') { wake(); await syncQ(); const s = await rpc('patrolState', {}, 1); if (s) setST(s); cacheProfile(); }
  goPage(U.role === 'admin' ? 'dash' : 'term'); pollLoop();
}
function doLogout() { if (T) rpc('logout', {}, 1).then(() => location.reload()); else location.reload(); }
$('#lbtn').addEventListener('click', doLogin);
$('#lpw').addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });
$('#lotp').addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });
$('#loff').addEventListener('click', offlineLogin);
if ((ls('pf') || []).length) $('#loff').style.display = '';
(async function () { // semakan sambungan pelayan pada skrin log masuk
  const l = $('#lmsg'); l.style.color = '#6b7794'; l.textContent = 'Menyambung ke pelayan...';
  const d = await rpc('ping', {}, 1);
  if (d) { l.style.color = '#16a34a'; l.textContent = 'Pelayan sedia'; setTimeout(() => { if (l.textContent === 'Pelayan sedia') l.textContent = ''; }, 2500); }
  else { l.style.color = '#e11d2a'; l.textContent = 'Tidak dapat sambung ke pelayan. Semak URL Web App (js/config.js) dan pastikan versi terkini di-deploy dengan akses "Anyone".'; }
})();
if ('serviceWorker' in navigator && API && (location.protocol === 'https:' || location.hostname === 'localhost')) navigator.serviceWorker.register('sw.js').catch(() => { });

/* ================= 2FA ================= */
const qrimg = (t, c) => { if (!window.qrcode) return ''; const q = qrcode(0, 'M'); q.addData(t); q.make(); return q.createDataURL(c || 6, 4); };
async function enrol2FA() {
  const d = await rpc('totpBegin'); if (!d) return; const im = qrimg(d.uri, 5);
  $('#mb').innerHTML = `<h3>Aktifkan Pengesahan Dua Faktor (2FA)</h3><p>Imbas kod QR dengan Google Authenticator atau Microsoft Authenticator, kemudian masukkan kod 6 digit.</p><div style="text-align:center">${im ? `<img src="${im}">` : ''}<p class="mono" style="word-break:break-all">${esc(d.secret)}</p><p class="mut">${im ? 'Atau taip kunci di atas secara manual.' : 'Taip kunci di atas dalam aplikasi Authenticator (Masukkan kunci setup).'}</p></div><label>Kod 6 digit</label><input id="tc" inputmode="numeric" maxlength="6"><button onclick="confirm2FA()">Sahkan & Aktifkan</button>`;
  md.style.display = 'grid';
}
async function confirm2FA() { if (await rpc('totpConfirm', { code: $('#tc').value })) { U.mustEnroll = false; closeM(); toast('2FA diaktifkan'); startApp(); } }

/* ================= UTILITI PAPARAN ================= */
const LBL = { Timestamp: 'Masa', TimeIn: 'Masa Masuk', TimeOut: 'Masa Keluar', ClockIn: 'Clock In', ClockOut: 'Clock Out', Guard: 'Pegawai', GuardID: 'ID', Premise: 'Premis', Checkpoint: 'Checkpoint', PhotoURL: 'Gambar', Remark: 'Catatan', Name: 'Nama', StaffNo: 'No Staf', Phone: 'Telefon', Address: 'Alamat', Description: 'Butiran', Category: 'Kategori', Date: 'Tarikh', RefNo: 'Ref No', Action: 'Tindakan / Denda', Status: 'Status', Shift: 'Syif', Purpose: 'Tujuan', Host: 'Hos', Vehicle: 'Kenderaan', Source: 'Sumber', Seq: 'Urutan', TotpOn: '2FA', PasskeyOn: 'Kunci Pas', IntervalMin: 'Selang (min)', AlarmSec: 'Alarm (saat)', Start: 'Mula', End: 'Tamat', Active: 'Aktif', ShiftName: 'Nama Syif' };
const HIDE = { Patrol: ['GuardID', 'CPID', 'Lat', 'Lng'], Attendance: ['GuardID'], Visitors: ['VisitID', 'Guard'], Guards: ['GuardID'], Premises: ['PremiseID'], Checkpoints: ['CPID', 'Lat', 'Lng', 'QRCode'], Roster: ['RosterID', 'GuardID'], Complaints: [], LogBook: [], AuditLog: [], Threats: [] };
const pill = (v, cls) => `<span class="pill ${cls}">${esc(v)}</span>`;
const SCLS = { Active: 'ok', Inactive: 'bad', OK: 'ok', Critical: 'bad', Understaffed: 'warn', Pending: 'warn', Justified: 'info', Approved: 'ok', Rejected: 'bad', Resolved: 'gry', Settled: 'gry', Open: 'bad', Acknowledged: 'ok', 'False Alarm': 'gry', High: 'warn', Medium: 'info', Low: 'gry', Yes: 'ok', No: 'bad', Online: 'ok', Offline: 'warn' };
function cell(k, v, r) {
  v = v == null ? '' : v;
  if (k === 'PhotoURL') return v ? `<button class="s" onclick="showPhoto('${esc(v)}')">📷 Lihat</button>` : '<span class="mut">-</span>';
  if (k === 'TotpOn' || k === 'PasskeyOn') return v === '1' ? pill('Aktif', 'ok') : pill('-', 'gry');
  if (k === 'Status' || k === 'Severity' || k === 'Active' || k === 'Source') return v ? pill(v, SCLS[v] || 'gry') : '';
  if (k === 'Hash' || k === 'PrevHash') return `<span class="pill ok mono" title="${esc(v)}">✓ ${esc(String(v).slice(0, 10))}…</span>`;
  if (k === 'AuditAction') return pill(v, /DELETE|FAIL|LOCK|DISABLED|PASSWORD/.test(v) ? 'bad' : /LOGIN|LOGOUT|CREATE|ENABLED|ENROLLED/.test(v) ? 'ok' : /THREAT/.test(v) ? 'warn' : 'info');
  if (k === 'Days') return String(v).split(',').map(d => `<span class="chip">${(DAYN[+d] || '').slice(0, 3)}</span>`).join('');
  if (k === 'Premise') return `<span class="prem">${esc(v)}</span>`;
  if (/^(Timestamp|TimeIn|TimeOut|ClockIn|ClockOut|Date)$/.test(k)) return `<span class="mono">${esc(v)}</span>`;
  if (k === 'Hash' || k === 'RefNo' || k === 'IV') return `<span class="mono">${esc(v)}</span>`;
  return esc(v);
}
function closeM() { md.style.display = 'none'; if (QR) { QR.stop().catch(() => { }); QR = null; } }
async function showPhoto(id) { $('#mb').innerHTML = 'Memuatkan gambar...'; md.style.display = 'grid'; const d = await rpc('photo', { id }); if (!d) { closeM(); return; } $('#mb').innerHTML = `<img src="${d}" style="width:100%;border-radius:8px"><button class="ghost" style="width:100%;margin-top:8px" onclick="closeM()">Tutup</button>`; }
function dl(name, txt, type) { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([txt], { type })); a.download = name; a.click(); }
function csvOut(k) { const d = DS[k], q = x => '"' + String(x == null ? '' : x).replace(/"/g, '""') + '"'; dl(k + '_' + new Date().toISOString().slice(0, 10) + '.csv', '﻿' + [d.cols.map(q).join(',')].concat(d.rows.map(r => d.cols.map(c => q(r[c])).join(','))).join('\n'), 'text/csv'); }
function jsonOut(k) { dl(k + '.json', JSON.stringify(DS[k].rows, null, 2), 'application/json'); }
async function load(k, force) { const d = await rpc('list', { sheet: k }); if (d) DS[k] = d; return d; }
function inPrem(r) { if (!PSEL || U.role !== 'admin') return true; if (r.Premise !== undefined) return r.Premise === PSEL; if (r.PremiseID !== undefined) return r.Name === PSEL; return true; }
const stat = (l, n, sub, ico, al) => `<div class="stat ${al && n ? 'al' : ''}"><span>${l}</span><b>${n}</b><small>${sub || ''}</small>${ico ? `<em>${ico}</em>` : ''}</div>`;
const hero = (t, p, right, tag) => `<div class="hero"><div>${tag ? `<div class="tg">${tag}</div>` : ''}<h2>${t}</h2><p>${p || ''}</p></div><div>${right || ''}</div></div>`;

/* jadual dark umum: kandungan DS[k] */
function gtable(k, o) {
  o = o || {}; const d = DS[k]; if (!d) return ''; const hide = HIDE[k] || [], cols = d.cols.filter(c => hide.indexOf(c) < 0 && c !== 'Lat' && c !== 'Lng' || (k === 'Premises' && (c === 'Lat' || c === 'Lng')));
  const rows = d.rows.map((r, i) => ({ r, i })).filter(x => inPrem(x.r));
  const id = 't_' + k;
  const head = o.bare ? '' : `<div class="ttl"><b>${esc(o.title || '')}</b><div class="tb" style="margin:0"><input placeholder="Cari..." oninput="flt('${id}',this.value)">${o.filter ? o.filter : ''}${o.add ? `<button class="${o.addCls || ''}" onclick="openForm('${k}')">${o.add}</button>` : ''}${o.extra || ''}<button class="ghost" onclick="csvOut('${k}')">Eksport CSV</button>${k === 'AuditLog' ? `<button onclick="jsonOut('${k}')">Eksport JSON</button>` : ''}</div></div>`;
  return head + `<div class="tw"><table id="${id}"><tr>${cols.map(c => `<th>${LBL[c] || c}</th>`).join('')}${o.act ? '<th></th>' : ''}</tr>${rows.map(x => `<tr>${cols.map(c => `<td>${cell(c, x.r[c], x.r)}</td>`).join('')}${o.act ? `<td style="white-space:nowrap">${o.act(x.r, x.i)}</td>` : ''}</tr>`).join('') || `<tr><td class="empty" colspan="${cols.length + 1}">Tiada rekod.</td></tr>`}</table></div>`;
}
function flt(id, q) { q = q.toLowerCase(); document.querySelectorAll('#' + id + ' tr').forEach((t, i) => { if (i) t.style.display = t.textContent.toLowerCase().includes(q) ? '' : 'none'; }); }
const editActs = k => (r, i) => `<button class="s ghost" onclick="openForm('${k}',${i})">✎</button> <button class="s red" onclick="doDel('${k}',${i})">🗑</button>`;

/* ================= BORANG ================= */
const FORMS = {
  Guards: { t: 'Pegawai', f: ['Name', 'StaffNo', 'Phone', 'Email', 'Premise:@P', 'Shift:Shift1|Shift2|Shift3', 'Status:Active|Inactive', 'NewPIN:@K'] },
  Complaints: { t: 'Rekod Aduan & Salah Laku', f: ['Date:@D', 'Premise:@P', 'Description:@T', 'Status:Pending|Justified|Approved|Rejected|Resolved|Settled', 'Action'] },
  Premises: { t: 'Premis', f: ['Name', 'Address:@T', 'Lat', 'Lng', 'Status:Active|Inactive'] },
  Checkpoints: { t: 'Checkpoint', f: ['Premise:@P', 'Name', 'Seq:@N', 'Lat', 'Lng', 'Status:Active|Inactive'] },
  Roster: { t: 'Syif Pegawai', f: ['GuardID:@G', 'Premise:@P', 'ShiftName', 'Start:@H', 'End:@H', 'Days:@W'] },
  PatrolConfig: { t: 'Alarm Rondaan (Admin sahaja)', f: ['Premise:@P', 'IntervalMin:@N', 'AlarmSec:@N', 'Start:@H', 'End:@H', 'Active:Yes|No'] },
  Visitors: { t: 'Daftar Pelawat', v: 1, f: ['Name', 'IC', 'Phone', 'Vehicle', 'Purpose', 'Host', 'Premise:@Padm', 'Photo:@F'] },
  LogBook: { t: 'Tulis Log Book', l: 1, f: ['Category:Rondaan|Insiden|Kejadian|Serahan Tugas|Kenderaan|Lain-lain', 'Premise:@Padm', 'Description:@T', 'Photo:@F'] }
};
const DEF = { PatrolConfig: { IntervalMin: '60', AlarmSec: '60', Start: '00:00', End: '23:59', Active: 'Yes' }, Roster: { Start: '07:00', End: '15:00' }, Checkpoints: { Status: 'Active' }, Premises: { Status: 'Active' } };
const FHELP = { PatrolConfig: 'Selang = jarak antara rondaan. Alarm (saat) = berapa lama alarm berbunyi pada peranti pegawai. Pegawai hanya boleh menghentikan alarm dengan mengimbas checkpoint.', Roster: 'Pegawai hanya boleh Clock In dan mengimbas dalam waktu syif (toleransi 30 minit lebih awal).' };
function opts(s, v) {
  if (s === '@P') return PREM.map(o => `<option ${o === v ? 'selected' : ''}>${esc(o)}</option>`).join('');
  if (s === '@G') return GL.map(g => `<option value="${esc(g.id)}" ${g.id === v ? 'selected' : ''}>${esc(g.name)} (${esc(g.staff)})</option>`).join('');
  return s.split('|').map(o => `<option ${o === v ? 'selected' : ''}>${esc(o)}</option>`).join('');
}
function openForm(k, i) {
  const g = FORMS[k], row = i != null && DS[k] ? DS[k].rows[i] : {}; let f = g.f.filter(x => !(x.endsWith(':@Padm') && U.role !== 'admin'));
  $('#mb').innerHTML = `<h3>${g.t}</h3>${FHELP[k] ? `<p class="mut" style="font-size:12px">${FHELP[k]}</p>` : ''}` + f.map(x => {
    const [n, o0] = x.split(':'); const o = o0 === '@Padm' ? '@P' : o0, id = 'f_' + n, v = (row[n] == null || row[n] === '') ? ((i == null && DEF[k] && DEF[k][n]) || '') : row[n]; let el;
    if (!o) el = `<input id="${id}" value="${esc(v)}">`;
    else if (o === '@T') el = `<textarea id="${id}" rows="3">${esc(v)}</textarea>`;
    else if (o === '@D') el = `<input id="${id}" type="date" value="${esc(v || new Date().toISOString().slice(0, 10))}">`;
    else if (o === '@F') el = `<input id="${id}" type="file" accept="image/*" capture="environment">`;
    else if (o === '@N') el = `<input id="${id}" type="number" value="${esc(v)}">`;
    else if (o === '@H') el = `<input id="${id}" type="time" value="${esc(v)}">`;
    else if (o === '@K') el = `<input id="${id}" type="password" autocomplete="new-password" placeholder="${i != null ? 'Kosongkan jika tidak mahu tukar' : 'Minimum 8 aksara'}">`;
    else if (o === '@W') { const s = String(v || '1,2,3,4,5').split(','); el = `<div class="wk" id="${id}">${DAYN.slice(1).map((d, j) => `<label><input type="checkbox" value="${j + 1}" ${s.indexOf(String(j + 1)) >= 0 ? 'checked' : ''}>${d}</label>`).join('')}</div>`; }
    else el = `<select id="${id}">${opts(o, v)}</select>`;
    return `<label>${LBL[n] || n}</label>${el}`;
  }).join('') + `<div style="margin-top:10px"><button onclick="doSubmit('${k}',${i == null ? -1 : i})">Simpan</button> <button class="ghost" onclick="closeM()">Batal</button></div>`;
  md.style.display = 'grid';
}
function readImg(inp, max) {
  return new Promise(r => {
    const f = inp && inp.files && inp.files[0]; if (!f) return r('');
    const im = new Image(), u = URL.createObjectURL(f);
    im.onload = () => { const s = Math.min(1, (max || 800) / Math.max(im.width, im.height)), c = document.createElement('canvas'); c.width = im.width * s; c.height = im.height * s; c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); r(c.toDataURL('image/jpeg', .7)); };
    im.onerror = () => r(''); im.src = u;
  });
}
async function doSubmit(k, i) {
  const g = FORMS[k], row = i >= 0 ? Object.assign({}, DS[k].rows[i]) : {};
  document.querySelectorAll('#mb [id^=f_]').forEach(e => { const n = e.id.slice(2); if (e.type === 'file') return; row[n] = e.classList.contains('wk') ? [...e.querySelectorAll('input:checked')].map(x => x.value).join(',') : e.value; });
  if (g.v || g.l) {
    const photo = await readImg($('#f_Photo'), 800), r = await guardAct(g.v ? 'visitorAdd' : 'logAdd', { row, photo }, g.t);
    if (r) { closeM(); if (PAGE === 'Visitors' || PAGE === 'logs') goPage(PAGE); } return;
  }
  const ok = await rpc('save', { sheet: k, row });
  if (ok) { closeM(); toast('Disimpan'); if (k === 'Guards' || k === 'Premises') { PREM = (await rpc('premises')) || PREM; GL = (await rpc('guardsLite')) || GL; buildNav(); document.querySelectorAll('#nav a').forEach(a => a.classList.toggle('on', a.dataset.k === PAGE)); } goPage(PAGE); }
}
async function doDel(k, i) { const r = DS[k].rows[i]; if (confirm('Padam rekod ini?') && await rpc('del', { sheet: k, key: r[DS[k].cols[0]] })) { toast('Dipadam'); goPage(PAGE); } }
async function vout(key) { if (await rpc('visitorOut', { key })) { toast('Pelawat keluar'); goPage('Visitors'); } }
async function ack(id, s) { if (await rpc('threatAck', { id, status: s })) { toast('Dikemas kini'); goPage(PAGE); } }

/* ================= DASHBOARD (OVERVIEW) ================= */
async function showDash() {
  const d = await rpc('dash'); if (!d) return;
  const mx = Math.max(1, ...d.threatDays.map(x => x.n)), ty = Object.keys(d.threatTypes).sort((a, b) => d.threatTypes[b] - d.threatTypes[a]);
  $('#c').innerHTML = (d.totpOn ? '' : '<div class="card" style="border-left:4px solid var(--red)">⚠ 2FA admin belum aktif. Pergi ke Tetapan & Kata Laluan.</div>') +
    hero('Pusat Kawalan Keselamatan & Analisis Ancaman', 'Dikemas kini masa nyata (setiap 5 saat). Ancaman baharu membunyikan siren.', '<button class="ghost" onclick="beep(3)">🔊 Uji Siren</button> <button onclick="goPage(\'logs\')">Log Audit</button>') +
    `<div class="stats">${stat('Ancaman terbuka', d.threatsOpen, 'Perlu tindakan', '🚨', 1)}${stat('Premis aktif', d.premises, 'Dipantau', '🏢')}${stat('Pegawai aktif', d.guards, d.inactive + ' tidak aktif', '👮')}${stat('Sedang bertugas', d.onDuty, 'Clock in', '🟢')}${stat('Imbasan hari ini', d.patrolToday, 'Checkpoint', '📍')}${stat('Pelawat di dalam', d.visitorsIn, 'Belum keluar', '🪪')}${stat('Aduan belum selesai', d.complaints, 'Pending', '📋', 1)}</div>
  <div class="two"><div class="dk"><b>Ancaman 7 hari terakhir</b><div class="bar">${d.threatDays.map(x => `<div style="height:${Math.round(x.n / mx * 100)}%"><span>${x.n}</span></div>`).join('')}</div><div class="lab">${d.threatDays.map(x => `<span>${x.d}</span>`).join('')}</div></div>
  <div class="dk"><b>Jenis ancaman (30 hari)</b><div style="margin-top:10px">${ty.map(t => `<div style="display:flex;justify-content:space-between;border-bottom:1px solid #1b2947;padding:5px 0"><span>${esc(t)}</span><b>${d.threatTypes[t]}</b></div>`).join('') || '<span class="mut">Tiada ancaman direkodkan.</span>'}</div></div></div>
  <div class="ttl"><b>Status Rondaan</b></div><div class="tw"><table><tr><th>Premis</th><th>Rondaan Terakhir</th><th>Rondaan Seterusnya</th><th>Pusingan</th><th>Status</th></tr>${d.tour.map(t => `<tr><td><span class="prem">${esc(t.premise)}</span></td><td class="mono">${esc(t.last)}</td><td class="mono">${esc(t.next)}</td><td>${t.done}/${t.total}</td><td>${pill(t.status, SCLS[t.status])}</td></tr>`).join('') || '<tr><td class="empty" colspan="5">Tiada premis. Tambah di Manage Premises & QR.</td></tr>'}</table></div>
  <div class="ttl"><b>Ancaman Terkini</b></div>${thtml(d.recentThreats)}`;
}
function thtml(a) {
  return `<div class="tw"><table><tr><th>Masa</th><th>Premis</th><th>Jenis</th><th>Tahap</th><th>Pegawai</th><th>Butiran</th><th>Status</th><th></th></tr>${a.map(t => `<tr><td class="mono">${esc(t.Timestamp)}</td><td><span class="prem">${esc(t.Premise)}</span></td><td>${esc(t.Type)}</td><td>${pill(t.Severity, SCLS[t.Severity] || 'gry')}</td><td>${esc(t.Guard)}</td><td>${esc(t.Detail)}</td><td>${pill(t.Status, SCLS[t.Status] || 'gry')}</td><td style="white-space:nowrap">${t.Status === 'Open' ? `<button class="s green" onclick="ack('${esc(t.ThreatID)}','Acknowledged')">Terima</button> <button class="s ghost" onclick="ack('${esc(t.ThreatID)}','Resolved')">Selesai</button> <button class="s ghost" onclick="ack('${esc(t.ThreatID)}','False Alarm')">Salah</button>` : t.Status === 'Acknowledged' ? `<button class="s ghost" onclick="ack('${esc(t.ThreatID)}','Resolved')">Selesai</button>` : ''}</td></tr>`).join('') || '<tr><td class="empty" colspan="8">Tiada ancaman.</td></tr>'}</table></div>`;
}

/* ================= ACTIVE REPORTS / VIEW ================= */
async function showReports() {
  const [d, th, cm, gd] = await Promise.all([rpc('dash'), load('Threats'), load('Complaints'), load('Guards')]); if (!d || !th || !gd) return;
  const gl = d.guardList.filter(g => !PSEL || g.premise === PSEL), on = gl.filter(g => g.status === 'Bertugas'), nr = gl.filter(g => g.status === 'Belum Lapor'), off = gl.filter(g => g.status === 'Off Duty');
  const cs = d.complaintStats, mx = Math.max(1, cs.Pending, cs.Justified, cs.Approved, cs.Rejected), no2 = gd.rows.filter(x => x.Status === 'Active' && x.TotpOn !== '1').length;
  const col = (t, a, sub, cls) => `<div class="col3"><div style="display:flex;justify-content:space-between"><span class="mut"><b>${t}</b></span>${pill(gl.length ? Math.round(a.length / gl.length * 100) + '%' : '0%', cls)}</div><b class="big">${a.length}</b> <span class="mut">Pegawai</span><div class="mut" style="font-size:11px">${sub}</div></div>`;
  $('#c').innerHTML = hero('Pusat Kawalan Keselamatan & Analisis Ancaman Pintar', 'Pantau kehadiran pegawai, ancaman terbuka dan aduan secara masa nyata.', '<button class="ghost" onclick="beep(3)">🔊 Uji Siren</button> <button onclick="goPage(\'term\')">Terminal Pegawai</button>', 'TAHAP 1 · VERTIKAL (ORCON-1)') +
    `<div class="stats">${stat('Ancaman terbuka', d.threatsOpen, 'Belum ditangani', '🚨', 1)}${stat('Pegawai tanpa 2FA', no2, 'Disyorkan diaktifkan', '🔐', 1)}${stat('Jumlah premis', d.premises, 'Aktif dipantau', '🏢')}${stat('Pegawai disahkan', d.guards, d.inactive + ' tidak aktif', '✅')}</div>
  <div class="card"><b>Status Kehadiran & Kehadiran Pegawai Semasa</b><div class="three" style="margin-top:10px">${col('Sedang Bertugas', on, 'Rondaan & pos kawalan beroperasi', 'ok')}${col('Belum Melapor Diri', nr, 'Jadual syif bermula, belum Clock In', 'bad')}${col('Off Duty', off, 'Di luar waktu syif', 'gry')}</div>
  <div class="dk" style="margin:0"><b style="font-size:12px">Personel Pegawai (Semua)</b>${gl.map(g => `<div class="pl"><span class="a">${esc((g.name || '?')[0])}</span><div style="flex:1"><b>${esc(g.name)}</b> <span class="chip">${esc(g.staff)}</span><div class="mut" style="font-size:11px">🏢 ${esc(g.premise)} · ${esc(g.shift)}${g.since ? ' · Masuk ' + esc(String(g.since).slice(11, 16)) : ''}</div></div>${pill(g.status, g.status === 'Bertugas' ? 'ok' : g.status === 'Belum Lapor' ? 'bad' : 'gry')}</div>`).join('') || '<div class="mut" style="padding:10px">Tiada pegawai.</div>'}</div></div>
  <div class="two"><div class="card"><b>Bilangan Aduan</b><div class="bar" style="margin-top:26px">${['Pending', 'Justified', 'Approved', 'Rejected'].map(k => `<div style="height:${Math.round(cs[k] / mx * 100)}%;background:${{ Pending: '#f59e0b', Justified: '#3b82f6', Approved: '#16a34a', Rejected: '#e11d2a' }[k]}"><span style="color:#14213d">${cs[k]}</span></div>`).join('')}</div><div class="lab" style="color:#6b7794">${['Pending', 'Justified', 'Approved', 'Rejected'].map(k => `<span style="color:#6b7794">${k}</span>`).join('')}</div></div>
  <div class="card"><b>Ancaman 7 hari</b><div class="bar" style="margin-top:26px">${d.threatDays.map(x => `<div style="height:${Math.round(x.n / Math.max(1, ...d.threatDays.map(y => y.n)) * 100)}%"><span style="color:#14213d">${x.n}</span></div>`).join('')}</div><div class="lab">${d.threatDays.map(x => `<span style="color:#6b7794">${x.d}</span>`).join('')}</div></div></div>
  <div class="ttl"><b>Ancaman & Insiden</b></div>${thtml(th.rows.filter(inPrem).slice(0, 30))}
  <div class="ttl"><b>Aduan Terkini</b><span class="mut">Dihantar ke: ${esc(d.alertEmail || 'emel amaran belum ditetapkan')}</span></div>${cm ? gtable('Complaints', { title: '' }) : ''}`;
}

/* ================= HR MASTER ================= */
async function showHR() {
  const [g, cm, ck, ro] = await Promise.all([load('Guards'), load('Complaints'), load('Checkpoints'), load('Roster')]); if (!g || !cm) return;
  const act = g.rows.filter(x => x.Status === 'Active'), per = PREM.map(p => ({ p, n: g.rows.filter(x => x.Premise === p).length })), mx = Math.max(1, ...per.map(x => x.n));
  const rem = []; g.rows.filter(x => x.Status === 'Active' && x.TotpOn !== '1').forEach(x => rem.push('Pegawai ' + x.Name + ' belum mengaktifkan 2FA.'));
  PREM.forEach(p => { if (ck && !ck.rows.some(c => c.Premise === p && c.Status !== 'Inactive')) rem.push('Premis ' + p + ' belum mempunyai checkpoint.'); });
  act.forEach(x => { if (ro && !ro.rows.some(r => r.GuardID === x.GuardID)) rem.push('Pegawai ' + x.Name + ' belum mempunyai jadual syif (tiada sekatan waktu).'); });
  $('#c').innerHTML = `<div class="stats">${stat('Jumlah pegawai', g.rows.length, 'Aktif: ' + act.length + ' · Tidak aktif: ' + (g.rows.length - act.length), '👮')}${stat('Pegawai dengan 2FA', g.rows.filter(x => x.TotpOn === '1').length, 'Daripada ' + g.rows.length, '🔐')}${stat('Pegawai kunci pas', g.rows.filter(x => x.PasskeyOn === '1').length, 'Mod luar talian', '📱')}${stat('Aduan belum selesai', cm.rows.filter(x => x.Status === 'Pending').length, 'Pending', '📋', 1)}</div>
  <div class="two"><div class="card"><b>Pegawai mengikut premis</b><div class="bar" style="height:110px;margin-top:26px">${per.map(x => `<div style="height:${Math.round(x.n / mx * 100)}%"><span style="color:#14213d">${x.n}</span></div>`).join('') || ''}</div><div class="lab">${per.map(x => `<span style="color:#6b7794">${esc(x.p)}</span>`).join('')}</div></div>
  <div class="card"><b>🔔 Peringatan</b>${rem.length ? rem.map(r => `<div style="padding:6px 0;border-bottom:1px solid #eef1f8;font-size:12px">• ${esc(r)}</div>`).join('') : '<div class="mut" style="padding:20px 0;text-align:center">Tiada peringatan. Semua tetapan lengkap.</div>'}</div></div>` +
    gtable('Complaints', { title: 'Recent Complaint (Rekod Aduan & Salah Laku)', add: '+ Rekod Aduan Baharu', addCls: 'gold', act: editActs('Complaints') }) +
    gtable('Guards', { title: 'Senarai Pegawai (HR)', add: '+ Tambah Pegawai', act: editActs('Guards') });
}

/* ================= MANAGE PREMISES & QR ================= */
async function showManage() {
  const [p, c] = await Promise.all([load('Premises'), load('Checkpoints')]); if (!p || !c) return;
  $('#c').innerHTML = hero('Pengurusan Premis & Checkpoint QR', 'Alamat premis dijana koordinat Google Maps secara automatik. QR checkpoint bertandatangan HMAC dan tidak boleh dipalsukan.', '') +
    gtable('Premises', { title: 'Premis Kawalan', add: '+ Tambah Premis', addCls: 'gold', act: editActs('Premises') }) +
    gtable('Checkpoints', { title: 'Titik Semakan QR', add: '+ Tambah Checkpoint', addCls: 'gold', extra: '<button class="ghost" onclick="allQR()">🖨 Cetak semua QR</button>', act: (r, i) => `<button class="s" onclick="showQR(${i})">QR</button> ` + editActs('Checkpoints')(r, i) });
}
function showQR(i) { const r = DS.Checkpoints.rows[i], im = qrimg(r.QRCode, 8); $('#mb').innerHTML = `<div style="text-align:center"><h3>${esc(r.Name)}</h3><p>${esc(r.Premise)}</p>${im ? `<img src="${im}" width="260">` : '<p class="mut">Pustaka QR gagal dimuat (semak internet).</p>'}<p class="mono" style="word-break:break-all">${esc(r.QRCode)}</p><button onclick="window.print()">Cetak</button> <button class="ghost" onclick="closeM()">Tutup</button></div>`; md.style.display = 'grid'; }
function allQR() {
  const w = window.open(''); if (!w) return toast('Benarkan pop-up untuk mencetak.');
  w.document.write('<body style="font-family:Arial;display:flex;flex-wrap:wrap;gap:14px">' + DS.Checkpoints.rows.filter(r => r.Status !== 'Inactive' && inPrem(r)).map(r => `<div style="border:2px solid #b8862f;padding:10px;text-align:center;width:230px"><b>MEGA SAFE SECURITY</b><br><img src="${qrimg(r.QRCode, 6)}" width="200"><br><b>${esc(r.Name)}</b><br>${esc(r.Premise)}</div>`).join('') + '<script>setTimeout(()=>print(),800)<\/script>');
  w.document.close();
}

/* ================= DUTY ROSTER & ALARM ================= */
async function showRoster() {
  const [r, pc] = await Promise.all([load('Roster'), load('PatrolConfig')]); if (!r) return;
  const gmap = {}; GL.forEach(g => gmap[g.id] = g);
  const rows = r.rows.map((x, i) => ({ x, i })).filter(o => inPrem(o.x));
  $('#c').innerHTML = hero('Penjadual Waktu Syif & Kawalan Akses Premis Pengawal', 'Pentadbir menetapkan tetingkap masa dan premis bertugas bagi setiap pegawai. Apabila jadual disimpan, hak akses sistem, lokasi premis dan kebenaran Clock In dikawal secara automatik.', '<button class="org" onclick="openForm(\'Roster\')">+ Tetapkan Syif Baharu</button>', 'PENYELARASAN AKSES AUTOMATIK') +
    `<div class="tw" style="padding:10px 14px;display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap"><span class="mut">Tapis mengikut premis: <b style="color:#fff">${esc(PSEL || 'Semua Premis')} (${rows.length} Jadual)</b></span><span class="mut">🕒 Masa Semasa Sistem: <b class="mono" style="color:#fff" id="rclk"></b></span></div>
  <div class="tw"><table><tr><th>Nama Pegawai & No Staf</th><th>Premis Ditugaskan</th><th>Nama Syif</th><th>Tetingkap Masa (Time Window)</th><th>Hari Bertugas</th><th>Status Hak Akses Semasa</th><th>Tindakan</th></tr>${rows.map(o => { const g = gmap[o.x.GuardID] || {}, on = rosterActive(o.x); return `<tr><td><b>${esc(o.x.Guard)}</b><br><span class="mut mono">ID: ${esc(g.staff || '-')}</span></td><td><span class="prem">${esc(o.x.Premise)}</span></td><td><b>${esc(o.x.ShiftName)}</b></td><td><span class="tm">🕒 ${esc(o.x.Start)} - ${esc(o.x.End)}</span></td><td>${cell('Days', o.x.Days)}</td><td>${on ? pill('● Akses Aktif (Dalam Syif)', 'ok') : pill('🔒 Di Luar Waktu Syif', 'gry')}</td><td style="white-space:nowrap">${editActs('Roster')(o.x, o.i)}</td></tr>`; }).join('') || '<tr><td class="empty" colspan="7">Tiada jadual syif. Tekan "Tetapkan Syif Baharu".</td></tr>'}</table></div>` +
    hero('Alarm Rondaan (Admin Sahaja)', 'Tetapkan selang rondaan dan berapa lama alarm berbunyi pada peranti pegawai. Pegawai tidak boleh mematikan alarm kecuali dengan mengimbas checkpoint.', '<button class="org" onclick="openForm(\'PatrolConfig\')">+ Tetapkan Alarm Premis</button>') +
    (pc ? gtable('PatrolConfig', { bare: 1, act: editActs('PatrolConfig') }) : '');
  tick();
}

/* ================= KEHADIRAN / PELAWAT (jadual) ================= */
async function showSheet(k) {
  const d = await load(k); if (!d) return;
  const o = { title: TITLES[PAGE] };
  if (k === 'Visitors') { o.add = '+ Daftar Pelawat'; o.addCls = 'gold'; o.act = (r) => r.TimeOut ? '' : `<button class="s" onclick="vout('${esc(r.VisitID)}')">Keluar</button>`; HIDE.Visitors = ['Guard']; }
  $('#c').innerHTML = hero(TITLES[PAGE], k === 'Visitors' ? 'Daftar pelawat dengan gambar, masa masuk dan keluar.' : 'Rekod Clock In / Clock Out pegawai.', '') + gtable(k, o);
}

/* ================= SECURITY LOG BOOK + AUDIT TRAIL ================= */
async function showLogs() {
  const tabs = U.role === 'admin' ? `<div class="tabs"><button class="tab ${LTAB === 'log' ? 'on' : ''}" onclick="LTAB='log';showLogs()">📖 Log Book Pengawal</button><button class="tab ${LTAB === 'patrol' ? 'on' : ''}" onclick="LTAB='patrol';showLogs()">📍 Laporan Rondaan & Gambar</button><button class="tab ${LTAB === 'audit' ? 'on' : ''}" onclick="LTAB='audit';showLogs()">🛡 Audit Trail</button></div>` : `<div class="tabs"><button class="tab ${LTAB !== 'patrol' ? 'on' : ''}" onclick="LTAB='log';showLogs()">📖 Log Book</button><button class="tab ${LTAB === 'patrol' ? 'on' : ''}" onclick="LTAB='patrol';showLogs()">📍 Rondaan Saya</button></div>`;
  if (U.role !== 'admin' && LTAB === 'audit') LTAB = 'log';
  if (LTAB === 'audit') {
    const d = await load('AuditLog'); if (!d) return; const acts = [...new Set(d.rows.map(r => r.Action))].sort();
    $('#c').innerHTML = tabs + hero('Log Audit Keselamatan & Rekod Integriti (Audit Trail)', 'Rekod terperinci bagi setiap penukaran kata laluan, penyelarasan tetapan dan aktiviti sistem dengan perlindungan rantaian hash SHA-256.', '<button class="ghost" onclick="csvOut(\'AuditLog\')">Eksport CSV</button> <button onclick="jsonOut(\'AuditLog\')">Eksport JSON</button> <button class="green" onclick="verifyAudit()">Sahkan Integriti Rantaian</button>') +
      `<div class="tw" style="padding:10px 14px;display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap"><input id="aq" placeholder="Cari butiran, nama pegawai..." style="max-width:320px;margin:0;background:#02050d;color:#fff;border-color:#243256" oninput="auditFlt()"><select id="af" style="max-width:240px;margin:0;background:#02050d;color:#fff;border-color:#243256" onchange="auditFlt()"><option value="">Semua Tindakan Audit</option>${acts.map(a => `<option>${esc(a)}</option>`).join('')}</select></div>
      <div class="tw"><table id="atb"><tr><th>Masa & Tarikh</th><th>Jenis Tindakan</th><th>Pengendali</th><th>Sasaran</th><th>Butiran Aktiviti</th><th>Peranti</th><th>Integriti SHA-256</th></tr>${d.rows.map(r => `<tr data-a="${esc(r.Action)}"><td class="mono">${esc(r.Timestamp)}</td><td>${cell('AuditAction', r.Action)}</td><td><b>${esc(r.Actor)}</b></td><td>${esc(r.Target)}</td><td>${esc(r.Detail)}</td><td class="mono">${esc(r.Device)}</td><td>${cell('Hash', r.Hash)}</td></tr>`).join('') || '<tr><td class="empty" colspan="7">Tiada rekod.</td></tr>'}</table></div>`;
    return;
  }
  if (LTAB === 'patrol') { const d = await load('Patrol'); if (!d) return; $('#c').innerHTML = tabs + hero('Laporan Rondaan & Gambar Checkpoint', 'Rekod imbasan QR dengan masa, lokasi GPS dan gambar bukti.', '') + gtable('Patrol', { title: '' }); return; }
  const d = await load('LogBook'); if (!d) return;
  $('#c').innerHTML = tabs + hero('Security Log Book', 'Catatan harian pengawal: rondaan, insiden, kejadian, serahan tugas dan kenderaan, lengkap dengan gambar bukti.', '<button class="gold" onclick="openForm(\'LogBook\')">+ Tulis Log Book</button>') + gtable('LogBook', { title: '' });
}
function auditFlt() { const q = $('#aq').value.toLowerCase(), a = $('#af').value; document.querySelectorAll('#atb tr').forEach((t, i) => { if (i) t.style.display = t.textContent.toLowerCase().includes(q) && (!a || t.dataset.a === a) ? '' : 'none'; }); }
async function verifyAudit() { const r = await rpc('auditVerify'); if (r) toast(r.ok ? 'Rantaian SHA-256 utuh (' + r.count + ' rekod).' : 'AMARAN: rantaian rosak pada rekod #' + r.brokenAt); }

/* ================= CENTRAL MONITORING (GOOGLE MAPS) ================= */
async function showMap() {
  const d = await rpc('mapData'); if (!d) return; MD = d;
  if (PSEL) SELP = PSEL; if (!SELP || !d.premises.find(p => p.Name === SELP)) SELP = d.premises[0] && d.premises[0].Name;
  const tabs = `<div class="tabs" style="max-width:560px;margin-left:auto"><button class="tab ${MTAB === 'prem' ? 'on' : ''}" onclick="MTAB='prem';showMap()">📍 Peta Premis (${d.premises.length})</button><button class="tab ${MTAB === 'route' ? 'on' : ''}" onclick="MTAB='route';showMap()">🧭 Ejen Laluan</button><button class="tab ${MTAB === 'sos' ? 'on' : ''}" onclick="MTAB='sos';showMap()">🛡 Bantuan Kecemasan</button></div>`;
  const cps = d.cps.filter(c => c.Premise === SELP).sort((a, b) => (+a.Seq || 99) - (+b.Seq || 99)), th = d.threats.filter(t => t.Premise === SELP);
  const left = `<div class="dk"><b style="font-size:11px;color:#9fb3e8">PREMIS KAWALAN AKTIF</b>${d.premises.map(p => `<div onclick="SELP='${esc(p.Name)}';showMap()" style="cursor:pointer;padding:9px;margin-top:7px;border-radius:8px;border:1px solid ${p.Name === SELP ? '#2f66ff' : '#1b2947'};background:${p.Name === SELP ? '#0e1c3f' : 'transparent'}"><div style="display:flex;justify-content:space-between"><b>${esc(p.Name)}</b>${d.threats.some(t => t.Premise === p.Name) ? pill('Amaran', 'bad') : ''}</div><small class="mut">${esc(p.Address)}</small></div>`).join('') || '<div class="mut">Tiada premis.</div>'}</div>
    <div class="dk"><div style="display:flex;justify-content:space-between"><b style="font-size:11px;color:#9fb3e8">TITIK SEMAKAN QR (${cps.length})</b></div>${cps.map(c => `<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-top:1px solid #16213a"><span><span class="chip">${esc(c.Seq || '•')}</span> ${esc(c.Name)}</span><button class="s ghost" onclick="routeTo('${esc(c.CPID)}')">➤ Laluan</button></div>`).join('') || '<div class="mut">Tiada checkpoint.</div>'}<div id="rt" style="margin-top:8px;font-size:12px"></div></div>
    ${th.length ? `<div class="dk" style="border-color:#7a1b25"><b style="color:#ff6b78">⚠ Ancaman Aktif di Premis Ini (${th.length})</b>${th.map(t => `<div style="padding:6px 0;border-top:1px solid #3a0b10;font-size:12px">${esc(t.Type)} · ${esc(t.Guard)}<br><span class="mut">${esc(t.Detail)}</span></div>`).join('')}</div>` : ''}`;
  let body;
  if (MTAB === 'prem') body = `<div class="two" style="grid-template-columns:minmax(280px,360px) 1fr"><div>${left}</div><div><div id="map"></div></div></div>`;
  else if (MTAB === 'route') body = routeAgentHTML(d);
  else body = emergencyHTML();
  $('#c').innerHTML = `<div class="hero" style="align-items:flex-start"><div><h2>Ejen Rondaan & Navigasi Google Maps Masa Nyata</h2><p>Analisis laluan pintar, status premis, jarak checkpoint dan pusat bantuan kecemasan.</p></div><div style="flex:1;min-width:300px">${tabs}</div></div>` + body;
  if (MTAB === 'prem') drawMap();
  if (MTAB === 'sos') emergencyLoad();
}
async function drawMap() {
  const p = MD.premises.find(x => x.Name === SELP), el = $('#map'); if (!el) return;
  if (MAPK === null) MAPK = (await rpc('mapKey', {}, 1)) || '';
  if (!p || !p.Lat || !p.Lng) { el.innerHTML = '<div style="padding:20px">Tetapkan Lat/Lng premis (atau isi alamat dan koordinat Google Maps dijana automatik) di Manage Premises & QR.</div>'; return; }
  if (!MAPK) { el.innerHTML = `<iframe src="https://maps.google.com/maps?q=${encodeURIComponent(p.Lat + ',' + p.Lng)}&z=18&output=embed" loading="lazy"></iframe>`; return; }
  if (!window.google || !google.maps) {
    window.__gm = () => drawMap(); window.gm_authFailure = () => { el.innerHTML = '<div style="padding:20px">Google Maps API key ditolak. Semak Billing, Maps JavaScript API dan sekatan domain key (tambah domain GitHub Pages anda).</div>'; };
    const s = document.createElement('script'); s.src = 'https://maps.googleapis.com/maps/api/js?key=' + encodeURIComponent(MAPK) + '&callback=__gm'; s.async = true; document.head.appendChild(s); return;
  }
  GM = new google.maps.Map(el, { center: { lat: +p.Lat, lng: +p.Lng }, zoom: 18, mapTypeControl: true });
  new google.maps.Marker({ map: GM, position: { lat: +p.Lat, lng: +p.Lng }, title: p.Name });
  MD.cps.filter(c => c.Premise === SELP && c.Lat && c.Lng).forEach(c => new google.maps.Marker({ map: GM, position: { lat: +c.Lat, lng: +c.Lng }, title: c.Name, label: String(c.Seq || '•') }));
  MD.last.filter(l => l.Premise === SELP).forEach(l => new google.maps.Marker({ map: GM, position: { lat: +l.Lat, lng: +l.Lng }, title: l.Guard + ' @ ' + l.Checkpoint + ' ' + l.Timestamp, icon: 'https://maps.google.com/mapfiles/ms/icons/green-dot.png' }));
  MD.threats.filter(t => t.Lat && t.Lng).forEach(t => new google.maps.Marker({ map: GM, position: { lat: +t.Lat, lng: +t.Lng }, title: t.Type, icon: 'https://maps.google.com/mapfiles/ms/icons/red-dot.png' }));
}
const getPos = () => new Promise(r => navigator.geolocation ? navigator.geolocation.getCurrentPosition(p => r({ lat: p.coords.latitude, lng: p.coords.longitude }), () => r({}), { timeout: 5000, maximumAge: 30000 }) : r({}));
function showRoute(r, el) { el.innerHTML = r ? `<b>${esc(r.distance)} · ${esc(r.duration)}</b> <a href="${esc(r.link)}" target="_blank" rel="noopener" style="color:#7aa2ff">Buka di Google Maps</a><ol style="padding-left:18px;margin:6px 0">${r.steps.map(s => `<li>${esc(s)}</li>`).join('')}</ol>` : 'Laluan gagal.'; }
async function routeTo(cpid) {
  const p = MD.premises.find(x => x.Name === SELP), c = MD.cps.find(x => x.CPID === cpid), to = c && c.Lat && c.Lng ? c : p, rt = $('#rt'); rt.textContent = 'Mengira laluan...';
  const pos = await getPos(), from = pos.lat ? pos : { lat: p.Lat, lng: p.Lng };
  showRoute(await rpc('maps', { action: 'route', from, to: { lat: to.Lat, lng: to.Lng }, mode: 'walking' }), rt);
}
function routeAgentHTML(d) {
  const pts = [{ k: 'me', n: '📍 Lokasi saya (GPS)' }].concat(d.premises.map(p => ({ k: 'p:' + p.PremiseID, n: '🏢 ' + p.Name }))).concat(d.cps.map(c => ({ k: 'c:' + c.CPID, n: '🔹 ' + c.Premise + ' · ' + c.Name })));
  const o = (sel) => pts.map((p, i) => `<option value="${esc(p.k)}" ${i === sel ? 'selected' : ''}>${esc(p.n)}</option>`).join('');
  return `<div class="two"><div class="card"><h3>Ejen Laluan Google Maps</h3><label>Dari</label><select id="rf">${o(1)}</select><label>Ke</label><select id="rto">${o(Math.min(2, pts.length - 1))}</select><label>Cara perjalanan</label><select id="rm"><option value="walking">Berjalan kaki</option><option value="driving">Memandu</option></select><button onclick="routeAgent()">Cari laluan</button><div id="rr" style="margin-top:10px;font-size:12px"></div></div>
  <div class="card"><h3>Cari Maklumat Tempat</h3><p class="mut" style="font-size:12px">Cari tempat berhampiran premis ${esc(SELP || '')} (Google Places).</p><div class="row"><input id="ps" placeholder="cth. balai polis, stesen minyak, farmasi"><button onclick="placesQ()" style="flex:none">Cari</button></div><div id="pr"></div></div></div>`;
}
async function routeAgent() {
  const pt = async k => { if (k === 'me') { const p = await getPos(); if (!p.lat) { toast('GPS tidak tersedia.'); return null; } return p; } const [t, id] = k.split(':'), o = t === 'p' ? MD.premises.find(x => x.PremiseID === id) : MD.cps.find(x => x.CPID === id); return o && o.Lat && o.Lng ? { lat: o.Lat, lng: o.Lng } : (toast('Koordinat tiada untuk titik dipilih.'), null); };
  const f = await pt($('#rf').value), t = await pt($('#rto').value); if (!f || !t) return; $('#rr').textContent = 'Mengira laluan...';
  showRoute(await rpc('maps', { action: 'route', from: f, to: t, mode: $('#rm').value }), $('#rr'));
}
async function placesQ() {
  const q = $('#ps').value.trim(); if (!q) return; const p = MD.premises.find(x => x.Name === SELP) || {}, el = $('#pr'); el.textContent = 'Mencari...';
  const r = await rpc('maps', { action: 'places', query: q, lat: p.Lat, lng: p.Lng });
  el.innerHTML = r ? r.map(x => `<div style="padding:7px 0;border-bottom:1px solid #eef1f8"><b>${esc(x.name)}</b><br><small class="mut">${esc(x.address)}</small> <a target="_blank" rel="noopener" href="https://www.google.com/maps/search/?api=1&query=${esc(x.lat)},${esc(x.lng)}">Peta</a></div>`).join('') || 'Tiada hasil.' : `<p class="mut" style="font-size:12px">Carian tempat memerlukan Google Maps API key (Tetapan). <a target="_blank" rel="noopener" href="https://www.google.com/maps/search/${encodeURIComponent(q)}/@${esc(p.Lat)},${esc(p.Lng)},15z">Buka carian di Google Maps</a></p>`;
}
const EMG = [['Balai Polis', 'police station'], ['Hospital / Klinik', 'hospital'], ['Balai Bomba', 'fire station'], ['Farmasi 24 jam', '24 hour pharmacy'], ['Pejabat Majlis / Pihak Berkuasa', 'government office']];
function emergencyHTML() {
  const p = MD.premises.find(x => x.Name === SELP) || {};
  return `<div class="card" style="border-left:4px solid var(--red)"><b>Nombor kecemasan Malaysia:</b> Polis / Ambulans / Bomba <b>999</b> · Telefon mudah alih <b>112</b></div><h3>Bantuan Kecemasan berhampiran ${esc(SELP || '-')}</h3><div class="three">${EMG.map((e, i) => `<div class="dk"><b>${e[0]}</b><div id="em${i}" style="margin-top:8px;font-size:12px">Memuatkan...</div></div>`).join('')}</div>`;
}
async function emergencyLoad() {
  const p = MD.premises.find(x => x.Name === SELP) || {};
  for (let i = 0; i < EMG.length; i++) {
    const el = $('#em' + i), link = `https://www.google.com/maps/search/${encodeURIComponent(EMG[i][1])}/@${esc(p.Lat)},${esc(p.Lng)},15z`;
    const r = p.Lat ? await rpc('maps', { action: 'places', query: EMG[i][1], lat: p.Lat, lng: p.Lng }, 1) : null;
    if (!el) return;
    el.innerHTML = (r && r.length ? r.slice(0, 4).map(x => `<div style="padding:5px 0;border-top:1px solid #16213a"><b>${esc(x.name)}</b><br><small class="mut">${esc(x.address)}</small></div>`).join('') : '') + `<div style="margin-top:6px"><a target="_blank" rel="noopener" style="color:#7aa2ff" href="${link}">Buka carian di Google Maps ›</a></div>`;
  }
}

/* ================= TERMINAL PEGAWAI ================= */
function setST(s) { ST = s; OFF = s.now - Date.now(); if (U && U.id) ls('st_' + U.id, s); }
async function showTerm() {
  if (U.role === 'admin') { const s = await rpc('patrolState', { premise: curPrem() }, 1); if (s) setST(s); }
  const s = ST, cps = s ? s.cps : [], dn = s ? s.done : 0, tot = s ? s.total : 0, isG = U.role === 'guard', onDuty = !!(s && s.onDuty && s.onDuty.indexOf(U.name) >= 0), n = qget().filter(x => U && x.uid === U.id).length;
  const tabs = `<div class="tabs">${[['scan', '▦ Imbasan Checkpoint (' + dn + '/' + tot + ')'], ['pass', '🔑 Kunci Pas Luar Talian'], ['inc', '⚠ Lapor Insiden / Bahaya'], ['comms', '🔒 Komunikasi E2EE']].map(t => `<button class="tab ${TAB === t[0] ? 'on' : ''}" onclick="TAB='${t[0]}';showTerm()">${t[1]}</button>`).join('')}</div>`;
  let body = '';
  if (TAB === 'scan') {
    body = `<div class="card" style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap"><div><b id="nxt">-</b><br><span id="qn" class="mut" style="font-size:11px">${n ? n + ' tindakan menunggu penyegerakan' : ''}</span></div>${isG ? `<div class="tb" style="margin:0"><button class="green" onclick="doClock('in')" ${OFFMODE ? 'disabled' : ''}>Clock In</button><button class="red" onclick="doClock('out')" ${OFFMODE ? 'disabled' : ''}>Clock Out</button><button onclick="openForm('Visitors')" ${OFFMODE ? '' : ''}>Daftar Pelawat</button><button class="ghost" onclick="openForm('LogBook')">Tulis Log Book</button></div>` : '<span class="mut">Paparan pentadbir untuk premis dipilih.</span>'}</div>
    <div class="dk" style="background:#1b2438"><div style="display:flex;justify-content:space-between;align-items:center"><div><b style="font-size:15px">Titik Semakan Rondaan (Checkpoints)</b><br><span class="mut" style="font-size:11px">Imbas kod QR di setiap pos kawalan mengikut urutan jadual rondaan keselamatan.</span></div>${pill((tot ? Math.round(dn / tot * 100) : 0) + '% Selesai', 'ok')}</div><div class="cps" style="margin-top:12px">${cps.map((c, i) => `<div class="cp ${c.done ? 'ok' : ''}"><div><span class="n">${i + 1}</span><b>${esc(c.Name)}</b></div><div class="r"><span>${c.done ? '✓ Diimbas ' + esc(String(c.at).slice(11, 16)) : 'Belum diimbas'}</span><button class="s" onclick="scanUI()">▦ Imbas Kod QR</button></div></div>`).join('') || '<span class="mut">Tiada checkpoint. Admin perlu menambah di Manage Premises & QR.</span>'}</div></div>`;
  } else if (TAB === 'pass') {
    const pf = (ls('pf') || []).find(p => U && p.uid === U.id);
    body = `<div class="card"><h3>Kunci Pas Luar Talian (Offline Passkey)</h3><p class="mut">Jika peranti tiada data mudah alih, anda masih boleh membuka aplikasi dengan biometrik/PIN peranti. Imbasan, SOS dan log disimpan dan dihantar selepas peranti dalam talian.</p>${isG ? `<p>Status: ${pf ? pill('Didaftarkan (' + (pf.mode === 'webauthn' ? 'biometrik' : 'PIN peranti') + ')', 'ok') : pill('Belum didaftarkan', 'warn')}</p><button onclick="enrolPasskey()" ${OFFMODE ? 'disabled' : ''}>${pf ? 'Daftar semula' : 'Daftar Kunci Pas'}</button><p class="mut" style="margin-top:10px">Menunggu penyegerakan: <b>${n}</b> tindakan</p>` : '<p class="mut">Untuk pegawai sahaja.</p>'}</div>`;
  } else if (TAB === 'inc') {
    body = isG ? `<div class="card"><h3>Lapor Insiden / Bahaya</h3><label>Jenis</label><select id="it"><option>Pencerobohan</option><option>Kebakaran</option><option>Kecurian</option><option>Kemalangan</option><option>Aktiviti Mencurigakan</option><option>Lain-lain</option></select><label>Butiran</label><textarea id="id" rows="4"></textarea><label>Gambar</label><input id="ip" type="file" accept="image/*" capture="environment"><button class="red" onclick="doIncident()">Hantar kepada pentadbir</button></div>` : '<div class="card mut">Untuk pegawai sahaja.</div>';
  } else body = commsHTML();
  $('#c').innerHTML = `<div class="hero"><div style="display:flex;gap:12px;align-items:center"><div><h2 style="display:inline">Terminal Rondaan Pegawai Pengawal</h2> ${onDuty ? pill('AKTIF BERTUGAS', 'ok') : pill('BELUM CLOCK IN', 'gry')}<p>Pegawai: <b>${esc(U.name)}</b> · Premis: <b style="color:#7aa2ff">${esc(curPrem() || '-')}</b>${U.shift ? ' · ' + esc(U.shift) : ''}</p></div></div>${isG ? '<button class="red" style="box-shadow:0 0 14px #e11d2a88" onclick="doSOS()">☝ PENGGERA SOS KECEMASAN</button>' : ''}</div>` + tabs + body;
  if (TAB === 'comms') commsLoad(); tick();
}
async function doClock(t) { const m = await guardAct('clock', { type: t }, 'Clock'); if (m && typeof m === 'string' && m !== 'queued') { toast(m); const s = await rpc('patrolState', {}, 1); if (s) setST(s); showTerm(); } }
async function doSOS() { if (!confirm('Hantar SOS kecemasan kepada pentadbir?')) return; const pos = await getPos(); await guardAct('sos', { lat: pos.lat || '', lng: pos.lng || '' }, 'SOS'); }
async function doIncident() { const detail = $('#id').value.trim(); if (!detail) return toast('Isi butiran.'); const photo = await readImg($('#ip'), 800), pos = await getPos(); if (await guardAct('incident', { type: $('#it').value, detail, photo, lat: pos.lat || '', lng: pos.lng || '' }, 'Insiden')) { toast('Insiden dilaporkan'); showTerm(); } }
function scanUI() {
  $('#mb').innerHTML = `<h3>Imbas QR Checkpoint</h3><div id="rd" style="width:100%"></div><label>Atau taip kod QR</label><input id="mc" placeholder="MSS|C...|..."><label>Catatan</label><input id="mr"><label>Gambar bukti</label><input id="mp" type="file" accept="image/*" capture="environment"><button onclick="doScan($('#mc').value)">Hantar</button> <button class="ghost" onclick="closeM()">Batal</button>`;
  md.style.display = 'grid';
  if (window.Html5Qrcode) { QR = new Html5Qrcode('rd'); QR.start({ facingMode: 'environment' }, { fps: 10, qrbox: 200 }, c => { if ($('#mc').value !== c) { $('#mc').value = c; toast('QR dikesan'); } }).catch(() => { $('#rd').textContent = 'Kamera tidak tersedia, taip kod secara manual.'; }); }
  else $('#rd').textContent = 'Pengimbas kamera tidak dimuatkan, taip kod secara manual.';
}
async function doScan(code) { code = String(code || '').trim(); if (!code) return toast('Imbas atau taip kod QR'); const photo = await readImg($('#mp'), 800), remark = ($('#mr') || {}).value || '', pos = await getPos(); const r = await guardAct('scan', { code, remark, photo, lat: pos.lat || '', lng: pos.lng || '' }, 'Imbasan'); if (r) { closeM(); } }

/* ================= BARIS GILIR LUAR TALIAN ================= */
const qget = () => ls('q') || [], qset = a => ls('q', a);
async function guardAct(fn, a, label) {
  if (U.role === 'guard' && (OFFMODE || !navigator.onLine)) return offAct(fn, a, label);
  const r = await rpc(fn, a);
  if (r === null && NETFAIL && U.role === 'guard') return offAct(fn, a, label);
  if (r === null) return null;
  if (fn === 'scan') { setST(r.st); toast(r.msg); tick(); if (PAGE === 'term') showTerm(); return r.msg; }
  if (fn === 'sos' || fn === 'incident') toast(r); else if (fn !== 'clock') toast('Disimpan');
  return r;
}
function offAct(fn, a, label) {
  if (fn === 'clock') { toast('Clock In/Out memerlukan sambungan internet.'); return null; }
  const q = qget(); if (q.length >= 60) { toast('Baris gilir penuh. Sambung ke internet.'); return null; }
  if (fn === 'scan') {
    const cp = (ST && ST.cps || []).find(c => c.QRCode === a.code); if (!cp) { toast('Kod QR tidak dikenali (luar talian).'); return null; } if (cp.done) { toast('Checkpoint ini sudah diimbas.'); return null; }
    cp.done = true; cp.at = new Date().toISOString().replace('T', ' ').slice(0, 19); ST.done = ST.cps.filter(c => c.done).length; ST.started = true; ls('st_' + U.id, ST);
  }
  q.push({ uid: U.id, fn, a: Object.assign({}, a, fn === 'sos' ? { offline: 1 } : {}), ts: Date.now(), label });
  try { qset(q); } catch (e) { toast('Storan peranti penuh.'); return null; }
  toast(label + ' disimpan luar talian (' + q.length + ' menunggu)'); closeM(); if (PAGE === 'term') showTerm(); return 'queued';
}
async function syncQ() {
  const q = qget(); if (!q.length || !U) return; const keep = []; let ok = 0, bad = 0, stop = false;
  for (const it of q) {
    if (stop || it.uid !== U.id) { keep.push(it); continue; }
    const a = Object.assign({}, it.a); if (it.fn === 'scan') a.ts = it.ts;
    const r = await rpc(it.fn, a, 1); if (r === null && NETFAIL) { stop = true; keep.push(it); } else if (r === null) bad++; else ok++;
  }
  qset(keep); if (ok || bad) toast('Penyegerakan: ' + ok + ' berjaya' + (bad ? ', ' + bad + ' ditolak pelayan' : ''));
}
window.addEventListener('online', () => { if (U && T) syncQ(); });

/* ================= KUNCI PAS LUAR TALIAN ================= */
const b64 = b => btoa(String.fromCharCode(...new Uint8Array(b))), unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
async function pbk(pin, salt) { const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits']); return b64(await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: 150000, hash: 'SHA-256' }, k, 256)); }
function cacheProfile() { if (!U || U.role !== 'guard') return; const all = ls('pf') || []; if (all.some(p => p.uid === U.id)) ls('pf', all.map(p => p.uid === U.id ? Object.assign(p, { user: U, st: ST, at: Date.now() }) : p)); }
async function enrolPasskey() {
  if (!U || U.role !== 'guard') return; const prof = { uid: U.id, user: U, st: ST, at: Date.now() };
  try {
    if (!window.PublicKeyCredential) throw 0;
    const cr = await navigator.credentials.create({ publicKey: { challenge: crypto.getRandomValues(new Uint8Array(32)), rp: { name: 'Mega Safe' }, user: { id: new TextEncoder().encode(U.id), name: U.name, displayName: U.name }, pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }], authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required' }, timeout: 60000 } });
    prof.mode = 'webauthn'; prof.cred = b64(cr.rawId);
  } catch (e) {
    const pin = prompt('Biometrik/kunci pas tidak tersedia pada peranti ini. Tetapkan PIN peranti (minimum 6 digit) untuk mod luar talian:'); if (!pin || pin.length < 6) return toast('Dibatalkan');
    const salt = crypto.getRandomValues(new Uint8Array(16)); prof.mode = 'pin'; prof.salt = b64(salt); prof.hash = await pbk(pin, salt);
  }
  ls('pf', (ls('pf') || []).filter(p => p.uid !== U.id).concat([prof])); await rpc('passkeyMark'); toast('Kunci pas luar talian didaftarkan (' + (prof.mode === 'webauthn' ? 'biometrik' : 'PIN peranti') + ').'); if (PAGE === 'term') showTerm();
}
async function offlineLogin() {
  const pf = (ls('pf') || []).filter(p => Date.now() - p.at < 14 * 864e5); if (!pf.length) return toast('Tiada kunci pas. Daftar semasa dalam talian (Terminal > Kunci Pas Luar Talian).');
  let p = pf[0]; if (pf.length > 1) { const n = prompt('Pilih nombor:\n' + pf.map((x, i) => (i + 1) + '. ' + x.user.name).join('\n')); p = pf[(+n || 1) - 1]; if (!p) return; }
  try {
    if (p.mode === 'webauthn') await navigator.credentials.get({ publicKey: { challenge: crypto.getRandomValues(new Uint8Array(32)), allowCredentials: [{ type: 'public-key', id: unb64(p.cred) }], userVerification: 'required', timeout: 60000 } });
    else { const pin = prompt('PIN peranti:'); if (!pin) return; if (await pbk(pin, unb64(p.salt)) !== p.hash) return toast('PIN peranti salah.'); }
  } catch (e) { return toast('Pengesahan dibatalkan / gagal.'); }
  OFFMODE = true; U = p.user; ST = p.st || ls('st_' + p.uid); OFF = 0;
  $('#login').style.display = 'none'; $('#app').style.display = 'block'; $('#usr').textContent = U.name; $('#rol').textContent = 'Luar talian'; $('#av').textContent = (U.name || '?')[0]; $('#off').style.display = 'block'; $('#sir').style.display = 'none'; $('#bell').style.display = 'none';
  buildNav(); wake(); goPage('term'); pollLoop();
}

/* ================= ENJIN ALARM ================= */
let ringT = 0;
function tick() {
  if (!U) return;
  const c = $('#clk'); if (c) c.textContent = new Date(nowS()).toLocaleString('en-GB', { timeZone: 'Asia/Kuala_Lumpur', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).replace(',', '');
  const rc = $('#rclk'); if (rc) rc.textContent = new Date(nowS()).toLocaleTimeString('en-GB', { timeZone: 'Asia/Kuala_Lumpur', hour12: false });
  if (U.role !== 'guard' || !ST) return;
  const s = ST, n = nowS(), nx = $('#nxt'), bar = $('#alm');
  const ring = s.on && !s.started && n >= s.due && n < s.due + s.alarmSec * 1000, missed = s.on && !s.started && n >= s.due + s.alarmSec * 1000;
  if (ring || missed) {
    bar.style.display = 'flex'; bar.className = ring ? '' : 'q';
    $('#almT').textContent = ring ? '⏰ MASA RONDA! Imbas checkpoint untuk menghentikan alarm (' + Math.max(0, Math.ceil((s.due + s.alarmSec * 1000 - n) / 1000)) + 's)' : '⚠ Rondaan tertunggak. Imbas checkpoint sekarang.';
    if (ring && Date.now() - ringT > 1800) { ringT = Date.now(); beep(2); }
  } else bar.style.display = 'none';
  if (nx) nx.textContent = !s.on ? 'Tiada rondaan aktif (belum Clock In / luar waktu aktif)' : (s.started ? 'Rondaan sedang dilakukan' : (n < s.due ? 'Rondaan seterusnya dalam ' + fmtD(s.due - n) : 'Rondaan tertunggak'));
}
setInterval(tick, 1000);

/* ================= MASA NYATA (polling ringan) ================= */
let polling = false;
async function pollLoop() {
  if (polling) return; polling = true;
  while (U) {
    await new Promise(r => setTimeout(r, U.role === 'admin' ? 5000 : 8000)); if (!U) break;
    if (OFFMODE || !T || (document.hidden && U.role === 'admin')) continue;
    const d = await rpc('poll', {}, 1); if (!d) continue; OFF = d.now - Date.now();
    if (d.st) { const old = ST; setST(d.st); if (PAGE === 'term' && TAB === 'scan' && md.style.display !== 'grid' && (!old || old.done !== d.st.done || old.started !== d.st.started)) showTerm(); }
    if (d.threats) {
      const b = $('#bn'); b.style.display = d.threats.length ? '' : 'none'; b.textContent = d.threats.length; let fresh = false;
      d.threats.forEach(t => { if (!SEEN[t.ThreatID]) { SEEN[t.ThreatID] = 1; if (POLLN > 0) fresh = true; } });
      if (fresh) { beep(4); toast('🚨 Ancaman baharu: ' + d.threats[0].Type + ' @ ' + d.threats[0].Premise); }
    }
    POLLN++;
    if (d.ver !== LASTVER) { const first = LASTVER === ''; LASTVER = d.ver; if (!first && md.style.display !== 'grid' && ['dash', 'reports', 'Attendance', 'Visitors', 'logs'].indexOf(PAGE) >= 0) goPage(PAGE); }
    if (PAGE === 'term' && TAB === 'comms' && md.style.display !== 'grid') commsLoad();
  }
  polling = false;
}

/* ================= TETAPAN & KATA LALUAN ================= */
async function showSettings() {
  const s = await rpc('getSettings'), g = await load('Guards'); if (!s || !g) return; GL = g.rows.map(x => ({ id: x.GuardID, name: x.Name, staff: x.StaffNo, premise: x.Premise, status: x.Status }));
  $('#c').innerHTML = `<div class="card" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px"><div><b style="font-size:15px">Tetapan Keselamatan & Pengurusan Kata Laluan (RBAC)</b><br><span class="mut">Dasar keselamatan ketat: hanya Administrator diberi kuasa menukar kata laluan bagi pegawai dan sistem.</span></div>${pill('Mod Akses: Pentadbir (Penuh)', 'info')}</div>
  <div class="two"><div class="card"><h3>🔑 Penukaran Kata Laluan Pegawai & Pentadbir</h3><label>Pilih Pegawai / Pentadbir</label><select id="pt"><option value="admin">Administrator Mega Safe (ADMIN)</option>${GL.map(x => `<option value="${esc(x.id)}">${esc(x.name)} (${esc(x.staff)})</option>`).join('')}</select><label>Kata Laluan Baharu</label><input id="pn" type="password" placeholder="Minimum 8 aksara" autocomplete="new-password"><label>Sahkan Kata Laluan Baharu</label><input id="pc" type="password" placeholder="Ulang kata laluan baharu" autocomplete="new-password"><button class="gold" style="width:100%" onclick="setPin()">🔑 Simpan Kata Laluan</button></div>
  <div class="card"><h3>Konfigurasi Google Sheets, Amaran & Peta</h3><label>Google Sheet (pangkalan data & log masa nyata)</label><div class="mono" style="word-break:break-all;background:#f0f5ff;padding:8px;border-radius:7px"><a href="${esc(s.sheetUrl)}" target="_blank" rel="noopener">${esc(s.sheetUrl)}</a></div><label style="margin-top:8px">URL Web App</label><div class="mono" style="word-break:break-all;background:#f0f5ff;padding:8px;border-radius:7px">${esc(s.execUrl)}</div>
  <label style="margin-top:8px">Emel amaran ancaman (dihantar automatik bila ancaman dikesan)</label><input id="ae" value="${esc(s.alertEmail)}" placeholder="pentadbir@syarikat.com"><label>Google Maps API Key ${s.hasMapsKey ? '(sedia ada: ' + esc(s.mapsKeyMasked) + ')' : ''}</label><input id="mk" placeholder="${s.hasMapsKey ? 'Kosongkan jika tidak mahu tukar' : 'AIza... (pilihan; tanpa key peta asas dipaparkan)'}">
  <div>Pemantau rondaan latar belakang: ${pill(s.triggers ? 'Dipasang' : 'Belum dipasang', s.triggers ? 'ok' : 'warn')} <small class="mut">(menu Sheet: Mega Safe > Pasang pemantau)</small></div>
  <div style="margin-top:10px"><button class="green" style="width:100%" onclick="saveSet()">📄 Simpan Tetapan</button><button class="ghost" style="width:100%;margin-top:6px" onclick="rotHook()">${s.webhook ? 'Jana semula' : 'Jana'} rahsia Webhook IoT</button></div></div></div>
  <div class="card"><h3>🛡 Status Pengesahan Dua Faktor (2FA) Pegawai</h3><p class="mut" style="margin-top:0">Pengesahan 2FA memastikan akaun hanya boleh diakses dengan kod keselamatan TOTP yang sah.</p><div class="cps"><div class="col3" style="display:flex;justify-content:space-between;align-items:center"><div><b>Administrator Mega Safe</b><br><small class="mut">ADMIN</small></div>${s.totp ? pill('2FA Aktif', 'ok') : '<button class="s" onclick="enrol2FA()">Aktifkan 2FA</button>'}</div>
  ${g.rows.map(x => `<div class="col3" style="display:flex;justify-content:space-between;align-items:center;gap:6px"><div><b>${esc(x.Name)}</b><br><small class="mut">${esc(x.StaffNo)} · ${esc(x.Premise)}</small></div>${x.TotpOn === '1' ? `<span>${pill('2FA Aktif', 'ok')} <button class="s ghost" onclick="g2fa('${esc(x.GuardID)}',0)">Nyahaktif</button></span>` : `<button class="s ghost" onclick="g2fa('${esc(x.GuardID)}',1)">Aktifkan 2FA</button>`}</div>`).join('')}</div></div>`;
}
async function setPin() { const m = await rpc('setPin', { target: $('#pt').value, pin: $('#pn').value, confirm: $('#pc').value }); if (m) { toast(m); $('#pn').value = ''; $('#pc').value = ''; if ($('#pt').value === 'admin') setTimeout(() => location.reload(), 1800); } }
async function saveSet() { const o = { alertEmail: $('#ae').value }; if ($('#mk').value.trim()) o.mapsKey = $('#mk').value; if (await rpc('saveSettings', o)) { MAPK = null; toast('Tetapan disimpan'); showSettings(); } }
async function rotHook() { if (!confirm('Jana rahsia baharu? Rahsia lama tidak sah lagi.')) return; const r = await rpc('saveSettings', { rotateWebhook: 1 }); if (r && r.webhookSecret) { $('#mb').innerHTML = `<h3>Rahsia Webhook IoT</h3><p>Simpan sekarang; tidak akan dipaparkan lagi.</p><div class="mono" style="word-break:break-all;background:#f2f4f8;padding:8px">${esc(r.webhookSecret)}</div><p style="font-size:12px">POST JSON ke URL Web App: {"secret":"…","premise":"Nama Premis","type":"Pintu dibuka","severity":"High","detail":"…"}</p><button onclick="closeM()">Tutup</button>`; md.style.display = 'grid'; } }
async function g2fa(id, on) {
  if (!confirm(on ? 'Aktifkan 2FA untuk pegawai ini? Pegawai wajib mendaftar kod dalam aplikasi Authenticator sebelum log masuk seterusnya.' : 'Nyahaktifkan 2FA pegawai ini?')) return;
  const r = await rpc('guard2fa', { id, on }); if (!r) return;
  if (r.secret) { const im = qrimg(r.uri, 5); $('#mb').innerHTML = `<h3>2FA: ${esc(r.name)}</h3><p>Tunjukkan kod QR ini kepada pegawai untuk diimbas dalam Authenticator. Ia tidak akan dipaparkan lagi.</p><div style="text-align:center">${im ? `<img src="${im}">` : ''}<p class="mono" style="word-break:break-all">${esc(r.secret)}</p></div><button onclick="closeM();showSettings()">Selesai</button>`; md.style.display = 'grid'; }
  else { toast('2FA dinyahaktifkan'); showSettings(); }
}

/* ================= KOMUNIKASI E2EE (AES-GCM; pelayan hanya melihat teks sulit) ================= */
async function ckey(prem) { const pw = ls('ck_' + prem); if (!pw) return null; const km = await crypto.subtle.importKey('raw', new TextEncoder().encode(pw), 'PBKDF2', false, ['deriveKey']); return crypto.subtle.deriveKey({ name: 'PBKDF2', salt: new TextEncoder().encode('MegaSafe|' + prem), iterations: 150000, hash: 'SHA-256' }, km, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']); }
function commsHTML() {
  CPREM = curPrem();
  return `<div class="card"><h3>🔒 Komunikasi Disulitkan Hujung-ke-Hujung</h3><p class="mut" style="margin-top:0">Mesej disulitkan dalam pelayar (AES-256-GCM). Pelayan dan Google Sheet hanya menyimpan teks sulit. Kongsi frasa kunci premis secara bersemuka, bukan melalui aplikasi ini.</p><label>Frasa kunci premis ${esc(CPREM)} ${ls('ck_' + CPREM) ? '(telah ditetapkan pada peranti ini)' : '(belum ditetapkan)'}</label><div class="row"><input id="ckp" type="password" placeholder="Frasa kunci (minimum 10 aksara)" style="margin:0"><button onclick="setCK()" style="flex:none">Simpan</button></div></div>
  <div class="dk"><div id="ml" style="max-height:340px;overflow:auto"></div><div class="row" style="margin-top:8px"><input id="mt" placeholder="Tulis mesej..." style="margin:0;background:#02050d;color:#fff;border-color:#243256" onkeydown="if(event.key=='Enter')sendMsg()"><button onclick="sendMsg()" style="flex:none">Hantar</button></div></div>`;
}
function setCK() { const v = $('#ckp').value; if (v.length < 10) return toast('Frasa minimum 10 aksara.'); ls('ck_' + CPREM, v); toast('Kunci disimpan pada peranti ini'); showTerm(); }
async function commsLoad() {
  const l = $('#ml'); if (!l) return; const r = await rpc('msgList', { premise: CPREM }, 1); if (!r) return; const k = await ckey(CPREM), out = [];
  for (const m of r) {
    let t = '🔒 (tetapkan frasa kunci)';
    if (k) { try { t = new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(m.IV) }, k, unb64(m.Cipher))); } catch (e) { t = '🔒 (frasa kunci tidak sepadan)'; } }
    out.push(`<div class="msg ${m.FromID === U.id ? 'me' : ''}"><small>${esc(m.FromName)} · ${esc(String(m.Timestamp).slice(5, 16))}</small><br>${esc(t)}</div>`);
  }
  const at = l.scrollTop + l.clientHeight >= l.scrollHeight - 30; l.innerHTML = out.join('') || '<span class="mut">Tiada mesej.</span>'; if (at) l.scrollTop = l.scrollHeight;
}
async function sendMsg() {
  const t = $('#mt').value.trim(); if (!t) return; const k = await ckey(CPREM); if (!k) return toast('Tetapkan frasa kunci dahulu.');
  const iv = crypto.getRandomValues(new Uint8Array(12)), c = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, k, new TextEncoder().encode(t));
  if (await rpc('msgSend', { premise: CPREM, iv: b64(iv), cipher: b64(c) })) { $('#mt').value = ''; commsLoad(); }
}
