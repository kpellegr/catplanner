import { createApp } from 'vue';
import './style.css';
import App from './App.vue';
import { router } from './router.js';
import { useAuth } from './stores/auth.js';

const app = createApp(App);
app.use(router);
app.mount('#app');

// Initialize auth
useAuth().init();
