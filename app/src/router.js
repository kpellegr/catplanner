import { createRouter, createWebHistory } from 'vue-router';

const routes = [
  {
    path: '/',
    name: 'home',
    component: () => import('./views/Home.vue'),
  },
  {
    path: '/onboarding',
    name: 'onboarding',
    component: () => import('./views/Onboarding.vue'),
  },
  {
    path: '/dashboard',
    name: 'dashboard',
    component: () => import('./views/Dashboard.vue'),
  },
  {
    path: '/planner/:id',
    name: 'planner',
    component: () => import('./views/Planner.vue'),
  },
  {
    path: '/invite/:token',
    name: 'invite',
    component: () => import('./views/InviteAccept.vue'),
  },
];

export const router = createRouter({
  history: createWebHistory('/'),
  routes,
});
