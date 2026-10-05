import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  loadCartridge,
  newWorld,
  gameView,
  INSTALLED,
  type Cartridge,
} from '../../../kernel/ts/src/index.ts';
import type { DefinitionRef, EntityId } from '../../../kernel/ts/src/contracts.gen.ts';
import { read } from '../../../kernel/ts/test/read.ts';
import { value } from '../../../kernel/ts/src/mechanics/fact.ts';
import { living } from '../../../kernel/ts/src/mechanics/death/shared.ts';
import { engaged } from '../../../kernel/ts/src/mechanics/combat/shared.ts';
import { elapsedHost } from './__tests__/elapsed-host.test.ts';
import { openStory } from './authority.ts';

const bundle = read('protocol/fixtures/missing_child_v002_hash.json');
const loaded = loadCartridge(
  new TextEncoder().encode(
    JSON.stringify({ cartridge: bundle.value, content_hash: bundle.sha256 }),
  ),
  INSTALLED,
);
assert.ok(loaded.ok);
const fresh = newWorld(
  loaded.cartridge as Cartridge,
  '0d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f' as never,
  [1, 2, 3, 4],
);
// Independent Python IdSource literals for this release, not allocated by the test.
const keyId = '05f6aca0-79cd-83fe-8096-bae95b0730e8';
const chestId = 'd68b48e6-93a5-8899-81ec-808f7be333f8' as EntityId;
const brassId = '19785203-d373-8973-8e64-1a9d8e50be82';
const maudId = '58ee172d-aa6f-8023-a3c1-a1d46af6d167';
const entity = (kind: string, name: string) =>
  fresh.entityIds[`ashmere_missing_child@0.0.2:${kind}/${name}`];
const ref = (name: string) =>
  ({
    cartridge_id: 'ashmere_missing_child',
    cartridge_version: '0.0.2',
    kind: 'fact',
    key: name,
  }) as DefinitionRef;
function setup(path = ':memory:') {
  const p = elapsedHost(path, { wall: 10000, mono: 0 }, bundle);
  const story = openStory(p.db, [{ fresh, content_hash: bundle.sha256 }], p.host);
  assert.equal(story.kind, 'open');
  if (story.kind !== 'open') throw new Error('production save');
  let n = Number(p.sql.prepare('SELECT count(*) AS n FROM receipt').get()!.n);
  const invoke = (
    action_key: string,
    target_ids: string[] = [],
    input: object = {},
    expected = 'accepted',
  ) => {
    const reply = story.invoke({
      invocation_id: `bbbbbbbb-0000-4000-8000-${String(++n).padStart(12, '0')}`,
      actor_id: fresh.character,
      action_key,
      target_ids,
      input,
    });
    assert.equal(reply.kind, 'saved');
    if (reply.kind === 'saved') {
      const d = reply.decision as { kind: string; error?: { code: string } };
      assert.equal(
        d.kind === 'accepted' ? 'accepted' : d.error?.code,
        expected,
        JSON.stringify(reply),
      );
    }
  };
  const move = (...directions: string[]) =>
    directions.forEach((direction) => invoke('move', [], { direction }));
  const answer = (choice_id: string, code = 'accepted') =>
    invoke(
      'choose',
      [],
      { choice_id, continuation_id: gameView(story.world()).choice!.continuation_id },
      code,
    );
  const offer = () => {
    invoke('maud_offer', [maudId]);
    answer('accept');
  };
  const kill = (number: number) => {
    const id = entity('npc', `cellar_rat_${number}`);
    for (let attempt = 0; attempt < 10 && living(story.world(), id); attempt++) {
      invoke('attack', [id]);
      for (let round = 0; round < 100 && engaged(story.world(), fresh.body); round++) {
        const from = story.world().state.clock;
        const result = story.elapsed({ expected_run_id: story.runId(), from, until: from + 150 });
        assert.equal(result.kind, 'saved');
        if (result.kind === 'saved')
          assert.equal((result.decision as { kind: string }).kind, 'accepted');
      }
      assert.equal(engaged(story.world(), fresh.body), undefined);
      if (gameView(story.world()).place.title.key === 'room.chapel_nave.title')
        move('south', 'south', 'south', 'south', 'east', 'down');
    }
    assert.equal(living(story.world(), id), false, `rat ${number} actually died`);
  };
  return { ...p, story, invoke, move, answer, offer, kill, view: () => gameView(story.world()) };
}

// Breaks: a production leaf/binding loses preacceptance credit, pays a new/wrong key,
// or the chest uses the attic key / loses deposited custody on a real cold reopen.
test('active chapter five actual kills, shrine return, Maud reward and cold-reopen storage', (t) => {
  // Breaks: adding details shifts entity allocation but release bindings retain stale IDs.
  const expectedIds = read('protocol/fixtures/missing_child_v002_ids.json');
  assert.deepEqual(
    {
      character: fresh.character,
      body: fresh.body,
      ...Object.fromEntries(
        Object.entries({ ...fresh.roomIds, ...fresh.entityIds }).map(([ref, id]) => [
          ref.split(':')[1],
          id,
        ]),
      ),
      ...Object.fromEntries(
        Object.entries(fresh.details).map(([id, detail]) => [`detail/${detail.key}`, id]),
      ),
      'slot/cloak': fresh.slots.cloak,
    },
    expectedIds,
  );
  const dir = mkdtempSync(join(tmpdir(), 'loka-maud-production-'));
  t.after(() => rmSync(dir, { recursive: true }));
  const path = join(dir, 'save.db');
  let p = setup(path);
  assert.equal(p.story.world().state.containers[keyId], maudId);
  p.move('north', 'east', 'down'); // fresh, keyless and unaccepted
  for (const number of [1, 2, 3, 4, 5]) p.kill(number);
  assert.deepEqual(
    [1, 2, 3, 4, 5].map((n) => value(p.story.world(), fresh.character, ref(`rat_${n}_killed`))),
    [true, true, true, true, true],
  );
  assert.deepEqual(p.story.world().state.quests ?? {}, {});
  assert.ok(
    Object.values(p.story.world().state.created ?? {}).some(
      (x) => x.definition.key === 'player_corpse',
    ),
    'actual lethal combat exercised the free shrine return route',
  );
  p.sql.close();
  p = setup(path);
  p.move('up');
  p.offer();
  assert.equal(p.story.world().state.containers[keyId], maudId, 'acceptance gives no key');
  assert.equal(p.view().journal[0].journal, 'quest.mauds_cellar.ready');
  p.invoke('maud_turn_in', [maudId]);
  p.answer('done');
  assert.equal(p.story.world().state.containers[keyId], fresh.body);
  assert.equal(value(p.story.world(), fresh.character, ref('maud_trust')), 5);
  assert.equal(value(p.story.world(), fresh.character, ref('inn_cellar_cleared')), true);
  assert.deepEqual(
    p.view().journal.map((q) => [q.state, q.journal]),
    [['resolved', 'quest.mauds_cellar.resolved']],
  );
  p.move('up');
  const chest = () => p.view().entities.find((e) => e.id === chestId)!;
  assert.equal(chest().state, 'locked');
  assert.equal(Object.values(p.story.world().state.containers).includes(chestId), false);
  p.invoke('unlock', [chestId]);
  p.invoke('open', [chestId]);
  p.invoke('take', [brassId]);
  p.invoke('put', [brassId, chestId]);
  p.invoke('close', [chestId]);
  p.move('up');
  assert.equal(p.view().entities.find((e) => e.id === entity('item', 'trunk'))!.state, 'locked');
  p.invoke('unlock', [entity('item', 'trunk')], {}, 'not_owned');
  p.move('down');
  p.sql.close();
  p = setup(path);
  assert.equal(p.story.world().state.containers[brassId], chestId);
  p.invoke('open', [chestId]);
  p.invoke('take', [brassId]);
  assert.equal(p.story.world().state.containers[brassId], fresh.body);
  p.sql.close();
});
