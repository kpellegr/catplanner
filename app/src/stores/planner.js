import { reactive, computed } from 'vue';
// Parser is now called from FileUpload before data reaches the store

const DB_NAME = 'catplanner';
const DB_VERSION = 1;

// ---- State ----

const DAGEN = ['ma', 'di', 'wo', 'do', 'vr'];

const state = reactive({
  weken: [],        // parsed week data: [{ metadata, sections }]
  voortgang: {},    // { [taakId]: { status, minutenGewerkt } }
  planning: {},     // { [taakId]: 'ma'|'di'|'wo'|'do'|'vr' }
  lesBlokken: {},   // { 'P3W4_ma': ['BIO','CH','LO'], ... }
  loaded: false,
});

// ---- Computed ----

const STATUSSEN = ['open', 'bezig', 'klaar', 'ingediend'];

const alleTaken = computed(() => {
  const taken = [];
  for (const week of state.weken) {
    for (const section of week.sections) {
      for (const taak of section.taken) {
        const id = taakId(taak, week.metadata);
        const voortgang = state.voortgang[id] || { status: 'open', minutenGewerkt: 0 };
        // Migrate legacy 'todo' status
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

// ---- Actions ----

function taakId(taak, metadata) {
  return `P${metadata.periode}W${metadata.week}_${taak.code || ''}_${(taak.omschrijving || '').slice(0, 30)}`.replace(/\s+/g, '_');
}

async function importStudiewijzerData(filtered) {
  // Replace all weeks — one active week at a time
  state.weken = [filtered];
  state.voortgang = {};
  state.planning = {};

  await save();
}

async function updateVoortgang(id, update) {
  state.voortgang[id] = { ...(state.voortgang[id] || { status: 'open', minutenGewerkt: 0 }), ...update };
  await save();
}

async function planTaak(id, dag) {
  if (dag) {
    state.planning[id] = dag;
  } else {
    delete state.planning[id];
  }
  await save();
}

function lesBlokKey(periode, week, dag) {
  return `P${periode}W${week}_${dag}`;
}

async function updateLesBlokken(periode, week, dag, blokken) {
  state.lesBlokken[lesBlokKey(periode, week, dag)] = blokken;
  await save();
}

function getLesBlokken(periode, week, dag) {
  return state.lesBlokken[lesBlokKey(periode, week, dag)] || [];
}

async function verwijderWeek(periode, week) {
  state.weken = state.weken.filter(
    (w) => !(w.metadata.periode === periode && w.metadata.week === week)
  );
  await save();
}

// ---- IndexedDB persistence ----

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('state')) {
        db.createObjectStore('state');
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function save() {
  const db = await openDB();
  const tx = db.transaction('state', 'readwrite');
  const store = tx.objectStore('state');
  store.put(JSON.parse(JSON.stringify(state.weken)), 'weken');
  store.put(JSON.parse(JSON.stringify(state.voortgang)), 'voortgang');
  store.put(JSON.parse(JSON.stringify(state.planning)), 'planning');
  store.put(JSON.parse(JSON.stringify(state.lesBlokken)), 'lesBlokken');
  return new Promise((resolve) => { tx.oncomplete = resolve; });
}

async function load() {
  try {
    const db = await openDB();
    const tx = db.transaction('state', 'readonly');
    const store = tx.objectStore('state');

    const weken = await idbGet(store, 'weken');
    const voortgang = await idbGet(store, 'voortgang');
    const planning = await idbGet(store, 'planning');
    const lesBlokken = await idbGet(store, 'lesBlokken');

    if (weken) state.weken = weken;
    if (voortgang) state.voortgang = voortgang;
    if (planning) state.planning = planning;
    if (lesBlokken) state.lesBlokken = lesBlokken;
  } catch (e) {
    console.warn('Could not load from IndexedDB:', e);
  }
  state.loaded = true;
}

function idbGet(store, key) {
  return new Promise((resolve) => {
    const req = store.get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
  });
}

// Auto-load on import
load();

// ---- Export ----

export function usePlanner() {
  return {
    state,
    alleTaken,
    vandaagTaken,
    stats,
    DAGEN,
    STATUSSEN,
    importStudiewijzerData,
    updateVoortgang,
    planTaak,
    updateLesBlokken,
    getLesBlokken,
    verwijderWeek,
  };
}
