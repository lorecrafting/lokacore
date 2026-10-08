import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { read } from './read.ts';
import { admitCandidate } from './e1_policy.ts';
import { caseHost } from './e1_case_host.ts';
import { witnessedObligations } from './e1_obligations.ts'; // the service witness alone; e1_world_witness adds its pools
import { replayCase } from './e1_cases.ts';
import { lanternServices } from './e1_services.ts';
import { hash } from '../src/foundation/canonical.ts';
import { refString } from '../src/runtime/decision.ts';
import { key as stateKey } from '../src/foundation/compose.ts';
import type { World } from '../src/index.ts';
import type { Command, DeltaOp as Op } from '../src/contracts.gen.ts';

const pin = read('protocol/fixtures/missing_child_v042_hash.json');
const bytes = new TextEncoder().encode(
  `{"cartridge":${pin.canonical},"content_hash":"${pin.sha256}"}`,
);
const source = {
  source_sha: '1'.repeat(40),
  check_hash: '2'.repeat(64),
  policy_hash: '3'.repeat(64),
};

// Breaks: a paid service is credited after its authored benefit or recovery is omitted from the receipt.
test('E1 witnesses each Maud service only with its own payment and committed benefit', () => {
  const dir = mkdtempSync(join(tmpdir(), 'loka-e1-services-'));
  const a = caseHost(
    admitCandidate(bytes),
    join(dir, 'save.db'),
    join(dir, 'case.jsonl'),
    undefined,
    {
      case_id: 'lantern-services',
      source,
      fault_schedule: [],
    },
  );
  const base = '/services/ashmere_missing_child@0.0.42:service/';
  const expected = ['lantern_room', 'lantern_meal', 'lantern_ale'].map((key) => `${base}${key}`);
  try {
    const witnessed: string[] = [];
    a.watch((before, after, command, decision) => {
      if (command.payload.type !== 'use_service' || decision.kind !== 'accepted') return;
      const key = command.payload.service.key;
      const selected = `${base}${key}`;
      assert.deepEqual(witnessedObligations(before, after, command, decision), [selected]);
      witnessed.push(selected);
      // Each plant breaks one witness clause and leaves the others satisfied.
      const ops = decision.delta.ops;
      const pennies = (holder: unknown) => (op: Op) =>
        op.op === 'resource.adjust' && op.entity_id === holder && op.resource.key === 'pennies';
      const benefitOp = (op: Op) =>
        key === 'lantern_room'
          ? op.op === 'fact.assign'
          : key === 'lantern_meal'
            ? op.op === 'resource.adjust' && op.resource.key === 'lantern_meals'
            : op.op === 'liquid.set';
      const recoveryOp = (op: Op) => op.op === 'resource.adjust' && op.resource.key === 'mv';
      const edit = (match: (op: Op) => boolean, change: (op: Op) => Op | undefined) => {
        assert.equal(ops.filter(match).length, 1, 'plant edits exactly one op');
        const next = ops.flatMap((op) => (match(op) ? (change(op) ?? []) : [op]));
        return { ...decision, delta: { ...decision.delta, ops: next } };
      };
      const svcKey = refString(command.payload.service);
      const authored = before.cartridge.services![svcKey]!;
      const authoring = (change: object, world = before) =>
        ({
          ...world,
          cartridge: {
            ...world.cartridge,
            services: { ...world.cartridge.services, [svcKey]: { ...authored, ...change } },
          },
        }) as World;
      const payload = (change: object) =>
        ({ ...command, payload: { ...command.payload, ...change } }) as Command;
      const patch = (match: (op: Op) => boolean, change: (op: any) => object) =>
        edit(match, (op) => ({ ...op, ...change(op) }) as Op);
      const provider = command.payload.provider_id;
      const plants: [string, World, Command, typeof decision, World?][] = [
        ['other actor', before, payload({ actor_id: 'someone-else' }), decision],
        [
          'other authored provider',
          authoring({ provider: { ...authored.provider, key: 'wren' } }),
          command,
          decision,
        ],
        ['wrong quote', before, payload({ quoted_price: authored.price + 1 }), decision],
        [
          'price differs from debit',
          authoring({ price: authored.price + 1 }),
          payload({ quoted_price: authored.price + 1 }),
          decision,
        ],
        ['payer debit op removed', before, command, edit(pennies(before.body), () => undefined)],
        ['provider credit op removed', before, command, edit(pennies(provider), () => undefined)],
        ['benefit op removed', before, command, edit(benefitOp, () => undefined)],
      ];
      for (const [who, holder] of [
        ['payer', before.body],
        ['provider', provider],
      ] as const)
        for (const [what, change] of [
          ['names another holder', () => ({ entity_id: 'someone-else' })],
          ['names another resource', (op: any) => ({ resource: { ...op.resource, key: 'mv' } })],
          ['from disagrees with state', (op: any) => ({ from: op.from + 1 })],
          ['to disagrees with state', (op: any) => ({ to: op.to + 1 })],
        ] as const)
          plants.push([`${who} op ${what}`, before, command, patch(pennies(holder), change)]);
      if (key === 'lantern_room')
        plants.push(
          [
            'fact op not an assign',
            before,
            command,
            patch(benefitOp, () => ({ op: 'fact.adjust' })),
          ],
          [
            'fact op not player-scoped',
            before,
            command,
            patch(benefitOp, (op) => ({ scope: { ...op.scope, kind: 'world' } })),
          ],
          ['fact op assigns false', before, command, patch(benefitOp, () => ({ value: false }))],
          [
            'fact without transition',
            before,
            command,
            edit(benefitOp, (op) => ({ ...op, expected: true }) as Op),
          ],
          [
            'fact for another character',
            before,
            command,
            edit(
              benefitOp,
              (op) =>
                ({ ...op, scope: { ...(op as any).scope, character_id: 'someone-else' } }) as Op,
            ),
          ],
          [
            'other fact assigned',
            before,
            command,
            edit(
              benefitOp,
              (op) => ({ ...op, fact: { ...(op as any).fact, key: 'dream_seen' } }) as Op,
            ),
          ],
        );
      else plants.push(['recovery op removed', before, command, edit(recoveryOp, () => undefined)]);
      if (key === 'lantern_meal') {
        plants.push([
          'stock debit differs',
          authoring({ benefit: { ...authored.benefit, debit: 2 } }),
          command,
          decision,
        ]);
        // The kernel refuses a full-MV meal; plant the capped receipt it would need: MV already
        // at its maximum before and after, and an mv adjust with from == to.
        const old = (ops.find(recoveryOp) as any).from as number;
        const mv = (ops.find(recoveryOp) as any).resource;
        const spec = stateKey(mv);
        const row = stateKey({ kind: 'resource', resource: mv, entity_id: before.body });
        const capped = {
          ...before.resourceSpecs,
          [spec]: { ...before.resourceSpecs[spec]!, maximum: old },
        };
        const atMax = { ...before, resourceSpecs: capped } as World;
        const stillMax = {
          ...after,
          resourceSpecs: capped,
          state: {
            ...after.state,
            resources: { ...after.state.resources, [row]: before.state.resources![row]! },
          },
        } as World;
        plants.push([
          'capped recovery from == to',
          atMax,
          command,
          patch(recoveryOp, () => ({ to: old })),
          stillMax,
        ]);
      }
      if (key === 'lantern_ale') {
        const vessel = a.entity('item', 'lantern_ale_cask');
        const ale = 'ashmere_missing_child@0.0.42:liquid/ale';
        plants.push(
          [
            'cask not held by provider',
            {
              ...before,
              state: {
                ...before.state,
                containers: { ...before.state.containers, [vessel]: before.body },
              },
            } as World,
            command,
            decision,
          ],
          [
            'other authored liquid',
            authoring({
              benefit: {
                ...authored.benefit,
                liquid: { ...(authored.benefit as any).liquid, key: 'water' },
              },
            }),
            command,
            decision,
          ],
          [
            'serving differs',
            {
              ...before,
              cartridge: {
                ...before.cartridge,
                liquids: {
                  ...before.cartridge.liquids,
                  [ale]: { ...before.cartridge.liquids![ale]!, drink_amount: 2 },
                },
              },
            } as World,
            command,
            decision,
          ],
          [
            'liquid op from disagrees',
            before,
            command,
            patch(benefitOp, (op) => ({ from: { ...op.from, quantity: 9 } })),
          ],
          [
            'liquid op to disagrees',
            before,
            command,
            patch(benefitOp, (op) => ({ to: { ...op.to, quantity: 9 } })),
          ],
        );
      }
      for (const [label, w, c, d, aw = after] of plants)
        assert.equal(
          witnessedObligations(w, aw, c, d).includes(selected),
          false,
          `${key}: ${label}`,
        );
    });
    assert.deepEqual(lanternServices(a), {
      services: ['lantern_room', 'lantern_meal', 'lantern_ale'],
      pennies: 14,
      ale: 3,
    });
    assert.deepEqual(witnessed, expected);
    a.record({
      kind: 'finish',
      steps: a.commands.length,
      digest: a.digest(),
      state_hash: hash(a.story.world().state as never),
    });
    const replay = replayCase(bytes, readFileSync(join(dir, 'case.jsonl'), 'utf8'), source);
    assert.deepEqual(
      expected.filter((path) => !replay.obligations.includes(path)),
      [],
    );
  } finally {
    a.close();
    rmSync(dir, { recursive: true });
  }
});
