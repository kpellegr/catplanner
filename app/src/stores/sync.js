import { supabase } from '../lib/supabase.js';

// ---- User profile ----

export async function getMyProfile() {
  const { data, error } = await supabase.rpc('get_my_profile');
  if (error) throw error;
  return data; // { user_type, display_name } or null
}

export async function createUserProfile(userType, displayName = null) {
  const { error } = await supabase.rpc('create_user_profile', {
    p_user_type: userType,
    p_display_name: displayName,
  });
  if (error) throw error;
}

// ---- Planners ----

export async function getMyPlanners() {
  const { data, error } = await supabase.rpc('get_my_planners');
  if (error) throw error;
  return data || []; // [{ planner_id, planner_naam, role, student_profile }]
}

export async function findMyPlanner() {
  const planners = await getMyPlanners();
  if (!planners.length) return null;
  const p = planners[0];
  return { plannerId: p.planner_id, role: p.role, naam: p.planner_naam };
}

export async function createPlanner(naam = 'Mijn planning', studentProfile = null) {
  const { data, error } = await supabase.rpc('create_planner', {
    p_naam: naam,
    p_student_profile: studentProfile,
  });
  if (error) throw error;
  return data; // returns planner UUID
}

// ---- Get planner info (including student_profile) ----

export async function getPlannerInfo(plannerId) {
  const { data, error } = await supabase
    .from('planners')
    .select('id, naam, student_profile')
    .eq('id', plannerId)
    .single();
  if (error) throw error;
  return data;
}

// ---- Load all data for a planner ----

export async function loadPlanner(plannerId) {
  const { data, error } = await supabase
    .from('planner_data')
    .select('key, data')
    .eq('planner_id', plannerId);

  if (error) throw error;

  const result = { weken: [], voortgang: {}, planning: {}, lesBlokken: {}, weekRooster: { ma: {}, di: {}, wo: {}, do: {}, vr: {}, za: {}, zo: {} }, configuratie: { vakken: {} }, studiewijzer: [] };
  for (const row of data || []) {
    result[row.key] = row.data;
  }
  return result;
}

// ---- Save individual data keys ----

export async function saveData(plannerId, key, data) {
  const { error } = await supabase
    .from('planner_data')
    .upsert(
      { planner_id: plannerId, key, data, updated_at: new Date().toISOString() },
      { onConflict: 'planner_id,key' }
    );
  if (error) throw error;
}

// ---- Real-time subscription ----

export function subscribeToPlanner(plannerId, onChange) {
  const channel = supabase
    .channel(`planner-${plannerId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'planner_data',
        filter: `planner_id=eq.${plannerId}`,
      },
      (payload) => {
        if (payload.new) {
          onChange(payload.new.key, payload.new.data);
        }
      }
    )
    .subscribe();

  return () => supabase.removeChannel(channel);
}

// ---- Invites ----

export async function createInvite(plannerId, role) {
  const { data: { user } } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from('invites')
    .insert({ planner_id: plannerId, role, created_by: user.id })
    .select('token')
    .single();
  if (error) throw error;
  return data.token;
}

export async function acceptInvite(token) {
  const { data, error } = await supabase.rpc('accept_invite', { invite_token: token });
  if (error) throw error;
  return data; // { planner_id, role }
}

export async function getMembers(plannerId) {
  const { data, error } = await supabase.rpc('get_planner_members', { p_planner_id: plannerId });
  if (error) throw error;
  return data || [];
}

export async function removeMember(memberId) {
  const { error } = await supabase
    .from('planner_members')
    .delete()
    .eq('id', memberId);
  if (error) throw error;
}

// ---- Push notifications ----

export async function notifyTaskKlaar(plannerId, taskLabel) {
  const { error } = await supabase.functions.invoke('send-push', {
    body: { plannerId, taskLabel },
  });
  if (error) console.warn('Push notification failed:', error);
}
