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
        currentVak = null;
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
  if (/^PROJECT/i.test(cleaned)) return { type: 'hoofdgroep', naam: 'PROJECT' };

  return { type: 'vak', naam: cleaned };
}

export function filterVoorDaan(parsed) {
  const { metadata, sections } = parsed;
  const filtered = [];
  const verworpen = [];

  for (const section of sections) {
    const secFiltered = [];
    const secVerworpen = [];

    for (const taak of section.taken) {
      const reden = getFilterReden(taak);
      if (reden) {
        secVerworpen.push({ ...taak, hoofdgroep: section.hoofdgroep, vak: section.vak, filterReden: reden });
      } else {
        // Resolve route-specific times
        if (taak.tijd && taak.tijd.type === 'minuten_per_route') {
          taak.tijd = { type: 'minuten', minuten: taak.tijd.Z };
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

function getFilterReden(taak) {
  if (!taak.richting) return 'Geen richting opgegeven';

  const r = taak.richting.toUpperCase().replace(/\s/g, '');

  if (r === 'B-ROUTE') return `B-route (richting: ${taak.richting})`;

  const relevant =
    r === 'WW' || r.includes('WW') || r === '6U' || r === '8U' ||
    r === 'Z-ROUTE' || r === 'B+Z';

  if (!relevant) {
    const labels = {
      'HW': 'Humane Wetenschappen',
      'MT': 'Moderne Talen',
      'MT-HW': 'MT/HW (niet WW)',
      '3+4U': 'Wiskunde 3-4u (Daan doet 8u)',
      'MT+OPTIE': 'MT + optie',
    };
    const label = labels[r] || taak.richting;
    return `Andere richting: ${label}`;
  }

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
