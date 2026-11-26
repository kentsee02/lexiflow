import fs from 'node:fs';
import path from 'node:path';
import { createSeedData } from '../data/seed.js';

/**
 * Lightweight JSON-file persistence layer.
 * Keeps runtime data outside git (`server/data/store.json`) and seeds automatically on first boot.
 */
export function createStore(dataFile) {
  const resolvedPath = path.resolve(dataFile);
  const parentDir = path.dirname(resolvedPath);

  function ensureInitialized() {
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }
    if (!fs.existsSync(resolvedPath)) {
      const initial = createSeedData();
      writeData(initial);
    }
  }

  function readData() {
    ensureInitialized();
    const raw = fs.readFileSync(resolvedPath, 'utf8');
    return JSON.parse(raw);
  }

  function writeData(data) {
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }
    const tmpPath = `${resolvedPath}.tmp`;
    fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf8');
    fs.renameSync(tmpPath, resolvedPath);
  }

  function update(mutator) {
    const current = readData();
    const next = mutator(current) || current;
    writeData(next);
    return next;
  }

  return {
    filePath: resolvedPath,
    readData,
    writeData,
    update,
  };
}
