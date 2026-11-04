// Semakan sintaks: node scripts/check.js  (jalankan selepas node scripts/build.js)
const fs = require('fs'), vm = require('vm'), path = require('path');
const root = path.join(__dirname, '..'); let bad = 0;
function chk(name, code) { try { new vm.Script(code, { filename: name }); console.log('OK  ' + name); } catch (e) { bad++; console.error('GAGAL ' + name + ': ' + e.message); } }
['apps-script/Code.gs', 'js/app.js', 'js/config.js', 'sw.js'].forEach(f => chk(f, fs.readFileSync(path.join(root, f), 'utf8')));
JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8')); JSON.parse(fs.readFileSync(path.join(root, 'apps-script/appsscript.json'), 'utf8')); console.log('OK  manifest.json, appsscript.json');
const h = fs.readFileSync(path.join(root, 'apps-script/Index.html'), 'utf8');
[...h.matchAll(/<script>([\s\S]*?)<\/script>/g)].forEach((m, i) => chk('apps-script/Index.html <script> #' + (i + 1), m[1]));
if (/<\?!?=|\{\{LOGO\}\}|src="img\/|href="css\/|src="js\//.test(h)) { bad++; console.error('GAGAL apps-script/Index.html masih merujuk fail luar'); }
process.exit(bad ? 1 : 0);
