import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY")!;
const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY")!;
const vapidSubject = Deno.env.get("VAPID_SUBJECT") || "mailto:admin@catplanner-app.netlify.app";

webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

const adminClient = createClient(supabaseUrl, supabaseServiceKey);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: corsHeaders });
}

async function sendPush(
  sub: { endpoint: string; keys_p256dh: string; keys_auth: string },
  payload: string
): Promise<{ statusCode: number; body: string }> {
  const result = await webpush.sendNotification(
    { endpoint: sub.endpoint, keys: { p256dh: sub.keys_p256dh, auth: sub.keys_auth } },
    payload
  );
  return { statusCode: result.statusCode, body: result.body };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) return json({ error: "Unauthorized" }, 401);

    const body = await req.json();

    // Test mode: send to self
    if (body.test === true) {
      const { data: subs } = await adminClient
        .from("push_subscriptions")
        .select("id, endpoint, keys_p256dh, keys_auth")
        .eq("user_id", user.id);

      if (!subs?.length) return json({ error: "Geen push-abonnement gevonden" });

      const results = [];
      for (const sub of subs) {
        try {
          const result = await sendPush(sub, JSON.stringify({
            title: "Test melding",
            body: "Push notificaties werken!",
          }));
          results.push({ endpoint: sub.endpoint.slice(-20), ...result });
        } catch (e: unknown) {
          const statusCode = (e as { statusCode?: number }).statusCode;
          results.push({ endpoint: sub.endpoint.slice(-20), statusCode, error: String(e) });
        }
      }
      return json({ test: true, results });
    }

    // Normal mode: notify other planner members
    const { plannerId, taskLabel } = body;
    if (!plannerId || !taskLabel) return json({ error: "Missing plannerId or taskLabel" }, 400);

    const { data: planner } = await adminClient
      .from("planners")
      .select("student_profile, naam")
      .eq("id", plannerId)
      .single();

    const studentName = planner?.student_profile?.naam || "Een leerling";

    const { data: members } = await adminClient
      .from("planner_members")
      .select("user_id")
      .eq("planner_id", plannerId)
      .neq("user_id", user.id);

    if (!members?.length) return json({ sent: 0, reason: "no other members" });

    const userIds = members.map((m: { user_id: string }) => m.user_id);

    const { data: subscriptions } = await adminClient
      .from("push_subscriptions")
      .select("id, endpoint, keys_p256dh, keys_auth")
      .in("user_id", userIds);

    if (!subscriptions?.length) return json({ sent: 0, reason: "no subscriptions" });

    const payload = JSON.stringify({
      title: "Taak afgerond!",
      body: `${studentName} heeft '${taskLabel}' als klaar gemarkeerd`,
      data: { url: `/planner/${plannerId}` },
    });

    let sent = 0;
    const staleIds: string[] = [];
    const errors: string[] = [];

    await Promise.allSettled(
      subscriptions.map(async (sub: { id: string; endpoint: string; keys_p256dh: string; keys_auth: string }) => {
        try {
          await sendPush(sub, payload);
          sent++;
        } catch (err: unknown) {
          const statusCode = (err as { statusCode?: number }).statusCode;
          if (statusCode === 404 || statusCode === 410) {
            staleIds.push(sub.id);
          } else {
            errors.push(`${statusCode}: ${String(err)}`);
          }
        }
      })
    );

    if (staleIds.length) {
      await adminClient.from("push_subscriptions").delete().in("id", staleIds);
    }

    return json({ sent, cleaned: staleIds.length, errors: errors.length ? errors : undefined });
  } catch (err) {
    console.error("send-push error:", err);
    return json({ error: String(err) }, 500);
  }
});
