import { validate } from '../../../kernel/ts/src/foundation/validate.ts';
import { bodyOf, refString, type World } from '../../../kernel/ts/src/runtime/decision.ts';

/** Reject malformed current rows before canonical receipt replay; replay proves causal history. */
export function patrolSave(world: World) {
  const invalid = () => {
    throw new SyntaxError('malformed JSON: invalid patrol row');
  };
  for (const [id, row] of Object.entries(world.state.patrols ?? {})) {
    if (validate('PatrolRelation', row).length) invalid();
    const quest = world.state.quests?.[id];
    const settings = quest && world.cartridge.quests?.[refString(quest.quest)]?.patrol;
    if (
      !settings ||
      id !== row.quest_instance_id ||
      row.actor_id !== world.character ||
      row.body_id !== bodyOf(world, row.actor_id) ||
      row.npc_id !== world.entityIds[refString(settings.npc)] ||
      row.cursor >= settings.route.length ||
      new Set(row.credit).size !== row.credit.length ||
      row.credit.some((r) => !settings.checkpoints.some((c) => world.roomIds[refString(c)] === r))
    )
      invalid();
    const leaderRoom = world.roomIds[refString(settings!.route[row.cursor])];
    const source =
      world.roomIds[
        refString(
          settings!.route[(row.cursor + settings!.route.length - 1) % settings!.route.length],
        )
      ];
    if (
      world.state.containers[row.npc_id] !== leaderRoom ||
      (row.status === 'together' && world.state.containers[row.body_id] !== leaderRoom) ||
      (row.status === 'awaiting' && world.state.containers[row.body_id] !== source)
    )
      invalid();
  }
}
