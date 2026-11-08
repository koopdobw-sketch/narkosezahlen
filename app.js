// Narkose-Tool: Oberfläche. Alle Daten bleiben im Browser (localStorage). Kein Netz nötig.
import { parseDiktat } from './parser.js';
import { klassifiziere, normalisiere, KATEGORIEN } from './katalog.js';
import { narkosezahlenXlsx, quartalsvorlageXlsx } from './export.js';

const KAT_LABEL = {
  abdomen: 'Abdomen', intrakraniell: 'Intrakraniell', kopf_hals: 'Kopf/Hals', thorax: 'Thorax',
  geburtshilfe: 'Geburtshilfe', reanimation: 'Reanimation', gefaess: 'Gefäßchirurgie', sonstige: 'Sonstige',
};
const VERF_LABEL = {
  vITN: 'vITN', kITN: 'kITN', nITN: 'nITN', LAMA: 'LAMA', Fieberoptik: 'Fieberoptik', Analgosedierung: 'Analgosedierung',
  Art: 'Art', ZVK: 'ZVK', 'ZVK+Art': 'ZVK + Art', PDK: 'PDK', SPA: 'SPA', ISB: 'ISB', Supraklavikulaer: 'Supraklavikulär',
  Infraklavikulaer: 'Infraklavikulär', Axillaer: 'Axillär', Femoral: 'Femoral', Ischiadikus: 'Ischiadikus', 'Anderer Block': 'Anderer Block',
  TIVA: 'TIVA', Rotem: 'Rotem',
};
const INTUBATION = ['vITN', 'kITN', 'nITN'];
const PERIPHER = ['ISB', 'Supraklavikulaer', 'Infraklavikulaer', 'Axillaer', 'Femoral', 'Ischiadikus', 'Anderer Block'];
const PDA_SPA = ['PDK', 'SPA'];
const KEY = 'narkose.daten.v1', ZKEY = 'narkose.zuordnung.v1', MKEY = 'narkose.meta.v1';

// ---------- Speicher (lokal, mit Fehlerabfang) ----------
function lade(key, fallback) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch (e) { return fallback; }
}
function speichere(key, wert) {
  try { localStorage.setItem(key, JSON.stringify(wert)); return true; }
  catch (e) { alert('Speichern fehlgeschlagen (Speicher voll oder gesperrt). Bitte Sicherung exportieren.'); return false; }
}
let narkosen = lade(KEY, []);
let zuordnung = lade(ZKEY, {});       // normalisierter Eingriffstext -> Kategorien
let meta = lade(MKEY, {});            // Felder für die Quartalsmeldung
const sichern = () => speichere(KEY, narkosen);

// ---------- Hilfen ----------
const $ = (s) => document.querySelector(s);
const el = (tag, attrs = {}, ...kinder) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') e.className = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (v === true) e.setAttribute(k, '');
    else if (v !== false && v != null) e.setAttribute(k, v);
  }
  for (const k of kinder.flat()) if (k != null) e.append(k.nodeType ? k : document.createTextNode(String(k)));
  return e;
};
const heute = () => new Date().toISOString().slice(0, 10);
const neueId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const monat = (datum) => datum.slice(0, 7);
const quartal = (datum) => `${datum.slice(0, 4)}-Q${Math.floor((Number(datum.slice(5, 7)) - 1) / 3) + 1}`;
const MONATE = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
const monatName = (ym) => `${MONATE[Number(ym.slice(5, 7)) - 1]} ${ym.slice(0, 4)}`;
const kategorienLabel = (ks) => ks.length ? ks.map(k => KAT_LABEL[k]).join(', ') : 'ohne Kategorie';
const ist = (n, arr) => (n.verfahren || []).some(v => arr.includes(v));
// First Pass Success: Standard ist „erfolgreich“. Nur ein ausdrücklicher Fehlversuch (fps === false) zählt dagegen.
const intubiert = (n) => ist(n, INTUBATION);
const fpsErfolg = (n) => intubiert(n) && n.fps !== false;
function fpsStatistik(liste) {
  const intub = liste.filter(intubiert).length;
  const erfolg = liste.filter(fpsErfolg).length;
  return { intub, erfolg, prozent: intub ? Math.round((erfolg / intub) * 100) : null };
}
const fpsText = (st) => st.prozent === null ? 'keine Intubationen' : `${st.prozent} % (${st.erfolg} von ${st.intub} Intubationen)`;

// Ein gespeicherter Eintrag kann einer Auswertung nur zugeordnet werden, wenn er gültig ist.
function setzeStatus(text, art = 'info') {
  const s = $('#status');
  s.textContent = text;
  s.className = 'status ' + art;
  if (text) setTimeout(() => { if (s.textContent === text) s.textContent = ''; }, 4000);
}

// ---------- Navigation ----------
function zeige(name) {
  for (const sec of document.querySelectorAll('main > section')) sec.hidden = sec.id !== name;
  for (const b of document.querySelectorAll('nav button')) b.setAttribute('aria-current', b.dataset.ziel === name ? 'page' : 'false');
  if (name === 'liste') renderListe();
  if (name === 'auswertung') renderAuswertung();
  if (name === 'sicherung') renderSicherung();
}
document.querySelectorAll('nav button').forEach(b => b.addEventListener('click', () => zeige(b.dataset.ziel)));

// ---------- Erfassen / Vorschau ----------
let entwuerfe = [];        // Vorschau-Zeilen (noch nicht gespeichert)
let bearbeiteteId = null;  // gesetzt, wenn ein bestehender Eintrag bearbeitet wird

function neuerEntwurf(p) {
  const k = klassifiziere(p.eingriff, zuordnung);
  const verfahren = [...new Set((p.verfahren || []).map(v => typeof v === 'string' ? v : v.name))];
  return {
    id: p.id || neueId(),
    datum: p.datum || heute(),
    eingriff: p.eingriff || '',
    kategorien: [...(p.kategorien || k.kategorien)],
    unklar: k.unsicher && !!p.eingriff,
    kategorienVorschlag: [...k.kategorien],
    kind: !!p.kind,
    ambulant: !!p.ambulant,
    verfahren,
    fps: verfahren.some(v => INTUBATION.includes(v)) ? p.fps !== false : null,
    original: p.original || p.eingriff || '',
    hinweise: p.hinweise || [],
  };
}

$('#vorschau-btn').addEventListener('click', () => {
  const text = $('#diktat').value.trim();
  if (!text) { setzeStatus('Bitte zuerst diktieren oder Text eingeben.', 'warn'); return; }
  const datum = $('#datum').value || heute();
  const { narkosen: neu, hinweise } = parseDiktat(text, datum, zuordnung);
  if (!neu.length) { setzeStatus('Keine Narkose erkannt.', 'warn'); return; }
  entwuerfe = neu.map(n => neuerEntwurf({ ...n, hinweise: n.hinweise }));
  bearbeiteteId = null;
  entwuerfe.forEach((d, i) => { if (hinweise.length && i === 0) d.hinweise.push(...hinweise); });
  zeigeVorschau();
});

function zeigeVorschau() {
  const box = $('#vorschau-liste');
  box.replaceChildren();
  entwuerfe.forEach((d, i) => box.append(karte(d, i)));
  $('#vorschau').hidden = false;
  $('#vorschau-titel').textContent = bearbeiteteId ? 'Eintrag bearbeiten' : `Vorschau: ${entwuerfe.length} Narkose(n)`;
  $('#vorschau').scrollIntoView({ behavior: 'smooth' });
}

function karte(d, i) {
  const feld = (label, input) => el('label', { class: 'feld' }, el('span', {}, label), input);
  const katBoxen = el('fieldset', { class: 'kats' }, el('legend', {}, 'Kategorien'),
    KATEGORIEN.map(k => el('label', { class: 'chip' },
      el('input', { type: 'checkbox', checked: d.kategorien.includes(k) || null,
        onchange: (e) => { d.kategorien = e.target.checked ? [...d.kategorien, k] : d.kategorien.filter(x => x !== k); } }),
      KAT_LABEL[k])));
  const verfBoxen = el('fieldset', { class: 'kats' }, el('legend', {}, 'Verfahren'),
    Object.keys(VERF_LABEL).map(v => el('label', { class: 'chip' },
      el('input', { type: 'checkbox', checked: d.verfahren.includes(v) || null,
        onchange: (e) => { d.verfahren = e.target.checked ? [...d.verfahren, v] : d.verfahren.filter(x => x !== v); } }),
      VERF_LABEL[v])));
  const eingriff = el('input', { type: 'text', value: d.eingriff, oninput: (e) => { d.eingriff = e.target.value; } });
  const fpsBox = intubiert(d) ? el('label', { class: 'chip' },
    el('input', { type: 'checkbox', checked: d.fps !== false || null, onchange: (e) => { d.fps = e.target.checked; } }),
    'First Pass Success') : null;
  const datum = el('input', { type: 'date', value: d.datum, onchange: (e) => { d.datum = e.target.value; } });
  return el('article', { class: 'karte' + (d.unklar ? ' unklar' : '') },
    el('header', {}, el('strong', {}, `Narkose ${i + 1}`),
      d.unklar ? el('span', { class: 'badge' }, 'Eingriff unklar') : null),
    feld('Eingriff', eingriff),
    feld('Datum', datum),
    katBoxen, verfBoxen,
    el('div', { class: 'checks' },
      el('label', { class: 'chip' }, el('input', { type: 'checkbox', checked: d.kind || null, onchange: (e) => { d.kind = e.target.checked; } }), 'Kind (≤ 5 J.)'),
      el('label', { class: 'chip' }, el('input', { type: 'checkbox', checked: d.ambulant || null, onchange: (e) => { d.ambulant = e.target.checked; } }), 'Ambulant'),
      fpsBox),
    d.hinweise.length ? el('p', { class: 'hinweis' }, d.hinweise.join(' · ')) : null,
    el('p', { class: 'original' }, `Diktat: „${d.original}“`),
    el('button', { class: 'gefahr klein', type: 'button', onclick: () => { entwuerfe.splice(i, 1); zeigeVorschau(); } }, 'Entfernen'));
}

$('#vorschau-abbrechen').addEventListener('click', () => {
  if (entwuerfe.length && !confirm('Vorschau verwerfen? Die Zeilen werden nicht gespeichert.')) return;
  entwuerfe = []; bearbeiteteId = null; $('#vorschau').hidden = true;
});

$('#vorschau-speichern').addEventListener('click', () => {
  if (!entwuerfe.length) return;
  const fehlt = entwuerfe.filter(d => !d.datum);
  if (fehlt.length) { setzeStatus('Bitte bei jeder Zeile ein Datum angeben.', 'warn'); return; }
  let gemerkt = 0;
  const neu = entwuerfe.map(d => {
    const key = normalisiere(d.eingriff);
    // Zuordnung merken, wenn etwas geändert oder unklar war
    if (key && (d.unklar || JSON.stringify([...d.kategorien].sort()) !== JSON.stringify([...d.kategorienVorschlag].sort()))) {
      zuordnung[key] = [...d.kategorien].sort(); gemerkt++;
    }
    return { id: d.id, datum: d.datum, eingriff: d.eingriff, kategorien: [...d.kategorien].sort(), kind: d.kind,
      ambulant: d.ambulant, verfahren: [...d.verfahren], fps: intubiert(d) ? d.fps !== false : null,
      original: d.original, erfasst: new Date().toISOString() };
  });
  if (bearbeiteteId) narkosen = narkosen.filter(n => n.id !== bearbeiteteId);
  const ids = new Set(neu.map(n => n.id));
  narkosen = narkosen.filter(n => !ids.has(n.id)).concat(neu);
  if (!sichern()) return;
  speichere(ZKEY, zuordnung);
  setzeStatus(`${neu.length} Narkose(n) gespeichert${gemerkt ? `, ${gemerkt} Zuordnung(en) gemerkt` : ''}.`, 'ok');
  entwuerfe = []; bearbeiteteId = null; $('#vorschau').hidden = true;
  $('#diktat').value = '';
});

// ---------- Liste ----------
function renderListe() {
  const box = $('#liste-inhalt');
  box.replaceChildren();
  $('#liste-anzahl').textContent = `${narkosen.length} Narkose(n) gespeichert · FPS gesamt: ${fpsText(fpsStatistik(narkosen))}`;
  if (!narkosen.length) { box.append(el('p', {}, 'Noch keine Narkosen erfasst.')); return; }
  const sortiert = [...narkosen].sort((a, b) => b.datum.localeCompare(a.datum));
  let aktuelleMonat = null;
  for (const n of sortiert) {
    if (monat(n.datum) !== aktuelleMonat) {
      aktuelleMonat = monat(n.datum);
      box.append(el('h3', {}, monatName(aktuelleMonat)));
    }
    const flags = [n.kind ? 'Kind' : null, n.ambulant ? 'ambulant' : null].filter(Boolean).join(', ');
    box.append(el('article', { class: 'karte zeile-liste' },
      el('div', {},
        el('strong', {}, n.datum.split('-').reverse().join('.')), ' · ',
        el('span', {}, n.eingriff || '(kein Eingriff)')),
      el('div', { class: 'klein' }, kategorienLabel(n.kategorien),
        n.verfahren.length ? ' · ' + n.verfahren.map(v => VERF_LABEL[v] || v).join(', ') : '',
        flags ? ' · ' + flags : '', intubiert(n) && !fpsErfolg(n) ? ' · FPS negativ' : ''),
      el('div', { class: 'aktionen' },
        el('button', { class: 'klein', type: 'button', onclick: () => bearbeiten(n.id) }, 'Bearbeiten'),
        el('button', { class: 'gefahr klein', type: 'button', onclick: () => loeschen(n.id) }, 'Löschen'))));
  }
}

function bearbeiten(id) {
  const n = narkosen.find(x => x.id === id);
  if (!n) return;
  bearbeiteteId = id;
  entwuerfe = [neuerEntwurf({ ...n, original: n.original })];
  entwuerfe[0].unklar = false;
  zeige('erfassen');
  zeigeVorschau();
}

function loeschen(id) {
  if (!confirm('Diese Narkose wirklich löschen?')) return;
  narkosen = narkosen.filter(n => n.id !== id);
  sichern();
  renderListe();
}

// ---------- Auswertung ----------
function gefiltert(filter) { return narkosen.filter(filter); }

function monatsText(ym) {
  const liste = gefiltert(n => monat(n.datum) === ym);
  if (!liste.length) return 'Keine Narkosen in diesem Monat.';
  const teile = [];
  const zaehl = (fn) => liste.filter(fn).length;
  const intub = zaehl(n => ist(n, INTUBATION));
  if (intub) teile.push(`${intub}× Intubation`);
  for (const v of ['LAMA', 'Analgosedierung', 'TIVA', 'Rotem']) { const c = zaehl(n => ist(n, [v])); if (c) teile.push(`${c}× ${VERF_LABEL[v]}`); }
  for (const k of KATEGORIEN) { const c = zaehl(n => n.kategorien.includes(k)); if (c) teile.push(`${c}× ${KAT_LABEL[k]}`); }
  const kinder = zaehl(n => n.kind); if (kinder) teile.push(`${kinder}× Kind`);
  return `${monatName(ym)}: ${liste.length} Narkosen. ${teile.join(', ')}. First Pass Success: ${fpsText(fpsStatistik(liste))}.`;
}

function diagramm(jahr) {
  const farben = { abdomen: '--c1', kopf_hals: '--c2', thorax: '--c3', intrakraniell: '--c4', rest: '--c5' };
  const daten = [];
  for (let m = 1; m <= 12; m++) {
    const ym = `${jahr}-${String(m).padStart(2, '0')}`;
    const liste = gefiltert(n => monat(n.datum) === ym);
    const seg = { abdomen: 0, kopf_hals: 0, thorax: 0, intrakraniell: 0, rest: 0 };
    for (const n of liste) {
      if (n.kategorien.includes('abdomen')) seg.abdomen++;
      else if (n.kategorien.includes('kopf_hals')) seg.kopf_hals++;
      else if (n.kategorien.includes('thorax')) seg.thorax++;
      else if (n.kategorien.includes('intrakraniell')) seg.intrakraniell++;
      else seg.rest++;
    }
    daten.push({ m, seg, summe: liste.length });
  }
  const max = Math.max(1, ...daten.map(d => d.summe));
  const W = 360, H = 180, pad = 24, bw = (W - pad * 2) / 12 - 6;
  const skala = (H - pad - 16) / max;
  let svg = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Narkosen pro Monat ${jahr}" class="diagramm">`;
  for (const d of daten) {
    let y = H - pad;
    const x = pad + (d.m - 1) * ((W - pad * 2) / 12) + 3;
    for (const k of Object.keys(d.seg)) {
      const h = d.seg[k] * skala;
      if (h > 0) svg += `<rect x="${x.toFixed(1)}" y="${(y - h).toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}" fill="var(${farben[k]})"><title>${MONATE[d.m - 1]}: ${d.seg[k]} ${k}</title></rect>`;
      y -= h;
    }
    svg += `<text x="${(x + bw / 2).toFixed(1)}" y="${H - 6}" text-anchor="middle" class="achse">${MONATE[d.m - 1].slice(0, 3)}</text>`;
    if (d.summe) svg += `<text x="${(x + bw / 2).toFixed(1)}" y="${(y - 3).toFixed(1)}" text-anchor="middle" class="wert">${d.summe}</text>`;
  }
  svg += `</svg>`;
  const legende = [['abdomen', 'Abdomen'], ['kopf_hals', 'Kopf/Hals'], ['thorax', 'Thorax'], ['intrakraniell', 'Intrakraniell'], ['rest', 'Sonstige/ohne']]
    .map(([k, l], i) => `<span class="leg"><i style="background:var(${farben[k]})"></i>${l}</span>`).join('');
  return svg + `<div class="legende">${legende}</div>`;
}

function quartalsZahlen(q) {
  const liste = gefiltert(n => quartal(n.datum) === q);
  const z = (fn) => liste.filter(fn).length;
  return [
    ['Gesamtzahl Narkosen', liste.length],
    ['Geburtshilfe', z(n => n.kategorien.includes('geburtshilfe'))],
    ['Kopf', z(n => n.kategorien.includes('kopf_hals'))],
    ['Thorax', z(n => n.kategorien.includes('thorax'))],
    ['Abdomen', z(n => n.kategorien.includes('abdomen'))],
    ['Kinder', z(n => n.kind)],
    ['PDA/SPA', z(n => ist(n, PDA_SPA))],
    ['Regionalanästhesie', z(n => ist(n, PERIPHER))],
  ];
}

// Zusätzliche Zeilen nur für die Anzeige (nicht Teil der Vorlage).
function quartalsZusatz(q) {
  const liste = gefiltert(n => quartal(n.datum) === q);
  return [
    ['First Pass Success', fpsText(fpsStatistik(liste))],
    ['TIVA', liste.filter(n => ist(n, ['TIVA'])).length],
    ['Rotem', liste.filter(n => ist(n, ['Rotem'])).length],
  ];
}

function quartalsOptionen() {
  const jahre = narkosen.map(n => Number(n.datum.slice(0, 4)));
  const von = Math.min(...jahre, new Date().getFullYear());
  const bis = Math.max(...jahre, new Date().getFullYear());
  const out = [];
  for (let j = von; j <= bis; j++) for (let q = 1; q <= 4; q++) out.push(`${j}-Q${q}`);
  return out;
}

function renderAuswertung() {
  const monatInput = $('#auswertung-monat');
  if (!monatInput.value) monatInput.value = heute().slice(0, 7);
  $('#monatstext').textContent = monatsText(monatInput.value);

  const jahrInput = $('#diagramm-jahr');
  if (!jahrInput.value) jahrInput.value = heute().slice(0, 4);
  $('#diagramm').innerHTML = diagramm(jahrInput.value);

  const qSel = $('#quartal');
  const alt = qSel.value;
  qSel.replaceChildren(...quartalsOptionen().map(q => el('option', { value: q }, q)));
  qSel.value = alt || `${heute().slice(0, 4)}-Q${Math.floor(new Date().getMonth() / 3) + 1}`;
  renderQuartal();
}

function renderQuartal() {
  const q = $('#quartal').value;
  const tbody = $('#quartal-tabelle');
  tbody.replaceChildren(...[...quartalsZahlen(q), ...quartalsZusatz(q)].map(([l, v]) => el('tr', {}, el('th', {}, l), el('td', {}, String(v)))));
  for (const id of ['name', 'weiterbildungszeit', 'imc', 'stand', 'abschnitt']) $('#q-' + id).value = meta[id] || '';
}

['name', 'weiterbildungszeit', 'imc', 'stand', 'abschnitt'].forEach(id => {
  $('#q-' + id).addEventListener('input', (e) => { meta[id] = e.target.value; speichere(MKEY, meta); });
});
$('#quartal').addEventListener('change', renderQuartal);
$('#auswertung-monat').addEventListener('change', () => { $('#monatstext').textContent = monatsText($('#auswertung-monat').value); });
$('#diagramm-jahr').addEventListener('change', () => { $('#diagramm').innerHTML = diagramm($('#diagramm-jahr').value); });

$('#quartal-kopieren').addEventListener('click', async () => {
  const q = $('#quartal').value;
  const z = quartalsZahlen(q).map(([, v]) => v);
  const zeile = [meta.name || '', meta.weiterbildungszeit || '', meta.imc || '', ...z, meta.stand || '', meta.abschnitt || ''];
  const text = zeile.join('\t');
  try { await navigator.clipboard.writeText(text); setzeStatus('Quartalszeile kopiert. In Excel einfügen.', 'ok'); }
  catch (e) { prompt('Zeile zum Kopieren:', text); }
});

// ---------- Excel-Export ----------
function herunterladen(bytes, dateiname) {
  const blob = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = el('a', { href: url, download: dateiname });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

$('#xlsx-btn').addEventListener('click', () => {
  if (!narkosen.length) { setzeStatus('Noch keine Narkosen zum Exportieren.', 'warn'); return; }
  herunterladen(narkosezahlenXlsx(narkosen), `Narkosezahlen-${heute()}.xlsx`);
  setzeStatus(`Excel-Datei mit ${narkosen.length} Narkosen erstellt.`, 'ok');
});

$('#quartal-xlsx').addEventListener('click', () => {
  const q = $('#quartal').value;
  const zahlen = quartalsZahlen(q);
  herunterladen(quartalsvorlageXlsx(meta, zahlen), `Weiterbildungszahlen-${q}.xlsx`);
  setzeStatus(`Quartalsvorlage ${q} als Excel erstellt.`, 'ok');
});

// ---------- Sicherung ----------
function renderSicherung() {
  $('#sicherung-anzahl').textContent = `${narkosen.length} Narkose(n) auf diesem Gerät`;
}

$('#export-btn').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify({ version: 1, exportiert: new Date().toISOString(), narkosen }, null, 1)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = el('a', { href: url, download: `narkose-sicherung-${heute()}.json` });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});

$('#import-datei').addEventListener('change', async (e) => {
  const datei = e.target.files[0];
  if (!datei) return;
  try {
    const roh = JSON.parse(await datei.text());
    const liste = Array.isArray(roh) ? roh : roh.narkosen;
    if (!Array.isArray(liste)) throw new Error('Kein Narkose-Datensatz');
    let neu = 0, ersetzt = 0;
    for (const r of liste) {
      if (!r.datum) continue;
      const alt = narkosen.findIndex(n => n.id === r.id);
      if (alt >= 0) { narkosen.splice(alt, 1); ersetzt++; }
      const kategorien = r.kategorien || klassifiziere(r.eingriff || '', zuordnung).kategorien;
      const intub = (r.verfahren || []).some(v => INTUBATION.includes(v));
      narkosen.push({ id: r.id || neueId(), datum: r.datum, eingriff: r.eingriff || '', kategorien: [...kategorien].sort(),
        kind: !!r.kind, ambulant: !!r.ambulant, verfahren: r.verfahren || [], fps: intub ? r.fps !== false : null,
        original: r.original || r.eingriff || '',
        erfasst: r.erfasst || new Date().toISOString(), asa: r.asa, geschlecht: r.geschlecht });
      neu++;
    }
    sichern();
    setzeStatus(`${neu} Narkose(n) neu importiert, ${ersetzt} vorhandene aktualisiert.`, 'ok');
    renderSicherung();
  } catch (err) {
    setzeStatus('Import fehlgeschlagen: ' + err.message, 'warn');
  }
  e.target.value = '';
});

// ---------- Start ----------
if (!$('#datum').value) $('#datum').value = heute();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
zeige('erfassen');
