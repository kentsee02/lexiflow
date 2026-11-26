import { Router } from 'express';
import { dictionaryRateLimiter } from '../middleware/rateLimit.js';
import { lookupWord, normalizeLookupWord } from '../services/dictionary.js';

export const dictionaryRouter = Router();

dictionaryRouter.get('/:word', dictionaryRateLimiter, async (req, res, next) => {
  try {
    const rawWord = Array.isArray(req.params.word) ? req.params.word[0] : req.params.word;
    const normalized = normalizeLookupWord(rawWord ?? '');
    if (!normalized) {
      res.status(400).json({ error: 'Invalid word parameter.' });
      return;
    }

    const result = await lookupWord(normalized);
    res.json(result);
  } catch (err) {
    next(err);
  }
});
