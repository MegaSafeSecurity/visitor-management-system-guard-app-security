// Semakan sintaks pantas (tanpa Apps Script): node scripts/check.js
const fs = require('fs'), vm = require('vm'), path = require('path');
const root = path.join(__dirname, '..');
let bad = 0;
function chk(name, code) {
  try { new vm.Script(code, { filename: name }); console.log('OK  ' + name); }
  catch (e) { bad++; console.error('GAGAL ' + name + ': ' + e.message); }
}
chk('Code.gs', fs.readFileSync(path.join(root, 'Code.gs'), 'utf8'));
const html = fs.readFileSync(path.join(root, 'Index.html'), 'utf8');
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
scripts.forEach((s, i) => chk('Index.html <script> #' + (i + 1), s));
if (!fs.existsSync(path.join(root, 'Logo.html'))) { bad++; console.error('GAGAL Logo.html tiada'); }
process.exit(bad ? 1 : 0);
