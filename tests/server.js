// Pelayan ujian: menghidang fail statik + tiruan Apps Script di POST /exec (guna tests/harness.js)
const http = require('http'), fs = require('fs'), path = require('path');
const H = require('./harness.js');
const root = path.join(__dirname, '..');
const SECRET = 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png' };

function seed() {
  const { run, good, sandbox, props, totp } = H;
  sandbox.__active = 'owner@x.com'; run('menuSetup()'); run("M.adminFromEditor('Strong-Pass-123x')"); sandbox.__active = '';
  props.ADMIN_TOTP = SECRET; props.ADMIN_TOTP_ON = '1';
  const A = good('login', { id: 'admin', pin: 'Strong-Pass-123x', otp: totp(SECRET) }).token;
  const P = ['HQ Bundusan Commercial|Jalan Bundusan, 88300 Penampang, Kota Kinabalu, Sabah', 'KK Port Depot & Logistics Terminal|Jalan Sepangar, Teluk Sepanggar, 88450 Kota Kinabalu, Sabah', 'Inanam Industrial Park Warehouse|Mile 6, Jalan Tuaran, Inanam, 88450 Kota Kinabalu, Sabah', 'Cyber City Commercial Hub|Jalan Lintas, Kepayan, 88200 Kota Kinabalu, Sabah'];
  P.forEach(x => { const [Name, Address] = x.split('|'); good('save', { sheet: 'Premises', row: { Name, Address, Status: 'Active' } }, A); });
  ['Pintu Masuk Utama (Main Guardhouse)', 'Lobi Menara Korporat A & Lif', 'Tempat Letak Kereta Bawah Tanah B1', 'Zon Pemunggahan & Stor Belakang', 'Tangga Kecemasan Timur & Generator'].forEach((Name, i) => good('save', { sheet: 'Checkpoints', row: { Premise: P[0].split('|')[0], Name, Seq: String(i + 1) } }, A));
  const G = [['Mohd Farhan bin Roslan', 'MS001', 0, '07:00', '15:00', '1,2,3,4,5', 'Syif 1 (Pagi)'], ['Siti Norheliza binti Bakar', 'MS002', 0, '15:00', '23:00', '1,2,3,4,5', 'Syif 2 (Petang)'], ['K. Arumugam a/l Krishnan', 'MS003', 1, '07:00', '15:00', '1,2,3,4,5', 'Syif 1 (Pagi)'], ['David Lingam', 'MS004', 2, '23:00', '07:00', '6,7,1,2', 'Syif 3 (Malam)']];
  G.forEach(g => good('save', { sheet: 'Guards', row: { Name: g[0], StaffNo: g[1], Premise: P[g[2]].split('|')[0], Shift: 'Shift1', Status: 'Active', NewPIN: 'Guard#Pass1' } }, A));
  const gl = good('guardsLite', {}, A);
  G.forEach(g => good('save', { sheet: 'Roster', row: { GuardID: gl.find(x => x.staff === g[1]).id, Premise: P[g[2]].split('|')[0], ShiftName: g[6], Start: g[3], End: g[4], Days: g[5] } }, A));
  good('save', { sheet: 'PatrolConfig', row: { Premise: P[0].split('|')[0], IntervalMin: '60', AlarmSec: '60', Start: '00:00', End: '23:59', Active: 'Yes' } }, A);
  [['27-10-2025', 'syarikat tidak menerima salinan surat pelepasan tapak pos keselamatan', 'Approved'], ['18-09-2025', 'syarikat lambat terima surat kebenaran tapak pembinaan Sepanggar', 'Justified'], ['17-09-2025', 'cek date mula kerja dan jadual pertukaran syif waktu malam', 'Resolved']].forEach(c => good('save', { sheet: 'Complaints', row: { Date: c[0], Premise: P[0].split('|')[0], Description: c[1], Status: c[2] } }, A));
}
function start(port) {
  seed();
  const srv = http.createServer((req, res) => {
    if (req.method === 'POST' && req.url.startsWith('/exec')) {
      let b = ''; req.on('data', d => b += d); req.on('end', () => {
        let out; try { out = H.run('doPost')({ postData: { contents: b } }).text; } catch (e) { out = JSON.stringify({ error: String(e) }); }
        res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(out);
      }); return;
    }
    let u = decodeURIComponent(req.url.split('?')[0]); if (u === '/') u = '/index.html';
    if (u === '/js/config.js') { res.writeHead(200, { 'Content-Type': 'text/javascript' }); return res.end("window.MEGASAFE_API='/exec';"); }
    const f = path.join(root, u); if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('404'); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); res.end(fs.readFileSync(f));
  });
  return new Promise(r => srv.listen(port, () => r(srv)));
}
module.exports = { start, SECRET, H };
if (require.main === module) start(8099).then(() => console.log('http://localhost:8099'));
