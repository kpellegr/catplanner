import { reactive, computed } from 'vue';
import { supabase } from '../lib/supabase.js';

const state = reactive({
  user: null,
  session: null,
  loading: true,
});

const isLoggedIn = computed(() => !!state.user);

async function init() {
  const { data: { session } } = await supabase.auth.getSession();
  state.session = session;
  state.user = session?.user || null;
  state.loading = false;

  supabase.auth.onAuthStateChange((_event, session) => {
    state.session = session;
    state.user = session?.user || null;
  });
}

async function signIn(email) {
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: window.location.origin + '/',
    },
  });
  if (error) throw error;
}

async function signInWithGoogle() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.origin + '/',
    },
  });
  if (error) throw error;
}

async function signOut() {
  await supabase.auth.signOut();
  state.user = null;
  state.session = null;
}

export function useAuth() {
  return { state, isLoggedIn, init, signIn, signInWithGoogle, signOut };
}
