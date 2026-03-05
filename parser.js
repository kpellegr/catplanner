/**
 * Studiewijzer Markdown Parser
 *
 * Parses the weekly studiewijzer markdown files (e.g. P3W3.md, P3W4.md)
 * into structured JSON data, with optional filtering for a specific
 * richting (e.g. WW) and route (e.g. Z).
 */

function parseStudiewijzer(markdownContent) {
  const lines = markdownContent.split('\n');

  // Extract metadata from the first lines
  const metadata = extractMetadata(lines);

  // Parse the main task table
  const { sections, allTaken } = parseMainTable(lines);

  return { metadata, sections, allTaken };
}

function extractMetadata(lines) {
  let titel = '';
  let week = '';
  let periode = '';
  let datumRange = '';

  for (const line of lines.slice(0, 5)) {
    const clean = cleanMarkdown(line).trim();
    if (clean.includes('Studiewijzer')) {
      titel = clean;
    }
    if (/week\s*\d+/i.test(clean)) {
      const weekMatch = clean.match(/week\s*(\d+)/i);
      if (weekMatch) week = parseInt(weekMatch[1]);
      const dateMatch = clean.match(/(\d{2}\/\d{2}\/\d{4})\s*-\s*(\d{2}\/\d{2}\/\d{4})/);
      if (dateMatch) {
        datumRange = { van: dateMatch[1], tot: dateMatch[2] };
      }
    }
    if (/P\d+/.test(clean)) {
      const pMatch = clean.match(/P(\d+)/);
      if (pMatch) periode = parseInt(pMatch[1]);
    }
  }

  return { titel, periode, week, datumRange };
}

function parseMainTable(lines) {
  const sections = [];
  const allTaken = [];

  let inMainTable = false;
  let currentHoofdgroep = null; // e.g. "HUMANE WETENSCHAPPEN", "WETENSCHAPPEN", "TALEN"
  let currentVak = null;        // e.g. "BIOLOGIE", "CHEMIE"
  let currentRichting = null;    // inherited richting for continuation rows
  let currentRouteContext = null; // for Engels B-route/Z-route sections

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (!line.trim().startsWith('|')) continue;

    const cells = splitTableRow(line);
    if (cells.length < 6) continue;

    // Detect main table start
    if (cells[0] && cleanMarkdown(cells[0]).toUpperCase().includes('RICHTING')) {
      inMainTable = true;
      continue;
    }

    if (!inMainTable) continue;

    // Skip separator rows
    if (isSeparatorRow(cells)) continue;

    // Sub-header rows (B/Z, 3u/4u) — but extract wiskunde context
    if (isSubHeaderRow(cells)) {
      if (currentHoofdgroep === 'WISKUNDE') {
        // Extract "3-4 uur" from cells like ['**3-4 uur**', '', '', '', '', '', '**3u**', '**4u**', '', '']
        const label = cleanMarkdown(cells[0] || '').trim();
        if (label && /\d/.test(label)) {
          currentVak = label;
          currentRouteContext = label;
          currentRichting = null;
        }
      }
      continue;
    }

    // Check for section/subsection headers
    const sectionInfo = detectSection(cells);
    if (sectionInfo) {
      if (sectionInfo.type === 'hoofdgroep') {
        currentHoofdgroep = sectionInfo.naam;
        currentVak = null;
        currentRichting = null;
        currentRouteContext = null;
      } else if (sectionInfo.type === 'vak') {
        currentVak = sectionInfo.naam;
        currentRichting = null;
        currentRouteContext = null;
      } else if (sectionInfo.type === 'route') {
        // e.g. "6 uur B- & Z- route" or "3-4 uur"
        // For Wiskunde, use the route context as vak name
        if (currentHoofdgroep === 'WISKUNDE') {
          currentVak = sectionInfo.naam;
        }
        currentRouteContext = sectionInfo.naam;
        currentRichting = null;
      }
      continue;
    }

    // Parse data row
    const taak = parseDataRow(cells, {
      hoofdgroep: currentHoofdgroep,
      vak: currentVak,
      inheritedRichting: currentRichting,
      routeContext: currentRouteContext,
    });

    if (taak) {
      // Update inherited richting if this row specifies one
      if (taak.richting) {
        currentRichting = taak.richting;
      } else {
        taak.richting = currentRichting;
      }

      // Add context
      taak.hoofdgroep = currentHoofdgroep;
      taak.vak = currentVak;

      allTaken.push(taak);

      // Add to sections structure
      let section = sections.find(
        (s) => s.hoofdgroep === currentHoofdgroep && s.vak === currentVak
      );
      if (!section) {
        section = {
          hoofdgroep: currentHoofdgroep,
          vak: currentVak,
          taken: [],
        };
        sections.push(section);
      }
      section.taken.push(taak);
    }
  }

  return { sections, allTaken };
}

function parseDataRow(cells, context) {
  const rawRichting = cleanMarkdown(cells[0] || '').trim();
  const rawVolgorde = cleanMarkdown(cells[3] || '').trim();
  const rawCode = cleanMarkdown(cells[4] || '').trim().replace(/:$/, ''); // remove trailing colon
  const rawOpdracht = cleanMarkdown(cells[5] || '').trim();
  const rawTijd = cleanMarkdown(cells[6] || '').trim();
  const rawTijdAlt = cells[7] ? cleanMarkdown(cells[7]).trim() : '';
  const rawFlags8 = cleanMarkdown(cells[8] || '').trim();
  const rawFlags9 = cleanMarkdown(cells[9] || '').trim();
  const rawFlags = rawFlags8 + rawFlags9;

  // Must have at least an opdracht or a tijd to be a valid row
  if (!rawOpdracht && !rawTijd) return null;

  // Parse richting
  let richting = rawRichting || null;

  // Parse volgorde
  let volgorde = null;
  if (rawVolgorde) {
    const num = parseInt(rawVolgorde);
    volgorde = isNaN(num) ? rawVolgorde : num; // keep 'A', 'B' as strings
  }

  // Parse tijd
  const tijd = parseTijd(rawTijd);
  const tijdAlt = rawTijdAlt ? parseTijd(rawTijdAlt) : null;

  // Parse flags
  const flags = parseFlags(rawFlags);

  return {
    richting,
    volgorde,
    code: rawCode || null,
    omschrijving: rawOpdracht,
    tijd,
    tijdAlt,
    flags,
    routeContext: context.routeContext,
  };
}

function parseTijd(raw) {
  if (!raw) return null;

  const lower = raw.toLowerCase();

  // "rooster" or "rooster (25)" or "50' rooster (STEM/Science@lab)"
  if (lower.includes('rooster')) {
    const minutesMatch = raw.match(/\((\d+)['']?\)/);
    return {
      type: 'rooster',
      minuten: minutesMatch ? parseInt(minutesMatch[1]) : null,
    };
  }

  // "x" means not applicable (e.g. wiskunde 3u column for 4u students)
  if (lower === 'x') return { type: 'nvt' };

  // "r" means rooster (shorthand used in wiskunde)
  if (lower === 'r') return { type: 'rooster', minuten: null };

  // Route-specific times: "B: 150' Z: 100'" (with possible smart quotes)
  const routeMatch = raw.match(/B:\s*(\d+)[''\u2019]?\s*Z:\s*(\d+)/i);
  if (routeMatch) {
    return {
      type: 'minuten_per_route',
      B: parseInt(routeMatch[1]),
      Z: parseInt(routeMatch[2]),
      minuten: null, // resolved during filtering
    };
  }

  // Minutes: "30'", "90'", "25' 25'", "80'", etc.
  // Handle multiple times like "25' 25'"
  const minutesMatches = raw.match(/(\d+)/g);
  if (minutesMatches) {
    const total = minutesMatches.reduce((sum, m) => sum + parseInt(m), 0);
    return { type: 'minuten', minuten: total };
  }

  // Empty or unrecognized
  return null;
}

function parseFlags(raw) {
  if (!raw) return [];
  const validFlags = ['P', 'M', 'U', 'G', 'X'];
  const flags = [];
  for (const f of validFlags) {
    if (raw.toUpperCase().includes(f)) {
      flags.push(f);
    }
  }
  return flags;
}

// ---- Section detection ----

function detectSection(cells) {
  const nonEmpty = cells.filter((c) => c.trim());

  // Only 1-2 non-empty cells, containing bold text
  if (nonEmpty.length === 0) return null;
  if (nonEmpty.length > 2) return null;

  const combined = nonEmpty.join(' ');
  if (!combined.includes('**')) return null;

  const cleaned = cleanMarkdown(combined).trim();
  if (!cleaned) return null;

  // Known hoofdgroepen
  const hoofdgroepen = [
    'HUMANE WETENSCHAPPEN',
    'WETENSCHAPPEN',
    'TALEN',
    'WISKUNDE',
    'ALGEMEEN',
  ];

  // Check if it's a hoofdgroep
  for (const hg of hoofdgroepen) {
    if (cleaned.toUpperCase().startsWith(hg)) {
      return { type: 'hoofdgroep', naam: hg };
    }
  }

  // Check for route context (wiskunde sub-sections like "3-4 uur", "6 uur B- & Z- route", "8 uur")
  if (/^\d[\-+]?\d?\s*uur/i.test(cleaned) || /^[BZ]-route/i.test(cleaned)) {
    return { type: 'route', naam: cleaned };
  }

  // Wiskunde and Project are sometimes listed after TALEN but should be their own hoofdgroep
  if (/^WISKUNDE/i.test(cleaned)) {
    return { type: 'hoofdgroep', naam: 'WISKUNDE' };
  }
  if (/^PROJECT/i.test(cleaned)) {
    return { type: 'hoofdgroep', naam: 'PROJECT' };
  }

  // Wiskunde sub-sections like "3-4 uur", "8 uur - CryptoLogic"
  if (/^\d[\-+]?\d?\s*uur/i.test(cleaned)) {
    return { type: 'route', naam: cleaned };
  }

  // Otherwise it's a vak/subsection
  return { type: 'vak', naam: cleaned };
}

// ---- Filtering ----

/**
 * Filter taken relevant for a specific student profile.
 * For Daan: richting=WW, route=Z
 */
function filterVoorDaan(parsed) {
  const { metadata, sections } = parsed;

  const filtered = [];

  for (const section of sections) {
    const relevanteTaken = section.taken.filter((taak) => {
      // Check richting: must be relevant for WW/Z-route
      if (!taak.richting) return false;
      const r = taak.richting.toUpperCase().replace(/\s/g, '');
      const heeftWW =
        r === 'WW' ||
        r.includes('WW') ||  // MT-HW-WW
        r === '6U' ||         // Wiskunde 6u (included for 8u students)
        r === '8U' ||         // Wiskunde 8u
        r === 'Z-ROUTE' ||    // Z-route tasks (e.g. Engels)
        r === 'B+Z';          // Combined B+Z tasks (e.g. Engels shared)

      if (!heeftWW) return false;

      // Exclude B-route-only tasks
      if (r === 'B-ROUTE') return false;

      // Resolve route-specific times for Z-route
      if (taak.tijd && taak.tijd.type === 'minuten_per_route') {
        taak.tijd = { type: 'minuten', minuten: taak.tijd.Z };
      }

      // Skip nvt (e.g. wiskunde 3u column showing 'x' for non-applicable)
      if (taak.tijd && taak.tijd.type === 'nvt') return false;

      return true;
    });

    if (relevanteTaken.length > 0) {
      filtered.push({
        hoofdgroep: section.hoofdgroep,
        vak: section.vak,
        taken: relevanteTaken,
      });
    }
  }

  return { metadata, sections: filtered };
}

// ---- Utilities ----

function splitTableRow(line) {
  const cells = line.split('|').map((c) => c.trim());
  // Remove empty first/last from pipe splitting
  if (cells.length > 0 && cells[0] === '') cells.shift();
  if (cells.length > 0 && cells[cells.length - 1] === '') cells.pop();
  return cells;
}

function isSeparatorRow(cells) {
  return cells.every((c) => /^[-:]*$/.test(c.trim()));
}

function isSubHeaderRow(cells) {
  const values = cells.filter((c) => c.trim());
  return values.some((c) =>
    ['**B**', '**Z**', '**3u**', '**4u**'].includes(c.trim())
  );
}

function cleanMarkdown(text) {
  return text
    .replace(/\*\*/g, '')      // bold
    .replace(/\*/g, '')        // italic
    .replace(/\\([+\-&.!'"])/g, '$1') // escaped special chars
    .replace(/\\/g, '')        // remaining backslashes
    .replace(/\u201c/g, '"')   // left smart quote
    .replace(/\u201d/g, '"')   // right smart quote
    .trim();
}

// ---- CLI usage ----
if (typeof require !== 'undefined' && require.main === module) {
  const fs = require('fs');
  const path = require('path');

  const args = process.argv.slice(2);
  const file = args[0] || 'P3W4.md';
  const filterDaan = !args.includes('--all');

  const content = fs.readFileSync(path.resolve(file), 'utf8');
  const parsed = parseStudiewijzer(content);

  const result = filterDaan ? filterVoorDaan(parsed) : parsed;

  console.log(JSON.stringify(result, null, 2));
}

// Export for use in Vue.js
if (typeof module !== 'undefined') {
  module.exports = { parseStudiewijzer, filterVoorDaan };
}
