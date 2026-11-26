import { prisma } from '../db/prisma.js';

export interface HeatmapCell {
  date: string;
  count: number;
  level: 0 | 1 | 2 | 3 | 4;
}

export interface DashboardPayload {
  dailyGoal: number;
  todayReviewed: number;
  streakDays: number;
  vocabBreakdown: {
    total: number;
    newCount: number;
    learning: number;
    mastered: number;
    dueCount: number;
  };
  articles: {
    completed: number;
    total: number;
  };
  quiz: {
    totalTaken: number;
    bestScore: number;
  };
  heatmap: HeatmapCell[];
  recentActivity: Array<{
    id: string;
    actionType: string;
    quality: number | null;
    score: number | null;
    total: number | null;
    word: string | null;
    createdAt: Date;
  }>;
}

export function formatUtcDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function scoreLevel(count: number): 0 | 1 | 2 | 3 | 4 {
  if (count <= 0) return 0;
  if (count <= 2) return 1;
  if (count <= 5) return 2;
  if (count <= 10) return 3;
  return 4;
}

export function buildHeatmap(logDates: Date[], days = 90, now: Date = new Date()): HeatmapCell[] {
  const counts = new Map<string, number>();
  for (const d of logDates) {
    const key = formatUtcDate(d);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const todayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const cells: HeatmapCell[] = [];

  for (let i = days - 1; i >= 0; i -= 1) {
    const day = new Date(todayUtc.getTime() - i * 86_400_000);
    const key = formatUtcDate(day);
    const count = counts.get(key) ?? 0;
    cells.push({
      date: key,
      count,
      level: scoreLevel(count),
    });
  }

  return cells;
}

export function computeStreakDays(logDates: Date[], now: Date = new Date()): number {
  if (logDates.length === 0) return 0;

  const activeDays = new Set(logDates.map(formatUtcDate));
  const todayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const todayKey = formatUtcDate(todayUtc);

  let cursor = todayUtc;
  if (!activeDays.has(todayKey)) {
    const yesterday = new Date(todayUtc.getTime() - 86_400_000);
    if (!activeDays.has(formatUtcDate(yesterday))) {
      return 0;
    }
    cursor = yesterday;
  }

  let streak = 0;
  while (activeDays.has(formatUtcDate(cursor))) {
    streak += 1;
    cursor = new Date(cursor.getTime() - 86_400_000);
  }

  return streak;
}

export async function getUserDashboard(userId: string): Promise<DashboardPayload> {
  const now = new Date();
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 86_400_000);
  const todayKey = formatUtcDate(now);

  const [user, cards, totalArticles, completedArticles, recentLogs, heatmapLogs, quizLogs] =
    await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: { dailyGoal: true },
      }),
      prisma.vocabCard.findMany({
        where: { userId },
        select: { status: true, nextReviewAt: true },
      }),
      prisma.article.count({
        where: { OR: [{ userId: null }, { userId }] },
      }),
      prisma.userArticleCompletion.count({
        where: {
          userId,
          article: { OR: [{ userId: null }, { userId }] },
        },
      }),
      prisma.reviewLog.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: {
          card: { select: { word: true } },
        },
      }),
      prisma.reviewLog.findMany({
        where: { userId, createdAt: { gte: ninetyDaysAgo } },
        select: { createdAt: true },
      }),
      prisma.reviewLog.findMany({
        where: { userId, actionType: 'quiz' },
        select: { score: true, total: true },
      }),
    ]);

  let newCount = 0;
  let learning = 0;
  let mastered = 0;
  let dueCount = 0;

  for (const card of cards) {
    if (card.status === 'mastered') mastered += 1;
    else if (card.status === 'learning') learning += 1;
    else newCount += 1;

    if (card.nextReviewAt <= now) {
      dueCount += 1;
    }
  }

  const logDates = heatmapLogs.map((l) => l.createdAt);
  const heatmap = buildHeatmap(logDates, 90, now);
  const todayReviewed = heatmap.find((c) => c.date === todayKey)?.count ?? 0;
  const streakDays = computeStreakDays(logDates, now);

  let bestScore = 0;
  for (const q of quizLogs) {
    if (q.score !== null && q.total && q.total > 0) {
      const pct = Math.round((q.score / q.total) * 100);
      if (pct > bestScore) bestScore = pct;
    }
  }

  return {
    dailyGoal: user?.dailyGoal ?? 20,
    todayReviewed,
    streakDays,
    vocabBreakdown: {
      total: cards.length,
      newCount,
      learning,
      mastered,
      dueCount,
    },
    articles: {
      completed: completedArticles,
      total: totalArticles,
    },
    quiz: {
      totalTaken: quizLogs.length,
      bestScore,
    },
    heatmap,
    recentActivity: recentLogs.map((log) => ({
      id: log.id,
      actionType: log.actionType,
      quality: log.quality,
      score: log.score,
      total: log.total,
      word: log.card?.word ?? null,
      createdAt: log.createdAt,
    })),
  };
}
