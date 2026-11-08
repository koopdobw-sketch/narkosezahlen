// Narkose-Tool: Eingriffskatalog (Engine). Läuft offline im Browser, ohne KI.
// Daten bearbeiten: katalog-regeln.js (Schlüsselwörter) und zuordnung.js (Einzelfälle).
import { KATEGORIEN, KATEGORIE_REGELN } from './katalog-regeln.js';
import { ZUORDNUNG } from './zuordnung.js';

// Vorverarbeitung: klein, ohne Umlaute/Akzente, Satzzeichen zu Leerzeichen.
export function normalisiere(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

// Schlüssel für Zuordnungen normalisieren (einmal beim Laden).
function normalisierteZuordnung(quelle) {
  const out = {};
  for (const [k, v] of Object.entries(quelle)) out[normalisiere(k)] = v;
  return out;
}

// Muster wie "=tep" (ganzes Wort) oder "appendek" (Teilwort).
function trifft(n, muster) {
  if (muster.startsWith('=')) {
    const wort = normalisiere(muster.slice(1));
    return new RegExp('\\b' + wort + '\\b').test(n);
  }
  return n.includes(normalisiere(muster));
}

// Ist ein Eingriffstext ein Ausschluss (Tabellenzeile „keine narkose“)?
export function istKeineNarkose(text) {
  return /\bkeine narkose\b/.test(normalisiere(text));
}

// Ordnet einen Eingriffstext zu.
// Reihenfolge: 1) eigene Zuordnungen des Geräts (benutzerZuordnung), 2) zuordnung.js, 3) Schlüsselwörter.
// Rückgabe: { kategorien: [...], unsicher: bool, quelle: 'benutzer' | 'zuordnung' | 'regel' | null }
//   unsicher = true, wenn nichts passt; die Nutzerin/der Nutzer ordnet dann zu.
export function klassifiziere(text, benutzerZuordnung = {}) {
  const n = normalisiere(text);
  const benutzer = normalisierteZuordnung(benutzerZuordnung);
  const zuord = normalisierteZuordnung(ZUORDNUNG);

  if (n in benutzer) return { kategorien: benutzer[n], unsicher: false, quelle: 'benutzer' };
  if (n in zuord) return { kategorien: zuord[n], unsicher: false, quelle: 'zuordnung' };

  const kategorien = KATEGORIEN.filter(k => (KATEGORIE_REGELN[k] || []).some(m => trifft(n, m)));
  return { kategorien, unsicher: kategorien.length === 0, quelle: kategorien.length ? 'regel' : null };
}

export { KATEGORIEN };
