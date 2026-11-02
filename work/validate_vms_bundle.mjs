import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';

const root = String.raw`C:\Users\User\Documents\Codex\2026-11-02\visitor-management-system-guard-app-security\outputs\visitor-guard-vms`;
const code = await fs.readFile(path.join(root, 'Code.gs'), 'utf8');
new vm.Script(code, { filename: 'Code.gs' });

const html = await fs.readFile(path.join(root, 'index.html'), 'utf8');
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
if (scripts.length !== 1) throw new Error(`Expected 1 inline script, found ${scripts.length}`);
const client = scripts[0].replace('<?!= boot ?>', JSON.stringify({}));
new vm.Script(client, { filename: 'index.html:inline-script' });

const builder = await fs.readFile(path.join(root, '..', '..', 'work', 'build_vms_template.mjs'), 'utf8');
function reportHeaders(source, filename) {
  const match = source.match(/['"]DAILY SITE REPORT['"]\s*:\s*\[([^\]]+)\]/);
  if (!match) throw new Error(`DAILY SITE REPORT headers not found in ${filename}`);
  return [...match[1].matchAll(/'([^']+)'/g)].map(([, header]) => header);
}
const appReportHeaders = reportHeaders(code, 'Code.gs');
const templateReportHeaders = reportHeaders(builder, 'build_vms_template.mjs');
if (JSON.stringify(appReportHeaders) !== JSON.stringify(templateReportHeaders)) {
  throw new Error('DAILY SITE REPORT headers differ between Apps Script and workbook template.');
}
if (!html.includes('CREDENTIAL_TTL_MS=12*60*60*1000') || html.includes('sessionStorage')) {
  throw new Error('Guard QR context must be shared across tabs and expire after 12 hours.');
}

for (const file of ['README.md', 'appsscript.json', 'VMS_Guard_App_Template.xlsx']) {
  await fs.access(path.join(root, file));
}

console.log('Syntax and deliverable presence checks passed.');
