import { reactive, computed } from 'vue';
// Parser is now called from FileUpload before data reaches the store

const DB_NAME = 'catplanner';
const DB_VERSION = 1;

// ---- State ----

const state = reactive({
  weken: [],        // parsed week data: [{ metadata, sections }]
  voortgang: {},    // { [taakId]: { status, minutenGewerkt } }
  loaded: false,
});

// ---- Computed ----

const alleTaken = computed(() => {
  const taken = [];
  for (const week of state.weken) {
    for (const section of week.sections) {
      for (const taak of section.taken) {
        const id = taakId(taak, week.metadata);
        taken.push({
          ...taak,
          id,
          week: week.metadata.week,
          periode: week.metadata.periode,
          voortgang: state.voortgang[id] || { status: 'todo', minutenGewerkt: 0 },
        });
      }
    }
  }
  return taken;
});

const vandaagTaken = computed(() => {
  return alleTaken.value.filter((t) => t.voortgang.status !== 'klaar');
});

const stats = computed(() => {
  const taken = alleTaken.value;
  const todo = taken.filter((t) => t.voortgang.status === 'todo').length;
  const bezig = taken.filter((t) => t.voortgang.status === 'bezig').length;
  const klaar = taken.filter((t) => t.voortgang.status === 'klaar').length;
  const totalMinuten = taken.reduce((sum, t) => {
    if (t.tijd && t.tijd.type === 'minuten') return sum + t.tijd.minuten;
    return sum;
  }, 0);
  const gewerktMinuten = taken.reduce((sum, t) => sum + (t.voortgang.minutenGewerkt || 0), 0);
  return { todo, bezig, klaar, total: taken.length, totalMinuten, gewerktMinuten };
});

// ---- Actions ----

function taakId(taak, metadata) {
  return `P${metadata.periode}W${metadata.week}_${taak.code || ''}_${(taak.omschrijving || '').slice(0, 30)}`.replace(/\s+/g, '_');
}

async function importStudiewijzerData(filtered) {
  // Replace existing week if same period+week
  const idx = state.weken.findIndex(
    (w) => w.metadata.periode === filtered.metadata.periode && w.metadata.week === filtered.metadata.week
  );
  if (idx >= 0) {
    state.weken[idx] = filtered;
  } else {
    state.weken.push(filtered);
    state.weken.sort((a, b) => {
      if (a.metadata.periode !== b.metadata.periode) return a.metadata.periode - b.metadata.periode;
      return a.metadata.week - b.metadata.week;
    });
  }

  await save();
}

async function updateVoortgang(id, update) {
  state.voortgang[id] = { ...(state.voortgang[id] || { status: 'todo', minutenGewerkt: 0 }), ...update };
  await save();
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
  return new Promise((resolve) => { tx.oncomplete = resolve; });
}

async function load() {
  try {
    const db = await openDB();
    const tx = db.transaction('state', 'readonly');
    const store = tx.objectStore('state');

    const weken = await idbGet(store, 'weken');
    const voortgang = await idbGet(store, 'voortgang');

    if (weken) state.weken = weken;
    if (voortgang) state.voortgang = voortgang;
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
    importStudiewijzerData,
    updateVoortgang,
    verwijderWeek,
  };
}
