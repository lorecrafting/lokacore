// Helper, named .test so the app typecheck skips it: the real-SQLite escort play the escort reopen tests share.
import assert from 'node:assert/strict';
import { bundle as escortBundle, entity, genesis } from '../../../kernel/ts/test/escort_fixture.ts';
import { elapsedHost } from './__tests__/elapsed-host.test.ts';
import { presenter } from '../../app/book/presenter.ts';
import { localSession, openGame } from './session.ts';
import { openStory } from './authority.ts';

export const bundle = escortBundle();
const fresh = genesis();
export const id = (kind: string, name: string) => entity(fresh, kind, name);
export const homeward = (a: ReturnType<typeof setup>) =>
  a.view().journal.find((q) => q.quest.key === 'homeward')!;

export function setup(path = ':memory:', source = bundle) {
  const a = elapsedHost(path, { wall: 10000, mono: 0 }, source);
  const book = presenter(a.game);
  a.game.subscribe(book.update);
  const view = () => a.game.view().view;
  const ok = (action_key: string, target_ids: string[] = [], input: object = {}) => {
    const reply = a.game.invoke({ action_key, target_ids, input } as never);
    assert.equal(reply.kind, 'saved', JSON.stringify(reply));
    if (reply.kind === 'saved')
      assert.equal(reply.decision.kind, 'accepted', JSON.stringify(reply));
  };
  const move = (...directions: string[]) =>
    directions.forEach((direction) => ok('move', [], { direction }));
  const choose = (choice_id: string, answer?: string) =>
    ok('choose', [], {
      choice_id,
      continuation_id: view().choice!.continuation_id,
      ...(answer && { answer }),
    });
  const accept = (dialogue: string, npc: string) => {
    ok(dialogue, [id('npc', npc)]);
    choose('accept');
    if (view().choice) ok('close_choice');
  };
  // Two quests (the cellar Lantern quest and Homeward), then the child's escort offer.
  const offer = () => {
    accept('bram_offer', 'bram');
    accept('keeper_offer', 'keeper');
    move('north', 'north');
    ok('child_escort', [id('npc', 'child')]);
  };
  const press = (npc: string) => {
    const button = book.screen().buttons.find((b) => b.action_key === 'choose');
    assert.ok(button);
    book.press(button, id('npc', npc));
  };
  const row = (section: string, key: string) => {
    const r = a.sql
      .prepare('SELECT value FROM state_row WHERE section=? AND key=?')
      .get(section, key);
    return r && JSON.parse(r.value as string);
  };
  const rows = (section: string) =>
    a.sql
      .prepare('SELECT key,value FROM state_row WHERE section=?')
      .all(section)
      .map((r) => ({ key: r.key as string, value: JSON.parse(r.value as string) }));
  const put = (section: string, key: string, value: unknown) =>
    a.sql
      .prepare('INSERT OR REPLACE INTO state_row VALUES (?,?,?)')
      .run(section, key, JSON.stringify(value));
  const fact = (key: string) => rows('facts').find((r) => JSON.parse(r.key).fact?.key === key);
  const quest = () => rows('quests').find((r) => r.value.quest.key === 'homeward')!;
  const escort = () => row('escorts', fresh.character);
  const lines = (npc: string, text: string) =>
    book
      .screen()
      .detail(id('npc', npc))
      .filter((line) => typeof line === 'string' && line.includes(text));
  const end = () => {
    move('south', 'south');
    ok('keeper_home', [id('npc', 'keeper')]);
    choose('home');
  };
  return {
    ...a,
    book,
    view,
    ok,
    move,
    choose,
    offer,
    press,
    row,
    rows,
    put,
    fact,
    quest,
    escort,
    lines,
    end,
  };
}
