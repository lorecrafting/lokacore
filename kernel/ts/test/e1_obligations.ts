// size: allow 540, the reaction witness reuses creditedPolicyPaths beside the other obligation witnesses
import { gameView, type World } from '../src/index.ts';
import type {
  CharacterId,
  Command,
  DecisionResult,
  DefinitionRef,
  EntityId,
  Policy,
} from '../src/contracts.gen.ts';
import { value } from '../src/mechanics/fact.ts';
import { holds } from '../src/mechanics/policy.ts';
import { refString } from '../src/runtime/decision.ts';
import { detailOf } from '../src/commands/actions.ts';
import { knowledgeChoiceStep } from './e1_knowledge_effects.ts';
import { identityWitnesses } from './e1_identity.ts';
import { creatureWitnesses } from './e1_creatures.ts';
import { level, resourceSpec } from '../src/mechanics/resource.ts';
import { key, same } from '../src/foundation/compose.ts';
import { apply } from '../src/runtime/apply.ts';
import { triggered } from '../src/mechanics/reaction.ts';
import { questOf } from '../src/mechanics/lookups.ts';

// ponytail: bind only reviewed dialogue/choice/policy, scene, recipe, quest, service and visible-entity witnesses;
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
    const actor = quest.scope.kind === 'player' ? quest.scope.character_id : after.character;
    return [
      base,
      `${base}/objective`,
      ...(root ? objectivePaths(before, after, actor, root, `${base}/objective/policy/root`) : []),
    ];
  });
  questPaths.push(
    ...journalVariantPaths(after),
    ...identityWitnesses(before, after, command, decision),
    ...creatureWitnesses(before, after, decision),
    ...reactionWitnesses(before, after, decision),
  );
  const withQuests = (paths: string[]) => [...paths, ...questPaths];
  if (p.type === 'use_service') {
    const key = refString(p.service);
    if (decision.outcome !== 'service_used') return questPaths;
    const service = before.cartridge.services?.[key];
    if (!service) throw new Error(`accepted use_service names unknown service ${key}`);
    if (
      p.actor_id !== before.character ||
      p.provider_id !== entityId(before, service.provider) ||
      p.quoted_price !== service.price
    )
      return questPaths;
    const ops = decision.delta.ops;
    const adjusted = (holder: EntityId, resource: DefinitionRef, amount: number) => {
      const old = level(before, holder, resource);
      const next = level(after, holder, resource);
      return (
        old !== undefined &&
        next === old + amount &&
        ops.some(
          (op) =>
            op.op === 'resource.adjust' &&
            op.entity_id === holder &&
            same(op.resource, resource) &&
            op.from === old &&
            op.to === next,
        )
      );
    };
    if (
      !adjusted(before.body, service.currency, -service.price) ||
      !adjusted(p.provider_id, service.currency, service.price)
    )
      return questPaths;
    const benefit = service.benefit;
    let committed = false;
    if (benefit.kind === 'entitlement') {
      committed = ops.some(
        (op) =>
          op.op === 'fact.assign' &&
          same(op.fact, benefit.fact) &&
          op.scope.kind === 'player' &&
          op.scope.character_id === p.actor_id &&
          op.expected === false &&
          op.value === true,
      );
    } else {
      const old = level(before, before.body, benefit.recovery);
      const maximum = resourceSpec(before, before.body, benefit.recovery)?.maximum;
      const gain =
        old === undefined || maximum === undefined
          ? 0
          : Math.min(old + benefit.amount, maximum) - old;
      // A capped adjust with from == to cannot be told apart from a benefit that adds nothing.
      const recovered = gain > 0 && adjusted(before.body, benefit.recovery, gain);
      if (benefit.kind === 'meal')
        committed = recovered && adjusted(p.provider_id, benefit.stock, -benefit.debit);
      else {
        const vessel = entityId(before, benefit.vessel);
        const previous = before.state.liquids?.[vessel];
        const current = after.state.liquids?.[vessel];
        const liquid = previous?.kind && before.cartridge.liquids?.[refString(previous.kind)];
        committed =
          recovered &&
          before.state.containers[vessel] === p.provider_id &&
          !!previous?.kind &&
          same(previous.kind, benefit.liquid) &&
          !!liquid &&
          current?.quantity === previous.quantity - liquid.drink_amount &&
          ops.some(
            (op) =>
              op.op === 'liquid.set' &&
              op.item_id === vessel &&
              JSON.stringify(op.from) === JSON.stringify(previous) &&
              JSON.stringify(op.to) === JSON.stringify(current),
          );
      }
    }
    return withQuests(committed ? [`/services/${key}`] : []);
  }
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
          return [
            base,
            ...(root
              ? creditedPolicyPaths(before, p.actor_id, root, `${base}/policy/root`, p.target_id)
              : []),
          ];
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
          if (step.op !== 'fact.assign' && step.op !== 'fact.adjust')
            return knowledgeChoiceStep(before, after, command, decision, step)
              ? [`${base}/sequence/${index}`]
              : [];
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
  const witnessed = [
    base,
    ...creditedPolicyPaths(
      before,
      p.actor_id,
      recipe.policy.root,
      `${base}/policy/root`,
      detailOf(before, recipe.target),
    ),
  ];
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

// docs/system/architecture.md#e1-policy-branch-evidence: credit a node only at positive polarity,
// when it holds and every ancestor evaluated to its own polarity, starting from a root that holds.
export function creditedPolicyPaths(
  world: World,
  actor: CharacterId,
  root: Policy,
  path: string,
  target?: EntityId,
): string[] {
  const walk = (node: Policy, at: string, value: boolean, positive: boolean): string[] => {
    if (value !== positive) return [];
    const children =
      node.op === 'not'
        ? [[node.item, `${at}/item`] as const]
        : node.op === 'all' || node.op === 'any'
          ? node.items.map((child, i) => [child, `${at}/items/${i}`] as const)
          : [];
    // A child's value follows from its parent unless an `any` held or an `all` failed.
    const valueOf = (child: Policy) =>
      node.op === 'not'
        ? !value
        : (node.op === 'all') === value
          ? value
          : holds(world, actor, child, { target, steps: { n: 0 } });
    return [
      ...(positive ? [at] : []),
      ...children.flatMap(([child, childAt]) =>
        walk(child, childAt, valueOf(child), node.op === 'not' ? !positive : positive),
      ),
    ];
  };
  return walk(root, path, holds(world, actor, root, { target, steps: { n: 0 } }), true);
}

// Resolution judges an objective before the command (dialogue) or mid-command after effects
// (reaction, scene); credit what holds at both boundaries, else at the one where the root holds.
export function objectivePaths(
  before: World,
  after: World,
  actor: CharacterId,
  root: Policy,
  path: string,
): string[] {
  const early = creditedPolicyPaths(before, actor, root, path);
  const late = creditedPolicyPaths(after, actor, root, path);
  return early.length && late.length ? early.filter((p) => late.includes(p)) : [...early, ...late];
}

// architecture.md creatures paragraph: every apply step has an exact committed effect in one writer
// group G; the `when` is judged on the state the delivery read (before + ops of groups before G).
// Effect events must name the cause; a quest.fail (no event) is bound only by sharing G.
// ponytail: each step takes its first matching op and the first matching cause, the actor is the
// world's player, and groups below G are taken as the read prefix (v042: one player, one delivery
// per rule, no due-job group reuse in a reacting step); bind per delivery when that grows.
export function reactionWitnesses(before: World, after: World, decision: DecisionResult): string[] {
  if (decision.kind !== 'accepted') return [];
  const ops = decision.delta.ops,
    events = decision.events,
    actor = before.character;
  return Object.entries(before.cartridge.reactions ?? {}).flatMap(([ref, rule]) => {
    const cause = events.find((e) => triggered(before, e).includes(rule));
    if (!cause) return [];
    const causeId: string = cause.id;
    const groups = rule.apply.map((step) => {
      if (step.op === 'quest.activate') {
        const op = ops.find((o) => o.op === 'quest.activate' && same(o.quest, step.quest));
        const row = op?.op === 'quest.activate' ? after.state.quests?.[op.instance_id] : undefined;
        return op?.op === 'quest.activate' &&
          !questOf(before, actor, step.quest) &&
          row?.state === 'active' &&
          same(row.scope, { kind: 'player', character_id: actor }) &&
          events.some(
            (e) =>
              e.causation_id === causeId &&
              e.payload.type === 'quest_activated' &&
              e.payload.instance_id === op.instance_id,
          )
          ? op.writer_group
          : undefined;
      }
      if (step.op === 'quest.resolve' || step.op === 'quest.fail') {
        const to = step.op === 'quest.resolve' ? 'resolved' : 'failed';
        const prior = questOf(before, actor, step.quest);
        const op = ops.find(
          (o) =>
            o.op === 'quest.transition' &&
            o.instance_id === prior?.[0] &&
            o.to === to &&
            o.outcome === step.outcome,
        );
        const row = prior && after.state.quests?.[prior[0]];
        return op &&
          prior &&
          (prior[1].state === 'active' || prior[1].state === 'objectives_complete') &&
          row?.state === to &&
          row.outcome === step.outcome &&
          (to === 'failed' ||
            events.some(
              (e) =>
                e.causation_id === causeId &&
                e.payload.type === 'quest_resolved' &&
                e.payload.instance_id === prior[0] &&
                e.payload.outcome === step.outcome,
            ))
          ? op.writer_group
          : undefined;
      }
      if (step.op === 'fact.assign') {
        const op = ops.find(
          (o) => o.op === 'fact.assign' && same(o.fact, step.fact) && o.value === step.value,
        );
        return op?.op === 'fact.assign' &&
          op.expected !== step.value &&
          value(after, actor, step.fact) === step.value &&
          events.some(
            (e) =>
              e.causation_id === causeId &&
              e.payload.type === 'fact_changed' &&
              same(e.payload.fact, step.fact) &&
              e.payload.old === op.expected &&
              e.payload.new === step.value,
          )
          ? op.writer_group
          : undefined;
      }
      if (step.op !== 'population.suppress') return undefined;
      const prior = before.state.population_plans?.[key(step.plan)],
        next = after.state.population_plans?.[key(step.plan)];
      const op = ops.find(
        (o) =>
          o.op === 'population.control' &&
          same(o.plan, step.plan) &&
          same(o.expected, prior) &&
          same(o.value, next),
      );
      // ponytail: the row names the cause event, not the reaction, so two reactions on one
      // event suppressing the same plan could both be credited (v042 cannot reach this);
      // bind the suppression row to the reaction if a cartridge can.
      return op?.op === 'population.control' &&
        prior &&
        !prior.suppression &&
        next?.suppression?.cause_event_id === cause.id &&
        next.suppression.ends_at === cause.logical_time + step.duration
        ? op.writer_group
        : undefined;
    });
    const group = groups[0]; // undefined without apply steps
    if (group === undefined || groups.some((g) => g !== group)) return [];
    const read = apply(
      before,
      ops.filter((o) => o.writer_group < group),
      false,
    );
    if ('fault' in read) return [];
    const base = `/reactions/${ref}`;
    const when = rule.when
      ? creditedPolicyPaths(
          { ...read.world, state: { ...read.world.state, clock: cause.logical_time } },
          actor,
          rule.when.root,
          `${base}/when/root`,
        )
      : [];
    if (rule.when && !when.length) return [];
    return [base, ...when, ...rule.apply.map((_, i) => `${base}/apply/${i}`)];
  });
}

function journalVariantPaths(world: World): string[] {
  return gameView(world).journal.flatMap((shown) => {
    if (shown.state !== 'active') return [];
    const key = refString(shown.quest);
    const variants = world.cartridge.quests?.[key]?.journal?.active_variants;
    const index = variants?.findIndex((v) => holds(world, world.character, v.when.root)) ?? -1;
    const selected = variants?.[index];
    if (!selected || shown.journal !== selected.text) return [];
    return creditedPolicyPaths(
      world,
      world.character,
      selected.when.root,
      `/quests/${key}/journal/active_variants/${index}/when/root`,
    );
  });
}

function entityId(world: World, ref: DefinitionRef): EntityId {
  const id = world.entityIds[refString(ref)];
  if (id === undefined) throw new Error(`E1 service names unplaced entity ${refString(ref)}`);
  return id;
}
