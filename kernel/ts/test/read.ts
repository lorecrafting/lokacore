// Reads a repository JSON file with JSON.parse, so expected values never pass through the
// code under test. `path` is relative to the repository root.
import { readFileSync } from 'node:fs';

export const read = (path: string) =>
  JSON.parse(readFileSync(new URL(`../../../${path}`, import.meta.url), 'utf8'));
