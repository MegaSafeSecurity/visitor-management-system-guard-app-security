const path = require('path'), assert = require('assert'), { load } = require('./mock-gas');
const { g, cache, pr, main, books } = load(path.join(__dirname, '../src/Code.gs'));
const call = (fn, t, a) => JSON.parse(g.rpc(fn, t, JSON.stringify(a || {})));
let n = 0; const ok = (c, m) => { assert(c, 'GAGAL: ' + m); n++; console.log('  ok  ' + m); };
const code = s => g.totp(s, Math.floor(Date.now() / 30000));
const fresh = () => { pr['LC_admin'] = '0'; };
const threats = () => main.reg.Threats.v.slice(1).map(r => r[3]);
const audits = () => main.reg.AuditLog.v.slice(1).map(r => r.join('|'));

console.log('TOTP');
const rfc = g.b32enc(Array.from(Buffer.from('12345678901234567890')));
ok(g.totp(rfc, 1) === '287082', 'RFC 6238 vektor (t=59)');
ok(g.totp(rfc, 37037036) === '081804', 'RFC 6238 vektor (t=1111111109)');

console.log('Admin & kunci akaun');
ok(/belum disediakan/.test(call('login', '', { id: 'admin', pin: 'x' }).error), 'tiada admin lalai: log masuk ditolak sebelum disediakan');
pr.INIT_ADMIN_PASSWORD = 'CorrectHorse-Battery9'; g.setup();
ok(pr.ADMIN_HASH && !pr.INIT_ADMIN_PASSWORD && !JSON.stringify(pr).includes('CorrectHorse'), 'kata laluan awal di-hash dan dipadam');
for (let i = 0; i < 4; i++) ok(/tidak sah/.test(call('login', '', { id: 'admin', pin: 'salah' + i }).error), 'percubaan salah ' + (i + 1));
ok(/tidak sah/.test(call('login', '', { id: 'admin', pin: 'salah4' }).error) && threats().includes('ACCOUNT_LOCK'), 'percubaan ke-5 mengunci akaun + ancaman High direkod');
ok(/dikunci/.test(call('login', '', { id: 'admin', pin: 'CorrectHorse-Battery9' }).error), 'akaun terkunci menolak walaupun kata laluan betul');
ok(books.book2 && books.book2.reg.Log.v.length > 2, 'log masa nyata (Sheet berasingan) menerima ancaman secara automatik');
call('login', '', { id: '=IMPORTXML("x")', pin: 'x' });
ok(main.reg.Threats.v.slice(1).some(r => String(r[4]).startsWith("'=")), 'suntikan formula dineutralkan dalam log');
Object.keys(cache).filter(k => /^(LK|FL)_/.test(k)).forEach(k => delete cache[k]);

console.log('2FA admin');
let r = call('login', '', { id: 'admin', pin: 'CorrectHorse-Battery9' });
ok(r.data.step === 'enroll' && r.data.secret.length >= 32, 'log masuk pertama menuntut pendaftaran 2FA');
ok(/tidak sah/.test(call('verify2fa', '', { ticket: r.data.ticket, code: '000000' }).error), 'kod 2FA salah ditolak');
let s = call('verify2fa', '', { ticket: r.data.ticket, code: code(r.data.secret) });
ok(s.data && s.data.token && pr.TS_admin === r.data.secret, 'kod betul: sesi dibuka dan peranti didaftar');
const secret = pr.TS_admin; let T = s.data.token;
call('logout', T); ok(/Sesi tamat/.test(call('list', T, { sheet: 'Guards' }).error), 'logout memadam sesi di server');
r = call('login', '', { id: 'admin', pin: 'CorrectHorse-Battery9' }); ok(r.data.step === 'totp', 'log masuk seterusnya menuntut 2FA');
ok(/tidak sah/.test(call('verify2fa', '', { ticket: r.data.ticket, code: code(secret) }).error), 'kod yang sama tidak boleh digunakan semula (anti-replay)');
fresh(); s = call('verify2fa', '', { ticket: call('login', '', { id: 'admin', pin: 'CorrectHorse-Battery9' }).data.ticket, code: code(secret) }); T = s.data.token; ok(!!T, 'kod baharu diterima');

console.log('Pegawai, PIN dan akses');
ok(call('save', T, { sheet: 'Premises', row: { Name: 'Premis A', Address: 'x', Status: 'Active', PatrolMin: 30, AlarmSec: 45 } }).data, 'admin simpan premis');
ok(/PIN wajib/.test(call('save', T, { sheet: 'Guards', row: { Name: 'Ali', StaffNo: 'MS002', Premise: 'Premis A', Shift: 'Shift1', Status: 'Active' } }).error), 'pegawai baharu tanpa PIN ditolak');
ok(/6 hingga 12/.test(call('save', T, { sheet: 'Guards', row: { Name: 'Ali', StaffNo: 'MS002', Premise: 'Premis A', Shift: 'Shift1', Status: 'Active', PIN: '1234' } }).error), 'PIN lemah ditolak');
ok(call('save', T, { sheet: 'Guards', row: { Name: 'Ali', StaffNo: 'MS002', Premise: 'Premis A', Shift: 'Shift1', Status: 'Active', PIN: '482913', TwoFA: 'No' } }).data, 'pegawai disimpan dengan PIN sah');
const grow = main.reg.Guards.v[1];
ok(grow[8] === '' && grow[10] && !JSON.stringify(main.reg.Guards.v).includes('482913'), 'PIN tidak disimpan; hanya cincang bergaram');
const gl = call('list', T, { sheet: 'Guards' }).data; ok(!gl.cols.includes('PinHash') && !gl.cols.includes('Salt') && !gl.cols.includes('PIN'), 'senarai pegawai tidak mendedahkan cincang/PIN');
ok(call('save', T, { sheet: 'Guards', row: { GuardID: grow[0], Name: 'Ali Baru', StaffNo: 'MS002', Premise: 'Premis A', Shift: 'Shift1', Status: 'Active', PIN: '', TwoFA: 'No' } }).data && main.reg.Guards.v[1][10] === grow[10], 'HR tukar nama: PIN/cincang dikekalkan');
ok(/tidak sah/.test(call('login', '', { id: 'MS002', pin: '111111' }).error), 'PIN pegawai salah ditolak');
const G = call('login', '', { id: 'ms002', pin: '482913' }).data.token; ok(!!G, 'pegawai log masuk dengan PIN betul');
ok(/admin sahaja/.test(call('save', G, { sheet: 'Guards', row: { Name: 'x' } }).error), 'pegawai tidak boleh ubah data admin');
ok(/ditolak/.test(call('list', G, { sheet: 'Guards' }).error) && /admin sahaja/.test(call('chpw', G, { cur: 'a', next: 'b', code: '1' }).error), 'pegawai tidak boleh baca HR / tukar kata laluan');
ok(threats().filter(t => t === 'UNAUTHORIZED').length >= 3, 'cubaan tanpa kebenaran direkod sebagai ancaman High');
ok(/Sesi tamat/.test(call('list', '', { sheet: 'Premises' }).error) && /Sesi tamat/.test(call('dash', 'palsu', {}).error), 'tiada akses tetamu tanpa token sah');

console.log('Tukar kata laluan (admin sahaja)');
fresh();
ok(/semasa salah/.test(call('chpw', T, { cur: 'salah', next: 'NewPassword-12345', code: code(secret) }).error), 'kata laluan semasa salah ditolak');
ok(/2FA/.test(call('chpw', T, { cur: 'CorrectHorse-Battery9', next: 'NewPassword-12345', code: '000000' }).error), 'kod 2FA wajib semasa tukar kata laluan');
ok(/12 aksara/.test(call('chpw', T, { cur: 'CorrectHorse-Battery9', next: 'pendek', code: code(secret) }).error), 'kata laluan baharu pendek ditolak'); fresh();
ok(call('chpw', T, { cur: 'CorrectHorse-Battery9', next: 'NewPassword-12345', code: code(secret) }).data, 'kata laluan admin ditukar');
ok(/tidak sah/.test(call('login', '', { id: 'admin', pin: 'CorrectHorse-Battery9' }).error), 'kata laluan lama tidak lagi sah');
Object.keys(cache).filter(k => /^(LK|FL)_/.test(k)).forEach(k => delete cache[k]);

console.log('Log audit, ancaman, masa nyata');
const A = audits().join('\n');
ok(/PIN_SET/.test(A) && /CREATE\|Premises/.test(A) && /ADMIN_PASSWORD_CHANGE/.test(A) && /EDIT\|Guards.*Name: Ali -> Ali Baru/.test(A), 'log audit merekod perubahan dengan nilai lama -> baharu');
ok(!A.includes('482913') && !A.includes('NewPassword'), 'log audit tidak mengandungi PIN atau kata laluan');
const f = call('feed', T, {}).data; ok(['Low', 'Medium', 'High'].includes(f.level) && f.total > 0 && f.latest.length > 0, 'suapan ancaman (polling) memberi tahap + senarai terkini');
fresh(); ok(call('feed', G, {}).error, 'suapan ancaman tertutup kepada pegawai');
call('clock', G, { type: 'in' });
ok(/tidak sah/.test(call('scan', G, { code: 'MSS|PALSU' }).error) && threats().includes('QR_INVALID'), 'imbasan QR palsu direkod sebagai ancaman');
main.reg.Attendance.v[1][5] = new Date(Date.now() + 8 * 3600e3 - 3 * 3600e3).toISOString().slice(0, 19).replace('T', ' ');
const before = threats().filter(t => t === 'PATROL_MISSED').length; g.monitor(); g.monitor();
ok(threats().filter(t => t === 'PATROL_MISSED').length === before + 1, 'pemantau automatik: ronda terlepas direkod sekali sahaja');

console.log('Sesi');
const sess = JSON.parse(cache['t' + T]); sess.last = Date.now() - 31 * 60000; cache['t' + T] = JSON.stringify(sess);
ok(/tidak aktif/.test(call('dash', T, {}).error), 'sesi admin tamat selepas 30 minit tidak aktif');

console.log('Peta');
const gm = call('maps', G, { q: 'laluan dari Kota Kinabalu ke Sandakan', mode: 'DRIVING' }).data;
ok(gm.type === 'route' && gm.steps[0].indexOf('<') < 0 && /google.com\/maps\/dir/.test(gm.url), 'ejen peta: laluan');
ok(call('maps', G, { q: 'Menara Tun Mustapha' }).data.type === 'geocode', 'ejen peta: geokod');
ok(/MAPS_KEY/.test(call('maps', G, { q: 'cari balai polis di Tawau' }).error), 'carian tempat memerlukan MAPS_KEY');
console.log('\n' + n + ' semakan lulus');
