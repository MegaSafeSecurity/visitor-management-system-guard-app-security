// Builds dist/Code.single.gs: ONE file to paste into Apps Script (no HTML files needed).
const fs = require('fs'), path = require('path'), root = path.join(__dirname, '..');
const rd = f => fs.readFileSync(path.join(root, f), 'utf8');
let code = rd('src/Code.gs'), logo = rd('src/Logo.html').trim();
const html = rd('src/Index.html').split("<?!= include('Logo') ?>").join('__LOGO__').split('<?= ScriptApp.getService().getUrl() ?>').join('__EXEC__');
const chunks = Buffer.from(html, 'utf8').toString('base64').match(/.{1,110}/g).map(s => "'" + s + "'").join(',\n  ');
const doGet = `function doGet() {
  var html = Utilities.newBlob(Utilities.base64Decode(PAGE_B64.join(''))).getDataAsString('UTF-8')
    .split('__LOGO__').join(LOGO).split('__EXEC__').join(ScriptApp.getService().getUrl());
  return HtmlService.createHtmlOutput(html)
    .setTitle('Mega Safe Security Services Sdn Bhd')
    .addMetaTag('viewport', 'width=device-width,initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}`;
if (!/\/\/#region PAGE[\s\S]*?\/\/#endregion/.test(code)) throw new Error('PAGE region missing');
code = code.replace(/\/\/#region PAGE[\s\S]*?\/\/#endregion/, doGet);
code += "\n/* ---------- PAPARAN (dijana oleh scripts/build-single.js, jangan ubah) ---------- */\nconst LOGO = '" + logo + "';\nconst PAGE_B64 = [\n  " + chunks + "\n];\n";
fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
fs.writeFileSync(path.join(root, 'dist/Code.single.gs'), code);
console.log('dist/Code.single.gs', Math.round(code.length / 1024) + ' KB');
