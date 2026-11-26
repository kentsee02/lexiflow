import 'dotenv/config';
import fs from 'node:fs';
import readline from 'node:readline';
import { Readable } from 'node:stream';
import type { ReadableStream as NodeWebReadableStream } from 'node:stream/web';
import { PrismaClient } from '@prisma/client';
import { parseEcdictRow, type EcdictEntryCandidate } from '../src/utils/ecdictParser.js';

const DEFAULT_URL = 'https://raw.githubusercontent.com/skywind3000/ECDICT/master/ecdict.csv';
const DEFAULT_LIMIT = 4500;
const BATCH_SIZE = 500;

function parseArgs(argv: string[]): { limit: number; file?: string; url: string } {
  let limit = DEFAULT_LIMIT;
  let file: string | undefined;
  let url = DEFAULT_URL;

  for (const arg of argv) {
    if (arg.startsWith('--limit=')) {
      const parsed = Number.parseInt(arg.slice(8), 10);
      if (Number.isFinite(parsed) && parsed >= 100 && parsed <= 50000) {
        limit = parsed;
      }
    } else if (arg.startsWith('--file=')) {
      file = arg.slice(7).trim() || undefined;
    } else if (arg.startsWith('--url=')) {
      url = arg.slice(6).trim() || DEFAULT_URL;
    }
  }

  return { limit, file, url };
}

async function openCsvStream(options: { file?: string; url: string }): Promise<NodeJS.ReadableStream> {
  if (options.file) {
    console.log(`Reading local ECDICT CSV: ${options.file}`);
    return fs.createReadStream(options.file, { encoding: 'utf8' });
  }

  console.log(`Streaming ECDICT CSV from ${options.url} ...`);
  const response = await fetch(options.url, { signal: AbortSignal.timeout(120_000) });
  if (!response.ok || !response.body) {
    throw new Error(`Failed to fetch ECDICT CSV (HTTP ${response.status})`);
  }
  return Readable.fromWeb(response.body as unknown as NodeWebReadableStream<Uint8Array>, {
    encoding: 'utf8',
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const prisma = new PrismaClient();

  try {
    const stream = await openCsvStream(args);
    const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

    const byWord = new Map<string, EcdictEntryCandidate>();
    let scannedLines = 0;

    for await (const line of rl) {
      scannedLines += 1;
      const parsed = parseEcdictRow(line);
      if (!parsed) continue;

      const existing = byWord.get(parsed.word);
      if (!existing || parsed.priorityScore > existing.priorityScore) {
        byWord.set(parsed.word, parsed);
      }
    }

    const selected = Array.from(byWord.values())
      .sort((a, b) => b.priorityScore - a.priorityScore || a.word.localeCompare(b.word))
      .slice(0, args.limit);

    console.log(
      `Scanned ${scannedLines} lines -> ${byWord.size} eligible -> importing top ${selected.length} words...`
    );

    let insertedTotal = 0;
    for (let i = 0; i < selected.length; i += BATCH_SIZE) {
      const chunk = selected.slice(i, i + BATCH_SIZE).map((entry) => ({
        word: entry.word,
        phonetic: entry.phonetic,
        audioUrl: '',
        partOfSpeech: entry.partOfSpeech,
        definitionEn: entry.definitionEn,
        meaningZh: entry.meaningZh,
        example: entry.example,
      }));

      const res = await prisma.dictionaryCache.createMany({
        data: chunk,
        skipDuplicates: true,
      });
      insertedTotal += res.count;
    }

    const totalCount = await prisma.dictionaryCache.count();
    console.log(
      `Import complete! Newly inserted: ${insertedTotal} | Total DictionaryCache entries: ${totalCount}`
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('ECDICT import failed:', err);
  process.exitCode = 1;
});
