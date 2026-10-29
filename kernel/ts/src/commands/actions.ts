// ActionSet: engine, cartridge, room, choice; combat restricts admission/projection (06 §19).
import {
  CAPABILITY_OWNERS,
  type ActionContribution,
  type ActionInputParameter,
  type ScriptedAction,
  type CharacterId,
  type CommandPayload,
  type ContinuationId,
  type DefinitionRef,
  type EntityId,
  type Key,
  type ScriptedTarget,
  type TargetSpec,
  type TextKey,
  type UnavailableReason,
  type Policy,
} from '../contracts.gen.ts';
import { key, same } from '../foundation/compose.ts';
import { bodyOf, refString, type Steps, type World } from '../runtime/decision.ts';
import { questOf } from '../mechanics/lookups.ts';
import { modal, pending, talks } from '../mechanics/dialogue/shared.ts';
import { permits } from '../mechanics/status/permits.ts';
import { sub } from '../foundation/int.ts';
import { pay } from '../mechanics/resource.ts';
import { accepts, aimedOffers, hiddenTarget, primaryTarget } from './action_input.ts';
import * as scene from '../mechanics/scene/shared.ts';
import { holds } from '../mechanics/policy.ts';
import { VERBS } from './verbs.ts';
import { engaged } from '../mechanics/combat/shared.ts';
import { eligible } from '../mechanics/combat/behavior.ts';
import { choice as characterChoice } from '../mechanics/attributes/shared.ts';
import { levelling } from '../mechanics/levelling/shared.ts';
import { castAdmission, craftRefused, useAdmission } from '../mechanics/scripted_action/shared.ts';
import { spellOf } from '../mechanics/scripted_action/shared.ts';

/**
 * One action of a set: what the GameView advertises, the Command type it resolves to, the
 * scripted action when it is one (whose invocation needs no target: the scripted action names its own), the quest
 * when it is a quest's offer (accept_quest of that quest), the speaker when it is a dialogue's
 * talk (its only target), the continuation when it is close_choice of the pending choice, and
 * whether it is an engine verb, whose rule is its target and input contract (see accepts).
 */
export type Offered = {
  readonly key: Key;
  readonly label: TextKey;
  readonly target: TargetSpec;
  readonly input: readonly ActionInputParameter[];
  readonly priority: number;
  readonly policy?: Policy;
  readonly command: Key;
  readonly scripted?: ScriptedAction;
  readonly quest?: DefinitionRef;
  readonly speaker?: EntityId;
  readonly dialogue?: DefinitionRef;
  readonly continuation?: ContinuationId;
  readonly engine?: true;
};
export type ActionSet = Readonly<Record<string, Offered>>;

// Toolbox row 4: Raise is offered only while the cartridge levels and points remain.
const points = (world: World, actor: CharacterId) => (levelling(world, actor)?.unspent ?? 0) > 0;

const SPEECH = ['say', 'whisper', 'shout', 'ask'];

export const needsAncestry = (world: World, actor: CharacterId) =>
  !!world.cartridge.ancestries && !characterChoice(world, actor);

/** `set` with contribution `c` applied by one of ADR-016's operations. */
export function apply(set: ActionSet, op: ActionContribution['op'], c: ActionSet): ActionSet {
  const keep = (inC: boolean) =>
    Object.fromEntries(Object.entries(set).filter(([k]) => Object.hasOwn(c, k) === inC));
  switch (op) {
    case 'union':
      return { ...c, ...set };
    case 'override':
      return { ...set, ...c };
    case 'replace':
      return c;
    case 'subtract':
      return keep(false);
    case 'intersect':
      return keep(true);
  }
}

// The engine verbs whose owning capability the cartridge locks, labelled action.<verb>.
function engine(world: World, actor: CharacterId): ActionSet {
  const locked = (verb: string) =>
    Object.hasOwn(world.cartridge.lock.capabilities, CAPABILITY_OWNERS.command[verb].split('@')[0]);
  return Object.fromEntries(
    Object.entries(VERBS)
      .filter(
        ([verb]) =>
          locked(verb) &&
          verb !== 'expedition' &&
          !(verb === 'wait' && world.cartridge.manifest.time_policy),
      )
      .filter(([verb]) => verb !== 'choose_ancestry' || needsAncestry(world, actor))
      .filter(([verb]) => verb !== 'raise_attribute' || points(world, actor))
      // Row 29a: cast only in a cartridge with a spell.
      .filter(
        ([verb]) => verb !== 'cast' || allScripted(world).some((r) => r.target.kind === 'spell'),
      )
      // Row G9: no speech while a conversation is open (the speech rule refuses it too).
      .filter(([verb]) => !SPEECH.includes(verb) || !pending(world, actor))
      .map(([verb, [target, input]]): [string, Offered] => {
        const key = verb as Key;
        const label = `action.${verb}` as TextKey;
        const verb_ = { key, label, target, input, priority: 0, command: key };
        return [key, { ...verb_, engine: true }];
      }),
  );
}

// The cartridge's actions, scripted actions, aimed spells, offers of quests `actor` has no instance of (a
// quest may have none) and talks of dialogues whose speaker is in the actor's room (several per
// speaker), by key: disjoint, since the compiler rejects a scripted action, quest or dialogue
// whose key is an action's, a scripted action's, a quest's or a registered command's (DUPLICATE_DEFINITION).
function cartridge(world: World, actor: CharacterId): ActionSet {
  const scripted_actions = keyed(world).map((scripted): [string, Offered] => {
    const { key, name: label, priority, policy } = scripted;
    // A use scripted action (row G4) is listed on the held tool, paired with each target (view/use.ts).
    const target: TargetSpec =
      scripted.target.kind === 'use'
        ? { kind: 'entity', scopes: ['room_contents', 'inventory'] }
        : { kind: 'none' };
    const command = 'perform' as Key;
    return [key, { key, label, target, input: [], priority, policy, command, scripted }];
  });
  const actions = Object.values(world.cartridge.actions).map(
    ({ name, ...a }): [string, Offered] => [a.key, { ...a, label: name as TextKey }],
  );
  const { id: cartridge_id, version: cartridge_version } = world.cartridge.manifest;
  const quests = Object.values(world.cartridge.quests ?? {}).flatMap(({ key, offer }) => {
    const quest = { cartridge_id, cartridge_version, kind: 'quest', key } as DefinitionRef;
    if (!offer || questOf(world, actor, quest)) return [];
    const command = 'accept_quest' as Key;
    const o = { key, ...offer, target: { kind: 'none' }, input: [], priority: 0, command, quest };
    return [[key, o] as [string, Offered]];
  });
  return Object.fromEntries([...actions, ...scripted_actions, ...quests, ...talks(world, actor)]);
}

/**
 * `actor`'s ActionSet before any policy is evaluated: every source composed, in order, then the
 * answers to a pending choice (modal state, mechanics/dialogue/shared.ts modal; 06 §37: no room contribution
 * removes them; combat filters the result afterward), which lists never renders directly.
 */
export function composed(world: World, actor: CharacterId): ActionSet {
  if (needsAncestry(world, actor)) return { choose_ancestry: engine(world, actor).choose_ancestry };
  if (scene.running(world, actor)) return scene.modal();
  const [verbs, own] = [engine(world, actor), cartridge(world, actor)];
  const all = { ...verbs, ...own };
  const body = bodyOf(world, actor);
  const room = body === undefined ? undefined : world.rooms[world.state.containers[body]];
  const set = (room?.actions ?? []).reduce(
    (set, c) =>
      apply(
        set,
        c.op,
        Object.fromEntries(c.actions.filter((k) => Object.hasOwn(all, k)).map((k) => [k, all[k]])),
      ),
    apply(apply({}, 'union', verbs), 'override', own),
  );
  const aimed = set.cast && Object.fromEntries(aimedOffers(world, actor)); // where cast is offered (loka-x6t.109)
  return { ...set, ...aimed, ...modal(world, actor) };
}

const fighting = (world: World, actor: CharacterId, body = bodyOf(world, actor)) =>
  body && engaged(world, body);

/** Final actor restriction; only internal escape policy reads the pre-combat composed set. */
export function resolved(world: World, actor: CharacterId): ActionSet {
  const set = composed(world, actor);
  const fight = fighting(world, actor);
  // Toolbox row 6a: an opted-in roster fight keeps Attack to choose among the members still here
  // (the row's roster is pruned only at round end, rows 6a/6c); row 29b keeps cast (a fire bolt).
  const choosing =
    !!world.cartridge.world?.combat?.target_choice &&
    (fight?.row.active_ids?.filter((id) => eligible(world, fight.row, id)).length ?? 0) > 1;
  const kept = (c: string) =>
    !fight ||
    ['flee', 'stand', 'look', 'scan', 'bandage', 'cast'].includes(c) ||
    (c === 'attack' && choosing);
  const free = permits(world, actor); // status reader 4
  return Object.fromEntries(
    Object.entries(set).filter(([, a]) => kept(a.command) && free(a.command)),
  );
}

// Status reader 4: a type the composed set offers but the actor's statuses bar.
const barred = (world: World, actor: CharacterId, type: string) =>
  !permits(world, actor)(type) &&
  Object.values(composed(world, actor)).some((a) => a.command === type);

/** The target id of a scripted action's detail (the compiler checks it exists). */
export const detailOf = (world: World, t: Extract<ScriptedTarget, { kind: 'detail' }>): EntityId =>
  Object.keys(world.details).find(
    (id) =>
      world.details[id].room === world.roomIds[refString(t.room)] &&
      world.details[id].key === t.detail,
  ) as EntityId;

/** The detail an offered scripted action acts on; none for another action or a use scripted action (row G4). */
export const detailAt = (world: World, a: Offered) =>
  a.scripted?.target.kind === 'detail' ? detailOf(world, a.scripted.target) : undefined;

/**
 * Why `actor` may not issue `payload` now, if it may not (04 §19; ACT-09): no action of its set
 * resolves to that Command and accepts its target and input (unsupported_capability), or for
 * perform a key that names no scripted action of the cartridge or for accept_quest a quest it does not
 * declare (not_found), or none that does is available, its policy failing (invalid_state). Each
 * policy leaf it evaluates adds one to the decision's `steps` (04 §5.4 query_steps). Given the
 * invoked `action`, only that action of the set is matched. A projection may supply the already
 * composed `set` to reuse it across targets.
 */
import { visible } from '../mechanics/light/shared.ts';

export const refusal = (...args: Parameters<typeof refusalReason>) => refusalReason(...args)?.code;

const untimed = (world: World, p: CommandPayload) =>
  p.type === 'wait' && !!world.cartridge.manifest.time_policy && !fighting(world, p.actor_id);

/** refusal with its reason: a failed spell policy carries the scripted action's `reason` text (loka-j64e). */
// size: allow 43, the reason rides the same admission chain as the code
export function refusalReason(
  world: World,
  payload: CommandPayload,
  steps: Steps,
  action?: Key,
  set?: ActionSet,
): UnavailableReason | undefined {
  const gated = 'actor_id' in payload && !['choose_ancestry', 'elapsed'].includes(payload.type);
  if (gated && needsAncestry(world, payload.actor_id)) return { code: 'invalid_state' }; // `in`: types only, run_job never gets here
  if (untimed(world, payload)) return { code: 'permission_denied' };
  const actor = (payload as { actor_id: CharacterId }).actor_id;
  const offers = Object.values(set ?? resolved(world, actor));
  const cast = payload.type === 'cast' && offers.some((a) => a.key === 'cast');
  if (cast && !spellOf(world, actor, payload.word)) return { code: 'invalid_state' }; // row 29a: where cast is offered, the word before any target check (loka-x6t.109)
  if (hiddenTarget(world, payload, steps)) return { code: 'not_present' };
  const perform = payload.type === 'perform';
  const matching = offers.filter(
    (a) =>
      (action === undefined || a.key === action) &&
      (perform ? a.scripted && a.key === payload.action : accepts(world, actor, a, payload, steps)),
  );
  const unknown =
    (perform && !scriptedKeys(world).includes(payload.action)) ||
    (payload.type === 'accept_quest' && !world.cartridge.quests?.[refString(payload.quest)]);
  if (unknown || !matching.length)
    return {
      code: unknown
        ? 'not_found'
        : fighting(world, actor) || barred(world, actor, payload.type)
          ? 'invalid_state'
          : 'unsupported_capability',
    };
  const use = useAdmission(world, matching[0]!.scripted, payload, steps); // row G4
  const used = use ? { code: use } : castAdmission(world, payload, steps); // row 29a
  const ok = (a: Offered, d = detailAt(world, a)) =>
    (d === undefined || visible(world, actor, d, steps)) &&
    holds(world, actor, a.policy, { target: d ?? primaryTarget(payload), steps });
  // An offered action's reason text is the GameView's (view/action_lists.ts); only cast's and craft's reach here.
  if (used || !matching.some((a) => ok(a))) return used ?? { code: 'invalid_state' };
  return craftRefused(world, matching[0]!.scripted, actor, steps); // after policy, as the offer (hs-10)
}

// A spell (row 29a) is cast by its word, never performed by its key (an aimed one is offered).
const allScripted = (world: World) => Object.values(world.cartridge.scripted_actions ?? {});
const keyed = (world: World) => allScripted(world).filter((r) => r.target.kind !== 'spell');
const scriptedKeys = (world: World) => keyed(world).map((r) => r.key);

/**
 * A scripted action's admission for `actor_id` acting through `body`, after its policy and target, shared
 * by the rule and the GameView: cooldown while the time since the actor's last admitted attempt
 * is below the scripted action's cooldown (never overflows: 0 <= last <= now), then insufficient_resource
 * when the body cannot pay the costs (mechanics/resource.ts pay); else the paid ops and levels, the last
 * attempt's time and now. Read-only, before any draw.
 */
export function admission(
  world: World,
  scripted: ScriptedAction,
  actor_id: CharacterId,
  body: EntityId,
) {
  const from = world.state.clock;
  const last = world.state.cooldowns?.[key({ kind: 'cooldown', actor_id, action: scripted.key })];
  if (scripted.cooldown && last !== undefined && sub(from, last) < scripted.cooldown)
    return 'cooldown' as const;
  const paid = pay(world, body, scripted.costs ?? []);
  return paid ? { paid, last, from } : ('insufficient_resource' as const);
}
