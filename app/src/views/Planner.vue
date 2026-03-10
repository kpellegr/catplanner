<template>
  <AuthGate>
    <PlannerApp :planner-id="route.params.id" />
  </AuthGate>
</template>

<script setup>
import { useRoute } from 'vue-router';
import AuthGate from '../components/AuthGate.vue';
import PlannerApp from '../components/PlannerApp.vue';

const route = useRoute();
</script>
