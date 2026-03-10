import { reactive, computed } from 'vue';
import * as sync from './sync.js';

// ---- State ----

const DAGEN = ['ma', 'di', 'wo', 'do', 'vr'];

const state = reactive({
  weken: [],
  voortgang: {},
  planning: {},
  lesBlokken: {},
  loaded: false,
  // Multi-user
  plannerId: null,
  userRole: null,  // 'eigenaar' | 'editor' | 'viewer'
  studentProfile: null, // { naam, richting, route, wiskunde }
});

let unsubscribe = null;
let savingKeys = new Set(); // prevent echo from realtime

// ---- Computed ----

const STATUSSEN = ['open', 'bezig', 'klaar', 'ingediend'];

const isReadOnly = computed(() => state.userRole === 'viewer');
const isEigenaar = computed(() => state.userRole === 'eigenaar');

const alleTaken = computed(() => {
  const taken = [];
  for (const week of state.weken) {
    for (const section of week.sections) {
      for (const taak of section.taken) {
        const id = taakId(taak, week.metadata);
        const voortgang = state.voortgang[id] || { status: 'open', minutenGewerkt: 0 };
        if (voortgang.status === 'todo') voortgang.status = 'open';
        taken.push({
          ...taak,
          id,
          week: week.metadata.week,
          periode: week.metadata.periode,
          voortgang,
          geplandOp: state.planning[id] || null,
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

async function importStudiewijzerData(filtered) {
  if (isReadOnly.value) return;
  state.weken = [filtered];
  state.voortgang = {};
  state.planning = {};
  await save();
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
}

async function planTaak(id, dag) {
  if (isReadOnly.value) return;
  if (dag) {
    state.planning[id] = dag;
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
  await save();
}

// ---- Export ----

export function usePlanner() {
  return {
    state,
    alleTaken,
    vandaagTaken,
    stats,
    DAGEN,
    STATUSSEN,
    isReadOnly,
    isEigenaar,
    init,
    importStudiewijzerData,
    editTaak,
    updateVoortgang,
    planTaak,
    updateLesBlokken,
    getLesBlokken,
    verwijderWeek,
    resetAlles,
  };
}
