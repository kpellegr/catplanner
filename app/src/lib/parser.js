/**
 * Studiewijzer Markdown Parser (ES Module)
 */

export function parseStudiewijzer(markdownContent) {
  const lines = markdownContent.split('\n');
  const metadata = extractMetadata(lines);
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
    if (clean.includes('Studiewijzer')) titel = clean;
    if (/week\s*\d+/i.test(clean)) {
      const weekMatch = clean.match(/week\s*(\d+)/i);
      if (weekMatch) week = parseInt(weekMatch[1]);
      const dateMatch = clean.match(/(\d{2}\/\d{2}\/\d{4})\s*-\s*(\d{2}\/\d{2}\/\d{4})/);
      if (dateMatch) datumRange = { van: dateMatch[1], tot: dateMatch[2] };
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
  let currentHoofdgroep = null;
  let currentVak = null;
  let currentRichting = null;
  let currentRouteContext = null;
  let taakIndex = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim().startsWith('|')) continue;

    const cells = splitTableRow(line);
    if (cells.length < 6) continue;

    if (cells[0] && cleanMarkdown(cells[0]).toUpperCase().includes('RICHTING')) {
      inMainTable = true;
      continue;
    }
    if (!inMainTable) continue;
    if (isSeparatorRow(cells)) continue;

    if (isSubHeaderRow(cells)) {
      if (currentHoofdgroep === 'WISKUNDE') {
        const label = cleanMarkdown(cells[0] || '').trim();
        if (label && /\d/.test(label)) {
          currentVak = `Wiskunde ${label}`;
          currentRouteContext = label;
          currentRichting = null;
        }
      }
      continue;
    }

    const sectionInfo = detectSection(cells);
    if (sectionInfo) {
      if (sectionInfo.type === 'hoofdgroep') {
        currentHoofdgroep = sectionInfo.naam;
        currentVak = sectionInfo.vak || null;
        currentRichting = null;
        currentRouteContext = null;
      } else if (sectionInfo.type === 'vak') {
        currentVak = sectionInfo.naam;
        currentRichting = null;
        currentRouteContext = null;
      } else if (sectionInfo.type === 'route') {
        if (currentHoofdgroep === 'WISKUNDE') currentVak = `Wiskunde ${sectionInfo.naam}`;
        currentRouteContext = sectionInfo.naam;
        currentRichting = null;
      }
      continue;
    }

    const taak = parseDataRow(cells, { routeContext: currentRouteContext });
    if (taak) {
      if (taak.richting) {
        currentRichting = taak.richting;
      } else {
        taak.richting = currentRichting;
      }
      taak.hoofdgroep = currentHoofdgroep;
      taak.vak = currentVak;
      taak.origIndex = taakIndex++;

      allTaken.push(taak);

      let section = sections.find(
        (s) => s.hoofdgroep === currentHoofdgroep && s.vak === currentVak
      );
      if (!section) {
        section = { hoofdgroep: currentHoofdgroep, vak: currentVak, taken: [] };
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
  const rawCode = cleanMarkdown(cells[4] || '').trim().replace(/:$/, '');
  const rawOpdracht = cleanMarkdown(cells[5] || '').trim();
  const rawTijd = cleanMarkdown(cells[6] || '').trim();
  const rawTijdAlt = cells[7] ? cleanMarkdown(cells[7]).trim() : '';
  const rawFlags = cleanMarkdown(cells[8] || '').trim() + cleanMarkdown(cells[9] || '').trim();

  if (!rawOpdracht && !rawTijd) return null;

  let volgorde = null;
  if (rawVolgorde) {
    const num = parseInt(rawVolgorde);
    volgorde = isNaN(num) ? rawVolgorde : num;
  }

  return {
    richting: rawRichting || null,
    volgorde,
    code: rawCode || null,
    omschrijving: rawOpdracht,
    tijd: parseTijd(rawTijd),
    tijdAlt: rawTijdAlt ? parseTijd(rawTijdAlt) : null,
    flags: parseFlags(rawFlags),
    routeContext: context.routeContext,
  };
}

function parseTijd(raw) {
  if (!raw) return null;
  const lower = raw.toLowerCase();

  if (lower.includes('rooster')) {
    const minutesMatch = raw.match(/\((\d+)['']?\)/);
    return { type: 'rooster', minuten: minutesMatch ? parseInt(minutesMatch[1]) : null };
  }
  if (lower === 'x') return { type: 'nvt' };
  if (lower === 'r') return { type: 'rooster', minuten: null };

  const routeMatch = raw.match(/B:\s*(\d+)[''\u2019]?\s*Z:\s*(\d+)/i);
  if (routeMatch) {
    return { type: 'minuten_per_route', B: parseInt(routeMatch[1]), Z: parseInt(routeMatch[2]), minuten: null };
  }

  const minutesMatches = raw.match(/(\d+)/g);
  if (minutesMatches) {
    return { type: 'minuten', minuten: minutesMatches.reduce((sum, m) => sum + parseInt(m), 0) };
  }
  return null;
}

function parseFlags(raw) {
  if (!raw) return [];
  const validFlags = ['P', 'M', 'U', 'G', 'X'];
  return validFlags.filter((f) => raw.toUpperCase().includes(f));
}

function detectSection(cells) {
  const nonEmpty = cells.filter((c) => c.trim());
  if (nonEmpty.length === 0 || nonEmpty.length > 2) return null;
  const combined = nonEmpty.join(' ');
  if (!combined.includes('**')) return null;
  const cleaned = cleanMarkdown(combined).trim();
  if (!cleaned) return null;

  const hoofdgroepen = ['HUMANE WETENSCHAPPEN', 'WETENSCHAPPEN', 'TALEN', 'WISKUNDE', 'ALGEMEEN'];
  for (const hg of hoofdgroepen) {
    if (cleaned.toUpperCase().startsWith(hg)) return { type: 'hoofdgroep', naam: hg };
  }
  if (/^\d[\-+]?\d?\s*uur/i.test(cleaned) || /^[BZ]-route/i.test(cleaned)) {
    return { type: 'route', naam: cleaned };
  }
  if (/^WISKUNDE/i.test(cleaned)) return { type: 'hoofdgroep', naam: 'WISKUNDE' };
  if (/^PROJECT/i.test(cleaned)) {
    // "PROJECT: KAAS" → hoofdgroep PROJECT with vak "PROJECT: KAAS"
    return { type: 'hoofdgroep', naam: 'PROJECT', vak: cleaned };
  }

  return { type: 'vak', naam: cleaned };
}

/**
 * Filter parsed studiewijzer for a specific student profile.
 * @param {object} parsed - Output of parseStudiewijzer()
 * @param {object} profiel - { richting: 'WW'|'HW'|'MT', route: 'B'|'Z', wiskunde: '3u'|'4u'|'6u'|'8u' }
 * @returns {{ metadata, sections, verworpen }}
 */
export function filterVoorProfiel(parsed, profiel) {
  const { metadata, sections } = parsed;
  const filtered = [];
  const verworpen = [];

  for (const section of sections) {
    const secFiltered = [];
    const secVerworpen = [];

    for (const taak of section.taken) {
      const reden = getFilterRedenProfiel(taak, profiel);
      if (reden) {
        secVerworpen.push({ ...taak, hoofdgroep: section.hoofdgroep, vak: section.vak, filterReden: reden });
      } else {
        // Resolve route-specific times
        if (taak.tijd && taak.tijd.type === 'minuten_per_route') {
          const routeKey = profiel.route?.toUpperCase() || 'Z';
          taak.tijd = { type: 'minuten', minuten: taak.tijd[routeKey] || taak.tijd.Z || taak.tijd.B };
        }
        secFiltered.push(taak);
      }
    }

    if (secFiltered.length > 0) {
      filtered.push({ hoofdgroep: section.hoofdgroep, vak: section.vak, taken: secFiltered });
    }
    verworpen.push(...secVerworpen);
  }

  return { metadata, sections: filtered, verworpen };
}

/** Backwards-compatible wrapper for Daan's hardcoded profile */
export function filterVoorDaan(parsed) {
  return filterVoorProfiel(parsed, { richting: 'WW', route: 'Z', wiskunde: '8u' });
}

function getFilterRedenProfiel(taak, profiel) {
  if (!taak.richting) return null; // geen richting = voor iedereen

  const r = taak.richting.toUpperCase().replace(/\s/g, '');
  const myRichting = (profiel.richting || '').toUpperCase();
  const myRoute = (profiel.route || '').toUpperCase();
  const myWisk = (profiel.wiskunde || '').toUpperCase().replace(/\s/g, '');

  // Route filtering
  if (r === 'B-ROUTE' && myRoute !== 'B') return `B-route (jij volgt ${myRoute}-route)`;
  if (r === 'Z-ROUTE' && myRoute !== 'Z') return `Z-route (jij volgt ${myRoute}-route)`;
  if (r === 'B+Z') return null; // beide routes

  // Richting matching — check if task's richting includes student's richting
  const richtingCombos = r.split(/[-+]/);
  const isRichtingMatch = richtingCombos.some(part => part === myRichting) || r.includes(myRichting);

  // Wiskunde uren matching
  const wiskLabels = ['3U', '4U', '6U', '8U', '3+4U'];
  const isWiskLabel = wiskLabels.some(w => r === w || r === w.replace('+', '+'));
  if (isWiskLabel) {
    // "3+4U" matches both 3u and 4u
    if (r === '3+4U') {
      if (myWisk === '3U' || myWisk === '4U') return null;
      return `Wiskunde ${taak.richting} (jij doet ${profiel.wiskunde})`;
    }
    if (r === myWisk) return null;
    return `Wiskunde ${taak.richting} (jij doet ${profiel.wiskunde})`;
  }

  // "MT+OPTIE" — only for MT students
  if (r === 'MT+OPTIE') {
    if (myRichting === 'MT') return null;
    return `MT + optie (jij volgt ${profiel.richting})`;
  }

  // Standard richting check
  if (!isRichtingMatch) {
    return `Andere richting: ${taak.richting} (jij volgt ${profiel.richting})`;
  }

  // NVT check
  if (taak.tijd && taak.tijd.type === 'nvt') return 'Niet van toepassing (nvt)';

  return null;
}

// ---- Utilities ----

function splitTableRow(line) {
  const cells = line.split('|').map((c) => c.trim());
  if (cells[0] === '') cells.shift();
  if (cells[cells.length - 1] === '') cells.pop();
  return cells;
}

function isSeparatorRow(cells) {
  return cells.every((c) => /^[-:]*$/.test(c.trim()));
}

function isSubHeaderRow(cells) {
  const values = cells.filter((c) => c.trim());
  return values.some((c) => ['**B**', '**Z**', '**3u**', '**4u**'].includes(c.trim()));
}

function cleanMarkdown(text) {
  return text
    .replace(/\*\*/g, '')
    .replace(/\*/g, '')
    .replace(/\\([+\-&.!'"])/g, '$1')
    .replace(/\\/g, '')
    .replace(/\u201c/g, '"')
    .replace(/\u201d/g, '"')
    .trim();
}
