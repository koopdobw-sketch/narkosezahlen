// Narkose-Tool: Zuordnung der gespeicherten Narkosen auf die Spalten der Excel-Tabelle „Narkosezahlen“
// und auf die Quartalsvorlage „Vorlage Weiterbildungszahlen“.
import { erstelleXlsx } from './xlsx.js';

export const SPALTEN_NARKOSEZAHLEN = ['Datum', 'ASA', 'Geschlecht', 'Eingriffsart', 'Atemweg', 'FPS', 'TIVA',
  'Kopf/Hals', 'Thorax', 'Intrakraniel', 'Abdomen', 'Punktion', 'Reginoalverfahren', 'Ambulant', 'Rotem',
  'Kinder', 'Geburtshilfe', 'Reanimation'];

const ATEMWEG = { vITN: 'vITN', kITN: 'kITN', nITN: 'nITN', LAMA: 'LAMA', Fieberoptik: 'Fieberoptik', Analgosedierung: 'Analgo.' };
const PUNKTION = { Art: 'Art', ZVK: 'ZVK', 'ZVK+Art': 'ZVK Art' };
const REGIONAL = { SPA: 'SPA', PDK: 'PDK', ISB: 'ISB', Supraklavikulaer: 'Sup-Clav', Infraklavikulaer: 'Infra-Clav',
  Axillaer: 'Axplex', Femoral: 'Femoral', Ischiadikus: 'Isch', 'Anderer Block': 'Anderer' };

const eins = (b) => (b ? 1 : '');
const intubiert = (n) => (n.verfahren || []).some(v => ['vITN', 'kITN', 'nITN'].includes(v));
const zahlOderText = (s) => (/^\d+$/.test(String(s || '').trim()) ? Number(s) : (s || ''));

// Eine gespeicherte Narkose -> Zeile für „Narkosezahlen“.
export function narkoseZeile(n) {
  const verf = n.verfahren || [];
  const kat = n.kategorien || [];
  const abbildung = (map) => verf.filter(v => map[v] !== undefined).map(v => map[v]).join(', ');
  return [
    { d: n.datum },
    zahlOderText(n.asa),
    n.geschlecht || '',
    n.eingriff || '',
    abbildung(ATEMWEG),
    intubiert(n) ? (n.fps === false ? 0 : 1) : '',      // FPS: 1 = erfolgreich (Standard), 0 = Fehlversuch
    eins((n.verfahren || []).includes('TIVA')),
    eins(kat.includes('kopf_hals')),
    eins(kat.includes('thorax')),
    eins(kat.includes('intrakraniell')),
    eins(kat.includes('abdomen')),
    abbildung(PUNKTION),
    abbildung(REGIONAL),
    eins(n.ambulant),
    eins((n.verfahren || []).includes('Rotem')),
    eins(n.kind),
    eins(kat.includes('geburtshilfe')),
    eins(kat.includes('reanimation') || verf.includes('Reanimation')),
  ];
}

// Datei „Narkosezahlen“: Kopfzeile + eine Zeile pro Narkose, nach Datum sortiert.
export function narkosezahlenXlsx(narkosen) {
  const sortiert = [...narkosen].sort((a, b) => a.datum.localeCompare(b.datum));
  return erstelleXlsx([SPALTEN_NARKOSEZAHLEN, ...sortiert.map(narkoseZeile)],
    { blattname: 'Narkosezahlen', spaltenbreiten: [12, 6, 10, 40, 12, 6, 6, 9, 8, 11, 9, 10, 18, 10, 8, 8, 12, 11] });
}

export const SPALTEN_VORLAGE = ['Name, Vorname', 'Weiterbildungszeit in vollen Monaten', 'davon auf IMC/ITS',
  'Gesamtzahl Narkosen', 'Geburtshilfe', 'Kopf', 'Thorax', 'Abdomen', 'Kinder', 'PDA/SPA', 'Regionalanästhesie',
  'Stand vom', 'WB Abschnitt'];

// Quartalsvorlage: eine Zeile mit den Werten des Quartals und den Angaben von Hand.
export function quartalsvorlageXlsx(meta, zahlen) {
  const werte = zahlen.map(([, v]) => v);            // Reihenfolge wie quartalsZahlen() in app.js
  const zeile = [
    meta.name || '', zahlOderText(meta.weiterbildungszeit), zahlOderText(meta.imc),
    ...werte, meta.stand ? { d: meta.stand } : '', meta.abschnitt || '',
  ];
  return erstelleXlsx([SPALTEN_VORLAGE, zeile], { blattname: 'Tabelle1', spaltenbreiten: [24, 16, 14, 14, 12, 8, 8, 10, 8, 9, 18, 12, 14] });
}
