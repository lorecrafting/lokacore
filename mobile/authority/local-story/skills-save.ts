import { key, same } from '../../../kernel/ts/src/foundation/compose.ts';
import { acquisition } from '../../../kernel/ts/src/mechanics/skills.ts';
import { refString, type World } from '../../../kernel/ts/src/runtime/decision.ts';
import type { DefinitionRef, DecisionResult } from '../../../kernel/ts/src/contracts.gen.ts';
import { committedDialogue } from './dialogue-receipt.ts';
import { checkRow } from './dialogue-save.ts';
import type { Db, Meta } from './store.ts';

export function skillsSave(world: World, db: Db, meta: Meta) {
  if (!Object.keys(world.cartridge.skills ?? {}).length) return;
  const rows = Object.entries(world.state.choices ?? {});
  const scope = `story/${meta.lineage_id}/${world.character}`;
  const grants = new Map<string, string[]>();
  for (const [id, row] of rows) {
    const d = world.cartridge.dialogues?.[refString(row.source)];
    const option = row.choice_id && d?.choices[row.choice_id];
    if (!option || row.status !== 'resolved') continue;
    for (const s of option.sequence ?? []) {
      if (s.op !== 'skill.acquire') continue;
      checkRow(world, id, row);
      committedDialogue(world, db, scope, id);
      const ref = refString(s.skill);
      grants.set(ref, [...(grants.get(ref) ?? []), id]);
    }
  }
  memberships(world, grants);
  reservedReceipts(world, db, scope, grants);
}

function reservedReceipts(world: World, db: Db, scope: string, grants: Map<string, string[]>) {
  const invalid = () => {
    throw new SyntaxError('malformed JSON: inconsistent skill receipt');
  };
  for (const r of db.getAllSync<{ response: string }>(
    "SELECT response FROM receipt WHERE scope=? AND json_extract(response,'$.kind')='accepted'",
    scope,
  )) {
    const d = JSON.parse(r.response) as Extract<DecisionResult, { kind: 'accepted' }>;
    for (const op of d.delta.ops) {
      if (op.op !== 'fact.assign') continue;
      const skill = Object.values(world.cartridge.skills ?? {}).find(
        (s) => `skill_${s.key}` === op.fact.key,
      );
      if (!skill) continue;
      if (
        op.expected !== false ||
        op.value !== true ||
        !same(op.scope, { kind: 'player', character_id: world.character })
      )
        invalid();
      if (
        !d.delta.ops.some(
          (o) =>
            o.op === 'choice.resolve' &&
            grants
              .get(refString({ ...op.fact, kind: 'skill', key: skill.key }))
              ?.includes(o.continuation_id),
        )
      )
        invalid();
    }
  }
}

function memberships(world: World, grants: Map<string, string[]>) {
  const invalid = () => {
    throw new SyntaxError('malformed JSON: inconsistent skill acquisition');
  };
  for (const [ref, skill] of Object.entries(world.cartridge.skills ?? {})) {
    const definition: DefinitionRef = {
      cartridge_id: world.cartridge.manifest.id,
      cartridge_version: world.cartridge.manifest.version,
      kind: 'skill',
      key: skill.key,
    };
    const at = key({
      kind: 'fact',
      fact: acquisition(definition),
      scope: { kind: 'player', character_id: world.character },
    });
    const acquired = Object.hasOwn(world.state.facts ?? {}, at) ? world.state.facts![at] : false;
    const count = grants.get(ref)?.length ?? 0;
    if (typeof acquired !== 'boolean' || count > 1 || acquired !== (count === 1)) invalid();
  }
}
