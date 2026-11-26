import type { HeatmapCell, ReviewQuality, VocabStatus } from '../types';

export interface SrsStateInput {
  status: VocabStatus;
  easeFactor: number;
  intervalDays: number;
  repetitions: number;
}

export interface SrsResult {
  status: VocabStatus;
  easeFactor: number;
  intervalDays: number;
  repetitions: number;
  nextReviewAt: string;
  lastReviewedAt: string;
}

const MIN_EASE_FACTOR = 1.3;
const MASTERED_INTERVAL_THRESHOLD = 21;

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function addDays(base: Date, days: number): Date {
  return new Date(base.getTime() + days * 86_400_000);
}

export function calculateSm2Review(
  card: SrsStateInput,
  quality: ReviewQuality,
  now: Date = new Date()
): SrsResult {
  const currentEf = Math.max(MIN_EASE_FACTOR, card.easeFactor || 2.5);
  const currentInterval = Math.max(0, card.intervalDays || 0);
  const currentReps = Math.max(0, card.repetitions || 0);

  if (quality === 1) {
    return {
      status: 'learning',
      easeFactor: Math.max(MIN_EASE_FACTOR, round2(currentEf - 0.2)),
      intervalDays: 0,
      repetitions: 0,
      nextReviewAt: new Date(now.getTime() + 10 * 60_000).toISOString(),
      lastReviewedAt: now.toISOString(),
    };
  }

  let nextEf = currentEf;
  let nextInterval = 1;

  if (quality === 2) {
    nextEf = Math.max(MIN_EASE_FACTOR, round2(currentEf - 0.15));
    nextInterval = currentReps === 0 ? 1 : Math.max(1, Math.round(currentInterval * 1.2));
  } else if (quality === 3) {
    nextEf = Math.max(MIN_EASE_FACTOR, round2(currentEf));
    if (currentReps === 0) nextInterval = 1;
    else if (currentReps === 1) nextInterval = 6;
    else nextInterval = Math.max(1, Math.round(currentInterval * nextEf));
  } else {
    nextEf = Math.max(MIN_EASE_FACTOR, round2(currentEf + 0.15));
    if (currentReps === 0) nextInterval = 4;
    else if (currentReps === 1) nextInterval = 10;
    else nextInterval = Math.max(1, Math.round(currentInterval * nextEf * 1.3));
  }

  const nextReps = currentReps + 1;
  const status: VocabStatus = nextInterval >= MASTERED_INTERVAL_THRESHOLD ? 'mastered' : 'learning';

  return {
    status,
    easeFactor: nextEf,
    intervalDays: nextInterval,
    repetitions: nextReps,
    nextReviewAt: addDays(now, nextInterval).toISOString(),
    lastReviewedAt: now.toISOString(),
  };
}

function formatIntervalLabel(days: number): string {
  if (days <= 0) return '10m';
  if (days < 30) return `${days}d`;
  const months = Math.round((days / 30) * 10) / 10;
  return `${months}mo`;
}

export function previewReviewIntervals(card: SrsStateInput): Record<ReviewQuality, string> {
  const now = new Date();
  return {
    1: formatIntervalLabel(calculateSm2Review(card, 1, now).intervalDays),
    2: formatIntervalLabel(calculateSm2Review(card, 2, now).intervalDays),
    3: formatIntervalLabel(calculateSm2Review(card, 3, now).intervalDays),
    4: formatIntervalLabel(calculateSm2Review(card, 4, now).intervalDays),
  };
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
    cells.push({ date: key, count, level: scoreLevel(count) });
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
    if (!activeDays.has(formatUtcDate(yesterday))) return 0;
    cursor = yesterday;
  }

  let streak = 0;
  while (activeDays.has(formatUtcDate(cursor))) {
    streak += 1;
    cursor = new Date(cursor.getTime() - 86_400_000);
  }
  return streak;
}
