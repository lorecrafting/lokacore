import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire, registerHooks } from 'node:module';
import { test } from 'node:test';
import { elapsedHost } from '../../authority/local-story/__tests__/elapsed-host.test.ts';
import { group, pagesAfter, restoredItemPages } from './model.ts';
import { presenter } from './presenter.ts';
import { ids, openChestBundle } from '../../authority/local-story/__tests__/priory-fixture.ts';
const ts = createRequire(import.meta.url)('typescript');
registerHooks({
  resolve(s, c, next) {
    return s === 'react-native' ? { url: 'test:d2-native', shortCircuit: true } : next(s, c);
  },
  load(url, c, next) {
    if (url === 'test:d2-native')
      return {
        format: 'module',
        shortCircuit: true,
        source:
          "export const Pressable='Pressable',Text='Text',View='View',ScrollView='ScrollView';",
      };
    if (!url.endsWith('.tsx')) return next(url, c);
    return {
      format: 'module',
      shortCircuit: true,
      source: ts.transpileModule(readFileSync(new URL(url), 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX },
      }).outputText,
    };
  },
});
const { Item } = await import('./Menu.tsx');
function nodes(e: any): any[] {
  if (Array.isArray(e)) return e.flatMap(nodes);
  if (!e || typeof e !== 'object') return [];
  return typeof e.type === 'function' ? nodes(e.type(e.props)) : [e, ...nodes(e.props?.children)];
}

// Break: opening a held child auto-reads, explicit Read loses its exact history, or Back leaves the parent.
test('actual nested book Item opens locally and Read stays between description and options with local Back', (t) => {
  const ward = ids['item/ward_of_the_fen'],
    chest = ids['item/storage_chest'];
  const a = elapsedHost(':memory:', { wall: 10000, mono: 0 }, openChestBundle());
  t.after(() => a.sql.close());
  const p = presenter(a.game);
  a.game.subscribe(p.update);
  for (const label of [
    'Go north',
    'Go north',
    'Go north',
    'Go north',
    'Go north',
    'Go north',
    'Go west',
    'Take The Ward of the Fen',
    'Take a storage chest',
  ])
    p.press(p.screen().buttons.find((b) => b.label === label) ?? assert.fail(label));
  const put = p
    .screen()
    .buttons.find(
      (b) => b.action_key === 'put' && b.target_ids[0] === ward && b.target_ids[1] === chest,
    );
  assert.ok(put);
  p.press(put, ward);
  let stack: any[] = [{ kind: 'carrying' }, { kind: 'thing', id: chest }];
  const draw = (id: string) =>
    nodes(
      Item({
        id,
        screen: p.screen(),
        g: group(p.screen().buttons),
        press: p.press,
        open: (page: any) => stack.push(page),
        world: () => {
          stack = [];
        },
        back: () => stack.pop(),
      }),
    );
  const before = a.sql.prepare('SELECT count(*) AS n FROM receipt').get()!.n;
  draw(chest)
    .find(
      (n) => n.type === 'Pressable' && n.props.accessibilityLabel === 'The Ward of the Fen, open',
    )!
    .props.onPress();
  assert.deepEqual(stack.at(-1), { kind: 'thing', id: ward });
  assert.equal(a.sql.prepare('SELECT count(*) AS n FROM receipt').get()!.n, before);
  assert.deepEqual(p.screen().view.topics, []);
  const read = draw(ward).find(
    (n) => n.type === 'Pressable' && n.props.accessibilityLabel === 'Read The Ward of the Fen',
  );
  assert.ok(read);
  read.props.onPress();
  assert.deepEqual(
    p.screen().view.topics?.map((t) => t.label),
    ['topic.ward'],
  );
  assert.deepEqual(p.screen().detail(ward), [
    'Stored.',
    'The ward is a promise kept between the Priory and the fen. Ask Aldric how its protection is renewed.',
  ]);
  const texts = draw(ward)
    .filter((n) => n.type === 'Text')
    .map((n) => n.props.children);
  assert.ok(
    texts.indexOf(
      'The ward is a promise kept between the Priory and the fen. Ask Aldric how its protection is renewed.',
    ) < texts.indexOf('Read The Ward of the Fen'),
  );
  assert.equal(p.screen().returnWorld, false);
  const latest = a.sql.prepare('SELECT count(*) AS n FROM receipt').get()!.n;
  draw(ward)
    .find((n) => n.type === 'Pressable' && n.props.accessibilityLabel === 'Back to container')!
    .props.onPress();
  assert.deepEqual(stack.at(-1), { kind: 'thing', id: chest });
  assert.equal(a.sql.prepare('SELECT count(*) AS n FROM receipt').get()!.n, latest);
  assert.deepEqual(restoredItemPages(p.screen().view, p.screen().detail), [
    { kind: 'carrying' },
    { kind: 'thing', id: chest },
    { kind: 'thing', id: ward },
  ]);
  const was = p.screen().view;
  const close = p
    .screen()
    .buttons.find((b) => b.action_key === 'close' && b.target_ids[0] === chest)!;
  p.press(close, chest);
  assert.deepEqual(
    pagesAfter([...stack, { kind: 'thing', id: ward }], was, p.screen().view),
    stack,
  );
});
