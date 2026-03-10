<template>
  <div>
    <ImportPreview
      v-if="preview"
      :metadata="preview.metadata"
      :sections="preview.sections"
      :verworpen="preview.verworpen || []"
      @bevestig="bevestig"
      @annuleer="preview = null"
      @herstel="herstelTaak"
      @verwerp="verwerpTaak"
    />
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { parseStudiewijzer, filterVoorProfiel, filterVoorDaan } from '../lib/parser.js';
import { usePlanner } from '../stores/planner.js';
import ImportPreview from './ImportPreview.vue';

const { state, importStudiewijzerData } = usePlanner();
const preview = ref(null);
const pendingQueue = ref([]);

async function processFiles(files) {
  for (const file of files) {
    const text = await file.text();
    const parsed = parseStudiewijzer(text);
    const filtered = state.studentProfile
      ? filterVoorProfiel(parsed, state.studentProfile)
      : filterVoorDaan(parsed);
    pendingQueue.value.push(filtered);
  }
  // Show first pending preview
  showNext();
}

function showNext() {
  if (pendingQueue.value.length > 0) {
    preview.value = pendingQueue.value[0];
  } else {
    preview.value = null;
  }
}

async function bevestig() {
  if (preview.value) {
    await importStudiewijzerData(preview.value);
    pendingQueue.value.shift();
    showNext();
  }
}

function herstelTaak(taak) {
  if (!preview.value) return;
  // Remove from verworpen
  const vi = preview.value.verworpen.findIndex((t) => t === taak);
  if (vi >= 0) preview.value.verworpen.splice(vi, 1);
  // Add to matching section or create new one
  let section = preview.value.sections.find(
    (s) => s.hoofdgroep === taak.hoofdgroep && s.vak === taak.vak
  );
  if (!section) {
    section = { hoofdgroep: taak.hoofdgroep, vak: taak.vak, taken: [] };
    preview.value.sections.push(section);
  }
  const { filterReden, ...cleanTaak } = taak;
  // Resolve route-specific times for restored tasks
  if (cleanTaak.tijd && cleanTaak.tijd.type === 'minuten_per_route') {
    const routeKey = state.studentProfile?.route?.toUpperCase() || 'Z';
    cleanTaak.tijd = { type: 'minuten', minuten: cleanTaak.tijd[routeKey] || cleanTaak.tijd.Z || cleanTaak.tijd.B };
  }
  section.taken.push(cleanTaak);
}

function verwerpTaak(taak) {
  if (!preview.value) return;
  // Find and remove from section
  for (const section of preview.value.sections) {
    const ti = section.taken.indexOf(taak);
    if (ti >= 0) {
      section.taken.splice(ti, 1);
      // Add to verworpen with reason
      preview.value.verworpen.push({
        ...taak,
        hoofdgroep: section.hoofdgroep,
        vak: section.vak,
        filterReden: 'Handmatig verwijderd',
      });
      // Remove empty sections
      if (section.taken.length === 0) {
        const si = preview.value.sections.indexOf(section);
        if (si >= 0) preview.value.sections.splice(si, 1);
      }
      break;
    }
  }
}

function onFiles(e) {
  processFiles(e.target.files);
  e.target.value = '';
}

function onDrop(e) {
  processFiles(e.dataTransfer.files);
}

defineExpose({ processFiles });
</script>
