// The authored bell outcome must agree with its typed quest rows and original choice receipt.
import { value } from '../../../kernel/ts/src/mechanics/fact.ts';
import { questOf } from '../../../kernel/ts/src/mechanics/lookups.ts';
import { refString, type ChoiceRow, type World } from '../../../kernel/ts/src/runtime/decision.ts';
import { choiceReceipt, ref } from './bell-receipt.ts';
import type { Db } from './store.ts';

const invalid = () => {
  throw new SyntaxError('malformed JSON: inconsistent bell return');
};

export function bellSave(world: World, db: Db, scope: string, rows: [string, ChoiceRow][]) {
  if (!Object.values(world.cartridge.quests ?? {}).some((q) => q.key === 'bell_of_ashmere'))
    return false;
  const fact = (key: string) => value(world, world.character, ref(world, 'fact', key));
  const q3 = questOf(world, world.character, ref(world, 'quest', 'bell_of_ashmere'));
  const q2 = questOf(world, world.character, ref(world, 'quest', 'missing_child'));
  const rung = fact('chapel_bell_rung');
  const allegiance = fact('chapel_allegiance');
  const rungScene = sceneLine(world, fact, 'scene_bell_rung');
  const silentScene = sceneLine(world, fact, 'scene_bell_silenced');
  if (q3 && !q2) invalid();
  const lost = q2?.[1].state === 'failed' && q2[1].outcome === 'lost';
  checkAllegiance(fact, q2, q3, rung, allegiance, rungScene, silentScene);
  if (q3 && !['active', 'resolved'].includes(q3[1].state)) invalid();
  checkLost(world, fact, rows, q2, rung, lost);
  if (rung && !choiceReceipt(world, db, scope, q3![0], q2![0], lost, 'prior')) invalid();
  if (allegiance === 'fox' && !choiceReceipt(world, db, scope, q3![0], q2![0], false, 'fox'))
    invalid();
  return !!lost;
}

type Fact = (key: string) => unknown;
type Quest = ReturnType<typeof questOf>;

function sceneLine(world: World, fact: Fact, name: string) {
  const line = fact(name);
  const type = world.cartridge.facts[refString(ref(world, 'fact', name))]?.value_type;
  if (
    type?.type !== 'int' ||
    typeof line !== 'number' ||
    !Number.isSafeInteger(line) ||
    typeof type.minimum !== 'number' ||
    typeof type.maximum !== 'number' ||
    line < type.minimum ||
    line > type.maximum
  )
    invalid();
  return line as number;
}

function checkAllegiance(
  fact: Fact,
  q2: Quest,
  q3: Quest,
  rung: unknown,
  allegiance: unknown,
  rungScene: number,
  silentScene: number,
) {
  if (rung) {
    if (
      allegiance !== 'prior' ||
      q3?.[1].state !== 'resolved' ||
      q3[1].outcome !== 'prior' ||
      rungScene === 0 ||
      silentScene !== 0 ||
      !q2
    )
      invalid();
  } else if (allegiance === 'fox') {
    if (
      q3?.[1].state !== 'resolved' ||
      q3[1].outcome !== 'fox' ||
      q2?.[1].state !== 'resolved' ||
      !['rescued', 'stays'].includes(q2[1].outcome ?? '') ||
      fact('village_child_status') !== q2[1].outcome ||
      rungScene !== 0 ||
      silentScene === 0
    )
      invalid();
  } else if (
    allegiance !== 'unknown' ||
    rungScene !== 0 ||
    silentScene !== 0 ||
    (q3 && q3[1].state !== 'active')
  )
    invalid();
}

function checkLost(
  world: World,
  fact: Fact,
  rows: [string, ChoiceRow][],
  q2: Quest,
  rung: unknown,
  lost: boolean,
) {
  if (lost) {
    if (
      !rung ||
      fact('village_child_status') !== 'lost' ||
      fact('fen_wren_met') !== false ||
      fact('fen_return_branch') !== 'unselected' ||
      Object.keys(world.state.escorts ?? {}).length ||
      rows.some(
        ([, row]) =>
          row.status === 'resolved' &&
          world.cartridge.dialogues?.[refString(row.source)]?.choices[
            row.choice_id!
          ]?.sequence?.some(
            (s) => s.op === 'fact.assign' && s.fact.key === 'fen_wren_met' && s.value === true,
          ),
      )
    )
      invalid();
  } else if (
    fact('village_child_status') === 'lost' ||
    q2?.[1].state === 'failed' ||
    (rung && q2?.[1].state === 'active' && fact('fen_wren_met') === false)
  )
    invalid();
}
