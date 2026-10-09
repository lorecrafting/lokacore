// E5 (storybook-plan-2026-10-08.md): the committed page-story views and live-story saves are what
// `npm run stories:views` writes now; a route, presenter or rule change that alters one fails here.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { scenarios } from './stories/scenarios.ts';

test('stories/views and stories/live are fresh (run npm run stories:views)', () => {
  const dir = new URL('stories/', import.meta.url);
  const committed = Object.fromEntries(
    ['views/', 'live/'].flatMap((d) =>
      readdirSync(new URL(d, dir))
        .filter((f) => /\.(json|sql)$/.test(f))
        .map((f) => [d + f, readFileSync(new URL(d + f, dir), 'utf8')]),
    ),
  );
  const fresh = scenarios();
  assert.deepEqual(Object.keys(committed).sort(), Object.keys(fresh).sort());
  for (const path of Object.keys(fresh))
    assert.ok(committed[path] === fresh[path], `${path} is stale`);
});

// Breaks: a story-level `globals: { palette }` locks the toolbar, so that story shows one palette only.
test('no story locks the palette toolbar', () => {
  const dir = new URL('stories/', import.meta.url);
  for (const f of readdirSync(dir).filter((f) => f.endsWith('.tsx')))
    assert.doesNotMatch(readFileSync(new URL(f, dir), 'utf8'), /globals:\s*\{\s*palette/, f);
});
