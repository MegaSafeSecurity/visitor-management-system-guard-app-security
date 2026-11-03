// Minimal in-memory mock of the Apps Script services used by src/Code.gs
const vm = require('vm'), fs = require('fs'), crypto = require('crypto');
function load(file) {
  const books = {}; let seq = 0;
  const mkSheet = (reg, name) => { const s = { name, v: [[]],
    getRange(r, c, nr, nc) { nr = nr || 1; nc = nc || 1; const o = {
      setValues(a) { for (let i = 0; i < a.length; i++) { s.v[r - 1 + i] = s.v[r - 1 + i] || []; for (let j = 0; j < a[i].length; j++) s.v[r - 1 + i][c - 1 + j] = a[i][j]; } return o; },
      setValue(x) { s.v[r - 1] = s.v[r - 1] || []; s.v[r - 1][c - 1] = x; return o; },
      getValues() { const out = []; for (let i = 0; i < nr; i++) { const row = []; for (let j = 0; j < nc; j++) { const x = (s.v[r - 1 + i] || [])[c - 1 + j]; row.push(x === undefined ? '' : x); } out.push(row); } return out; } };
      ['setFontWeight', 'setBackground', 'setFontColor', 'setNumberFormat'].forEach(f => o[f] = () => o); return o; },
    getDataRange() { return { getValues: () => s.v.map(r => r.slice()) }; },
    appendRow(a) { if (s.v.length === 1 && s.v[0].length === 0) s.v[0] = a.slice(); else s.v.push(a.slice()); },
    getLastRow() { return s.v.length; }, deleteRow(i) { s.v.splice(i - 1, 1); }, setFrozenRows() {},
    setName(n) { delete reg[s.name]; s.name = n; reg[n] = s; } }; reg[name] = s; return s; };
  const mkBook = (name, withDefault) => { const reg = {}, id = 'book' + (++seq);
    const b = { id, reg, getId: () => id, getUrl: () => 'https://sheets/' + id, getSheetByName: n => reg[n] || null, insertSheet: n => mkSheet(reg, n), getSheets: () => Object.values(reg) };
    if (withDefault) mkSheet(reg, 'Sheet1'); books[id] = b; return b; };
  const main = mkBook('main', false);
  const toBuf = x => typeof x === 'string' ? Buffer.from(x, 'utf8') : Buffer.from(x.map(b => b & 255));
  const signed = b => Array.from(b).map(x => x > 127 ? x - 256 : x);
  const cache = {}, pr = {};
  const ctx = { console, Logger: { log() {} },
    SpreadsheetApp: { getActiveSpreadsheet: () => main, create: () => mkBook('new', true), openById: id => { if (!books[id]) throw new Error('nf'); return books[id]; } },
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => pr[k] == null ? null : pr[k], setProperty: (k, v) => { pr[k] = String(v); }, deleteProperty: k => { delete pr[k]; } }) },
    CacheService: { getScriptCache: () => ({ get: k => cache[k] == null ? null : cache[k], put: (k, v) => { cache[k] = v; }, remove: k => { delete cache[k]; } }) },
    ScriptApp: { getProjectTriggers: () => [], deleteTrigger() {}, newTrigger: () => ({ timeBased: () => ({ everyMinutes: () => ({ create() {} }) }) }) },
    Utilities: {
      formatDate(d, tz, f) { const p = n => String(n).padStart(2, '0'), x = new Date(d.getTime() + 8 * 3600e3);
        const m = { yyyy: x.getUTCFullYear(), yy: String(x.getUTCFullYear()).slice(2), MM: p(x.getUTCMonth() + 1), dd: p(x.getUTCDate()), HH: p(x.getUTCHours()), mm: p(x.getUTCMinutes()), ss: p(x.getUTCSeconds()) };
        return f.replace(/yyyy|yy|MM|dd|HH|mm|ss/g, t => m[t]); },
      getUuid: () => crypto.randomUUID(), DigestAlgorithm: { SHA_256: 'sha256' }, MacAlgorithm: { HMAC_SHA_1: 'sha1' },
      computeDigest: (a, s) => signed(crypto.createHash('sha256').update(toBuf(s)).digest()),
      computeHmacSha256Signature: (v, k) => { if (typeof v !== typeof k) throw new Error('overload mismatch'); return signed(crypto.createHmac('sha256', toBuf(k)).update(toBuf(v)).digest()); },
      computeHmacSignature: (a, v, k) => signed(crypto.createHmac('sha1', toBuf(k)).update(toBuf(v)).digest()),
      base64EncodeWebSafe: b => toBuf(b).toString('base64').replace(/\+/g, '-').replace(/\//g, '_'),
      base64Decode: s => signed(Buffer.from(s, 'base64')), newBlob: s => ({ getBytes: () => signed(Buffer.from(s)) }) },
    Maps: { newGeocoder: () => ({ setRegion() { return this; }, geocode: q => ({ results: [{ formatted_address: 'KK ' + q, geometry: { location: { lat: 5.98, lng: 116.07 } } }] }) }),
      DirectionFinder: { Mode: { DRIVING: 'D', WALKING: 'W', TRANSIT: 'T', BICYCLING: 'B' } },
      newDirectionFinder: () => { const f = { setOrigin() { return f; }, setDestination() { return f; }, setMode() { return f; }, setRegion() { return f; },
        getDirections: () => ({ status: 'OK', routes: [{ legs: [{ start_address: 'A', end_address: 'B', distance: { text: '10 km' }, duration: { text: '15 min' }, steps: [{ html_instructions: 'Belok <b>kiri</b>', distance: { text: '1 km' } }] }] }] }) }; return f; } } };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(file, 'utf8'), ctx);
  const g = vm.runInContext('({rpc,setup,totp,b32enc,monitor,props,S})', ctx);
  return { g, cache, pr, main, books };
}
module.exports = { load };
