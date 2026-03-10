import { reactive, computed } from 'vue';

// ---- Constants ----

export const flagTooltips = {
  P: 'Inleveren op papier',
  M: 'Materiaal meebrengen',
  U: 'Uitgestelde deadline',
  G: 'Groepswerk',
};

export function flagTooltip(flag) {
  return flagTooltips[flag] || flag;
}

// ---- Hoofdgroep coloring ----

export function hoofdgroepClass(taak) {
  const hg = (taak.hoofdgroep || '').toUpperCase();
  if (hg.includes('WETENSCHAP')) return 'hg-wetenschap';
  if (hg.includes('TALEN')) return 'hg-talen';
  if (hg.includes('WISKUNDE')) return 'hg-wiskunde';
  if (hg.includes('PROJECT')) return 'hg-project';
  return 'hg-algemeen';
}

// ---- Duration formatting ----

export function formatDuur(taak, { showCustom = false, defaultMinutes = null } = {}) {
  if (showCustom && taak.voortgang?.customMinuten != null) return `${taak.voortgang.customMinuten}'`;
  if (!taak.tijd) return defaultMinutes ? `${defaultMinutes}'` : '';
  if (taak.tijd.type === 'rooster') return 'R';
  if (taak.tijd.type === 'minuten') return `${taak.tijd.minuten}'`;
  return defaultMinutes ? `${defaultMinutes}'` : '';
}

export function duurTooltip(taak, { defaultMinutes = null } = {}) {
  if (!taak.tijd) return defaultMinutes ? `${defaultMinutes} minuten (standaard)` : '';
  if (taak.tijd.type === 'rooster') return 'Roosteruur';
  if (taak.tijd.type === 'minuten') return `${taak.tijd.minuten} minuten`;
  return '';
}

// ---- Vak grouping with expand/collapse ----

export function useVakGroepen(takenRef) {
  const openVakken = reactive({});

  const vakken = computed(() => {
    const map = new Map();
    for (const taak of takenRef.value) {
      const vak = taak.vak || '';
      if (!map.has(vak)) map.set(vak, []);
      map.get(vak).push(taak);
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([naam, taken]) => ({ naam, taken }));
  });

  function isVakOpen(vakNaam) {
    return openVakken[vakNaam] !== false; // expanded by default
  }

  function toggleVak(vakNaam) {
    openVakken[vakNaam] = !isVakOpen(vakNaam);
  }

  const allesOpen = computed(() => {
    return vakken.value.length > 0 && vakken.value.every((v) => openVakken[v.naam] !== false);
  });

  function toggleAlles() {
    const open = !allesOpen.value;
    for (const vak of vakken.value) {
      openVakken[vak.naam] = open;
    }
  }

  function vakMinuten(taken) {
    return taken.reduce((sum, t) => (t.tijd?.type === 'minuten' ? sum + t.tijd.minuten : sum), 0);
  }

  return { vakken, openVakken, isVakOpen, toggleVak, allesOpen, toggleAlles, vakMinuten };
}

// ---- Dependency chains (volgorde) ----

export function useVolgordeKetens(vakkenRef) {
  const volgordeKetens = computed(() => {
    const result = [];
    for (const vak of vakkenRef.value) {
      const metVolgorde = [...vak.taken]
        .filter(t => typeof t.volgorde === 'number')
        .sort((a, b) => (a.origIndex ?? 0) - (b.origIndex ?? 0));

      if (metVolgorde.length < 2) continue;

      let huidigeKeten = [metVolgorde[0]];
      for (let i = 1; i < metVolgorde.length; i++) {
        if (metVolgorde[i].volgorde > metVolgorde[i - 1].volgorde) {
          huidigeKeten.push(metVolgorde[i]);
        } else {
          if (huidigeKeten.length > 1) result.push(huidigeKeten);
          huidigeKeten = [metVolgorde[i]];
        }
      }
      if (huidigeKeten.length > 1) result.push(huidigeKeten);
    }
    return result;
  });

  const relatedIds = computed(() => {
    const lookup = new Map();
    for (const keten of volgordeKetens.value) {
      const ids = keten.map(t => t.id);
      for (const id of ids) {
        lookup.set(id, new Set(ids));
      }
    }
    return lookup;
  });

  const taakKetenMap = computed(() => {
    const map = new Map();
    for (const keten of volgordeKetens.value) {
      for (const t of keten) {
        map.set(t.id, keten);
      }
    }
    return map;
  });

  function taakKeten(taak) {
    return taakKetenMap.value.get(taak.id) || null;
  }

  function ketenTooltip(taak) {
    const keten = taakKeten(taak);
    if (!keten) return '';
    return `Volgorde: ${keten.map(t => t.code || `#${t.volgorde}`).join(' → ')}`;
  }

  return { volgordeKetens, relatedIds, taakKetenMap, taakKeten, ketenTooltip };
}

// ---- Drag-related chain highlighting ----

export function useDragRelated(draggingTaakRef, relatedIdsRef, taakKetenMapRef, ketenStapKleurFn) {
  function isRelatedToDrag(taakId) {
    if (!draggingTaakRef.value) return false;
    const related = relatedIdsRef.value.get(draggingTaakRef.value.id);
    return related?.has(taakId) && taakId !== draggingTaakRef.value.id;
  }

  function dragRelatedClass(taak) {
    if (!isRelatedToDrag(taak.id)) return '';
    const keten = taakKetenMapRef.value.get(taak.id);
    if (!keten) return 'drag-related-ok';
    let worstLevel = 0;
    for (let i = 1; i < keten.length; i++) {
      const kleur = ketenStapKleurFn(keten[i], keten[i]);
      if (kleur === 'keten-rood') worstLevel = 2;
      else if (kleur === 'keten-oranje' && worstLevel < 2) worstLevel = 1;
    }
    if (worstLevel === 2) return 'drag-related-conflict';
    if (worstLevel === 1) return 'drag-related-warn';
    return 'drag-related-ok';
  }

  return { isRelatedToDrag, dragRelatedClass };
}
