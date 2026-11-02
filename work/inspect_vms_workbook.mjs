import fs from 'node:fs/promises';
import { FileBlob, SpreadsheetFile } from '@oai/artifact-tool';

const xlsx = 'C:/Users/User/Documents/Codex/2026-11-02/visitor-management-system-guard-app-security/outputs/visitor-guard-vms/VMS_Guard_App_Template.xlsx';
const previewDir = 'C:/Users/User/Documents/Codex/2026-11-02/visitor-management-system-guard-app-security/work/vms-previews';
const workbook = await SpreadsheetFile.importXlsx(await FileBlob.load(xlsx));
const sheets = await workbook.inspect({ kind: 'sheet', include: 'id,name', maxChars: 6000 });
console.log(sheets.ndjson);
const dashboard = await workbook.inspect({ kind: 'table', range: 'VMS DASHBOARD!A1:H6', include: 'values,formulas', tableMaxRows: 8, tableMaxCols: 8 });
console.log(dashboard.ndjson);
const formulaErrors = await workbook.inspect({ kind: 'match', searchTerm: '#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A|#NUM!|#NULL!|#SPILL!|#CALC!', options: { useRegex: true, maxResults: 100 }, summary: 'template formula errors' });
console.log(formulaErrors.ndjson);
await fs.mkdir(previewDir, { recursive: true });
for (const name of ['VMS DASHBOARD','EMPLOYEES','SITES','CHECKPOINTS','DUTY ROSTER','ATTENDANCE LOG','VISITOR LOG','SECURITY LOG BOOK','CHECKPOINT LOG','DAILY SITE REPORT','SETTINGS','AUDIT LOG']) {
  const preview = await workbook.render({ sheetName: name, autoCrop: 'all', scale: 1, format: 'png' });
  await fs.writeFile(`${previewDir}/${name.replace(/[^A-Za-z0-9]+/g, '_')}.png`, new Uint8Array(await preview.arrayBuffer()));
}
console.log('Rendered 12 sheets for visual QA.');
