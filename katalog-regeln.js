// Narkose-Tool: Schlüsselwörter für die Eingriffskategorien.
// HIER Eingriffe ergänzen oder Schlüsselwörter anpassen.
//
// Format: Jeder Eintrag ist ein Text in Anführungszeichen.
//   "appendek"  -> trifft, wenn der Eingriffstext "appendek" irgendwo enthält (Teilwort).
//   "=tep"      -> trifft nur, wenn "tep" als ganzes Wort vorkommt (Vorsatz "=").
// Groß-/Kleinschreibung und Umlaute sind egal (ä = a, ß = ss).
// Ein Eingriff kann mehreren Kategorien zugeordnet sein.
// Für Einzelfälle ist zuordnung.js besser geeignet (dort gewinnt die Zuordnung immer).

export const KATEGORIEN = ['abdomen', 'intrakraniell', 'kopf_hals', 'thorax', 'geburtshilfe', 'reanimation', 'gefaess', 'sonstige'];

// Die ersten sieben werden in der Auswertung gezählt.
// 'sonstige' = bekannter Eingriff ohne eigene Auswertungs-Kategorie (Orthopädie, Urologie, Gynäkologie, Proktologie, Gliedmaßen u. a.).

export const KATEGORIE_REGELN = {
  abdomen: [
    // Appendix, Cholezystektomie
    'appendekt', 'appendik', 'lap che', 'lap chol', 'lap gal', 'lap gall', 'lapche', 'lapgalle',
    'lep che', 'lepche', 'lab galle', 'labgalle', 'cholez', 'cholecyst',
    // Hernien (inkl. Leiste, Lichtenstein, TEPP/eTEP, Endoleiste)
    'hernie', 'leisten', 'lichtenstein', '=tepp', '=etep', 'endoleist',
    // Stoß auf Stoß (SAS) ist eine Hernien-OP
    '=sas', 'stoss auf stoss',
    // Laparotomie / Laparoskopie
    'laparo', '=lsk',
    // Darm, Magen, Leber, Pankreas
    'sigma', 'kolektom', 'kollektom', 'colektom', 'colon', 'kolon', 'rektum', 'rectum', '=magen',
    'fundoplic', 'leber', 'pankreas', 'whipple', 'ileus', 'ileostom', 'dunndarm', 'duenndarm', 'hohlorgan',
    // Sonstige intraabdominelle
    'abdom', 'sekundarverschluss', 'second look', 'third look', 'nierenteil', 'prostatektom',
    'emilos', 'retroperiton', '=pump',
  ],
  intrakraniell: [
    'subdural', '=sdh', 'intrazerebral', 'intracerebral', 'intrakran', 'intracran', 'intracraniel', 'kraniotom',
    '=icb', '=evd', 'ventrikel', 'janetta', 'liquorleck', 'meningeom', 'hirntumor',
    '=stroke', '=m1', 'zerebral', 'cerebral', 'hirn', 'schadel',
  ],
  kopf_hals: [
    // HNO, Nase, Nebenhöhlen, Ohr
    '=hno', '=nnh', 'septum', 'septorhin', 'rhinopl', 'nasen', '=spl', 'sprl', 'conchae',
    'tonsill', 'adenotom', 'tympano', 'pauken', 'gehorgang', 'antihelix', '=mls', 'laryng',
    // Zähne, Kiefer, MKG, Jochbein, Orbita
    'zahn', 'zhan', 'dental', '=mkg', 'kiefer', 'maxill', 'mandibul', 'jochbei', 'orbit', 'orbut',
    // Hals, Halswirbelsäule, Schilddrüse, Speicheldrüse, Zunge, Gaumen
    'neck dissection', 'hals', 'zervikal', 'cervikal', '=hws', '=hwk',
    'thyr', 'thery', 'thyreo', 'schilddr', 'nebenschild', 'parotis', 'zunge', 'gaumen', 'uveolo', 'palatin',
    // Augen
    'auge', 'aufen', 'phako', '=ppv', 'pars plana', 'hinterkammer', '=hkl', 'strabism', 'pterygium',
    'glaukom', 'miniject', 'panendoskop', '=te',
  ],
  thorax: [
    'thorax', 'thorak', '=vats', 'lobektom', 'lunge', 'pleura', 'pneumon', 'dissektion',
    // Herz-OPs gelten als intrathorakal (Entscheidung der Nutzerin/des Nutzers)
    'herz', '=cabg', '=ake', '=tavi', '=mkr', 'koronar', 'aortenklapp',
  ],
  gefaess: [
    'carotis', 'fem pop', 'fempop', '=pop', 'varize', 'venefit', 'venos', 'bypass', 'crossover',
    'thrombendarter', 'aneurysma', 'stent', 'gefa',
  ],
  geburtshilfe: ['=sectio', 'kaiserschn', 'geburt', 'plazent', 'placent'],
  reanimation: ['reanim', '=reani'],
  sonstige: [
    // Gliedmaßen, Wirbelsäule, Orthopädie
    'knie', 'huft', 'schulter', 'ellenbogen', 'ellbogen', '=hand', 'finger', 'fuss', 'hallux', 'zehen',
    'sehne', 'bandscheib', 'wirbel', 'spinal', 'dorsal', 'instrument', '=bsv', '=lws', '=bws', '=lwk', '=bwk',
    '=plif', '=tlif', '=prif', '=me', 'osteosynth', 'fraktur', 'frakt', '=tep', 'arthro', '=ask', 'vac', 'wund',
    '=pfn', 'pfna', '=dhs', '=osg', '=mfk', '=mhk', '=mt5', '=fix', 'coxa', '=isg', 'unterschenkel',
    'tiviakopf', 'tibiakopf', 'tibia', 'femur', 'humerus', 'radius', 'clavikula', 'calcane', 'becken', 'glenoid',
    'karpal', 'carpal', 'kahnbein', 'achilles', 'ulna', 'amputation', 'replant', 'kompartment', 'meniskus',
    'knorpel', '=vkb', '=acl', 'kapsel', 'schwannom', 'enchondrom', 'ablatio', 'schmerzkatheter',
    // Urologie
    'hydrocel', 'hoden', 'prostat', '=tur', '=dj', '=pcnl', 'nephro', 'nierenfist', '=n1', '=n3', 'zystocele',
    // Proktologie, Dermatologie, Gyn/Brust, Sonstiges
    'perianal', 'perineal', '=anal', 'analfissur', 'hamorhoid', 'hamorrhoid', 'gangr', 'fistel', 'steissbein',
    'pilonid', 'kondylom', 'abszes', 'abszess', 'prokto', 'loop', 'zyste', 'facett', '=lk',
    'mastekt', 'mamma', 'liposuc', 'lappen', 'haut', 'transplant', 'lymph',
    // Zugänge
    '=port', 'portexpl', 'portanl', 'katheter', 'zvk',
  ],
};
