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

// Register service worker for PWA + push notifications
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }).then((reg) => {
    // Check for updates immediately
    reg.update();
  }).catch((err) => {
    console.warn('SW registration failed:', err);
  });
}
