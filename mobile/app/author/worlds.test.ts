// The Worlds tab's Samples fold opened by the current world (worlds.tsx): a process of its own, since
// worlds.tsx asks GET /world once (notebook.test.ts: the closed fold, a real world current).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { nodes, words } from '../book/__tests__/combat-book.test.ts'; // also registers the .tsx loader

const { story } = await import('./build/room.tsx');
const { worldRows } = await import('./build/worlds.tsx');

// Break: the current world, a sampler, hidden in the closed Samples fold.
test('the Samples fold opens when the current world is a sampler', async () => {
  const worlds = [
    { name: 'farm', title: 'Farm' },
    { name: 'cellar_sampler', title: 'Cellar' },
  ];
  const api = async (path: string): Promise<[number, any]> =>
    path === '/world'
      ? [200, { current: 'cellar_sampler', worlds }]
      : [200, { map: [], graph: { nodes: [] }, files: {} }];
  story(
    api,
    () => {},
    () => {},
    () => {},
  );
  worldRows();
  await new Promise((r) => setTimeout(r));
  const marked = nodes(worldRows()).filter((n) => n.props?.accessibilityState?.selected);
  assert.deepEqual(marked.map(words), ['Cellar']);
});
