// Fixed E1 proof host. The production authority remains the only writer.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { appendFileSync, existsSync, writeFileSync } from 'node:fs';
import { encode, hash } from '../src/foundation/canonical.ts';
import { gameView, newWorld, stepElapsed, type World } from '../src/index.ts';
import type { Command, DecisionResult, DefinitionRef } from '../src/contracts.gen.ts';
import { value } from '../src/mechanics/fact.ts';
import { checked, KERNEL } from './sim.ts';
import { target } from '../src/foundation/compose.ts';
import { row } from '../src/runtime/rows.ts';
import { sha256, type admitCandidate } from './e1_policy.ts';
import { openStory } from '../../../mobile/authority/local-story/authority.ts';
import { sqliteHost } from '../../../mobile/authority/local-story/__tests__/elapsed-host.test.ts';
import { buttonsOf } from '../../../mobile/app/book/model.ts';

export const AUTHORITY_KERNEL = {
  ...KERNEL,
  step: (world: World, command: Command, revision: number) =>
    command.payload.type === 'elapsed'
      ? stepElapsed(world, command, revision)
      : KERNEL.step(world, command, revision),
};

export type LoadedCandidate = ReturnType<typeof admitCandidate>;
export const CASE_GENERATOR = 'e1-v042-authority-cases-v1';
export type Coverage = {
  rooms: Set<string>;
  quests: Set<string>;
  dialogues: Set<string>;
  choices: Set<string>;
  scenes: Set<string>;
  commands: Set<string>;
};
type Observer = (before: World, after: World, command: Command, decision: DecisionResult) => void;
export const coverage = (): Coverage =>
  Object.fromEntries(
    ['rooms', 'quests', 'dialogues', 'choices', 'scenes', 'commands'].map((key) => [
      key,
      new Set<string>(),
    ]),
  ) as Coverage;

// ponytail: bind only reviewed dialogue/choice/policy, scene, recipe, quest and visible-entity witnesses;
// other authored paths wait for their own exact command/state evidence.
export function witnessedObligations(
  before: World,
  after: World,
  command: Command,
  decision: DecisionResult,
): string[] {
  const p = command.payload;
  if (decision.kind !== 'accepted') return [];
  const questPaths = Object.entries(after.state.quests ?? {}).flatMap(([instance, quest]) => {
    if (quest.state !== 'resolved' || before.state.quests?.[instance]?.state === 'resolved')
      return [];
    const ref = quest.quest;
    const base = `/quests/${ref.cartridge_id}@${ref.cartridge_version}:quest/${ref.key}`;
    const definition =
      after.cartridge.quests?.[`${ref.cartridge_id}@${ref.cartridge_version}:quest/${ref.key}`];
    if (!definition) return [];
    const root =
      definition.objective.evidence === 'current_state'
        ? definition.objective.policy.root
        : undefined;
    return [
      base,
      `${base}/objective`,
      ...(root ? requiredPolicyPaths(root, `${base}/objective/policy/root`) : []),
    ];
  });
  const withQuests = (paths: string[]) => [...paths, ...questPaths];
  if (p.type === 'use_transport') {
    const ref = p.route;
    const key = `${ref.cartridge_id}@${ref.cartridge_version}:transport/${ref.key}`;
    const route = before.cartridge.transports?.[key];
    if (!route || decision.outcome !== 'transport_used') return questPaths;
    const destination = route.destination;
    const room =
      after.roomIds[
        `${destination.cartridge_id}@${destination.cartridge_version}:room/${destination.key}`
      ];
    return withQuests(
      before.state.containers[before.body] !== after.state.containers[after.body] &&
        after.state.containers[after.body] === room
        ? [`/transports/${key}`]
        : [],
    );
  }
  if (p.type === 'move') {
    if (before.state.containers[before.body] === after.state.containers[after.body])
      return questPaths;
    const view = gameView(after);
    const refs = new Map(Object.entries(after.entityIds).map(([ref, id]) => [id, ref]));
    const shown = [
      ...view.entities,
      ...view.inventory,
      ...(view.equipment ?? []).flatMap((slot) => (slot.item ? [slot.item] : [])),
    ];
    return withQuests([
      ...new Set(
        shown.flatMap(({ id }) => {
          const ref = refs.get(id);
          return ref?.includes(':item/')
            ? [`/items/${ref}`]
            : ref?.includes(':npc/')
              ? [`/npcs/${ref}`]
              : [];
        }),
      ),
    ]);
  }
  if (p.type === 'talk') {
    return withQuests(
      Object.entries(after.state.choices ?? {})
        .filter(
          ([id, choice]) =>
            choice.status === 'pending' &&
            choice.source.kind === 'dialogue' &&
            !before.state.choices?.[id],
        )
        .flatMap(([, choice]) => {
          const ref = choice.source;
          const key = `${ref.cartridge_id}@${ref.cartridge_version}:dialogue/${ref.key}`;
          const base = `/dialogues/${key}`;
          const root = after.cartridge.dialogues?.[key]?.policy.root;
          return [base, ...(root ? requiredPolicyPaths(root, `${base}/policy/root`) : [])];
        }),
    );
  }
  if (p.type === 'choose') {
    const choice = before.state.choices?.[p.continuation_id];
    if (choice?.status !== 'pending') return questPaths;
    if (choice.source.kind === 'dialogue') {
      const key = `${choice.source.cartridge_id}@${choice.source.cartridge_version}:dialogue/${choice.source.key}`;
      const base = `/dialogues/${key}/choices/${p.choice_id}`;
      const selected = before.cartridge.dialogues?.[key]?.choices[p.choice_id];
      const steps =
        selected?.sequence?.flatMap((step, index) => {
          if (step.op !== 'fact.assign' && step.op !== 'fact.adjust') return [];
          const old = value(before, p.actor_id, step.fact);
          const next =
            step.op === 'fact.assign'
              ? step.value
              : typeof old === 'number'
                ? old + step.amount
                : undefined;
          if (next === undefined || old === next || value(after, p.actor_id, step.fact) !== next)
            return [];
          return decision.events.some(
            (event) =>
              event.payload.type === 'fact_changed' &&
              JSON.stringify(event.payload.fact) === JSON.stringify(step.fact) &&
              event.payload.old === old &&
              event.payload.new === next,
          )
            ? [`${base}/sequence/${index}`]
            : [];
        }) ?? [];
      return withQuests([base, ...steps]);
    }
    const dream = gameView(before).notices?.find((notice) => notice.bed)?.dream;
    if (
      choice.source.kind !== 'scene' ||
      !dream ||
      dream.index !== 4 ||
      dream.choice?.continuation_id !== p.continuation_id ||
      !p.dream ||
      gameView(after).notices?.find((notice) => notice.bed)?.dream?.branch !== p.choice_id
    )
      return questPaths;
    const index = dream.choice.choices.findIndex((option) => option.choice_id === p.choice_id);
    if (index < 0) return questPaths;
    const base = `/scenes/${choice.source.cartridge_id}@${choice.source.cartridge_version}:scene/${choice.source.key}`;
    return withQuests([`${base}/steps/3`, `${base}/steps/3/choices/${index}`]);
  }
  if (p.type === 'continue') {
    const shown = gameView(before).scene;
    if (shown && p.scene && p.line === shown.index && p.scene.key === shown.scene.key) {
      const base = `/scenes/${shown.scene.cartridge_id}@${shown.scene.cartridge_version}:scene/${shown.scene.key}`;
      return withQuests([
        ...(shown.index === 1 ? [base] : []),
        `${base}/steps/${shown.index - 1}`,
        ...(shown.index === shown.count && !gameView(after).scene
          ? [`${base}/steps/${shown.count}`, `${base}/steps/${shown.count + 1}`]
          : []),
      ]);
    }
    const dream = gameView(before).notices?.find((notice) => notice.bed)?.dream;
    if (!dream || !p.scene || p.line !== dream.index || p.scene.key !== dream.scene.key)
      return questPaths;
    const base = `/scenes/${dream.scene.cartridge_id}@${dream.scene.cartridge_version}:scene/${dream.scene.key}`;
    const ended =
      dream.index === dream.count &&
      gameView(after).notices?.find((notice) => notice.bed)?.dream?.index === -1;
    return withQuests([
      ...(dream.index === 1 ? [base] : []),
      `${base}/steps/${dream.index - 1}`,
      ...(ended ? [`${base}/steps/${dream.count}`, `${base}/steps/${dream.count + 1}`] : []),
    ]);
  }
  if (p.type !== 'perform') return questPaths;
  const { id, version } = before.cartridge.manifest;
  const base = `/recipes/${id}@${version}:recipe/${p.action}`;
  const recipe = before.cartridge.recipes?.[`${id}@${version}:recipe/${p.action}`];
  if (!recipe) return questPaths;
  const witnessed = [base, ...requiredPolicyPaths(recipe.policy.root, `${base}/policy/root`)];
  const branch =
    decision.outcome === 'performed' || decision.outcome === 'success'
      ? 'success'
      : decision.outcome === 'failure'
        ? 'failure'
        : undefined;
  if (!branch) return withQuests(witnessed);
  const outcome = recipe.outcomes[branch];
  if (!outcome) return withQuests(witnessed);
  const steps = outcome.sequence.map((step, index) => {
    if (step.op === 'fact.assign') {
      const old = value(before, p.actor_id, step.fact);
      return old !== step.value &&
        value(after, p.actor_id, step.fact) === step.value &&
        decision.events.some(
          (event) =>
            event.payload.type === 'fact_changed' &&
            JSON.stringify(event.payload.fact) === JSON.stringify(step.fact) &&
            event.payload.old === old &&
            event.payload.new === step.value,
        )
        ? `${base}/outcomes/${branch}/sequence/${index}`
        : undefined;
    }
    if (step.op === 'event.emit')
      return decision.events.some(
        (event) =>
          event.payload.type === 'custom_event' &&
          event.payload.event.cartridge_id === id &&
          event.payload.event.cartridge_version === version &&
          event.payload.event.kind === 'event' &&
          event.payload.event.key === step.event,
      )
        ? `${base}/outcomes/${branch}/sequence/${index}`
        : undefined;
    return undefined;
  });
  const complete =
    steps.every((path) => path !== undefined) &&
    (steps.length > 0 ||
      (branch === 'failure' &&
        decision.events.some((event) => event.payload.type === 'check_failed')));
  return withQuests([
    ...witnessed,
    ...(complete ? [`${base}/outcomes/${branch}`] : []),
    ...steps.filter((path): path is string => path !== undefined),
  ]);
}

function requiredPolicyPaths(node: unknown, path: string): string[] {
  const policy = node as { op: string; items?: readonly unknown[] };
  return [
    path,
    ...(policy.op === 'all'
      ? (policy.items ?? []).flatMap((child, index) =>
          requiredPolicyPaths(child, `${path}/items/${index}`),
        )
      : []),
  ];
}

export function caseHost(
  loaded: LoadedCandidate,
  path: string,
  log?: string,
  kernelVersion = `loka-kernel@${'0'.repeat(40)}`,
  proof: object = {},
) {
  assert.equal(existsSync(path), false, 'E1 case requires a new isolated database');
  if (log) writeFileSync(log, '', { flag: 'wx' });
  const initial = newWorld(
    loaded.cartridge,
    '0d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f' as never,
    [1, 2, 3, 4],
  );
  const clock = { wall: 10000, mono: 0 };
  let p = sqliteHost(path, clock, kernelVersion),
    n = 0,
    lastRow = 0,
    previous = initial;
  const releases = [{ fresh: initial, content_hash: loaded.hash }] as const;
  const open = () => {
    const opened = openStory(p.db, releases, p.host);
    assert.equal(opened.kind, 'open');
    if (opened.kind !== 'open') throw new Error('E1 save did not open');
    return opened;
  };
  let story = open();
  let watched: Observer | undefined;
  const seen = coverage(),
    commands: Command[] = [],
    invocations: unknown[] = [];
  const digest = createHash('sha256');
  const record = (data: object) => {
    if (log) appendFileSync(log, `${JSON.stringify(data)}\n`);
  };
  record({
    kind: 'start',
    generator: CASE_GENERATOR,
    content_hash: loaded.hash,
    artifact_sha256: sha256(loaded.artifact),
    construction: 'fresh',
    initial_state: initial.state,
    initial_state_hash: hash(initial.state as never),
    identity: {
      context: initial.context,
      character: initial.character,
      body: initial.body,
      algorithm: 'loka-id-v1',
    },
    rng: { algorithm: 'xoshiro128**', state: initial.state.rng },
    logical_clock: initial.state.clock,
    host_clock: { ...clock },
    ...proof,
    run_id: story.runId(),
    kernel_version: kernelVersion,
  });
  const visit = (world: World) =>
    seen.rooms.add(
      gameView(world)
        .place.title.key.replace(/^room\./, '')
        .replace(/\.title$/, ''),
    );
  visit(initial);
  const observe = () => {
    const rows = p.sql
      .prepare('SELECT rowid,* FROM receipt WHERE rowid > ? ORDER BY rowid')
      .all(lastRow);
    if (!rows.length) return;
    assert.equal(rows.length, 1, 'E1 must observe every commit boundary');
    const r = rows[0]!,
      command = JSON.parse(String(r.command)) as Command | null;
    const decision = JSON.parse(String(r.response)) as DecisionResult,
      after = story.world();
    if (command) {
      commands.push(command);
      const observation = checked(AUTHORITY_KERNEL, previous, command, Number(r.revision));
      digest.update(observation.bytes);
      record({
        kind: 'step',
        obligations: witnessedObligations(previous, after, command, decision),
        command,
        revision: r.revision,
        decision,
        state_hash: hash(after.state as never),
        rng: after.state.rng,
        clock: after.state.clock,
        invariant_failure: observation.failure ?? null,
        receipt_sha256: sha256(JSON.stringify(r)),
        changed_rows: changedRows(p.sql, decision),
      });
      assert.equal(observation.failure, undefined, JSON.stringify(observation.failure));
      assert.equal(
        observation.bytes,
        `${encode(decision as never)}\n${hash(after.state as never)}\n`,
      );
      capture(seen, previous, after, command, decision);
      watched?.(previous, after, command, decision);
    } else {
      assert.equal(hash(after.state as never), hash(previous.state as never));
      record({
        kind: 'admission',
        revision: r.revision,
        decision,
        state_hash: hash(after.state as never),
      });
    }
    lastRow = Number(r.rowid);
    previous = after;
    visit(after);
  };
  story.onAdvance(observe);
  const attempt = (action_key: string, target_ids: string[] = [], input: object = {}) => ({
    invocation_id: `eeeeeeee-1111-4111-8111-${String(++n).padStart(12, '0')}`,
    actor_id: initial.character,
    action_key,
    target_ids,
    input,
  });
  const send = (invocation: ReturnType<typeof attempt>) => {
    invocations.push(invocation);
    let reply;
    try {
      reply = story.invoke(invocation);
    } catch (e) {
      record({
        kind: 'invocation',
        invocation,
        thrown: { code: (e as { errcode?: number }).errcode ?? null },
      });
      throw e;
    }
    if (reply.kind === 'saved') observe();
    record({ kind: 'invocation', invocation, reply });
    return reply;
  };
  const invoke = (
    action_key: string,
    target_ids: string[] = [],
    input: object = {},
    expected = 'accepted',
  ) => {
    const invocation = attempt(action_key, target_ids, input),
      reply = send(invocation);
    assert.equal(reply.kind, 'saved', JSON.stringify(reply));
    if (reply.kind === 'saved') {
      const d = reply.decision as unknown as DecisionResult;
      assert.equal(d.kind === 'rejected' ? d.error.code : d.kind, expected, JSON.stringify(d));
    }
    return { invocation, reply };
  };
  const ref = (kind: string, key: string) =>
    ({
      cartridge_id: 'ashmere_missing_child',
      cartridge_version: '0.0.42',
      kind,
      key,
    }) as DefinitionRef;
  return {
    initial,
    seen,
    commands,
    invocations,
    clock,
    digest: () => digest.copy().digest('hex'),
    record,
    invoke,
    attempt,
    send,
    watch: (observer: Observer) => {
      watched = observer;
    },
    get story() {
      return story;
    },
    get sql() {
      return p.sql;
    },
    get fault() {
      return p.fault;
    },
    view: () => gameView(story.world()),
    flag: (name: string) => value(story.world(), initial.character, ref('fact', name)),
    entity: (kind: string, key: string) =>
      initial.entityIds[`ashmere_missing_child@0.0.42:${kind}/${key}`]!,
    detail: (room: string, key: string) =>
      Object.entries(initial.details).find(
        ([, d]) => initial.rooms[d.room]?.key === room && d.key === key,
      )![0],
    move: (...directions: string[]) =>
      directions.forEach((direction) => invoke('move', [], { direction })),
    choose: (choice_id: string, answer?: string) =>
      invoke('choose', [], {
        continuation_id: gameView(story.world()).choice!.continuation_id,
        choice_id,
        ...(answer && { answer }),
      }),
    next: () => {
      const view = gameView(story.world()),
        text = (key: string) => loaded.cartridge.text![key] ?? key;
      const button = buttonsOf(view, text, text).find((b) => b.action_key === 'continue')!;
      assert.ok(button, 'Book must offer the shown scene Continue');
      return invoke(button.action_key, button.target_ids, button.input);
    },
    elapsed: (milliseconds: number) => {
      record({ kind: 'elapsed_request', milliseconds });
      clock.wall += milliseconds;
      clock.mono += milliseconds;
      let status = story.pulse('active', story.runId());
      while (status.kind === 'catching_up') {
        const before = story.world().state.clock;
        status = story.pulse('drain', story.runId());
        assert.ok(story.world().state.clock > before, 'E1 elapsed drain made no progress');
      }
      assert.equal(status.kind, 'ready', JSON.stringify(status));
      observe();
    },
    reopen: () => {
      const before = hash(story.world().state as never);
      const newId = p.host.newId;
      p.sql.close();
      p = sqliteHost(path, clock, kernelVersion);
      p.host.newId = newId;
      story = open();
      story.onAdvance(observe);
      assert.equal(
        hash(story.world().state as never),
        before,
        'cold reopen changes the committed state',
      );
      record({ kind: 'reopen', state_hash: before });
    },
    close: () => p.sql.close(),
  };
}
export type CaseHost = ReturnType<typeof caseHost>;

function changedRows(sql: ReturnType<typeof sqliteHost>['sql'], decision: DecisionResult) {
  if (decision.kind !== 'accepted') return [];
  const keys = new Map<string, readonly [string, string]>();
  for (const op of decision.delta.ops) {
    const address = row(target(op));
    if (address) keys.set(JSON.stringify(address), address);
  }
  return [...keys.values()].map(([section, key]) => ({
    section,
    key,
    value:
      sql.prepare('SELECT value FROM state_row WHERE section=? AND key=?').get(section, key)
        ?.value ?? null,
  }));
}

function capture(
  seen: Coverage,
  before: World,
  after: World,
  command: Command,
  decision: DecisionResult,
) {
  seen.commands.add(command.payload.type);
  if (decision.kind !== 'accepted') return;
  for (const q of Object.values(after.state.quests ?? {}))
    seen.quests.add(`${q.quest.key}/${q.state}${q.outcome ? `/${q.outcome}` : ''}`);
  const p = command.payload;
  if (p.type === 'choose') {
    const choice = before.state.choices?.[p.continuation_id];
    if (choice?.source.kind === 'dialogue') seen.choices.add(`${choice.source.key}/${p.choice_id}`);
  }
  if (p.type === 'talk') {
    for (const c of Object.values(after.state.choices ?? {}))
      if (c.status === 'pending' && c.source.kind === 'dialogue') seen.dialogues.add(c.source.key);
  }
  const view = gameView(before);
  if (p.type === 'continue' && view.scene)
    seen.scenes.add(`${view.scene.scene.key}/${view.scene.index}`);
  for (const notice of view.notices ?? [])
    if (notice.dream && (p.type === 'continue' || p.type === 'choose'))
      seen.scenes.add(`${notice.dream.scene.key}/${notice.dream.index}`);
}
