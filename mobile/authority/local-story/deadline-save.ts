// Reconcile a bound deadline against the original choices, due job, facts and conserved payment.
import type { DefinitionRef } from '../../../kernel/ts/src/contracts.gen.ts';
import { key, same } from '../../../kernel/ts/src/foundation/compose.ts';
import { validOverrideRow } from '../../../kernel/ts/src/foundation/resource.ts';
import { validate } from '../../../kernel/ts/src/foundation/validate.ts';
import { bind } from '../../../kernel/ts/src/mechanics/dialogue/shared.ts';
import { value } from '../../../kernel/ts/src/mechanics/fact.ts';
import { refString, type ChoiceRow, type World } from '../../../kernel/ts/src/runtime/decision.ts';
import {
  choiceReceipt,
  expiryReceipt,
  invalid,
  terminalAxis,
  type Deadline,
  within,
} from './deadline-receipts.ts';
import { committedDialogue } from './dialogue-receipt.ts';
import type { Db, Meta } from './store.ts';

const rowFor = (world: World, ref: DefinitionRef, entity_id: string) =>
  world.state.resources?.[key({ kind: 'resource', resource: ref, entity_id })];
type Choices = [string, ChoiceRow][];

export function deadlineSave(world: World, db: Db, meta: Meta, exchanges = false) {
  const scope = `story/${meta.lineage_id}/${world.character}`;
  const choices = Object.entries(world.state.choices ?? {});
  for (const job of Object.values(world.state.jobs ?? {}))
    if (
      !job ||
      validate('DefinitionRef', job.job).length ||
      (job.quest_instance_id !== undefined &&
        (validate('QuestInstanceId', job.quest_instance_id).length ||
          validate('CharacterId', job.actor_id).length))
    )
      invalid();
  for (const [questRef, definition] of Object.entries(world.cartridge.quests ?? {})) {
    // Toolbox row W24: a generic deadline has no fact and no bound offer to reconcile.
    if (!definition.deadline?.fact) continue;
    const d = setting(world, choices, questRef, definition.deadline as Deadline);
    if (d.q) bound(world, db, scope, choices, d, exchanges);
    else unbound(world, d);
  }
}

// The one dialogue offering the quest, its accepted choice and instance, and their bound roles.
function offerOf(world: World, choices: Choices, questRef: string) {
  const offers = Object.values(world.cartridge.dialogues ?? {}).filter((d) =>
    Object.values(d.choices).some((o) => o.accept && refString(o.accept) === questRef && o.receive),
  );
  if (offers.length !== 1) invalid();
  const offer = offers[0];
  const accepted = choices.filter(
    ([, row]) =>
      refString(row.source) === refString({ ...offer.npc, kind: 'dialogue', key: offer.key }) &&
      row.status === 'resolved' &&
      !!offer.choices[row.choice_id!]?.accept,
  );
  const instances = Object.entries(world.state.quests ?? {}).filter(
    ([, q]) => refString(q.quest) === questRef,
  );
  if (accepted.length > 1 || instances.length > 1 || accepted.length !== instances.length)
    invalid();
  const bound = bind(world, offer);
  const receive = Object.values(offer.choices).find((o) => o.receive)!.receive!;
  const ledger = bound.find((r) => r.role === receive.item)?.entity_id;
  const peg = bound.find((r) => r.role === receive.from)?.entity_id;
  const terminal =
    Object.values(world.cartridge.dialogues ?? {}).find(
      (d) => d.quest && refString(d.quest) === questRef,
    ) ?? invalid();
  if (!ledger || !peg) invalid();
  return { offer, accepted, instances, bound, peg: peg!, terminal, ledger: ledger! };
}

function setting(world: World, choices: Choices, questRef: string, deadline: Deadline) {
  const o = offerOf(world, choices, questRef);
  const holder = world.state.containers[o.ledger];
  const jobs = Object.entries(world.state.jobs ?? {}).filter(
    ([, job]) => refString(job.job) === questRef,
  );
  const fact = value(world, world.character, deadline.fact);
  const trust = value(world, world.character, deadline.trust_fact);
  const [instance, q] = o.instances[0] ?? [];
  return { ...o, ...funds(world, o), deadline, holder, jobs, fact, trust, instance, q };
}

// The payment the terminal choice moves, with both balances it must have conserved.
function funds(world: World, { terminal, bound }: ReturnType<typeof offerOf>) {
  const funding = Object.values(terminal.choices).find((o) => o.payment)?.payment ?? invalid();
  const aldric = bound.find((r) => r.role === funding.from)?.entity_id;
  const resource = funding.resource;
  const spec = world.resourceSpecs[key(resource)];
  const start = world.cartridge.npcs?.[refString(terminal.npc)]?.resource_starts?.[resource.key];
  const actorBalance = rowFor(world, resource, world.body);
  const npcBalance = aldric && rowFor(world, resource, aldric);
  if (
    !aldric ||
    !spec ||
    start === undefined ||
    !validOverrideRow(actorBalance, spec, world.state.clock) ||
    !validOverrideRow(npcBalance, spec, world.state.clock)
  )
    invalid();
  const commerce = Object.values(world.cartridge.npcs ?? {}).some(
    (n) => n.shop && same(n.shop.resource, resource),
  );
  return {
    funding,
    aldric,
    spec: spec!,
    start,
    actorBalance,
    npcBalance,
    commerce,
  };
}
type Setting = ReturnType<typeof setting>;

function unbound(world: World, d: Setting) {
  if (
    d.holder !== d.peg ||
    d.jobs.length ||
    d.fact !== world.factDefaults[key(d.deadline.fact)] ||
    d.trust !== world.factDefaults[key(d.deadline.trust_fact)] ||
    (!d.commerce && d.actorBalance!.value !== d.spec.start) ||
    d.npcBalance!.value !== d.start
  )
    invalid();
}

function bound(
  world: World,
  db: Db,
  scope: string,
  choices: Choices,
  d: Setting,
  exchanges: boolean,
) {
  const { deadline, instance } = d;
  const q = d.q!;
  const [choiceId, choice] = d.accepted[0];
  if (
    q.scope.kind !== 'player' ||
    q.scope.character_id !== world.character ||
    !same(q.bindings, d.bound) ||
    choice.actor_id !== world.character ||
    !same(choice.roles, d.bound) ||
    d.jobs.length !== 1
  )
    invalid();
  const [jobId, job] = d.jobs[0];
  if (
    job.quest_instance_id !== instance ||
    job.actor_id !== world.character ||
    job.due_time !== deadline.at ||
    (q.state === 'failed' && job.status !== 'completed') ||
    (q.state !== 'failed' && job.status === 'cancelled') ||
    (world.state.clock >= deadline.at && job.status !== 'completed') ||
    (world.state.clock < deadline.at && job.status !== 'pending') ||
    (world.state.clock >= deadline.at && ['active', 'objectives_complete'].includes(q.state))
  )
    invalid();
  activated(world, db, scope, d, choiceId, choice, jobId);
  const paid = settled(world, db, scope, choices, d, jobId, exchanges);
  if (
    (!d.commerce && d.actorBalance!.value !== d.spec.start + (paid ? d.funding.amount : 0)) ||
    d.npcBalance!.value !== d.start! - (paid ? d.funding.amount : 0)
  )
    invalid();
}

// The accept receipt activates exactly this instance and schedules exactly this due job.
function activated(
  world: World,
  db: Db,
  scope: string,
  d: Setting,
  choiceId: string,
  choice: ChoiceRow,
  jobId: string,
) {
  const receipt = choiceReceipt(world, db, scope, choiceId);
  if (!within(receipt, d.offer.choices[choice.choice_id!]!.availability)) invalid();
  const activation = receipt.delta.ops.filter((o) => o.op === 'quest.activate');
  const scheduled = receipt.delta.ops.filter((o) => o.op === 'job.schedule');
  if (
    activation.length !== 1 ||
    activation[0].op !== 'quest.activate' ||
    activation[0].instance_id !== d.instance ||
    !same(activation[0].bindings, d.bound) ||
    scheduled.length !== 1 ||
    scheduled[0].op !== 'job.schedule' ||
    scheduled[0].job_id !== jobId ||
    scheduled[0].quest_instance_id !== d.instance ||
    scheduled[0].actor_id !== world.character ||
    scheduled[0].due_time !== d.deadline.at
  )
    invalid();
  committedDialogue(world, db, scope, choiceId);
}

const terminalChoices = (choices: Choices, terminal: Setting['terminal']) =>
  choices.filter(
    ([, row]) =>
      refString(row.source) ===
        refString({ ...terminal.npc, kind: 'dialogue', key: terminal.key }) &&
      row.status === 'resolved' &&
      row.choice_id &&
      Object.hasOwn(terminal.choices, row.choice_id),
  );

// The quest's terminal state matches its terminal choice or expiry; returns whether it paid.
function settled(
  world: World,
  db: Db,
  scope: string,
  choices: Choices,
  d: Setting,
  jobId: string,
  exchanges: boolean,
) {
  const { terminal, deadline, fact, trust } = d;
  const q = d.q!;
  const onTime = Object.entries(terminal.choices).find(([, o]) => !!o.payment)?.[0];
  const complete = terminalChoices(choices, terminal);
  if (complete.length > 1) invalid();
  const outcome = complete[0]?.[1].choice_id;
  const paid = q.state === 'resolved' && outcome === onTime;
  if (q.state === 'resolved') resolved(world, db, scope, d, complete[0], outcome, paid, exchanges);
  else if (q.state === 'failed') {
    if (
      outcome ||
      q.outcome !== deadline.outcome ||
      fact !== deadline.outcome ||
      trust !== deadline.trust_amount ||
      !expiryReceipt(world, db, scope, d.instance!, jobId, deadline)
    )
      invalid();
  } else if (
    !['active', 'objectives_complete'].includes(q.state) ||
    outcome ||
    fact !== 'pending' ||
    trust !== 0 ||
    world.entities[d.holder]?.kind === 'npc'
  )
    invalid();
  return paid;
}

function resolved(
  world: World,
  db: Db,
  scope: string,
  d: Setting,
  complete: Choices[number],
  outcome: string | undefined,
  paid: boolean,
  exchanges: boolean,
) {
  const { terminal, fact, trust, spec, start } = d;
  if (
    !outcome ||
    d.q!.outcome !== outcome ||
    fact !== outcome ||
    d.holder !== d.aldric ||
    trust !== 0
  )
    invalid();
  const terminalReceipt = choiceReceipt(world, db, scope, complete[0]);
  if (!within(terminalReceipt, terminal.choices[outcome!]!.availability)) invalid();
  committedDialogue(world, db, scope, complete[0]);
  const selected = terminal.choices[outcome!]!;
  const axis = selected.sequence?.filter((s) => s.op === 'fact.adjust') ?? [];
  if (axis.length !== 1 || !terminalAxis(world, terminalReceipt, axis[0], exchanges)) invalid();
  if (paid && !d.commerce) {
    const transfers = terminalReceipt.delta.ops.filter((o) => o.op === 'resource.adjust');
    if (
      transfers.length !== 2 ||
      transfers[0].op !== 'resource.adjust' ||
      transfers[1].op !== 'resource.adjust' ||
      transfers[0].from !== start ||
      transfers[0].to !== d.npcBalance!.value ||
      transfers[1].from !== spec.start ||
      transfers[1].to !== d.actorBalance!.value
    )
      invalid();
  }
}
