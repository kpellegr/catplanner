import { reactive, ref, computed } from 'vue';
import * as sync from './sync.js';
import { filterVoorProfiel, filterVoorDaan } from '../lib/parser.js';

// ---- State ----

const DAGEN = ['ma', 'di', 'wo', 'do', 'vr', 'za', 'zo'];

const state = reactive({
  weken: [],
  voortgang: {},
  planning: {},
  lesBlokken: {},
  weekRooster: { ma: {}, di: {}, wo: {}, do: {}, vr: {}, za: {}, zo: {} },
  configuratie: { vakken: {} },
  studiewijzer: [],  // raw parsed sections (ongefilterd, originele import)
  loaded: false,
  // Multi-user
  plannerId: null,
  userRole: null,  // 'eigenaar' | 'editor' | 'viewer'
  studentProfile: null, // { naam, richting, route, wiskunde }
});

let unsubscribe = null;
let savingKeys = new Set(); // prevent echo from realtime

// Global task selection (not persisted, survives view switches)
const selectedTaakId = ref(null);

function selectTaak(id) {
  if (id === null) { selectedTaakId.value = null; return; }
  selectedTaakId.value = selectedTaakId.value === id ? null : id;
}

function deselectTaak() {
  selectedTaakId.value = null;
}

// Global filters (not persisted, survives view switches)
const filters = reactive({
  // Type (show tasks matching at least one active type)
  rooster: true,
  huistaken: true,
  // Status (show tasks matching at least one active status)
  ongepland: true,
  gepland: true,
  klaar: true,
  ingediend: true,
  // Drill-down: show only unplanned tasks
  alleenOngepland: false,
  // Warnings (off = show all, on = drill-down to only matching)
  overdue: false,
  inTeDienen: false,
  conflict: false,
});

// ---- Computed ----

const STATUSSEN = ['open', 'bezig', 'klaar', 'ingediend'];

const isReadOnly = computed(() => state.userRole === 'viewer');
const isEigenaar = computed(() => state.userRole === 'eigenaar');

// Set of inactive vak names (from configuratie)
const inactieveVakken = computed(() => {
  const vakken = state.configuratie?.vakken;
  if (!vakken) return new Set();
  const set = new Set();
  for (const [naam, config] of Object.entries(vakken)) {
    if (config.actief === false) set.add(naam);
  }
  return set;
});

const alleTaken = computed(() => {
  const taken = [];
  const inactief = inactieveVakken.value;
  for (const week of state.weken) {
    for (const section of week.sections) {
      // Skip sections for inactive vakken
      if (inactief.has(section.vak)) continue;
      for (const taak of section.taken) {
        const id = taakId(taak, week.metadata);
        const voortgang = state.voortgang[id] || { status: 'open', minutenGewerkt: 0 };
        if (voortgang.status === 'todo') voortgang.status = 'open';
        const planVal = state.planning[id] || null;
        // Support both old format (string "ma") and new format ({ dag: "ma", blok: 5 })
        const geplandOp = planVal ? (typeof planVal === 'string' ? planVal : planVal.dag) : null;
        const geplandBlok = planVal && typeof planVal === 'object' ? planVal.blok : null;
        taken.push({
          ...taak,
          id,
          week: week.metadata.week,
          periode: week.metadata.periode,
          voortgang,
          geplandOp,
          geplandBlok,
        });
      }
    }
  }
  return taken;
});

const vandaagTaken = computed(() => {
  return alleTaken.value.filter((t) => t.voortgang.status !== 'klaar');
});

function statusMinuten(taken, status) {
  return taken
    .filter((t) => t.voortgang.status === status)
    .reduce((sum, t) => (t.tijd?.type === 'minuten' ? sum + t.tijd.minuten : sum), 0);
}

const stats = computed(() => {
  const taken = alleTaken.value;
  const todo = taken.filter((t) => t.voortgang.status === 'open').length;
  const bezig = taken.filter((t) => t.voortgang.status === 'bezig').length;
  const klaar = taken.filter((t) => t.voortgang.status === 'klaar').length;
  const ingediend = taken.filter((t) => t.voortgang.status === 'ingediend').length;
  const totalMinuten = taken.reduce((sum, t) => {
    if (t.tijd && t.tijd.type === 'minuten') return sum + t.tijd.minuten;
    return sum;
  }, 0);
  const gewerktMinuten = taken.reduce((sum, t) => sum + (t.voortgang.minutenGewerkt || 0), 0);
  return {
    todo, bezig, klaar, ingediend,
    todoMin: statusMinuten(taken, 'open'),
    bezigMin: statusMinuten(taken, 'bezig'),
    klaarMin: statusMinuten(taken, 'klaar'),
    ingediendMin: statusMinuten(taken, 'ingediend'),
    total: taken.length, totalMinuten, gewerktMinuten,
  };
});

// Set of all taak IDs currently in weken (for studiewijzer view comparison)
const wekenTaakIds = computed(() => {
  const set = new Set();
  for (const week of state.weken) {
    for (const section of week.sections) {
      for (const taak of section.taken) {
        set.add(taakId(taak, week.metadata));
      }
    }
  }
  return set;
});

// ---- Init (called with a specific planner) ----

async function init(plannerId = null, role = null) {
  // If no planner specified, try to find one (but don't auto-create)
  if (!plannerId) {
    const info = await sync.findMyPlanner();
    if (!info) return false; // no planner found
    plannerId = info.plannerId;
    role = info.role;
  }

  state.plannerId = plannerId;
  state.userRole = role || 'eigenaar';

  // Load planner info (including student profile)
  try {
    const info = await sync.getPlannerInfo(plannerId);
    state.studentProfile = info?.student_profile || null;
  } catch (e) {
    console.warn('Could not load planner info:', e);
  }

  // Load data
  const data = await sync.loadPlanner(state.plannerId);
  state.weken = data.weken || [];
  state.voortgang = data.voortgang || {};
  state.planning = data.planning || {};
  state.lesBlokken = data.lesBlokken || {};
  state.weekRooster = data.weekRooster || { ma: {}, di: {}, wo: {}, do: {}, vr: {}, za: {}, zo: {} };
  state.configuratie = data.configuratie || { vakken: {} };
  state.studiewijzer = data.studiewijzer || [];
  state.loaded = true;

  // Subscribe to realtime changes
  if (unsubscribe) unsubscribe();
  unsubscribe = sync.subscribeToPlanner(state.plannerId, (key, data) => {
    // Skip echo from own saves
    if (savingKeys.has(key)) return;
    if (key === 'weken') state.weken = data || [];
    else if (key === 'voortgang') state.voortgang = data || {};
    else if (key === 'planning') state.planning = data || {};
    else if (key === 'lesBlokken') state.lesBlokken = data || {};
    else if (key === 'weekRooster') state.weekRooster = data || { ma: {}, di: {}, wo: {}, do: {}, vr: {}, za: {}, zo: {} };
    else if (key === 'configuratie') state.configuratie = data || { vakken: {} };
    else if (key === 'studiewijzer') state.studiewijzer = data || [];
  });

  return true;
}

// ---- Persistence ----

async function save(key) {
  if (!state.plannerId) return;

  const dataMap = {
    weken: state.weken,
    voortgang: state.voortgang,
    planning: state.planning,
    lesBlokken: state.lesBlokken,
    weekRooster: state.weekRooster,
    configuratie: state.configuratie,
    studiewijzer: state.studiewijzer,
  };

  const keysToSave = key ? [key] : Object.keys(dataMap);

  for (const k of keysToSave) {
    savingKeys.add(k);
    try {
      await sync.saveData(state.plannerId, k, JSON.parse(JSON.stringify(dataMap[k])));
    } catch (e) {
      console.warn(`Save failed for ${k}:`, e);
    }
    // Clear echo flag after a short delay (realtime arrives async)
    setTimeout(() => savingKeys.delete(k), 2000);
  }
}

// ---- Actions ----

function taakId(taak, metadata) {
  return `P${metadata.periode}W${metadata.week}_${taak.code || ''}_${(taak.omschrijving || '').slice(0, 30)}`.replace(/\s+/g, '_');
}

// Resolve route-specific times for a task based on student profile
function resolveTijd(tijd, profiel) {
  if (!tijd) return null;
  if (tijd.type === 'minuten_per_route') {
    const routeKey = profiel?.route?.toUpperCase() || 'Z';
    return { type: 'minuten', minuten: tijd[routeKey] || tijd.Z || tijd.B };
  }
  if (tijd.type === 'rooster_zelf') {
    const route = (profiel?.route || '').toUpperCase();
    if (route === 'Z') {
      return { type: 'minuten', minuten: tijd.minuten || 50 };
    }
    return { type: 'rooster', minuten: null };
  }
  return tijd;
}

// New import: saves raw studiewijzer + generates filtered weken
async function importRaw(parsed) {
  if (isReadOnly.value) return;

  // Replace all with new import
  state.studiewijzer = [{ metadata: parsed.metadata, sections: parsed.sections }];

  // Apply profile filter to generate weken
  const profiel = state.studentProfile;
  const filtered = profiel
    ? filterVoorProfiel(parsed, profiel)
    : filterVoorDaan(parsed);

  state.weken = [{ metadata: filtered.metadata, sections: filtered.sections }];
  state.voortgang = {};
  state.planning = {};

  // Auto-derive vakken config from raw data (all vakken)
  const vakkenConfig = deriveVakkenConfig(state.studiewijzer, state.configuratie.vakken || {});

  // Auto-deactivate vakken where ALL tasks were filtered out by profile
  const rawVakken = new Set();
  for (const sw of state.studiewijzer) {
    for (const s of sw.sections) {
      if (s.vak) rawVakken.add(s.vak);
    }
  }
  const gefilterdeVakken = new Set();
  for (const w of state.weken) {
    for (const s of w.sections) {
      if (s.vak && s.taken.length > 0) gefilterdeVakken.add(s.vak);
    }
  }
  for (const vak of rawVakken) {
    if (!gefilterdeVakken.has(vak) && vakkenConfig[vak]) {
      vakkenConfig[vak].actief = false;
    }
  }

  const newConfig = {
    ...state.configuratie,
    vakken: vakkenConfig,
  };

  // Auto-koppel vakken to rooster (if rooster exists)
  state.configuratie = autoKoppelVakken(newConfig);
  await save();
}

// Legacy import (kept for backward compatibility)
async function importStudiewijzerData(filtered) {
  if (isReadOnly.value) return;
  state.weken = [filtered];
  state.voortgang = {};
  state.planning = {};
  state.configuratie = {
    ...state.configuratie,
    vakken: deriveVakkenConfig(state.weken, state.configuratie.vakken || {}),
  };
  await save();
}

// Include a previously-excluded task back into weken
async function includeTaak(rawTaak, weekMetadata, sectionVak, sectionHoofdgroep) {
  if (isReadOnly.value) return;

  // Find or create the right week in weken
  let week = state.weken.find(
    w => w.metadata.periode === weekMetadata.periode && w.metadata.week === weekMetadata.week
  );
  if (!week) {
    week = { metadata: { ...weekMetadata }, sections: [] };
    state.weken.push(week);
  }

  // Find or create section
  let section = week.sections.find(s => s.vak === sectionVak);
  if (!section) {
    section = { hoofdgroep: sectionHoofdgroep, vak: sectionVak, taken: [] };
    week.sections.push(section);
  }

  // Clone and resolve time
  const resolvedTaak = { ...JSON.parse(JSON.stringify(rawTaak)) };
  resolvedTaak.tijd = resolveTijd(resolvedTaak.tijd, state.studentProfile);
  section.taken.push(resolvedTaak);

  await save('weken');
}

// Exclude a task from weken
async function excludeTaak(key, weekMetadata) {
  if (isReadOnly.value) return;

  const week = state.weken.find(
    w => w.metadata.periode === weekMetadata.periode && w.metadata.week === weekMetadata.week
  );
  if (!week) return;

  for (const section of week.sections) {
    const idx = section.taken.findIndex(t => taakId(t, week.metadata) === key);
    if (idx >= 0) {
      section.taken.splice(idx, 1);
      if (section.taken.length === 0) {
        const si = week.sections.indexOf(section);
        if (si >= 0) week.sections.splice(si, 1);
      }
      break;
    }
  }

  // Clean up voortgang and planning
  delete state.voortgang[key];
  delete state.planning[key];

  await save('weken');
}

async function editTaak(id, updates) {
  if (isReadOnly.value) return;
  for (const week of state.weken) {
    for (const section of week.sections) {
      for (const taak of section.taken) {
        const tid = taakId(taak, week.metadata);
        if (tid !== id) continue;

        const oldId = id;

        if (updates.code !== undefined) taak.code = updates.code;
        if (updates.omschrijving !== undefined) taak.omschrijving = updates.omschrijving;
        if (updates.minuten !== undefined) {
          taak.tijd = updates.minuten
            ? { type: 'minuten', minuten: updates.minuten }
            : taak.tijd;
        }

        if (updates.vak !== undefined && updates.vak !== section.vak) {
          const ti = section.taken.indexOf(taak);
          if (ti >= 0) section.taken.splice(ti, 1);
          taak.vak = updates.vak;
          let target = week.sections.find((s) => s.vak === updates.vak);
          if (!target) {
            target = { hoofdgroep: section.hoofdgroep, vak: updates.vak, taken: [] };
            week.sections.push(target);
          }
          target.taken.push(taak);
          if (section.taken.length === 0) {
            const si = week.sections.indexOf(section);
            if (si >= 0) week.sections.splice(si, 1);
          }
        }

        const newId = taakId(taak, week.metadata);
        if (newId !== oldId) {
          if (state.voortgang[oldId]) {
            state.voortgang[newId] = state.voortgang[oldId];
            delete state.voortgang[oldId];
          }
          if (state.planning[oldId]) {
            state.planning[newId] = state.planning[oldId];
            delete state.planning[oldId];
          }
        }

        await save();
        return;
      }
    }
  }
}

async function updateVoortgang(id, update) {
  if (isReadOnly.value) return;
  state.voortgang[id] = { ...(state.voortgang[id] || { status: 'open', minutenGewerkt: 0 }), ...update };
  await save('voortgang');

  // Notify other members when a task is marked as klaar
  if (update.status === 'klaar' && state.plannerId) {
    const taak = alleTaken.value.find(t => t.id === id);
    const label = taak ? `${taak.code || ''} ${taak.omschrijving || ''}`.trim() : id;
    sync.notifyTaskKlaar(state.plannerId, label).catch(console.warn);
  }
}

async function planTaak(id, dag, blok = null) {
  if (isReadOnly.value) return;
  if (dag) {
    state.planning[id] = blok !== null ? { dag, blok } : dag;
  } else {
    delete state.planning[id];
  }
  await save('planning');
}

function lesBlokKey(periode, week, dag) {
  return `P${periode}W${week}_${dag}`;
}

async function updateLesBlokken(periode, week, dag, blokken) {
  if (isReadOnly.value) return;
  state.lesBlokken[lesBlokKey(periode, week, dag)] = blokken;
  await save('lesBlokken');
}

function getLesBlokken(periode, week, dag) {
  return state.lesBlokken[lesBlokKey(periode, week, dag)] || [];
}

async function saveWeekRooster(rooster) {
  if (isReadOnly.value) return;
  state.weekRooster = rooster;
  await save('weekRooster');
}

async function saveConfiguratie(config) {
  if (isReadOnly.value) return;
  state.configuratie = config;
  await save('configuratie');
}

// ---- Vak-rooster matching (shared with ConfiguratieView) ----

const BEKENDE_GROEPEN = {
  'taal': ['nederlands', 'frans', 'engels', 'duits'],
  'science@lab': ['biologie', 'fysica', 'chemie', 'science', 'stem'],
  'stem@lab': ['stem'],
  'cultuur': ['burgerschap', 'cultuurbeschouwing', 'historisch'],
  'cb': ['burgerschap', 'cultuurbeschouwing', 'historisch'],
  'rb': ['ruimtelijk', 'aardwetenschap'],
  'wiskunde': ['wiskunde'],
};

const BEKENDE_WILDCARDS = ['lab@work'];

function extractKeywords(naam) {
  return naam.toLowerCase().split(/[\s:\/,&()\-–]+/).map(w => w.trim()).filter(w => w.length >= 3);
}

function matchesVak(titelLower, vakNaam, vakConfig) {
  const vakLower = vakNaam.toLowerCase();
  const vakWords = extractKeywords(vakNaam);
  const titelWords = extractKeywords(titelLower);
  const aliassen = (vakConfig?.aliassen || []).map(a => a.toLowerCase());

  // Exact match
  if (vakLower === titelLower) return true;

  // First keyword of vak matches titel (both must be >= 4 chars)
  if (vakWords.length && vakWords[0].length >= 4 && titelLower.length >= 4 && (
    titelLower.includes(vakWords[0]) || vakWords[0].includes(titelLower)
  )) return true;

  // Titel's first word contained in vak name (both must be >= 4 chars)
  if (titelWords.length && titelWords[0].length >= 4 && (
    vakLower.includes(titelWords[0])
  )) return true;

  // Alias match (aliases are explicit, no length restriction)
  if (aliassen.some(a => titelLower.includes(a) || a.includes(titelLower))) return true;

  const groepKw = BEKENDE_GROEPEN[titelLower];
  if (groepKw) {
    if (vakWords.some(w => groepKw.some(kw => w.includes(kw) || kw.includes(w)))) return true;
  }
  for (const [groepTitel, keywords] of Object.entries(BEKENDE_GROEPEN)) {
    if (groepTitel !== titelLower) continue;
    if (keywords.some(kw => vakLower.includes(kw))) return true;
  }

  if (titelLower.startsWith('wiskunde') && vakLower.startsWith('wiskunde')) {
    const titelUur = titelLower.match(/\d+/)?.[0];
    const vakUur = vakLower.match(/\d+/)?.[0];
    if (!titelUur || !vakUur) return true;
    if (titelUur === vakUur) return true;
  }

  return false;
}

// Auto-koppel all vakken to rooster titles based on heuristic matching
function autoKoppelVakken(config) {
  const wr = state.weekRooster;
  if (!wr || !config.vakken) return config;

  // Collect all rooster titles
  const roosterTitels = new Set();
  for (const dag of DAGEN) {
    const slots = wr[dag];
    if (!slots || typeof slots !== 'object') continue;
    for (const slot of Object.values(slots)) {
      if (slot.type === 'les' && slot.titel) roosterTitels.add(slot.titel);
    }
  }
  if (!roosterTitels.size) return config;

  // Auto-detect known wildcards
  if (!config.wildcardTitels) config.wildcardTitels = [];
  for (const titel of roosterTitels) {
    const lower = titel.toLowerCase();
    if (BEKENDE_WILDCARDS.includes(lower) && !config.wildcardTitels.includes(lower)) {
      config.wildcardTitels.push(lower);
    }
  }

  // Match each rooster title to vakken
  const actieveVakken = Object.entries(config.vakken)
    .filter(([, v]) => v.actief !== false)
    .map(([naam]) => naam);

  for (const titel of roosterTitels) {
    const lower = titel.toLowerCase();
    if (config.wildcardTitels.includes(lower)) continue;

    for (const vakNaam of actieveVakken) {
      const vak = config.vakken[vakNaam];
      if (!vak) continue;
      // Skip if already linked
      if (vak.roosterTitels?.includes(lower)) continue;
      if (matchesVak(lower, vakNaam, vak)) {
        if (!vak.roosterTitels) vak.roosterTitels = [];
        vak.roosterTitels.push(lower);
      }
    }
  }

  return config;
}

// Auto-derive vakken config from studiewijzer data, merging with existing user config
function deriveVakkenConfig(weken, existing = {}) {
  const vakken = { ...existing };
  for (const week of weken) {
    for (const section of week.sections) {
      const vak = section.vak;
      if (!vak) continue;
      if (!vakken[vak]) {
        // Extract code prefix from tasks as alias
        const aliassen = new Set();
        for (const taak of section.taken) {
          if (taak.code) {
            const prefix = taak.code.replace(/[\d\s]+$/, '').toUpperCase();
            if (prefix && prefix.length >= 2) aliassen.add(prefix);
          }
        }
        vakken[vak] = {
          actief: true,
          zRoute: false,
          aliassen: [...aliassen],
          roosterTitels: [],
        };
      }
    }
  }
  return vakken;
}

async function verwijderWeek(periode, week) {
  if (isReadOnly.value) return;
  state.weken = state.weken.filter(
    (w) => !(w.metadata.periode === periode && w.metadata.week === week)
  );
  await save('weken');
}

async function resetAlles() {
  if (!isEigenaar.value) return;
  state.weken = [];
  state.voortgang = {};
  state.planning = {};
  state.lesBlokken = {};
  state.weekRooster = { ma: {}, di: {}, wo: {}, do: {}, vr: {}, za: {}, zo: {} };
  state.configuratie = { vakken: {} };
  state.studiewijzer = [];
  await save();
}

// ---- UI state (not synced, survives component remounts) ----

const wpViewMode = ref('week');   // 'week' | 'dag'
const wpFocusDag = ref(null);     // 'ma'..'zo', null = vandaag
const activeView = ref('kanban'); // 'kanban' | 'weekplan' | 'studiewijzer' | 'config'

// ---- Export ----

export function usePlanner() {
  return {
    state,
    alleTaken,
    vandaagTaken,
    stats,
    wekenTaakIds,
    DAGEN,
    STATUSSEN,
    isReadOnly,
    isEigenaar,
    wpViewMode,
    wpFocusDag,
    activeView,
    taakId,
    init,
    importRaw,
    importStudiewijzerData,
    includeTaak,
    excludeTaak,
    editTaak,
    updateVoortgang,
    planTaak,
    updateLesBlokken,
    getLesBlokken,
    saveWeekRooster,
    saveConfiguratie,
    deriveVakkenConfig,
    autoKoppelVakken,
    matchesVak,
    extractKeywords,
    BEKENDE_GROEPEN,
    BEKENDE_WILDCARDS,
    verwijderWeek,
    resetAlles,
    selectedTaakId,
    selectTaak,
    deselectTaak,
    filters,
  };
}
