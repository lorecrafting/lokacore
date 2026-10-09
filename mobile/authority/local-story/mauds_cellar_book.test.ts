// Production Maud resolution over a controlled five-credit input; actual combat and
// SQLite reopen are proved separately by authority/mauds_cellar.test.ts.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire, registerHooks } from 'node:module';
import { test } from 'node:test';
import {
  loadCartridge,
  newWorld,
  gameView,
  step,
  INSTALLED,
  type Cartridge,
  type World,
} from '../../../kernel/ts/src/index.ts';
import type { Command, DefinitionRef } from '../../../kernel/ts/src/contracts.gen.ts';
import { key } from '../../../kernel/ts/src/foundation/compose.ts';
import { read } from '../../../kernel/ts/test/read.ts';
import { buttonsOf, group } from '../../app/book/model.ts';

const ts = createRequire(new URL('../../app/package.json', import.meta.url))('typescript');
registerHooks({
  resolve(specifier, context, next) {
    return specifier === 'react-native'
      ? { url: 'test:maud-native-hosts', shortCircuit: true }
      : next(specifier, context);
  },
  load(url, context, next) {
    if (url === 'test:maud-native-hosts')
      return {
        format: 'module',
        shortCircuit: true,
        source:
          "export const Pressable='Pressable',Text='Text',View='View',ScrollView='ScrollView',AccessibilityInfo={};",
      };
    if (!url.endsWith('.tsx')) return next(url, context);
    return {
      format: 'module',
      shortCircuit: true,
      source: ts.transpileModule(readFileSync(new URL(url), 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX },
      }).outputText,
    };
  },
});
const { RoomPage } = await import(new URL('../../app/book/pages.tsx', import.meta.url).href);
const nodes = (element: any): any[] => {
  if (Array.isArray(element)) return element.flatMap(nodes);
  if (!element || typeof element !== 'object') return [];
  if (typeof element.type === 'function') return nodes(element.type(element.props));
  return [element, ...nodes(element.props?.children)];
};
const words = (element: any): string =>
  Array.isArray(element)
    ? element.map(words).join('')
    : typeof element === 'string' || typeof element === 'number'
      ? String(element)
      : words(element?.props?.children ?? []);

// Breaks: resolving the only accepted side quest falsely announces the whole story
// has ended while the unaccepted lantern errand and earned storage are still playable.
test('production Maud completion leaves World free of story-ended claims and storage usable', () => {
  const bundle = read('protocol/fixtures/containers_cartridge_sampler_hash.json');
  const loaded = loadCartridge(
    new TextEncoder().encode(
      JSON.stringify({ cartridge: bundle.value, content_hash: bundle.sha256 }),
    ),
    INSTALLED,
  );
  assert.ok(loaded.ok);
  let w: World = newWorld(
    loaded.cartridge as Cartridge,
    '0d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f' as never,
    [1, 2, 3, 4],
  );
  const ref = (kind: string, name: string) =>
    ({
      cartridge_id: 'ashmere_sampler',
      cartridge_version: '0.0.11',
      kind,
      key: name,
    }) as DefinitionRef;
  w = {
    ...w,
    state: {
      ...w.state,
      containers: {
        ...w.state.containers,
        [w.body]: w.roomIds['ashmere_sampler@0.0.11:room/drowned_lantern'],
      },
      facts: Object.fromEntries(
        [1, 2, 3, 4, 5].map((n) => [
          key({
            kind: 'fact',
            fact: ref('fact', `rat_${n}_killed`),
            scope: { kind: 'player', character_id: w.character },
          }),
          true,
        ]),
      ),
    },
  };
  let n = 0;
  const run = (payload: object) => {
    const result = step(
      w,
      {
        id: `aaaaaaaa-0000-4000-8000-${String(++n).padStart(12, '0')}`,
        world_context_id: w.context,
        payload: { actor_id: w.character, ...payload },
      } as Command,
      n,
    );
    assert.equal(result.decision.kind, 'accepted', JSON.stringify(result.decision));
    w = result.world;
  };
  const maud = 'f14e477f-cecc-897a-bee7-c573aa5c76c3';
  const answer = (choice_id: string) =>
    run({ type: 'choose', choice_id, continuation_id: gameView(w).choice!.continuation_id });
  run({ type: 'talk', target_id: maud });
  answer('accept');
  run({ type: 'talk', target_id: maud });
  answer('done');
  assert.deepEqual(
    gameView(w).journal.map((q) => [q.quest.key, q.state]),
    [['mauds_cellar', 'resolved']],
  );
  const text = (key: string) => w.cartridge.text[key as never];
  const view = gameView(w);
  const tree = RoomPage({
    view,
    text,
    log: [],
    g: group(buttonsOf(view, text, text)),
    press: () => {},
    open: () => {},
    openChoice: () => {},
  });
  assert.equal(
    nodes(tree)
      .filter((n) => n.type === 'Text')
      .map(words)
      .some((s) => /story ends|start over/i.test(s)),
    false,
  );
  run({ type: 'move', direction: 'up' });
  const chest = 'd68b48e6-93a5-8899-81ec-808f7be333f8',
    brass = '58ee172d-aa6f-8023-a3c1-a1d46af6d167';
  run({ type: 'unlock', target_id: chest });
  run({ type: 'open', target_id: chest });
  run({ type: 'take', item_id: brass });
  run({ type: 'put', item_id: brass, container_id: chest });
  assert.equal(w.state.containers[brass], chest);
});
