import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const brevoApiKey = Deno.env.get("BREVO_API_KEY")!;

const adminClient = createClient(supabaseUrl, supabaseServiceKey);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: corsHeaders });
}

interface PlannerData {
  planner_id: string;
  key: string;
  data: unknown;
}

interface VoortgangMap {
  [id: string]: { status: string; minutenGewerkt?: number };
}

interface Week {
  metadata: { periode: number; week: number };
  sections: Array<{ vak: string; taken: Array<{ code?: string; omschrijving?: string; tijd?: { type: string; minuten: number } }> }>;
}

function buildStats(weken: Week[], voortgang: VoortgangMap) {
  let open = 0, bezig = 0, klaar = 0, ingediend = 0, total = 0;
  let openMin = 0, bezigMin = 0, klaarMin = 0;

  for (const week of weken) {
    for (const section of week.sections) {
      for (const taak of section.taken) {
        total++;
        const id = `P${week.metadata.periode}W${week.metadata.week}_${taak.code || ''}_${(taak.omschrijving || '').slice(0, 30)}`.replace(/\s+/g, '_');
        const status = voortgang[id]?.status || 'open';
        const min = taak.tijd?.type === 'minuten' ? taak.tijd.minuten : 0;

        if (status === 'klaar') { klaar++; klaarMin += min; }
        else if (status === 'bezig') { bezig++; bezigMin += min; }
        else if (status === 'ingediend') { ingediend++; }
        else { open++; openMin += min; }
      }
    }
  }

  return { total, open, bezig, klaar, ingediend, openMin, bezigMin, klaarMin };
}

function formatMinutes(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m > 0 ? `${h}u ${m}min` : `${h}u`;
}

function buildEmailHtml(studentName: string, stats: ReturnType<typeof buildStats>, plannerUrl: string): string {
  const pct = stats.total > 0 ? Math.round(((stats.klaar + stats.ingediend) / stats.total) * 100) : 0;
  const barColor = pct >= 75 ? '#22c55e' : pct >= 40 ? '#eab308' : '#ef4444';

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; color: #333;">
  <h2 style="color: #6366f1; margin-bottom: 4px;">📋 Catplanner</h2>
  <p style="color: #666; margin-top: 0;">Dagelijkse samenvatting voor <strong>${studentName}</strong></p>

  <div style="background: #f8fafc; border-radius: 12px; padding: 16px; margin: 16px 0;">
    <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
      <span style="font-weight: 600;">Voortgang</span>
      <span style="font-weight: 700; color: ${barColor};">${pct}%</span>
    </div>
    <div style="background: #e2e8f0; border-radius: 8px; height: 12px; overflow: hidden;">
      <div style="background: ${barColor}; height: 100%; width: ${pct}%; border-radius: 8px;"></div>
    </div>
  </div>

  <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
    <tr>
      <td style="padding: 8px 12px; background: #fef2f2; border-radius: 8px 0 0 0;">
        <div style="font-size: 20px; font-weight: 700; color: #ef4444;">${stats.open}</div>
        <div style="font-size: 12px; color: #666;">Open${stats.openMin ? ` (${formatMinutes(stats.openMin)})` : ''}</div>
      </td>
      <td style="padding: 8px 12px; background: #fefce8;">
        <div style="font-size: 20px; font-weight: 700; color: #eab308;">${stats.bezig}</div>
        <div style="font-size: 12px; color: #666;">Bezig${stats.bezigMin ? ` (${formatMinutes(stats.bezigMin)})` : ''}</div>
      </td>
      <td style="padding: 8px 12px; background: #f0fdf4; border-radius: 0 8px 0 0;">
        <div style="font-size: 20px; font-weight: 700; color: #22c55e;">${stats.klaar + stats.ingediend}</div>
        <div style="font-size: 12px; color: #666;">Klaar${stats.klaarMin ? ` (${formatMinutes(stats.klaarMin)})` : ''}</div>
      </td>
    </tr>
  </table>

  <a href="${plannerUrl}" style="display: block; text-align: center; background: #6366f1; color: white; padding: 12px; border-radius: 8px; text-decoration: none; font-weight: 600; margin: 16px 0;">
    Bekijk planning →
  </a>

  <p style="font-size: 11px; color: #aaa; text-align: center; margin-top: 24px;">
    Je ontvangt deze email omdat je gekoppeld bent aan ${studentName}'s planning op Catplanner.
  </p>
</body>
</html>`;
}

async function sendEmail(to: string, toName: string, subject: string, html: string) {
  const resp = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": brevoApiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      sender: { name: "Catplanner", email: "koen.pellegrims+catplanner@gmail.com" },
      to: [{ email: to, name: toName }],
      subject,
      htmlContent: html,
    }),
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Brevo ${resp.status}: ${err}`);
  }
  return await resp.json();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get all planners
    const { data: planners, error: pErr } = await adminClient
      .from("planners")
      .select("id, naam, student_profile");
    if (pErr) throw pErr;

    let emailsSent = 0;
    const errors: string[] = [];

    for (const planner of planners || []) {
      const studentName = planner.student_profile?.naam || planner.naam || "Leerling";
      const plannerUrl = `https://catplanner-app.netlify.app/planner/${planner.id}`;

      // Get planner data (weken + voortgang)
      const { data: pData } = await adminClient
        .from("planner_data")
        .select("key, data")
        .eq("planner_id", planner.id)
        .in("key", ["weken", "voortgang"]) as { data: PlannerData[] | null };

      const weken = (pData?.find((d) => d.key === "weken")?.data || []) as Week[];
      const voortgang = (pData?.find((d) => d.key === "voortgang")?.data || {}) as VoortgangMap;

      if (!weken.length) continue; // Skip planners without data

      const stats = buildStats(weken, voortgang);
      if (stats.total === 0) continue;

      // Get non-student members (ouders/coaches)
      const { data: members } = await adminClient
        .from("planner_members")
        .select("user_id, role")
        .eq("planner_id", planner.id);

      if (!members?.length) continue;

      const memberUserIds = members.map((m: { user_id: string }) => m.user_id);

      // Get user profiles to find ouders/coaches
      const { data: profiles } = await adminClient
        .from("user_profiles")
        .select("user_id, user_type, display_name")
        .in("user_id", memberUserIds)
        .in("user_type", ["ouder", "coach"]);

      if (!profiles?.length) continue;

      // Get their email addresses
      const { data: authUsers } = await adminClient.auth.admin.listUsers();
      const emailMap = new Map<string, string>();
      for (const u of authUsers?.users || []) {
        if (u.email) emailMap.set(u.id, u.email);
      }

      const subject = `${studentName}: ${stats.klaar + stats.ingediend}/${stats.total} taken klaar`;
      const html = buildEmailHtml(studentName, stats, plannerUrl);

      for (const profile of profiles) {
        const email = emailMap.get(profile.user_id);
        if (!email) continue;

        try {
          await sendEmail(email, profile.display_name || "Ouder", subject, html);
          emailsSent++;
        } catch (e: unknown) {
          errors.push(`${email}: ${String(e)}`);
        }
      }
    }

    return json({ emailsSent, errors: errors.length ? errors : undefined });
  } catch (err) {
    console.error("daily-summary error:", err);
    return json({ error: String(err) }, 500);
  }
});
