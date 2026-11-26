export type ReviewQuality = 1 | 2 | 3 | 4;

export interface SrsCardState {
  status: string;
  easeFactor: number;
  intervalDays: number;
  repetitions: number;
}

export interface SrsCalculationResult {
  status: 'new' | 'learning' | 'mastered';
  easeFactor: number;
  intervalDays: number;
  repetitions: number;
  nextReviewAt: Date;
  lastReviewedAt: Date;
}

const MIN_EASE_FACTOR = 1.3;
const MASTERED_INTERVAL_THRESHOLD = 21;

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function addDays(base: Date, days: number): Date {
  return new Date(base.getTime() + days * 86_400_000);
}

/**
 * Pure SM-2 spaced repetition calculation.
 * Qualities: 1=Again, 2=Hard, 3=Good, 4=Easy.
 */
export function calculateSm2Review(
  card: SrsCardState,
  quality: ReviewQuality,
  now: Date = new Date()
): SrsCalculationResult {
  const currentEf = Math.max(MIN_EASE_FACTOR, card.easeFactor || 2.5);
  const currentInterval = Math.max(0, card.intervalDays || 0);
  const currentReps = Math.max(0, card.repetitions || 0);

  if (quality === 1) {
    return {
      status: 'learning',
      easeFactor: Math.max(MIN_EASE_FACTOR, round2(currentEf - 0.2)),
      intervalDays: 0,
      repetitions: 0,
      nextReviewAt: new Date(now.getTime() + 10 * 60_000),
      lastReviewedAt: now,
    };
  }

  let nextEf = currentEf;
  let nextInterval = 1;

  if (quality === 2) {
    nextEf = Math.max(MIN_EASE_FACTOR, round2(currentEf - 0.15));
    nextInterval = currentReps === 0 ? 1 : Math.max(1, Math.round(currentInterval * 1.2));
  } else if (quality === 3) {
    nextEf = Math.max(MIN_EASE_FACTOR, round2(currentEf));
    if (currentReps === 0) {
      nextInterval = 1;
    } else if (currentReps === 1) {
      nextInterval = 6;
    } else {
      nextInterval = Math.max(1, Math.round(currentInterval * nextEf));
    }
  } else {
    nextEf = Math.max(MIN_EASE_FACTOR, round2(currentEf + 0.15));
    if (currentReps === 0) {
      nextInterval = 4;
    } else if (currentReps === 1) {
      nextInterval = 10;
    } else {
      nextInterval = Math.max(1, Math.round(currentInterval * nextEf * 1.3));
    }
  }

  const nextReps = currentReps + 1;
  const status = nextInterval >= MASTERED_INTERVAL_THRESHOLD ? 'mastered' : 'learning';

  return {
    status,
    easeFactor: nextEf,
    intervalDays: nextInterval,
    repetitions: nextReps,
    nextReviewAt: addDays(now, nextInterval),
    lastReviewedAt: now,
  };
}

function formatIntervalLabel(days: number): string {
  if (days <= 0) return '10m';
  if (days < 30) return `${days}d`;
  const months = Math.round((days / 30) * 10) / 10;
  return `${months}mo`;
}

export function previewReviewIntervals(card: SrsCardState): Record<ReviewQuality, string> {
  const now = new Date();
  return {
    1: formatIntervalLabel(calculateSm2Review(card, 1, now).intervalDays),
    2: formatIntervalLabel(calculateSm2Review(card, 2, now).intervalDays),
    3: formatIntervalLabel(calculateSm2Review(card, 3, now).intervalDays),
    4: formatIntervalLabel(calculateSm2Review(card, 4, now).intervalDays),
  };
}
