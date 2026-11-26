import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { STARTER_VOCAB, SYSTEM_ARTICLES } from '../src/data/starterData.js';

const prisma = new PrismaClient();

async function main() {
  for (const article of SYSTEM_ARTICLES) {
    await prisma.article.upsert({
      where: { id: article.id },
      update: {
        title: article.title,
        titleZh: article.titleZh,
        category: article.category,
        level: article.level,
        readMinutes: article.readMinutes,
        paragraphs: article.paragraphs,
        keyTerms: article.keyTerms,
      },
      create: {
        id: article.id,
        userId: null,
        title: article.title,
        titleZh: article.titleZh,
        category: article.category,
        level: article.level,
        readMinutes: article.readMinutes,
        paragraphs: article.paragraphs,
        keyTerms: article.keyTerms,
        completed: false,
      },
    });
  }

  for (const vocab of STARTER_VOCAB) {
    const normalizedWord = vocab.word.toLowerCase();
    await prisma.dictionaryCache.upsert({
      where: { word: normalizedWord },
      update: {
        phonetic: vocab.phonetic,
        partOfSpeech: vocab.partOfSpeech,
        definitionEn: vocab.definitionEn,
        meaningZh: vocab.meaningZh,
        example: vocab.example,
      },
      create: {
        word: normalizedWord,
        phonetic: vocab.phonetic,
        partOfSpeech: vocab.partOfSpeech,
        definitionEn: vocab.definitionEn,
        meaningZh: vocab.meaningZh,
        example: vocab.example,
      },
    });
  }

  console.log(
    `Seeded ${SYSTEM_ARTICLES.length} system articles and ${STARTER_VOCAB.length} dictionary entries.`
  );
}

main()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
