// Narkose-Tool: Diktatparser. Zerlegt einen Diktattext in einzelne Narkosen.
// Läuft offline im Browser, ohne KI. Nutzt den Eingriffskatalog (katalog.js).
import { klassifiziere, istKeineNarkose, normalisiere } from './katalog.js';

// Trennwörter zwischen zwei Narkosen (Komma, Semikolon, Satzende, „dann“, „und“ …).
const TRENNER = /\s*(?:;|,|\.(?=\s|$)|\bund danach\b|\bdanach\b|\bdann\b|\banschliessend\b|\bausserdem\b|\bnaechste(?:r|s)?\b|\bnoch (?:eine|einen|ein)\b|\bund\b)\s*/i;

// ASA-Klasse, z. B. „ASA 3“ oder „ASA drei“.
const ASA_RE = /\basa\s*(?:klasse\s*)?([1-5]|eins|zwei|drei|vier|fuenf)\b/i;
const ASA_WORT = { eins: 1, zwei: 2, drei: 3, vier: 4, fuenf: 5 };

// Mengen am Satzanfang: „zweimal Lap Chole“, „2x Appendektomie“, „drei Hernien“
const MENGEN_WORT = { einmal: 1, eine: 1, ein: 1, zweimal: 2, zwei: 2, dreimal: 3, drei: 3,
  viermal: 4, vier: 4, fuenfmal: 5, fuenf: 5, sechsmal: 6, sechs: 6 };
const MENGE_RE = /^\s*(?:(\d+)\s?x\s(?=\D)|(\d+)\s*-?mal\s|(einmal|eine?|ein|zweimal|zwei|dreimal|drei|viermal|vier|fuenfmal|fuenf|sechsmal|sechs)\s)/i;

// Verfahren (Narkose- und Zugangsmethoden). Reihenfolge wichtig: spezifischere zuerst.
const VERFAHREN = [
  ['Reanimation', /\breanimation\w*|\breani\b/i],
  ['TIVA', /\btiva\b/i],
  ['Rotem', /\brotem\b/i],
  ['ZVK+Art', /\bzvk\b.*\barteri\w*|\barteri\w*.*\bzvk\b|\bzvk art\b/i],
  ['ZVK', /\bzvk\b/i],
  ['Art', /\bart\b|\barteri\w*|\barterie\b/i],
  ['vITN', /\bvitn\b|video\s*-?\s*itn|videoitn|video.?intub/i],
  ['kITN', /\bkitn\b|konv\w*\.?\s*itn/i],
  ['nITN', /\bnitn\b|nasal\w*\s*itn/i],
  ['LAMA', /\blama\b/i],
  ['Fieberoptik', /fieberoptik/i],
  ['Analgosedierung', /analgo\w*/i],
  ['PDK', /\bpdk\b|periduralkath\w*|\bpda\b/i],
  ['SPA', /\bspa\b|spinalan[aä]s\w*/i],
  ['ISB', /\bisb\b/i],
  ['Supraklavikulaer', /supra ?-?klavik\w*|sup ?-?clav\w*|supraclav\w*/i],
  ['Infraklavikulaer', /infra ?-?klavik\w*|infraclav\w*/i],
  ['Axillaer', /axill\w*|axplex/i],
  ['Femoral', /femoral\w*/i],
  ['Ischiadikus', /\bisch\w*\b/i],
  ['Anderer Block', /\bperiph\w* block\w*|\bplexus\w*|\bblock\b/i],
];

// First Pass Success ist Standard. Nur ein Fehlversuch wird ausdrücklich diktiert.
const FPS_NEG = /\bfps (nicht|negativ|fehl\w*)|\bkein\w* first pass|\bnicht (beim )?(ersten|erst\w*) (versuch|anlauf)|\bzweit\w* (versuch|anlauf|intubation)|\bfirst pass (nicht|fehl\w*)/i;
const INTUBATIONS_VERFAHREN = ['vITN', 'kITN', 'nITN'];

// Wörter, die nur Merkmale sind und nicht zum Eingriffstext gehören.
const MERKMAL_RE = /\b(kind|kinder|saeugling|baby|ambulant|selbst|ich)\b|\b\d{1,2}\s*(jahre?|jahr|jaehrig|j)\b/gi;

// Alter (in Jahren) aus dem Segment, falls genannt.
function alter(segment) {
  const m = segment.match(/\b(\d{1,2})\s*(?:jahre?|jahr|jaehrig|j)\b/i);
  return m ? Number(m[1]) : null;
}

// Zerlegt Diktat in Segmente mit Menge.
function zerlegeSegment(seg) {
  let s = seg.trim();
  let menge = 1;
  const m = s.match(MENGE_RE);
  if (m) {
    if (m[1]) menge = Number(m[1]);
    else if (m[2]) menge = Number(m[2]);
    else menge = MENGEN_WORT[m[3].toLowerCase().replace(/ü/g, 'ue')] || 1;
    s = s.slice(m[0].length).trim();
  }
  return { text: s, menge };
}

// Hauptfunktion. Gibt { narkosen: [...], hinweise: [...] } zurück.
// Jede Narkose hat: datum, eingriff, kategorien, unsicher, kind, ambulant, verfahren, original, hinweise.
// Ein Segment ohne Eingriffstext (nur Verfahren oder Merkmale, z. B. „, LAMA, selbst“) wird der vorherigen Narkose zugeschlagen.
export function parseDiktat(diktat, datum = null, benutzerZuordnung = {}) {
  const gruppen = [];   // jede Gruppe = eine Narkose (ggf. mit Menge)
  const hinweise = [];
  const segmente = String(diktat || '').split(TRENNER).map(s => s.trim()).filter(Boolean);

  for (const seg of segmente) {
    // „Anmerkung …“ gehört zur vorherigen Narkose und wird nicht als Eingriff gewertet.
    const anm = seg.match(/^anmerkung\s*[:\-]?\s*(.*)$/i);
    if (anm) {
      const ziel = gruppen[gruppen.length - 1];
      if (ziel) ziel.notiz = [ziel.notiz, anm[1]].filter(Boolean).join(' ');
      continue;
    }
    if (istKeineNarkose(seg)) {
      hinweise.push(`„${seg}“ übersprungen (keine Narkose)`);
      continue;
    }
    const { text, menge } = zerlegeSegment(seg);
    const verfahren = [];
    const fpsNegativ = FPS_NEG.test(text);
    const asaMatch = text.match(ASA_RE);
    const asa = asaMatch ? (ASA_WORT[asaMatch[1].toLowerCase()] || Number(asaMatch[1])) : null;
    let rest = text.replace(ASA_RE, ' ').replace(new RegExp(FPS_NEG.source, 'gi'), ' ').replace(/\b(fps|first pass success|first pass)\b/gi, ' ');
    for (const [name, re] of VERFAHREN) {
      if (re.test(rest)) {
        verfahren.push({ name });
        rest = rest.replace(new RegExp(re.source, re.flags.includes('i') ? 'gi' : 'g'), ' ');
      }
    }
    const kind = /\b(kind|kinder|saeugling|baby)\b/i.test(text) || (alter(text) !== null && alter(text) <= 5);
    const ambulant = /\bambulant\b/i.test(text);
    const eingriffText = rest.replace(MERKMAL_RE, ' ').replace(/\b(mit|in|per|bei|unter|ausgeleitet|durchgefuehrt)\b/gi, ' ')
      .replace(/\s+/g, ' ').replace(/^[\s,:.\-+]+|[\s,:.\-+]+$/g, '');

    const letzte = gruppen[gruppen.length - 1];
    if (!eingriffText && letzte && menge === 1) {
      // Nur Merkmale/Verfahren: gehört zur vorherigen Narkose.
      letzte.verfahren.push(...verfahren);
      letzte.kind = letzte.kind || kind;
      letzte.ambulant = letzte.ambulant || ambulant;
      letzte.fpsNegativ = letzte.fpsNegativ || fpsNegativ;
      letzte.asa = letzte.asa ?? asa;
      letzte.segmente.push(seg);
      continue;
    }
    gruppen.push({ eingriff: eingriffText, menge, verfahren, kind, ambulant, fpsNegativ, asa, notiz: '', segmente: [seg] });
  }

  const narkosen = [];
  for (const g of gruppen) {
    const k = klassifiziere(g.eingriff, benutzerZuordnung);
    const zeileHinweise = [];
    if (!g.eingriff && g.verfahren.length === 0) zeileHinweise.push('Kein Eingriff erkannt');
    if (k.unsicher && g.eingriff) zeileHinweise.push('Eingriff unklar, bitte zuordnen');
    if (g.menge > 1) zeileHinweise.push(`Menge ${g.menge}`);
    for (let i = 0; i < g.menge; i++) {
      narkosen.push({
        datum,
        eingriff: g.eingriff,
        kategorien: k.kategorien,
        unsicher: k.unsicher && !!g.eingriff,
        kind: g.kind,
        asa: g.asa,
        notiz: g.notiz,
        ambulant: g.ambulant,
        verfahren: g.verfahren.map(v => ({ ...v })),
        fps: g.verfahren.some(v => INTUBATIONS_VERFAHREN.includes(v.name)) ? !g.fpsNegativ : null,
        original: g.segmente.join(', '),
        hinweise: zeileHinweise.slice(),
      });
    }
  }
  return { narkosen, hinweise };
}

export { normalisiere };
