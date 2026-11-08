// Narkose-Tool: Einzelzuordnungen (gewinnen immer gegen die Schlüsselwörter).
// Schlüssel = Eingriffstext (Groß-/Kleinschreibung und Umlaute egal).
// Werte = Kategorien aus katalog-regeln.js; [] = bekannt, aber keinem Fachbereich zugeordnet.
// Neue Einträge einfach ergänzen, z. B.:  'lap galle nachresektion': ['abdomen'],

export const ZUORDNUNG = {
  'sas': ['abdomen'],             // Stoß auf Stoß Repair (Hernien-OP)
  'pump': ['abdomen'],            // Hernien-OP
  'schockraum': [],               // keinem Fachbereich zugeordnet
  'us revision': ['sonstige'],    // Unterschenkel-Revision
  'prif collum': ['kopf_hals'],   // MKG (Unterkiefer)
  'nch': ['sonstige'],            // Neurochirurgie (Abkürzung, Zuordnung ggf. prüfen)
  'mke': ['thorax'],              // Mitralklappenersatz (Herz)
  '2x8er': ['kopf_hals'],         // Weisheitszähne (2 Stück, Diktat-Mengen später im Parser)
  '4x8er': ['kopf_hals'],         // Weisheitszähne (4 Stück)
  'uch': ['sonstige'],            // Unfallchirurgie
  'accc bending': ['sonstige'],   // Schulter-OP (Unfallchirurgie)
  'entfernung krallenplattcjen d5': ['sonstige'], // Finger 5 (Digitus 5), Krallenplättchen
  'd2 verletzung': ['sonstige'],  // Zeigefinger (Digitus 2)
  'spa analgo ausgeleitet': [],   // kein Eingriff, nur Verfahren (SPA + Analgosedierung)
};
