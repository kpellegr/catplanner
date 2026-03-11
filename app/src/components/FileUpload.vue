<template>
  <div></div>
</template>

<script setup>
import { parseStudiewijzer } from '../lib/parser.js';
import { usePlanner } from '../stores/planner.js';

const { importRaw } = usePlanner();

const emit = defineEmits(['imported']);

async function processFiles(files) {
  for (const file of files) {
    const text = await file.text();
    const parsed = parseStudiewijzer(text);
    await importRaw(parsed);
  }
  emit('imported');
}

defineExpose({ processFiles });
</script>
