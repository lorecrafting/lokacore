import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fragment } from './fragment.ts';
import { step, gameView, type World } from '../src/index.ts';
import { key } from '../src/foundation/compose.ts';
import { apply } from '../src/runtime/apply.ts';
import { accepted, allocator } from '../src/runtime/decision.ts';
import { admit, adopt } from '../src/runtime/proposal.ts';
import { adjust, level, resourceRef } from '../src/mechanics/resource.ts';
import { deathSequence } from '../src/mechanics/death/sequence.ts';
import type { Command, CommandId, FactValue } from '../src/contracts.gen.ts';

// cellar_sampler 0.0.9's frozen KAT (death, shrine chapel_nave) with an inline study west of
// the shrine whose ingress waits on search_plan = player_led (docs/system/mechanics.md, corpse
// ingress). The player starts in the study, so a death leaves the corpse there.
const f = fragment('protocol/fixtures/containers_sampler_v009_hash.json');
const { prefix, ref } = f;
const entity = (w: World, kind: string, name: string) => w.entityIds[`${prefix}:${kind}/${name}`];
const room = (w: World, name: string) => w.roomIds[`${prefix}:room/${name}`];
const fresh = () =>
  f.genesis((c) => {
    c.rooms[`${prefix}:room/study`] = {
      description: 'room.study.description',
      exits: { east: { to: ref('room', 'chapel_nave') } },
      key: 'study',
      title: 'room.study.title',
    };
    c.rooms[`${prefix}:room/chapel_nave`].exits.west = {
      to: ref('room', 'study'),
      corpse_ingress: { fact: ref('fact', 'search_plan'), equals: 'player_led' },
    };
    Object.assign(c.text, { 'room.study.description': 'A study.', 'room.study.title': 'Study' });
    c.entry = ref('room', 'study');
  });

function fox(world: World): World {
  return {
    ...world,
    state: {
      ...world.state,
      facts: {
        ...world.state.facts,
        [key({
          kind: 'fact',
          fact: ref('fact', 'search_plan'),
          scope: { kind: 'player', character_id: world.character },
        })]: 'player_led' as FactValue,
      },
    },
  };
}

function move(world: World, direction: 'west' | 'east', n: number) {
  return step(
    world,
    {
      id: `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`,
      world_context_id: world.context,
      payload: { type: 'move', actor_id: world.character, direction },
    } as Command,
    n,
  );
}

// Breaks: fox closure blocks egress, or a stale/empty/foreign corpse opens ordinary Study ingress.
test('fox Study ingress rechecks actual owned nonempty corpse and never closes egress', () => {
  const base = fresh();
  const keyItem = entity(base, 'item', 'brass_key');
  const atStudy: World = {
    ...base,
    state: { ...base.state, containers: { ...base.state.containers, [keyItem]: base.body } },
  };
  const command = {
    id: '00000000-0000-4000-8000-000000000091' as CommandId,
    world_context_id: atStudy.context,
    payload: { type: 'look', actor_id: atStudy.character },
  } as const satisfies Command;
  const mint = allocator(atStudy, command);
  const hp = resourceRef(atStudy, 'hp');
  const loss = adjust(atStudy, atStudy.body, hp, -level(atStudy, atStudy.body, hp)!, {}).op;
  const lost = apply(atStudy, [loss]);
  assert.ok('world' in lost);
  const death = deathSequence(
    lost.world,
    command,
    {
      loss,
      owner_id: atStudy.character,
      killer_id: null,
      credited_character_id: null,
    },
    mint,
  );
  const died = adopt(
    atStudy,
    admit('death', accepted(atStudy, 'died', [loss, ...death.ops], death.events)),
    command,
    mint,
    1,
  );
  assert.equal(died.decision.kind, 'accepted');
  const closed = fox(died.world);
  assert.equal(closed.state.containers[closed.body], room(closed, 'chapel_nave'));
  assert.equal(move(closed, 'west', 2).decision.kind, 'accepted');
  const inside = move(closed, 'west', 2).world;
  const taken = step(
    inside,
    {
      id: '00000000-0000-4000-8000-000000000003' as CommandId,
      world_context_id: inside.context,
      payload: { type: 'take', actor_id: inside.character, item_id: keyItem },
    } as Command,
    3,
  );
  assert.equal(taken.decision.kind, 'accepted');
  assert.equal(taken.world.state.containers[keyItem], taken.world.body);
  const left = move(taken.world, 'east', 4);
  assert.equal(left.decision.kind, 'accepted');
  assert.equal(move(left.world, 'west', 5).decision.kind, 'rejected');
  const noRoot: World = {
    ...closed,
    state: { ...closed.state, containers: { ...closed.state.containers, [keyItem]: closed.body } },
  };
  assert.equal(move(noRoot, 'west', 4).decision.kind, 'rejected');
  const west = gameView(noRoot).exits.find((e) => e.direction === 'west');
  assert.ok(west && !west.available);
  assert.deepEqual(west.reason, { code: 'exit_closed' });
  // Only a direct item root counts: an NPC held by the corpse does not open the Study.
  const npc = Object.keys(noRoot.entities).find((id) => noRoot.entities[id].kind === 'npc')!;
  const npcRoot: World = {
    ...noRoot,
    state: { ...noRoot.state, containers: { ...noRoot.state.containers, [npc]: death.corpse_id } },
  };
  assert.equal(move(npcRoot, 'west', 4).decision.kind, 'rejected');
  const npcWest = gameView(npcRoot).exits.find((e) => e.direction === 'west');
  assert.ok(npcWest && !npcWest.available);
  assert.deepEqual(npcWest.reason, { code: 'exit_closed' });
  const foreign: World = {
    ...closed,
    state: {
      ...closed.state,
      created: {
        ...closed.state.created,
        [death.corpse_id]: {
          ...closed.state.created![death.corpse_id],
          origin: {
            ...closed.state.created![death.corpse_id].origin,
            owner_id: '99999999-9999-4999-8999-999999999999',
          },
        } as never,
      },
    },
  };
  assert.equal(move(foreign, 'west', 5).decision.kind, 'rejected');
});
