// Ujian pelayar sebenar (Chromium): node tests/ui.test.js   (tangkapan skrin dalam tests/shots/)
const { chromium } = require('playwright'), fs = require('fs'), path = require('path');
const { start, SECRET, H } = require('./server.js');
const shots = path.join(__dirname, 'shots'); fs.mkdirSync(shots, { recursive: true });
let pass = 0, fail = 0; const ok = (c, m) => { if (c) { pass++; console.log('  ok   ' + m); } else { fail++; console.error('  GAGAL ' + m); } };
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const srv = await start(8099), base = 'http://localhost:8099/';
  const br = await chromium.launch();
  const errors = [];
  async function newPage(ctx) {
    const pg = await ctx.newPage();
    pg.on('pageerror', e => errors.push('pageerror: ' + e.message));
    pg.on('console', m => { if (m.type() === 'error' && !/ERR_FAILED|Failed to load resource|net::/.test(m.text())) errors.push('console: ' + m.text()); });
    pg.on('dialog', d => d.accept('123456'));
    await pg.route(/cdn\.jsdelivr|cdnjs/, r => r.abort());
    return pg;
  }
  const ctx = await br.newContext({ viewport: { width: 1366, height: 700 } });
  const pg = await newPage(ctx);
  console.log('1. Skrin log masuk');
  await pg.goto(base); await pg.waitForSelector('#lbtn'); await pg.waitForFunction(() => /Pelayan sedia/.test(document.querySelector('#lmsg').textContent), null, { timeout: 8000 }).catch(() => { });
  ok(await pg.evaluate(() => document.querySelector('.lb img').naturalWidth > 50), 'logo Mega Safe dipaparkan pada skrin log masuk');
  ok(await pg.evaluate(() => /Pelayan sedia/.test(document.querySelector('#lmsg').textContent)), 'semakan sambungan pelayan: "Pelayan sedia"');
  await pg.screenshot({ path: shots + '/01-login.png' });
  await pg.fill('#lid', 'admin'); await pg.fill('#lpw', 'salah-salah'); await pg.click('#lbtn'); await wait(600);
  ok(/salah|tidak aktif/.test(await pg.textContent('#lmsg')), 'kata laluan salah ditolak dengan mesej jelas');
  await pg.fill('#lpw', 'Strong-Pass-123x'); await pg.click('#lbtn'); await pg.waitForSelector('#s2', { state: 'visible' });
  ok(true, 'kotak 2FA muncul selepas kata laluan betul');
  H.tick(31000); await pg.fill('#lotp', H.totp(SECRET)); await pg.click('#lbtn'); await pg.waitForSelector('#app', { state: 'visible' }); await wait(800);
  ok(/Pusat Kawalan/.test(await pg.textContent('#c')), 'admin masuk ke Dashboard');
  ok(await pg.evaluate(() => document.querySelector('header img').naturalWidth > 20), 'logo pada bar atas');
  await pg.screenshot({ path: shots + '/02-dashboard.png', fullPage: true });

  console.log('2. Semua halaman admin');
  const pages = ['dash', 'map', 'Attendance', 'reports', 'term', 'Visitors', 'logs', 'hr', 'manage', 'roster', 'settings'];
  for (const k of pages) {
    await pg.evaluate(k => goPage(k), k); await wait(900);
    const txt = await pg.textContent('#c'), bad = /Memuatkan\.\.\./.test(txt) || txt.trim().length < 30;
    ok(!bad, 'halaman ' + k + ' dimuatkan'); await pg.screenshot({ path: shots + '/p-' + k + '.png', fullPage: true });
  }
  await pg.evaluate(() => { LTAB = 'audit'; goPage('logs'); }); await wait(700); ok(/SHA-256/.test(await pg.textContent('#c')) && /USER_LOGIN/.test(await pg.textContent('#c')), 'Audit Trail memaparkan log + hash SHA-256'); await pg.screenshot({ path: shots + '/p-audit.png', fullPage: true });
  await pg.evaluate(() => { MTAB = 'route'; goPage('map'); }); await wait(700); await pg.click('text=Cari laluan'); await wait(700); ok(/120 m/.test(await pg.textContent('#rr')), 'Ejen Laluan memaparkan jarak & langkah'); await pg.screenshot({ path: shots + '/p-route.png' });
  await pg.evaluate(() => { MTAB = 'sos'; goPage('map'); }); await wait(900); ok(/999/.test(await pg.textContent('#c')), 'Bantuan Kecemasan dipaparkan'); await pg.screenshot({ path: shots + '/p-sos.png', fullPage: true });
  await pg.evaluate(() => { MTAB = 'prem'; goPage('map'); }); await wait(800); ok(await pg.evaluate(() => !!document.querySelector('#map iframe')), 'Peta Google dipaparkan (iframe, tanpa API key)'); await pg.screenshot({ path: shots + '/p-map.png' });

  console.log('3. Admin cipta data melalui borang');
  await pg.evaluate(() => goPage('roster')); await wait(600); await pg.evaluate(() => openForm('PatrolConfig')); await wait(200);
  ok(await pg.inputValue('#f_Start') === '00:00' && await pg.inputValue('#f_IntervalMin') === '60', 'borang alarm baharu ada nilai lalai'); await pg.fill('#f_IntervalMin', '2'); await pg.fill('#f_AlarmSec', '20'); await pg.click('#mb >> text=Simpan'); await wait(1000);
  ok(H.good('list', { sheet: 'PatrolConfig' }, await pg.evaluate(() => T)).rows.some(r => r.IntervalMin === '2' && r.AlarmSec === '20'), 'admin menetapkan selang (2 min) & tempoh alarm (20s) - tersimpan di Sheet');
  await pg.evaluate(() => { PSEL = 'HQ Bundusan Commercial'; goPage('hr'); }); await wait(900); ok(/Mohd Farhan/.test(await pg.textContent('#t_Guards')) && !/Arumugam/.test(await pg.textContent('#t_Guards')), 'penapis premis bar atas berfungsi (jadual pegawai)');
  await pg.evaluate(() => { PSEL = ''; }); await pg.screenshot({ path: shots + '/p-hr.png', fullPage: true });
  await pg.evaluate(() => openForm('Guards')); await pg.fill('#f_Name', 'Ujian Baharu'); await pg.fill('#f_StaffNo', 'MS099'); await pg.fill('#f_NewPIN', 'Abcdefgh1!'); await pg.click('#mb >> text=Simpan'); await wait(1000);
  ok(/Ujian Baharu/.test(await pg.textContent('#c')), 'tambah pegawai melalui HR (muncul dalam senarai)');
  await pg.evaluate(() => goPage('settings')); await wait(800);
  await pg.selectOption('#pt', { label: 'Ujian Baharu (MS099)' }); await pg.fill('#pn', 'Pass#Baharu77'); await pg.fill('#pc', 'Pass#Baharu77'); await pg.click('text=Simpan Kata Laluan'); await wait(900);
  ok(/dikemas kini/.test(await pg.textContent('#toast')), 'admin menukar kata laluan pegawai dari Tetapan');

  console.log('4. Pegawai (telefon)');
  const gctx = await br.newContext({ viewport: { width: 390, height: 800 }, isMobile: true }); await gctx.addInitScript(() => { window.PublicKeyCredential = undefined; }); const gp = await newPage(gctx);
  await gp.goto(base); await gp.fill('#lid', 'MS001'); await gp.fill('#lpw', 'Guard#Pass1'); await gp.click('#lbtn'); await gp.waitForSelector('#app', { state: 'visible' }); await wait(900);
  ok(/Terminal Rondaan Pegawai/.test(await gp.textContent('#c')), 'pegawai terus ke Guard Mobile Terminal');
  const navs = await gp.$$eval('#nav a', a => a.map(x => x.textContent)); ok(navs.length === 4 && !navs.some(n => /Settings|Tetapan|HR|Roster|Premises/.test(n)), 'menu pegawai terhad (tiada Tetapan/HR/Roster): ' + navs.join(', '));
  ok(await gp.evaluate(() => !document.querySelector('#nav').textContent.includes('Tetapan')), 'pegawai tiada akses halaman tukar kata laluan');
  const r = await gp.evaluate(() => rpc('setPin', { target: 'x', pin: 'Abcdefgh1', confirm: 'Abcdefgh1' })); ok(r === null, 'pegawai tidak boleh memanggil setPin (ditolak pelayan)');
  await gp.evaluate(() => doClock('in')); await wait(900); ok(/AKTIF BERTUGAS/.test(await gp.textContent('#c')), 'Clock In berjaya, status AKTIF BERTUGAS');
  await gp.screenshot({ path: shots + '/g-terminal.png', fullPage: true });
  const cps = H.good('list', { sheet: 'Checkpoints' }, H.good('login', { id: 'admin', pin: 'Strong-Pass-123x', otp: (H.tick(31000), H.totp(SECRET)) }).token).rows;
  // alarm: selang ditukar kepada 2 min, alarm 20s. Maju masa pelayan melepasi selang
  H.tick(2 * 60000 + 3000); await gp.evaluate(() => rpc('poll', {}).then(d => { setST(d.st); tick(); })); await wait(1300);
  ok(await gp.evaluate(() => getComputedStyle(document.querySelector('#alm')).display !== 'none'), 'bar alarm merah muncul pada masa rondaan');
  ok(!(await gp.evaluate(() => /henti|stop|tutup/i.test(document.querySelector('#alm').textContent.replace('Imbas checkpoint untuk menghentikan alarm', '')))), 'tiada butang untuk mematikan alarm selain mengimbas');
  await gp.screenshot({ path: shots + '/g-alarm.png' });
  await gp.evaluate(() => { setST(Object.assign({}, ST, { on: true, started: false, due: nowS() - 5000, alarmSec: 60, now: nowS() })); tick(); }); await wait(300);
  ok(await gp.evaluate(() => /MASA RONDA/.test(document.querySelector('#almT').textContent)), 'alarm berbunyi: teks "MASA RONDA" + kiraan detik tempoh alarm'); await gp.screenshot({ path: shots + '/g-ring.png' });
  await gp.evaluate(code => doScan(code), cps[0].QRCode); await wait(1000);
  ok(await gp.evaluate(() => getComputedStyle(document.querySelector('#alm')).display === 'none'), 'alarm berhenti selepas pegawai mengimbas checkpoint');
  ok(/1\/5|20%/.test(await gp.textContent('#c')), 'kemajuan checkpoint 1/5 dipaparkan');
  await gp.evaluate(() => { TAB = 'inc'; showTerm(); }); await gp.fill('#id', 'Orang tidak dikenali di pagar belakang'); await gp.click('text=Hantar kepada pentadbir'); await wait(900);
  await gp.evaluate(() => doSOS()); await wait(900);
  await wait(5500); ok(await pg.evaluate(() => document.querySelector('#bn').style.display !== 'none'), 'loceng admin menunjukkan ancaman baharu (masa nyata)');
  console.log('5. Luar talian');
  await gp.evaluate(() => { TAB = 'pass'; showTerm(); }); await gp.click('text=Daftar Kunci Pas'); await wait(1500);
  ok(await gp.evaluate(() => (ls('pf') || []).length === 1), 'kunci pas luar talian didaftarkan (PIN peranti)');
  await gctx.setOffline(true); await gp.evaluate(code => doScan(code), cps[1].QRCode); await wait(1200);
  ok(await gp.evaluate(() => qget().length >= 1), 'imbasan luar talian disimpan dalam baris gilir');
  await gctx.setOffline(false); await gp.evaluate(() => syncQ()); await wait(1500);
  ok(await gp.evaluate(() => qget().length === 0), 'baris gilir disegerakkan selepas dalam talian');
  const pt = H.good('list', { sheet: 'Patrol' }, H.good('login', { id: 'admin', pin: 'Strong-Pass-123x', otp: (H.tick(31000), H.totp(SECRET)) }).token).rows; ok(pt.length >= 2 && pt.some(x => x.Source === 'Offline' || x.Checkpoint), 'rekod rondaan tiba di Google Sheet');
  // mod luar talian dari skrin log masuk
  const g2 = await br.newContext({ viewport: { width: 390, height: 800 } }); await g2.addInitScript(() => { window.PublicKeyCredential = undefined; }); const lp = await newPage(g2);
  await lp.goto(base); await lp.evaluate(pf => localStorage.setItem('pf', pf), await gp.evaluate(() => localStorage.getItem('pf'))); await lp.reload(); await lp.waitForSelector('#loff', { state: 'visible' });
  await lp.click('#loff'); await lp.waitForSelector('#app', { state: 'visible' }, { timeout: 8000 }).catch(() => { }); await wait(600);
  ok(await lp.evaluate(() => OFFMODE === true && document.querySelector('#off').style.display === 'block'), 'log masuk luar talian dengan kunci pas berfungsi tanpa pelayan');

  console.log('6. Ralat JavaScript semasa semua ujian');
  ok(errors.length === 0, 'tiada ralat JS/konsol' + (errors.length ? ': ' + errors.slice(0, 5).join(' | ') : ''));
  console.log('\n' + pass + ' lulus, ' + fail + ' gagal'); await br.close(); srv.close(); process.exit(fail ? 1 : 0);
})().catch(e => { console.error('RALAT UJIAN', e); process.exit(2); });
