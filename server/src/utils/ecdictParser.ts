/**
 * Parser & selector for skywind3000/ECDICT CSV rows (MIT License).
 * Columns: word,phonetic,definition,translation,pos,collins,oxford,tag,bnc,frq,exchange,detail,audio
 */

export interface EcdictEntryCandidate {
  word: string;
  phonetic: string;
  partOfSpeech: string;
  definitionEn: string;
  meaningZh: string;
  example: string;
  priorityScore: number;
}

const CLEAN_WORD_RE = /^[a-z][a-z'-]{1,24}$/;
const EXAM_TAG_RE = /\b(cet4|cet6|ielts|toefl|gk|ky)\b/i;

export function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      fields.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  fields.push(current);
  return fields;
}

function cleanMultilineText(raw: string, separator: string, maxLen: number): string {
  const normalized = raw
    .replace(/\\n/g, '\n')
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean)
    .join(separator);

  if (normalized.length <= maxLen) return normalized;
  return `${normalized.slice(0, maxLen - 1).trimEnd()}…`;
}

function formatPhonetic(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  if ((trimmed.startsWith('/') && trimmed.endsWith('/')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
    return trimmed;
  }
  return `/${trimmed}/`;
}

function extractShortPos(posRaw: string, meaningZh: string): string {
  const trimmed = posRaw.trim();
  if (trimmed) {
    const first = trimmed.split('/')[0]?.split(':')[0]?.trim();
    if (first && first.length <= 16) return first;
  }

  const zhMatch = meaningZh.match(/^([a-z]{1,6}\.)/i);
  if (zhMatch?.[1]) {
    return zhMatch[1].toLowerCase();
  }
  return 'word';
}

function parsePositiveInt(raw: string | undefined): number {
  if (!raw) return 0;
  const num = Number.parseInt(raw.trim(), 10);
  return Number.isFinite(num) && num > 0 ? num : 0;
}

export function parseEcdictRow(line: string): EcdictEntryCandidate | null {
  if (!line || !line.trim()) return null;
  const cols = parseCsvLine(line);
  if (cols.length < 10) return null;

  const rawWord = (cols[0] ?? '').trim();
  if (!CLEAN_WORD_RE.test(rawWord)) {
    return null;
  }
  if (rawWord === 'word') return null;

  const phonetic = formatPhonetic(cols[1] ?? '');
  const definitionEn = cleanMultilineText(cols[2] ?? '', '; ', 280);
  const meaningZh = cleanMultilineText(cols[3] ?? '', '；', 220);

  if (!phonetic || !meaningZh) {
    return null;
  }

  const collins = parsePositiveInt(cols[5]);
  const oxford = (cols[6] ?? '').trim() === '1';
  const tag = (cols[7] ?? '').trim();
  const bnc = parsePositiveInt(cols[8]);
  const frq = parsePositiveInt(cols[9]);

  const isFrequentExamWord =
    EXAM_TAG_RE.test(tag) && ((bnc > 0 && bnc <= 6500) || (frq > 0 && frq <= 6500));

  if (!oxford && collins < 3 && !isFrequentExamWord) {
    return null;
  }

  // Higher score = higher priority when selecting top N high-frequency entries
  const bestRank =
    frq > 0 && bnc > 0 ? Math.min(frq, bnc) : frq > 0 ? frq : bnc > 0 ? bnc : 20000;
  const rankBonus = Math.max(0, 15000 - bestRank);
  const priorityScore =
    (oxford ? 50000 : 0) +
    collins * 6000 +
    (EXAM_TAG_RE.test(tag) ? 4000 : 0) +
    rankBonus;

  return {
    word: rawWord,
    phonetic,
    partOfSpeech: extractShortPos(cols[4] ?? '', meaningZh),
    definitionEn,
    meaningZh,
    example: '',
    priorityScore,
  };
}
