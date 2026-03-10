import { createRouter, createWebHistory } from 'vue-router';

const routes = [
  {
    path: '/',
    name: 'home',
    component: () => import('./views/Home.vue'),
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
