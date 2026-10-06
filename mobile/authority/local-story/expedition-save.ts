import type {
  Command,
  DecisionResult,
  DefinitionRef,
  DeltaOp,
  ExpeditionAttempt,
} from '../../../kernel/ts/src/contracts.gen.ts';
import { key, same } from '../../../kernel/ts/src/foundation/compose.ts';
import { validate } from '../../../kernel/ts/src/foundation/validate.ts';
import { refString, type World } from '../../../kernel/ts/src/runtime/decision.ts';
import { value } from '../../../kernel/ts/src/mechanics/fact.ts';
import type { Db, Meta } from './store.ts';

const invalid = (): never => {
  throw new SyntaxError('malformed JSON: inconsistent expedition receipt');
};
type Accepted = Extract<DecisionResult, { kind: 'accepted' }>;
type Receipt = {
  command_id: string;
  actor_id: string;
  command: string;
  response: string;
  revision: number;
};

/** Cold-open proof from accepted ordered transfers and the original Start command. */
export function expeditionSave(world: World, db: Db, meta: Meta, head: number) {
  const quests = Object.values(world.cartridge.quests ?? {}).filter((q) => q.expedition);
  if (!quests.length) return;
  if (quests.length !== 1) invalid();
  const definition = quests[0]!;
  const spec = definition.expedition!;
  const ref = {
    cartridge_id: world.cartridge.manifest.id,
    cartridge_version: world.cartridge.manifest.version,
    kind: 'quest',
    key: definition.key,
  } as DefinitionRef;
  const rows = world.state.expeditions ?? {};
  if (Object.keys(rows).length > 1) invalid();
  let attempt: ExpeditionAttempt | null = null;
  let faction = world.factDefaults[key(spec.faction)];
  let completions = 0;
  let last = 0;
  const scope = `story/${meta.lineage_id}/${world.character}`;
  // ponytail: a cold reopen scans the private run's receipts; index per quest if runs grow large.
  for (const r of db.getAllSync<Receipt>(
    'SELECT command_id,actor_id,command,response,revision FROM receipt WHERE scope=? ORDER BY revision',
    scope,
  )) {
    if (r.command === 'null') continue;
    const command = JSON.parse(r.command) as Command;
    const decision = JSON.parse(r.response) as DecisionResult;
    if (
      validate('Command', command).length ||
      validate('DecisionResult', decision).length ||
      command.id !== r.command_id ||
      r.actor_id !== world.character ||
      command.payload.actor_id !== world.character ||
      command.world_context_id !== world.context ||
      r.revision < last ||
      r.revision > head
    )
      invalid();
    last = r.revision;
    if (decision.kind !== 'accepted') continue;
    const ops = decision.delta.ops;
    const transitions = ops.filter((op) => op.op === 'expedition.transition');
    if (transitions.length > 1) invalid();
    const changed = transitions[0];
    const payload = command.payload;
    const bodyMove = ops.find(
      (op): op is Extract<DeltaOp, { op: 'entity.transfer' }> =>
        op.op === 'entity.transfer' && op.entity_id === world.body,
    );
    const died = decision.events.some(
      (event) =>
        event.payload.type === 'entity_died' &&
        event.payload.victim_id === world.body &&
        String(event.causation_id) === String(command.id),
    );
    const active = attempt?.status === 'active';
    const outside =
      bodyMove &&
      !spec.footprint.some((room) => world.roomIds[refString(room)] === bodyMove.destination_id);
    const edge = attempt && spec.route[attempt.cursor];
    const next =
      bodyMove &&
      edge &&
      bodyMove.source_id === world.roomIds[refString(edge.from)] &&
      bodyMove.destination_id === world.roomIds[refString(edge.to)] &&
      (payload.type === 'move' || payload.type === 'flee');
    const needed = payload.type === 'expedition' || (active && !!(died || outside || next));
    if (needed !== !!changed) invalid();
    const factionBefore = faction;
    for (const op of ops)
      if (op.op === 'fact.assign' && same(op.fact, spec.faction)) {
        if (op.expected !== faction) invalid();
        faction = op.value;
      }
    if (!changed) {
      if (
        ops.some((op) => op.op === 'fact.assign' && same(op.fact, spec.survived_fact)) ||
        ops.some(
          (op) =>
            op.op === 'quest.transition' &&
            world.state.quests?.[op.instance_id]?.quest.key === definition.key,
        )
      )
        invalid();
      continue;
    }
    if (
      !same(changed.expected, attempt) ||
      changed.value.actor_id !== world.character ||
      changed.value.body_id !== world.body ||
      changed.value.quest_instance_id !== changed.quest_instance_id ||
      changed.writer_group !== (bodyMove?.writer_group ?? changed.writer_group)
    )
      invalid();
    const nextRow = changed.value;
    const expected =
      payload.type === 'expedition'
        ? payload.transition === 'shelter'
          ? attempt && { ...attempt, sheltered: true }
          : {
              kind: 'expedition',
              actor_id: world.character,
              body_id: world.body,
              quest_instance_id: changed.quest_instance_id,
              attempt_id: command.id,
              cursor: 0,
              sheltered: false,
              status: 'active',
            }
        : attempt &&
          (died || outside
            ? { ...attempt, cursor: 0, sheltered: false, status: 'failed' }
            : {
                ...attempt,
                cursor: attempt.cursor + 1,
                status: attempt.cursor + 1 === spec.route.length ? 'completed' : 'active',
              });
    if (!same(nextRow, expected)) invalid();
    if (payload.type === 'expedition') {
      const stage = payload.transition;
      const detail = stage === 'shelter' ? spec.shelter_detail : spec.start_detail;
      const room = stage === 'shelter' ? spec.shelter_room : spec.start_room;
      const target = Object.entries(world.details).find(
        ([, d]) => d.key === detail && d.room === world.roomIds[refString(room)],
      )?.[0];
      if (
        payload.detail_id !== target ||
        spec.actions[stage] === undefined ||
        (stage === 'start' &&
          (attempt || nextRow.attempt_id !== command.id || nextRow.cursor !== 0)) ||
        (stage === 'restart' &&
          (attempt?.status !== 'failed' ||
            payload.quest_instance_id !== attempt.quest_instance_id ||
            payload.attempt_id !== attempt.attempt_id ||
            nextRow.attempt_id !== command.id)) ||
        (stage === 'shelter' &&
          (attempt?.status !== 'active' ||
            attempt.cursor !== 3 ||
            attempt.sheltered ||
            payload.cursor !== 3 ||
            payload.quest_instance_id !== attempt.quest_instance_id ||
            payload.attempt_id !== attempt.attempt_id ||
            !nextRow.sheltered))
      )
        invalid();
      if (
        stage === 'start' &&
        !ops.some(
          (op) =>
            op.op === 'quest.activate' &&
            op.instance_id === nextRow.quest_instance_id &&
            same(op.quest, ref) &&
            same(op.scope, { kind: 'player', character_id: world.character }),
        )
      )
        invalid();
    } else if (died || outside) {
      if (
        !attempt ||
        nextRow.status !== 'failed' ||
        nextRow.cursor !== 0 ||
        nextRow.sheltered ||
        nextRow.attempt_id !== attempt.attempt_id
      )
        invalid();
    } else if (next) {
      if (
        !attempt ||
        nextRow.cursor !== attempt.cursor + 1 ||
        nextRow.attempt_id !== attempt.attempt_id ||
        !decision.events.some(
          (e) =>
            e.payload.type === 'entity_entered_room' &&
            e.payload.entity_id === world.body &&
            e.payload.room_id === bodyMove!.destination_id &&
            String(e.causation_id) === String(command.id),
        )
      )
        invalid();
      if (nextRow.status === 'completed') {
        if (nextRow.cursor !== spec.route.length || ++completions !== 1) invalid();
        completion(world, command, decision, nextRow, ref, factionBefore);
      }
    } else invalid();
    attempt = nextRow;
  }
  const [id, saved] = Object.entries(rows)[0] ?? [];
  if (
    !!saved !== !!attempt ||
    (saved &&
      (!same(saved, attempt) ||
        id !== saved.quest_instance_id ||
        validate('ExpeditionAttempt', saved).length))
  )
    invalid();
  const quest = attempt && world.state.quests?.[attempt.quest_instance_id];
  if (
    attempt &&
    (!quest ||
      !same(quest.quest, ref) ||
      quest.state !== (attempt.status === 'completed' ? 'resolved' : 'active') ||
      (attempt.status === 'active' &&
        !spec.footprint.some(
          (room) => world.roomIds[refString(room)] === world.state.containers[world.body],
        )))
  )
    invalid();
  if (value(world, world.character, spec.survived_fact) !== (completions === 1)) invalid();
  if (value(world, world.character, spec.faction) !== faction) invalid();
}

function completion(
  world: World,
  command: Command,
  d: Accepted,
  row: ExpeditionAttempt,
  questRef: DefinitionRef,
  factionBefore: unknown,
) {
  const spec = world.cartridge.quests![refString(questRef)]!.expedition!;
  const group = d.delta.ops.find((op) => op.op === 'expedition.transition')!.writer_group;
  const fact = d.delta.ops.find(
    (op): op is Extract<DeltaOp, { op: 'fact.assign' }> =>
      op.op === 'fact.assign' && same(op.fact, spec.survived_fact),
  );
  const faction = d.delta.ops.find(
    (op): op is Extract<DeltaOp, { op: 'fact.assign' }> =>
      op.op === 'fact.assign' && same(op.fact, spec.faction),
  );
  const type = world.cartridge.facts[refString(spec.faction)].value_type;
  if (type.type !== 'int') return invalid();
  const floor = type.minimum ?? invalid();
  if (
    !fact ||
    !faction ||
    fact.writer_group !== group ||
    fact.value !== true ||
    fact.expected !== false ||
    faction.writer_group !== group ||
    faction.expected !== factionBefore ||
    faction.value !== Math.max(floor, (factionBefore as number) + spec.faction_delta) ||
    !d.delta.ops.some(
      (op) =>
        op.op === 'quest.transition' &&
        op.instance_id === row.quest_instance_id &&
        op.from === 'objectives_complete' &&
        op.to === 'resolved' &&
        op.writer_group === group,
    ) ||
    !d.events.some(
      (e) =>
        e.payload.type === 'quest_resolved' &&
        e.payload.instance_id === row.quest_instance_id &&
        String(e.causation_id) === String(command.id),
    )
  )
    invalid();
}
