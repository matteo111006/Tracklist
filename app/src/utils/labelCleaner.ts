/**
 * Utility to sanitize and format music record labels concisely.
 * Strips legal boilerplate, copyright notices, corporate suffixes,
 * and normalizes major music groups and imprints into clean, short display names.
 *
 * Example:
 * "An Epic release (P) 2026 Sony Music Entertainment Italy S.p.A." -> "Sony Music"
 * "℗ 2024 Universal Music Italia Srl" -> "Universal Music"
 * "Warner Music Italy a Warner Music Group company" -> "Warner Music"
 * "DND ENTERTAINMENT SRL" -> "DND"
 */

export function cleanRecordLabel(raw?: string | null): string {
  if (!raw || typeof raw !== 'string') return 'Indipendente';

  const trimmed = raw.trim();
  if (!trimmed) return 'Indipendente';

  const lower = trimmed.toLowerCase();

  // 1. Direct match for major distributors / parent groups
  if (lower.includes('sony music') || lower.includes('sony bmg') || lower === 'sony') {
    return 'Sony Music';
  }
  if (
    lower.includes('universal music') ||
    lower.includes('universal-island') ||
    lower.includes('universal international') ||
    lower === 'universal'
  ) {
    return 'Universal Music';
  }
  if (
    lower.includes('warner music') ||
    lower.includes('warner bros') ||
    lower.includes('warner records') ||
    lower.includes('warner music group') ||
    lower === 'warner'
  ) {
    return 'Warner Music';
  }

  // 2. Well-known imprints & prominent Italian / International labels
  if (lower.includes('milano ovest')) return 'Milano Ovest';
  if (lower.includes('sto records') || lower.includes('sto record')) return 'Sto Records';
  if (lower.includes('machete')) return 'Machete';
  if (lower.includes('dogo gang')) return 'Dogo Gang';
  if (lower.includes('tanta roba')) return 'Tanta Roba';
  if (lower.includes('thaurus')) return 'Thaurus';
  if (lower.includes('undamento')) return 'Undamento';
  if (lower.includes('bomba dischi')) return 'Bomba Dischi';
  if (lower.includes('maciste dischi') || lower.includes('maciste')) return 'Maciste Dischi';
  if (lower.includes('carosello')) return 'Carosello Records';
  if (lower.includes('sugar')) return 'Sugar Music';
  if (lower.includes('columbia')) return 'Columbia';
  if (lower.includes('epic')) return 'Epic';
  if (lower.includes('island')) return 'Island Records';
  if (lower.includes('def jam')) return 'Def Jam';
  if (lower.includes('virgin')) return 'Virgin Music';
  if (lower.includes('atlantic')) return 'Atlantic Records';
  if (lower.includes('republic')) return 'Republic Records';
  if (lower.includes('interscope')) return 'Interscope';
  if (lower.includes('rca')) return 'RCA Records';
  if (lower.includes('geffen')) return 'Geffen Records';
  if (lower.includes('motown')) return 'Motown';
  if (lower.includes('capitol')) return 'Capitol Records';
  if (lower.includes('polydor')) return 'Polydor';
  if (lower.includes('bmg')) return 'BMG';
  if (lower.includes('altafonte')) return 'Altafonte';
  if (lower.includes('believe')) return 'Believe Music';
  if (lower.includes('asap worldwide') || lower.includes('a$ap worldwide')) return 'A$AP Worldwide';
  if (
    lower.includes('indipendente') ||
    lower.includes('spotify release') ||
    lower === 'release' ||
    lower === 'indie'
  ) {
    return 'Indipendente';
  }

  // 3. General cleaning for any other custom or independent label
  let cleaned = trimmed;

  // Remove copyright symbols: ℗, ©, (P), (C), (p), (c)
  cleaned = cleaned.replace(/[℗©]/g, ' ');
  cleaned = cleaned.replace(/\([pPcC]\)/g, ' ');

  // Remove standard boilerplate phrases
  cleaned = cleaned.replace(/\b(?:an?|the)\s+[\w\s-]+\s+release\b/gi, ' ');
  cleaned = cleaned.replace(/\bunder exclusive licen[sc]e to\b/gi, ' ');
  cleaned = cleaned.replace(/\bunder licen[sc]e to\b/gi, ' ');
  cleaned = cleaned.replace(/\ba division of\b/gi, ' ');
  cleaned = cleaned.replace(/\bdistributed by\b/gi, ' ');
  cleaned = cleaned.replace(/\bdistribuzione\b/gi, ' ');
  cleaned = cleaned.replace(/\bin licenza\b/gi, ' ');
  cleaned = cleaned.replace(/\besclusiva\b/gi, ' ');

  // Remove years (4 digits)
  cleaned = cleaned.replace(/\b(19\d\d|20\d\d)\b/g, ' ');

  // Remove corporate entity suffixes
  cleaned = cleaned.replace(/\bS\.?p\.?A\.?\b/gi, ' ');
  cleaned = cleaned.replace(/\bS\.?r\.?l\.?\b/gi, ' ');
  cleaned = cleaned.replace(/\bL\.?L\.?C\.?\b/gi, ' ');
  cleaned = cleaned.replace(/\bInc\.?\b/gi, ' ');
  cleaned = cleaned.replace(/\bLtd\.?\b/gi, ' ');
  cleaned = cleaned.replace(/\bGmbH\b/gi, ' ');
  cleaned = cleaned.replace(/\bEntertainment\b/gi, ' ');
  cleaned = cleaned.replace(/\bCompany\b/gi, ' ');
  cleaned = cleaned.replace(/\bCorp(?:oration)?\.?\b/gi, ' ');

  // Remove territorial/country names
  cleaned = cleaned.replace(/\b(?:Italy|Italia|Italiana|Italian|UK|US|USA)\b/gi, ' ');

  // Clean remaining punctuation & extra spaces
  cleaned = cleaned.replace(/^[,\s;:\-\/\\|]+|[,\s;:\-\/\\|]+$/g, '');
  cleaned = cleaned.replace(/\s{2,}/g, ' ').trim();

  // If after cleaning we only have empty or short noise, fallback
  if (!cleaned || cleaned.length < 2) {
    return 'Indipendente';
  }

  return cleaned;
}
