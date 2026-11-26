import { prisma } from '../db/prisma.js';

export interface DictionaryLookupResult {
  word: string;
  phonetic: string;
  audioUrl: string;
  partOfSpeech: string;
  definitionEn: string;
  meaningZh: string;
  example: string;
  found: boolean;
  source: 'cache' | 'external' | 'fallback';
}

interface FreeDictApiEntry {
  word?: string;
  phonetic?: string;
  phonetics?: Array<{ text?: string; audio?: string }>;
  meanings?: Array<{
    partOfSpeech?: string;
    definitions?: Array<{
      definition?: string;
      example?: string;
    }>;
  }>;
}

export function normalizeLookupWord(raw: string): string | null {
  const cleaned = raw
    .trim()
    .toLowerCase()
    .replace(/^[^a-z]+|[^a-z]+$/g, '');

  if (!cleaned || !/^[a-z][a-z'-]{0,48}$/.test(cleaned)) {
    return null;
  }
  return cleaned;
}

function pickBestAudio(phonetics: Array<{ audio?: string }> | undefined): string {
  if (!phonetics || phonetics.length === 0) return '';
  const urls = phonetics
    .map((p) => (typeof p.audio === 'string' ? p.audio.trim() : ''))
    .filter(Boolean);
  if (urls.length === 0) return '';
  return (
    urls.find((u) => u.includes('-us.mp3')) ??
    urls.find((u) => u.includes('-uk.mp3')) ??
    urls[0]
  );
}

function pickBestPhonetic(entry: FreeDictApiEntry): string {
  if (typeof entry.phonetic === 'string' && entry.phonetic.trim()) {
    return entry.phonetic.trim();
  }
  const found = entry.phonetics?.find((p) => typeof p.text === 'string' && p.text.trim());
  return found?.text?.trim() ?? '';
}

export async function lookupWord(
  rawWord: string,
  options: { fetchImpl?: typeof fetch } = {}
): Promise<DictionaryLookupResult> {
  const word = normalizeLookupWord(rawWord);
  if (!word) {
    throw new Error('INVALID_WORD');
  }

  const cached = await prisma.dictionaryCache.findUnique({ where: { word } });
  if (cached && (cached.definitionEn || cached.meaningZh)) {
    return {
      word: cached.word,
      phonetic: cached.phonetic,
      audioUrl: cached.audioUrl,
      partOfSpeech: cached.partOfSpeech,
      definitionEn: cached.definitionEn,
      meaningZh: cached.meaningZh,
      example: cached.example,
      found: true,
      source: 'cache',
    };
  }

  const fetchFn = options.fetchImpl ?? fetch;

  try {
    const response = await fetchFn(
      `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`,
      { signal: AbortSignal.timeout(4500) }
    );

    if (!response.ok) {
      return {
        word,
        phonetic: cached?.phonetic ?? '',
        audioUrl: cached?.audioUrl ?? '',
        partOfSpeech: cached?.partOfSpeech ?? '',
        definitionEn: cached?.definitionEn ?? '',
        meaningZh: cached?.meaningZh ?? '',
        example: cached?.example ?? '',
        found: false,
        source: 'fallback',
      };
    }

    const payload = (await response.json()) as FreeDictApiEntry[];
    const entry = Array.isArray(payload) ? payload[0] : undefined;
    if (!entry) {
      return {
        word,
        phonetic: '',
        audioUrl: '',
        partOfSpeech: '',
        definitionEn: '',
        meaningZh: cached?.meaningZh ?? '',
        example: '',
        found: false,
        source: 'fallback',
      };
    }

    const phonetic = pickBestPhonetic(entry);
    const audioUrl = pickBestAudio(entry.phonetics);
    const primaryMeaning = entry.meanings?.[0];
    const partOfSpeech = primaryMeaning?.partOfSpeech?.trim() ?? '';
    const primaryDef = primaryMeaning?.definitions?.[0];
    const definitionEn = primaryDef?.definition?.trim() ?? '';
    const example =
      primaryMeaning?.definitions?.find((d) => typeof d.example === 'string' && d.example.trim())
        ?.example?.trim() ?? '';

    const saved = await prisma.dictionaryCache.upsert({
      where: { word },
      update: {
        phonetic,
        audioUrl,
        partOfSpeech,
        definitionEn,
        example,
      },
      create: {
        word,
        phonetic,
        audioUrl,
        partOfSpeech,
        definitionEn,
        meaningZh: cached?.meaningZh ?? '',
        example,
      },
    });

    return {
      word: saved.word,
      phonetic: saved.phonetic,
      audioUrl: saved.audioUrl,
      partOfSpeech: saved.partOfSpeech,
      definitionEn: saved.definitionEn,
      meaningZh: saved.meaningZh,
      example: saved.example,
      found: true,
      source: 'external',
    };
  } catch {
    return {
      word,
      phonetic: cached?.phonetic ?? '',
      audioUrl: cached?.audioUrl ?? '',
      partOfSpeech: cached?.partOfSpeech ?? '',
      definitionEn: cached?.definitionEn ?? '',
      meaningZh: cached?.meaningZh ?? '',
      example: cached?.example ?? '',
      found: false,
      source: 'fallback',
    };
  }
}
