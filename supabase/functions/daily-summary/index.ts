import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const brevoApiKey = Deno.env.get("BREVO_API_KEY")!;

const adminClient = createClient(supabaseUrl, supabaseServiceKey);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: corsHeaders });
}

// ---- Types ----

interface Taak {
  code?: string;
  omschrijving?: string;
  tijd?: { type: string; minuten?: number };
  volgorde?: number[];
  flags?: string[];
}

interface Section {
  vak: string;
  taken: Taak[];
}

interface Week {
  metadata: { periode: number; week: number };
  sections: Section[];
}

interface VoortgangEntry {
  status: string;
  minutenGewerkt?: number;
  customMinuten?: number;
}

interface VoortgangMap {
  [id: string]: VoortgangEntry;
}

interface PlanningMap {
  [id: string]: string | { dag: string; blok?: number };
}

interface VakConfig {
  actief?: boolean;
  [key: string]: unknown;
}

interface Configuratie {
  vakken?: { [naam: string]: VakConfig };
  [key: string]: unknown;
}

interface WeekRooster {
  [dag: string]: {
    [uur: string]: { type: string; titel?: string };
  };
}

interface MergedTaak {
  id: string;
  code: string;
  omschrijving: string;
  vak: string;
  tijd: { type: string; minuten?: number } | null;
  voortgang: VoortgangEntry;
  geplandOp: string | null;
  geplandBlok: number | null;
}

// ---- Helpers ----

const DAGEN = ["ma", "di", "wo", "do", "vr", "za", "zo"];
const DAGEN_VOL = [
  "maandag",
  "dinsdag",
  "woensdag",
  "donderdag",
  "vrijdag",
  "zaterdag",
  "zondag",
];
const MAANDEN = [
  "januari",
  "februari",
  "maart",
  "april",
  "mei",
  "juni",
  "juli",
  "augustus",
  "september",
  "oktober",
  "november",
  "december",
];

const BLOKKEN = 56; // 14 uur x 4 kwartieren

function taakId(taak: Taak, metadata: { periode: number; week: number }) {
  return `P${metadata.periode}W${metadata.week}_${taak.code || ""}_${(taak.omschrijving || "").slice(0, 30)}`.replace(
    /\s+/g,
    "_"
  );
}

function buildAlleTaken(
  weken: Week[],
  voortgang: VoortgangMap,
  planning: PlanningMap,
  configuratie: Configuratie
): MergedTaak[] {
  const inactief = new Set<string>();
  const vakken = configuratie?.vakken;
  if (vakken) {
    for (const [naam, config] of Object.entries(vakken)) {
      if (config.actief === false) inactief.add(naam);
    }
  }

  const taken: MergedTaak[] = [];
  for (const week of weken) {
    for (const section of week.sections) {
      if (inactief.has(section.vak)) continue;
      for (const taak of section.taken) {
        const id = taakId(taak, week.metadata);
        const v = voortgang[id] || { status: "open", minutenGewerkt: 0 };
        if (v.status === "todo") v.status = "open";
        const planVal = planning[id] || null;
        const geplandOp = planVal
          ? typeof planVal === "string"
            ? planVal
            : planVal.dag
          : null;
        const geplandBlok =
          planVal && typeof planVal === "object" ? planVal.blok ?? null : null;
        taken.push({
          id,
          code: taak.code || "",
          omschrijving: taak.omschrijving || "",
          vak: section.vak,
          tijd: taak.tijd || null,
          voortgang: v,
          geplandOp,
          geplandBlok,
        });
      }
    }
  }
  return taken;
}

function isKlaar(t: MergedTaak) {
  return t.voortgang.status === "klaar" || t.voortgang.status === "ingediend";
}

function taakMin(t: MergedTaak) {
  return (
    t.voortgang.customMinuten ||
    (t.tijd?.type === "minuten" ? t.tijd.minuten || 0 : 0)
  );
}

function formatMin(min: number): string {
  if (!min) return "0'";
  return `${min}'`;
}

// ---- WeekGrid SVG builder ----

const GRID_CLR: Record<string, string> = {
  vrij: "#f0f0ee",
  klaar: "#86cfac",
  gemist: "#e07878",
  rooster: "#b4a7d6",
  huiswerk: "#7eb8d8",
  les: "#e0ddd6",
  bezet: "#c8c8c8",
};

const TAAK_PRIO: Record<string, number> = {
  gemist: 4,
  rooster: 3,
  huiswerk: 2,
  klaar: 1,
};
const ROOSTER_PRIO: Record<string, number> = { bezet: 2, les: 1 };

// ---- WeekGrid compact HTML table for email ----

function buildWeekGridHtml(
  alleTaken: MergedTaak[],
  weekRooster: WeekRooster,
  vandaagIdx: number
): string {
  // Reuse same grid logic from buildWeekGridSvg
  const roosterMap: Record<string, Record<number, string>> = {};
  for (const dag of DAGEN) roosterMap[dag] = {};
  for (const dag of DAGEN) {
    const dagSlots = weekRooster[dag];
    if (!dagSlots || typeof dagSlots !== "object") continue;
    for (const [uurStr, slot] of Object.entries(dagSlots)) {
      const uur = parseInt(uurStr);
      const startBlok = (uur - 1) * 4;
      const kleur =
        slot.type === "bezet" || slot.type === "pauze"
          ? "bezet"
          : slot.type === "les"
            ? "les"
            : null;
      if (kleur) {
        for (let j = 0; j < 4; j++) roosterMap[dag][startBlok + j] = kleur;
      }
    }
  }

  const takenMap: Record<string, Record<number, string>> = {};
  for (const dag of DAGEN) takenMap[dag] = {};
  takenMap["_"] = {};
  let ongeplandBlok = 0;

  for (const taak of alleTaken) {
    const status = taak.voortgang.status;
    const isRooster = taak.tijd?.type === "rooster";
    const minuten = taakMin(taak);
    const aantalBlokken = isRooster ? 4 : Math.max(1, Math.ceil(minuten / 15));

    let kleur: string;
    if (status === "klaar" || status === "ingediend") kleur = "klaar";
    else if (taak.geplandOp && DAGEN.indexOf(taak.geplandOp) < vandaagIdx) kleur = "gemist";
    else if (isRooster) kleur = "rooster";
    else kleur = "huiswerk";

    if (taak.geplandOp && taak.geplandBlok != null) {
      for (let j = 0; j < aantalBlokken; j++) {
        const b = taak.geplandBlok + j;
        if (b < BLOKKEN && !takenMap[taak.geplandOp]?.[b])
          takenMap[taak.geplandOp][b] = kleur;
      }
    } else if (taak.geplandOp) {
      const dag = taak.geplandOp;
      let start = 0;
      for (let b = 0; b <= BLOKKEN - aantalBlokken; b++) {
        let vrij = true;
        for (let j = 0; j < aantalBlokken; j++) {
          if (takenMap[dag][b + j] || roosterMap[dag]?.[b + j]) { vrij = false; break; }
        }
        if (vrij) { start = b; break; }
      }
      for (let j = 0; j < aantalBlokken; j++) {
        if (start + j < BLOKKEN) takenMap[dag][start + j] = kleur;
      }
    } else {
      for (let j = 0; j < aantalBlokken; j++) {
        if (ongeplandBlok + j < BLOKKEN) takenMap["_"][ongeplandBlok + j] = kleur;
      }
      ongeplandBlok += aantalBlokken;
    }
  }

  function uurColor(kolKey: string, uurIdx: number): string {
    const baseBlok = uurIdx * 4;
    const tm = takenMap[kolKey] || {};
    const rm = roosterMap[kolKey] || {};
    let bestTaak: string | null = null;
    for (let j = 0; j < 4; j++) {
      const k = tm[baseBlok + j];
      if (k && (!bestTaak || (TAAK_PRIO[k] || 0) > (TAAK_PRIO[bestTaak] || 0))) bestTaak = k;
    }
    if (bestTaak) return GRID_CLR[bestTaak] || GRID_CLR.vrij;
    let bestRooster: string | null = null;
    for (let j = 0; j < 4; j++) {
      const k = rm[baseBlok + j];
      if (k && (!bestRooster || (ROOSTER_PRIO[k] || 0) > (ROOSTER_PRIO[bestRooster] || 0))) bestRooster = k;
    }
    if (bestRooster) return GRID_CLR[bestRooster] || GRID_CLR.vrij;
    return GRID_CLR.vrij;
  }

  const kolommen = [...DAGEN, "_"];
  const kolLabels: Record<string, string> = {};
  for (const d of DAGEN) kolLabels[d] = d;
  kolLabels["_"] = "?";

  let rows = "";
  for (const kol of kolommen) {
    const isVandaag = kol === DAGEN[vandaagIdx];
    const lc = isVandaag ? CLR.accent : kol === "_" ? "#d97706" : CLR.textMuted;
    let cells = `<td style="font:700 9px sans-serif;color:${lc};text-align:right;padding-right:3px">${kolLabels[kol]}</td>`;
    for (let u = 0; u < 14; u++) {
      cells += `<td bgcolor="${uurColor(kol, u)}" width="16" height="10"></td>`;
    }
    rows += `<tr>${cells}</tr>`;
  }

  return `<table cellspacing="1" cellpadding="0" border="0">${rows}</table>`;
}

// ---- Email HTML builder ----

const CLR = {
  bg: "#f8f7f5",
  surface: "#ffffff",
  border: "#e8e6e1",
  text: "#2d2a26",
  textMuted: "#8a8780",
  accent: "#7c6cad",
  klaar: "#86cfac",
  gemist: "#e07878",
  rooster: "#b4a7d6",
  huiswerk: "#7eb8d8",
};

function borderColor(t: MergedTaak, isVerleden: boolean, vandaagIdx: number) {
  if (isKlaar(t)) return "#10b981";
  if (isVerleden || (t.geplandOp && DAGEN.indexOf(t.geplandOp) < vandaagIdx))
    return "#ef4444";
  if (t.tijd?.type === "rooster") return "#c4b5fd";
  return "#93c5fd";
}

function statusBadge(t: MergedTaak, isVerleden: boolean, vandaagIdx: number): string {
  if (t.voortgang.status === "klaar") return `<span style="font-size:9px;font-weight:700;color:#059669;background:#ecfdf5;padding:1px 5px;border-radius:3px;">KLAAR</span>`;
  if (t.voortgang.status === "ingediend") return `<span style="font-size:9px;font-weight:700;color:#059669;background:#ecfdf5;padding:1px 5px;border-radius:3px;">INGEDIEND</span>`;
  if (t.voortgang.status === "bezig") return `<span style="font-size:9px;font-weight:700;color:#b45309;background:#fffbeb;padding:1px 5px;border-radius:3px;">BEZIG</span>`;
  if (isVerleden || (t.geplandOp && DAGEN.indexOf(t.geplandOp) < vandaagIdx))
    return `<span style="font-size:9px;font-weight:700;color:#dc2626;background:#fef2f2;padding:1px 5px;border-radius:3px;">GEMIST</span>`;
  return `<span style="font-size:9px;font-weight:700;color:${CLR.textMuted};background:${CLR.bg};padding:1px 5px;border-radius:3px;">OPEN</span>`;
}

function buildEmailHtml(
  studentName: string,
  weekNr: number | string,
  alleTaken: MergedTaak[],
  weekGridHtml: string,
  plannerUrl: string
): string {
  const now = new Date();
  const jsDay = now.getDay();
  const dagMap = [6, 0, 1, 2, 3, 4, 5];
  const vandaagIdx = dagMap[jsDay];
  const vandaagDag = DAGEN[vandaagIdx] || "ma";
  const gisterenIdx = vandaagIdx > 0 ? vandaagIdx - 1 : 6;
  const gisterenDag = DAGEN[gisterenIdx];

  const dateTxt = `${DAGEN_VOL[vandaagIdx]} ${now.getDate()} ${MAANDEN[now.getMonth()]} ${now.getFullYear()}`;

  // Stats
  const klaarCount = alleTaken.filter(isKlaar).length;
  const klaarMinTot = alleTaken
    .filter(isKlaar)
    .reduce((s, t) => s + taakMin(t), 0);
  const totaalCount = alleTaken.length;
  const totaalMinTot = alleTaken.reduce((s, t) => s + taakMin(t), 0);

  const gepland = alleTaken.filter((t) => !isKlaar(t) && t.geplandOp);
  const geplandCount = gepland.length;
  const geplandMin = gepland.reduce((s, t) => s + taakMin(t), 0);

  const overdue = alleTaken.filter(
    (t) =>
      t.geplandOp && DAGEN.indexOf(t.geplandOp) < vandaagIdx && !isKlaar(t)
  );
  const overdueCount = overdue.length;
  const overdueMin = overdue.reduce((s, t) => s + taakMin(t), 0);

  const ongepland = alleTaken.filter((t) => !t.geplandOp && !isKlaar(t));
  const ongeplandCount = ongepland.length;
  const ongeplandMin = ongepland.reduce((s, t) => s + taakMin(t), 0);

  // Sections
  const gisterenTaken = alleTaken.filter((t) => t.geplandOp === gisterenDag);
  const gisterenKlaarMin = gisterenTaken
    .filter(isKlaar)
    .reduce((s, t) => s + taakMin(t), 0);

  const vandaagTaken = alleTaken.filter((t) => t.geplandOp === vandaagDag);
  const vandaagOpenMin = vandaagTaken
    .filter((t) => !isKlaar(t))
    .reduce((s, t) => s + taakMin(t), 0);

  const restTaken = alleTaken.filter(
    (t) => t.geplandOp && DAGEN.indexOf(t.geplandOp) > vandaagIdx
  );
  const restOpenMin = restTaken
    .filter((t) => !isKlaar(t))
    .reduce((s, t) => s + taakMin(t), 0);

  // Two-line task card: line 1 = code + duur + status badge, line 2 = omschrijving
  function taakRow(t: MergedTaak, isVerleden: boolean) {
    const bc = borderColor(t, isVerleden, vandaagIdx);
    const opacity = isKlaar(t) ? "opacity:0.5;" : "";
    const label = t.code || t.vak?.slice(0, 4).toUpperCase() || "?";
    const effectiveMin = taakMin(t);
    const duur = t.tijd?.type === "rooster" && effectiveMin === 0
      ? "R"
      : effectiveMin > 0
        ? `${effectiveMin}'`
        : "";
    const badge = statusBadge(t, isVerleden, vandaagIdx);
    const strikethrough = isKlaar(t) ? "text-decoration:line-through;text-decoration-color:#10b981;" : "";

    return `<div style="padding:5px 8px 5px 10px;border-left:3px solid ${bc};background:white;margin:2px 0;${opacity}">
      <div style="display:flex;align-items:center;gap:4px;">
        <span style="font-weight:700;font-size:12px;">${escHtml(label)}</span>
        <span style="margin-left:auto;display:flex;align-items:center;gap:4px;">
          <span style="font-size:10px;font-weight:700;color:${CLR.textMuted};">${duur}</span>
          ${badge}
        </span>
      </div>
      <div style="font-size:11px;color:${CLR.textMuted};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;${strikethrough}">${escHtml(t.omschrijving)}</div>
    </div>`;
  }

  // Section with tasks
  function section(
    title: string,
    meta: string,
    taken: MergedTaak[],
    isVerleden: boolean
  ) {
    if (!taken.length) return "";
    const rows = taken.map((t) => taakRow(t, isVerleden)).join("");
    return `<div style="padding:8px 0;border-bottom:1px solid ${CLR.border};">
      <div style="font-size:10px;font-weight:700;color:${CLR.textMuted};text-transform:uppercase;letter-spacing:0.4px;padding:0 0 4px;">
        ${escHtml(title)} <span style="text-transform:none;font-weight:400;letter-spacing:0;">${escHtml(meta)}</span>
      </div>
      ${rows}
    </div>`;
  }

  // Status table (matching dashboard: count · label · minutes right-aligned)
  function statRow(count: number, label: string, min: number, color: string): string {
    return `<tr>
      <td style="font-size:10px;font-weight:700;color:${color};padding:3px 0;width:20px;">${count}</td>
      <td style="font-size:11px;color:${CLR.textMuted};padding:3px 4px;">${escHtml(label)}</td>
      <td align="right" style="font-size:10px;font-weight:600;color:${color};padding:3px 0;">${formatMin(min)}</td>
    </tr>`;
  }

  let statsHtml = `<table cellspacing="0" cellpadding="0" border="0" style="width:100%;">`;
  statsHtml += statRow(klaarCount, "afgewerkt", klaarMinTot, "#059669");
  statsHtml += statRow(geplandCount, "gepland", geplandMin, "#93c5fd");
  if (overdueCount > 0) statsHtml += statRow(overdueCount, "achterstallig", overdueMin, "#ef4444");
  if (ongeplandCount > 0) statsHtml += statRow(ongeplandCount, "niet ingepland", ongeplandMin, "#d97706");
  statsHtml += `<tr><td colspan="3" style="border-top:1px solid ${CLR.border};padding-top:4px;"></td></tr>`;
  statsHtml += statRow(totaalCount, "totaal", totaalMinTot, CLR.textMuted);
  statsHtml += `</table>`;

  // Sections
  const gisterenHtml = section(
    `Gisteren (${DAGEN_VOL[gisterenIdx]})`,
    `\u00b7 ${formatMin(gisterenKlaarMin)} afgewerkt`,
    gisterenTaken,
    true
  );
  const vandaagHtml = section(
    `Vandaag (${DAGEN_VOL[vandaagIdx]})`,
    `\u00b7 ${formatMin(vandaagOpenMin)} gepland`,
    vandaagTaken,
    false
  );
  const restHtml = section(
    `Rest van de week`,
    `\u00b7 ${formatMin(restOpenMin)} gepland`,
    restTaken,
    false
  );

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;margin:0;padding:8px 0;background:${CLR.bg};color:${CLR.text};">
  <div style="max-width:420px;margin:0 auto;">

    <!-- Header -->
    <div style="padding:10px 0 6px;border-bottom:1px solid ${CLR.border};">
      <div style="font-size:10px;color:${CLR.textMuted};">${escHtml(dateTxt)}</div>
      <div style="font-size:14px;font-weight:700;color:${CLR.text};margin-top:2px;">${escHtml(studentName)}</div>
    </div>

    <!-- WeekGrid -->
    ${weekGridHtml ? `<div style="padding:8px 0;border-bottom:1px solid ${CLR.border};">${weekGridHtml}</div>` : ""}

    <!-- Stats -->
    <div style="padding:6px 0;border-bottom:1px solid ${CLR.border};">
      ${statsHtml}
    </div>

    <!-- Sections -->
    ${gisterenHtml}
    ${vandaagHtml}
    ${restHtml}

    <!-- CTA -->
    <div style="padding:14px 0;">
      <a href="${plannerUrl}" style="display:block;text-align:center;background:${CLR.accent};color:white;padding:10px;border-radius:6px;text-decoration:none;font-weight:700;font-size:12px;">Bekijk planning</a>
    </div>

    <!-- Footer -->
    <div style="text-align:center;font-size:9px;color:${CLR.textMuted};padding:0 0 12px;">
      Catplanner \u00b7 ${escHtml(studentName)}'s planning
    </div>
  </div>
</body>
</html>`;
}

function escHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ---- Brevo sender ----

async function sendEmail(
  to: string,
  toName: string,
  subject: string,
  html: string
) {
  const resp = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": brevoApiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      sender: {
        name: "Catplanner",
        email: "koen.pellegrims+catplanner@gmail.com",
      },
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

// ---- Main handler ----

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
      const studentName =
        planner.student_profile?.naam || planner.naam || "Leerling";
      const plannerUrl = `https://catplanner-app.netlify.app/planner/${planner.id}`;

      // Get planner data
      const { data: pData } = await adminClient
        .from("planner_data")
        .select("key, data")
        .eq("planner_id", planner.id)
        .in("key", [
          "weken",
          "voortgang",
          "planning",
          "configuratie",
          "weekRooster",
        ]);

      const findData = (key: string) =>
        pData?.find((d: { key: string; data: unknown }) => d.key === key)
          ?.data;

      const weken = (findData("weken") || []) as Week[];
      const voortgang = (findData("voortgang") || {}) as VoortgangMap;
      const planning = (findData("planning") || {}) as PlanningMap;
      const configuratie = (findData("configuratie") || {}) as Configuratie;
      const weekRooster = (findData("weekRooster") || {}) as WeekRooster;

      if (!weken.length) continue;

      const weekNr = weken[0]?.metadata?.week || "?";
      const taken = buildAlleTaken(weken, voortgang, planning, configuratie);
      if (!taken.length) continue;

      // Get non-student members (ouders/coaches)
      const { data: members } = await adminClient
        .from("planner_members")
        .select("user_id, role")
        .eq("planner_id", planner.id);

      if (!members?.length) continue;

      const memberUserIds = members.map(
        (m: { user_id: string }) => m.user_id
      );

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

      // Generate WeekGrid HTML
      const now = new Date();
      const vandaagIdx = [6, 0, 1, 2, 3, 4, 5][now.getDay()];
      const weekGridHtml = buildWeekGridHtml(taken, weekRooster, vandaagIdx);

      const klaarCount = taken.filter(isKlaar).length;
      const subject = `${studentName}: ${klaarCount}/${taken.length} taken klaar`;
      const html = buildEmailHtml(
        studentName,
        weekNr,
        taken,
        weekGridHtml,
        plannerUrl
      );

      for (const profile of profiles) {
        const email = emailMap.get(profile.user_id);
        if (!email) continue;

        try {
          await sendEmail(
            email,
            profile.display_name || "Ouder",
            subject,
            html
          );
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
