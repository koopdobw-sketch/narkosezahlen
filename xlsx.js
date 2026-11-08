// Narkose-Tool: minimaler XLSX-Writer (ohne Bibliothek, offline).
// zeilen: Array von Arrays. Werte: Zahl, Text, {d:'YYYY-MM-DD'} (Datum), null/'' (leer).
// Die erste Zeile wird fett dargestellt (Kopfzeile).

function utf8(str) {
  const out = [];
  for (const ch of str) {
    let c = ch.codePointAt(0);
    if (c < 0x80) out.push(c);
    else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 63));
    else if (c < 0x10000) out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    else out.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
  }
  return new Uint8Array(out);
}

const CRC_TABELLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABELLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

// ZIP ohne Kompression (Methode 0), ausreichend für Excel.
function zip(dateien) {
  const teile = [];
  const zentral = [];
  let offset = 0;
  const datum = 0x21; // 1980-01-01
  for (const { name, data } of dateien) {
    const nameBytes = utf8(name);
    const crc = crc32(data);
    const kopf = new DataView(new ArrayBuffer(30));
    kopf.setUint32(0, 0x04034b50, true); kopf.setUint16(4, 20, true); kopf.setUint16(6, 0x0800, true);
    kopf.setUint16(8, 0, true); kopf.setUint16(10, 0, true); kopf.setUint16(12, datum, true);
    kopf.setUint32(14, crc, true); kopf.setUint32(18, data.length, true); kopf.setUint32(22, data.length, true);
    kopf.setUint16(26, nameBytes.length, true); kopf.setUint16(28, 0, true);
    teile.push(new Uint8Array(kopf.buffer), nameBytes, data);
    const zk = new DataView(new ArrayBuffer(46));
    zk.setUint32(0, 0x02014b50, true); zk.setUint16(4, 20, true); zk.setUint16(6, 20, true); zk.setUint16(8, 0x0800, true);
    zk.setUint16(10, 0, true); zk.setUint16(12, 0, true); zk.setUint16(14, datum, true);
    zk.setUint32(16, crc, true); zk.setUint32(20, data.length, true); zk.setUint32(24, data.length, true);
    zk.setUint16(28, nameBytes.length, true); zk.setUint16(30, 0, true); zk.setUint16(32, 0, true);
    zk.setUint16(34, 0, true); zk.setUint16(36, 0, true); zk.setUint32(38, 0, true); zk.setUint32(42, offset, true);
    zentral.push(new Uint8Array(zk.buffer), nameBytes);
    offset += 30 + nameBytes.length + data.length;
  }
  const zentralGroesse = zentral.reduce((s, t) => s + t.length, 0);
  const ende = new DataView(new ArrayBuffer(22));
  ende.setUint32(0, 0x06054b50, true); ende.setUint16(8, dateien.length, true); ende.setUint16(10, dateien.length, true);
  ende.setUint32(12, zentralGroesse, true); ende.setUint32(16, offset, true);
  return verbinde([...teile, ...zentral, new Uint8Array(ende.buffer)]);
}

function verbinde(teile) {
  const gesamt = teile.reduce((s, t) => s + t.length, 0);
  const out = new Uint8Array(gesamt);
  let p = 0;
  for (const t of teile) { out.set(t, p); p += t.length; }
  return out;
}

const xmlEsc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const spalte = (i) => { let s = ''; i++; while (i > 0) { const r = (i - 1) % 26; s = String.fromCharCode(65 + r) + s; i = Math.floor((i - 1) / 26); } return s; };
const excelDatum = (iso) => {
  const [y, m, d] = iso.split('-').map(Number);
  return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(1899, 11, 30)) / 86400000);
};

function zelleXml(wert, ref, kopfzeile) {
  if (wert === null || wert === undefined || wert === '') return '';
  if (typeof wert === 'number') return `<c r="${ref}"><v>${wert}</v></c>`;
  if (typeof wert === 'object' && wert.d) return `<c r="${ref}" s="1"><v>${excelDatum(wert.d)}</v></c>`;
  const stil = kopfzeile ? ' s="2"' : '';
  return `<c r="${ref}"${stil} t="inlineStr"><is><t xml:space="preserve">${xmlEsc(wert)}</t></is></c>`;
}

// Hauptfunktion: liefert die Bytes einer .xlsx-Datei.
export function erstelleXlsx(zeilen, { blattname = 'Tabelle1', spaltenbreiten = null } = {}) {
  const breite = zeilen.reduce((m, z) => Math.max(m, z.length), 0);
  const zeilenXml = zeilen.map((z, r) => {
    const zellen = z.map((w, c) => zelleXml(w, spalte(c) + (r + 1), r === 0)).join('');
    return `<row r="${r + 1}">${zellen}</row>`;
  }).join('');
  const cols = spaltenbreiten
    ? `<cols>${spaltenbreiten.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('')}</cols>`
    : '';
  const letzte = spalte(Math.max(breite - 1, 0)) + Math.max(zeilen.length, 1);
  const ns = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
  const rns = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
  const dateien = [
    { name: '[Content_Types].xml', data: utf8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`) },
    { name: '_rels/.rels', data: utf8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`) },
    { name: 'xl/workbook.xml', data: utf8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="${ns}" xmlns:r="${rns}"><sheets><sheet name="${xmlEsc(blattname)}" sheetId="1" r:id="rId1"/></sheets></workbook>`) },
    { name: 'xl/_rels/workbook.xml.rels', data: utf8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`) },
    { name: 'xl/styles.xml', data: utf8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="${ns}"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="14" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs><cellStyles count="1"><cellStyle name="Standard" xfId="0" builtinId="0"/></cellStyles></styleSheet>`) },
    { name: 'xl/worksheets/sheet1.xml', data: utf8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="${ns}" xmlns:r="${rns}"><dimension ref="A1:${letzte}"/><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="15"/>${cols}<sheetData>${zeilenXml}</sheetData></worksheet>`) },
  ];
  return zip(dateien);
}
