import fs from 'node:fs/promises';
import { SpreadsheetFile, Workbook } from '@oai/artifact-tool';

const outputDir = 'C:/Users/User/Documents/Codex/2026-11-02/visitor-management-system-guard-app-security/outputs/visitor-guard-vms';
const workbook = Workbook.create();
const navy = '#10243A';
const slate = '#475467';
const pale = '#EAF1F7';
const white = '#FFFFFF';
const font = { name: 'Arial', size: 10, color: '#172033' };

const tabs = {
  'EMPLOYEES': ['Employee ID','Full Name','Phone','Position','Default Site ID','Status','QR Revision','Created At','Updated At','Notes'],
  'SITES': ['Site ID','Site Name','Address','Latitude','Longitude','GPS Radius (m)','Status','Contact Person','Contact Phone','Notes','Updated At'],
  'CHECKPOINTS': ['Checkpoint ID','Site ID','Checkpoint Name','Zone','Latitude','Longitude','GPS Radius (m)','Status','QR Revision','Notes','Updated At'],
  'DUTY ROSTER': ['Roster ID','Duty Date','Employee ID','Site ID','Shift Code','Start Time','End Time','Status','Notes','Created At','Updated At'],
  'ATTENDANCE LOG': ['Event ID','Timestamp','Shift Date','Employee ID','Employee Name Snapshot','Site ID','Site Name Snapshot','Event Type','Roster ID','Latitude','Longitude','GPS Accuracy (m)','Distance From Site (m)','Status','Notes','Request ID'],
  'VISITOR LOG': ['Visitor ID','Check-in Timestamp','Check-out Timestamp','Visit Date','Site ID','Site Name Snapshot','Visitor Name','ID/Passport (Masked)','Company','Phone','Host / Unit','Purpose','Vehicle No','Badge No','Check-in Guard ID','Check-in Guard Name Snapshot','Check-out Guard ID','Check-out Guard Name Snapshot','Check-in Latitude','Check-in Longitude','Check-out Latitude','Check-out Longitude','Status','Notes','Check-in Photo File ID','Check-in Photo Link','Check-out Photo File ID','Check-out Photo Link','Check-in Request ID','Check-out Request ID','Updated At'],
  'SECURITY LOG BOOK': ['Log ID','Timestamp','Log Date','Shift Date','Site ID','Site Name Snapshot','Guard ID','Guard Name Snapshot','Category','Priority','Subject','Details','Action Taken','Reported To','Latitude','Longitude','GPS Accuracy (m)','Photo File ID','Photo Link','Status','Revision','Request ID','Updated At'],
  'CHECKPOINT LOG': ['Event ID','Timestamp','Shift Date','Site ID','Site Name Snapshot','Guard ID','Guard Name Snapshot','Checkpoint ID','Checkpoint Name Snapshot','Zone Snapshot','Latitude','Longitude','GPS Accuracy (m)','Distance From Checkpoint (m)','Status','Photo File ID','Photo Link','Notes','Request ID'],
  'DAILY SITE REPORT': ['Report Date','Site ID','Site Name','Rostered Guards','Checked In','Open Attendance Exceptions','Checkpoint Checks','Checkpoint Exceptions','Log Book Entries','Log Book Open','Visitor Check-ins','Visitors On Site','Last Generated At'],
  'SETTINGS': ['Setting','Value','Description'],
  'AUDIT LOG': ['Audit ID','Timestamp','Actor','Action','Entity Type','Entity ID','Detail']
};

function columnName(n) {
  let out = '';
  while (n > 0) { const p = (n - 1) % 26; out = String.fromCharCode(65 + p) + out; n = Math.floor((n - 1) / 26); }
  return out;
}

function prepareTable(name, headers) {
  const sheet = workbook.worksheets.add(name);
  sheet.showGridLines = false;
  sheet.getRange(`A1:${columnName(headers.length)}1`).values = [headers];
  const header = sheet.getRange(`A1:${columnName(headers.length)}1`);
  header.format = { fill: navy, font: { name: 'Arial', size: 10, bold: true, color: white }, horizontalAlignment: 'center', verticalAlignment: 'center', wrapText: true, borders: { preset: 'outside', style: 'thin', color: '#CBD5E1' } };
  header.format.rowHeight = 32;
  sheet.freezePanes.freezeRows(1);
  sheet.getRange(`A2:${columnName(headers.length)}200`).format = { font, verticalAlignment: 'center' };
  sheet.getRange(`A1:${columnName(headers.length)}200`).format.columnWidth = 16;
  return sheet;
}

const dash = workbook.worksheets.add('VMS DASHBOARD');
dash.showGridLines = false;
dash.getRange('A1:H1').merge();
dash.getRange('A1').values = [['MEGA SAFE Visitor & Guard Operations']];
dash.getRange('A1:H1').format = { fill: navy, font: { name: 'Arial', size: 18, bold: true, color: white }, verticalAlignment: 'center' };
dash.getRange('A1:G1').format.rowHeight = 34;
dash.getRange('A3:H3').values = [['Today','Active guards','Scheduled today','Check-ins today','Checkpoint checks','Open log entries','Visitors on site','Last setup']];
dash.getRange('A3:H3').format = { fill: pale, font: { name: 'Arial', size: 10, bold: true, color: slate }, horizontalAlignment: 'center', verticalAlignment: 'center' };
// The Apps Script setup function replaces these initial values with Google
// Sheets formulas. Static seed values keep the import template portable and
// avoid an Excel formula engine resolving cross-sheet formulas before import.
dash.getRange('A4:H4').values = [[new Date(), 0, 0, 0, 0, 0, 0, new Date()]];
dash.getRange('A4:H4').format = { font: { name: 'Arial', size: 14, bold: true, color: navy }, fill: white, horizontalAlignment: 'center', verticalAlignment: 'center', borders: { preset: 'outside', style: 'thin', color: '#D9E2EC' } };
dash.getRange('A4:H4').format.rowHeight = 42;
dash.getRange('A4').format.numberFormat = 'dd/mm/yyyy';
dash.getRange('H4').format.numberFormat = 'dd/mm/yyyy hh:mm';
dash.getRange('A6:H6').merge();
dash.getRange('A6').values = [['Source-of-truth rule: keep Employee ID, Site ID, Checkpoint ID and Visitor ID stable. HR may update names and profiles using the existing IDs.']];
dash.getRange('A6:H6').format = { font: { name: 'Arial', size: 10, italic: true, color: slate }, fill: '#F8FAFC' };
dash.getRange('A1:H20').format.columnWidth = 18;
dash.getRange('A1').format.columnWidth = 22;
dash.tabColor = navy;

Object.entries(tabs).forEach(([name, headers]) => prepareTable(name, headers));

const settings = workbook.worksheets.getItem('SETTINGS');
settings.getRange('A2:C4').values = [
  ['GPS_MAX_ACCURACY_M', '100', 'Maximum GPS accuracy accepted by guard submissions.'],
  ['DEFAULT_GPS_RADIUS_M', '150', 'Fallback site/checkpoint radius.'],
  ['ALLOW_OFF_ROSTER', 'NO', 'YES permits attendance outside an active roster. Keep NO for normal operations.']
];
settings.getRange('A2:C4').format = { font, verticalAlignment: 'center', borders: { insideVertical: { style: 'thin', color: '#E2E8F0' } } };
settings.getRange('A:A').format.columnWidth = 28;
settings.getRange('B:B').format.columnWidth = 14;
settings.getRange('C:C').format.columnWidth = 70;
settings.tabColor = '#64748B';

for (const name of ['EMPLOYEES','SITES','CHECKPOINTS','DUTY ROSTER','ATTENDANCE LOG','VISITOR LOG','SECURITY LOG BOOK','CHECKPOINT LOG','DAILY SITE REPORT','SETTINGS','AUDIT LOG']) {
  const sheet = workbook.worksheets.getItem(name);
  const lastCol = tabs[name].length;
  sheet.getRange(`A1:${columnName(lastCol)}1`).format.autofitColumns();
  sheet.getRange(`A1:${columnName(lastCol)}1`).format.columnWidth = 18;
}
settings.getRange('A:A').format.columnWidth = 28;
settings.getRange('B:B').format.columnWidth = 14;
settings.getRange('C:C').format.columnWidth = 70;

workbook.recalculate();
await fs.mkdir(outputDir, { recursive: true });
const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(`${outputDir}/VMS_Guard_App_Template.xlsx`);

const check = await workbook.inspect({ kind: 'table', range: 'VMS DASHBOARD!A1:H6', include: 'values,formulas', tableMaxRows: 8, tableMaxCols: 8 });
console.log(check.ndjson);
