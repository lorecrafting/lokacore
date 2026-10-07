import { gameView, type World } from '../src/index.ts';
import type { Command, DecisionResult, DefinitionRef, EntityId } from '../src/contracts.gen.ts';
import { value } from '../src/mechanics/fact.ts';
import { holds } from '../src/mechanics/policy.ts';
import { refString } from '../src/runtime/decision.ts';
import { knowledgeChoiceStep } from './e1_knowledge_effects.ts';
import { identityWitnesses } from './e1_identity.ts';
import { level, resourceSpec } from '../src/mechanics/resource.ts';
import { same } from '../src/foundation/compose.ts';

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
    return [
      base,
      `${base}/objective`,
      ...(root ? requiredPolicyPaths(root, `${base}/objective/policy/root`) : []),
    ];
  });
  questPaths.push(
    ...journalVariantPaths(after),
    ...identityWitnesses(before, after, command, decision),
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

function journalVariantPaths(world: World): string[] {
  return gameView(world).journal.flatMap((shown) => {
    if (shown.state !== 'active') return [];
    const key = refString(shown.quest);
    const variants = world.cartridge.quests?.[key]?.journal?.active_variants;
    const index = variants?.findIndex((v) => holds(world, world.character, v.when.root)) ?? -1;
    const selected = variants?.[index];
    if (!selected || shown.journal !== selected.text) return [];
    return requiredPolicyPaths(
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
