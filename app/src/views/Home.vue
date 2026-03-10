<template>
  <AuthGate>
    <PlannerApp />
  </AuthGate>
</template>

<script setup>
import AuthGate from '../components/AuthGate.vue';
import PlannerApp from '../components/PlannerApp.vue';
</script>
