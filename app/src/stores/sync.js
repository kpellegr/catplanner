import { supabase } from '../lib/supabase.js';

// ---- Find or create planner ----

export async function findMyPlanner() {
  const { data, error } = await supabase
    .from('planner_members')
    .select('planner_id, role, planners(naam)')
    .limit(1)
    .single();

  if (error || !data) return null;
  return { plannerId: data.planner_id, role: data.role, naam: data.planners?.naam };
}

export async function createPlanner(naam = 'Mijn planning') {
  const { data, error } = await supabase.rpc('create_planner', { p_naam: naam });
  if (error) throw error;
  return data; // returns planner UUID
}

// ---- Load all data for a planner ----

export async function loadPlanner(plannerId) {
  const { data, error } = await supabase
    .from('planner_data')
    .select('key, data')
    .eq('planner_id', plannerId);

  if (error) throw error;

  const result = { weken: [], voortgang: {}, planning: {}, lesBlokken: {} };
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
