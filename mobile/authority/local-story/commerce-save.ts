// Reconcile conserved penny receipts and shelf custody at each original commit.
import type {
  Command,
  DecisionResult,
  DefinitionRef,
  DeltaOp,
  EntityId,
  Shop,
} from '../../../kernel/ts/src/contracts.gen.ts';
import { id } from '../../../kernel/ts/src/foundation/id_source.ts';
import { key, same } from '../../../kernel/ts/src/foundation/compose.ts';
import { validate } from '../../../kernel/ts/src/foundation/validate.ts';
import { refString, type World } from '../../../kernel/ts/src/runtime/decision.ts';
import type { Db, Meta } from './store.ts';
type Accepted = Extract<DecisionResult, { kind: 'accepted' }>;
type Row = {
  command_id: string;
  actor_id: string;
  command: string;
  response: string;
  revision: number;
};
function invalid(): never {
  throw new SyntaxError('malformed JSON: inconsistent shop payment');
}

// size: allow 60, one ordered reconciliation loop joins exact money and custody evidence
export function commerceSave(world: World, db: Db, meta: Meta, revision: number) {
  for (const [provider, npc] of Object.entries(world.entities)) {
    if (npc.kind !== 'npc' || !npc.shop) continue;
    const shop = npc.shop,
      spec = world.resourceSpecs[key(shop.resource)];
    const balances = startingBalances(world, shop.resource, spec.start);
    const custody: Record<string, EntityId> = Object.fromEntries(
      shop.offers.map((o) => [world.entityIds[refString(o.item)], provider as EntityId]),
    );
    for (const { command, decision } of receipts(world, db, meta, revision)) {
      const money = decision.delta.ops.filter(
        (o) => o.op === 'resource.adjust' && same(o.resource, shop.resource),
      );
      const p = command.payload;
      if (p.type === 'buy' || p.type === 'sell') {
        shopReceipt(world, provider, shop, custody, command, decision);
        checkPayment(
          money,
          shop.resource,
          p.type === 'buy' ? world.body : provider,
          p.type === 'buy' ? provider : world.body,
          p.quoted_price,
          balances,
          spec.minimum,
          spec.maximum,
        );
      } else if (money.length) {
        const payment = dialoguePayment(world, command);
        checkPayment(
          money,
          shop.resource,
          payment.payer,
          world.body,
          payment.amount,
          balances,
          spec.minimum,
          spec.maximum,
        );
      }
      for (const op of decision.delta.ops)
        if (op.op === 'entity.transfer' && Object.hasOwn(custody, op.entity_id)) {
          if (
            custody[op.entity_id] !== op.source_id ||
            !custodyEvidence(world, command, decision, op)
          )
            invalid();
          custody[op.entity_id] = op.destination_id;
        }
    }
    for (const [entity, expected] of Object.entries(balances))
      if (
        world.state.resources?.[
          key({ kind: 'resource', resource: shop.resource, entity_id: entity })
        ]?.value !== expected
      )
        invalid();
    for (const [entity, holder] of Object.entries(custody))
      if (!world.entities[entity] || world.state.containers[entity] !== holder) invalid();
  }
}

function startingBalances(world: World, resource: DefinitionRef, start: number) {
  const balances: Record<string, number> = { [world.body]: start };
  for (const [entity, e] of Object.entries(world.entities))
    if (e.kind === 'npc' && e.resource_starts?.[resource.key] !== undefined)
      balances[entity] = e.resource_starts[resource.key];
  return balances;
}

function receipts(world: World, db: Db, meta: Meta, revision: number) {
  const rows = db.getAllSync<Row>(
    `SELECT command_id,actor_id,command,response,revision FROM receipt
    WHERE scope=? AND json_extract(response,'$.kind')='accepted' ORDER BY revision`,
    `story/${meta.lineage_id}/${world.character}`,
  );
  let previous = 0;
  return rows.map((row) => {
    if (!Number.isSafeInteger(row.revision) || row.revision <= previous || row.revision > revision)
      invalid();
    previous = row.revision;
    const command: Command = JSON.parse(row.command),
      decision: DecisionResult = JSON.parse(row.response);
    if (
      validate('Command', command).length ||
      validate('DecisionResult', decision).length ||
      command.id !== row.command_id ||
      command.world_context_id !== world.context ||
      row.actor_id !== world.character ||
      !('actor_id' in command.payload) ||
      command.payload.actor_id !== world.character ||
      decision.kind !== 'accepted'
    )
      invalid();
    return { command, decision };
  });
}

// size: allow 50, bind one whole exchange to its command, item, payment and acquired event
function shopReceipt(
  world: World,
  provider: string,
  shop: Shop,
  custody: Record<string, EntityId>,
  command: Command,
  d: Accepted,
) {
  const p = command.payload;
  if (p.type !== 'buy' && p.type !== 'sell') invalid();
  const offer = shop.offers.find((o) => world.entityIds[refString(o.item)] === p.item_id);
  const source = p.type === 'buy' ? provider : world.body,
    destination = p.type === 'buy' ? world.body : provider;
  const moves = d.delta.ops.filter((o) => o.op === 'entity.transfer');
  if (
    p.provider_id !== provider ||
    !offer ||
    p.quoted_price !== offer[p.type] ||
    moves.length !== 1 ||
    !same(moves[0], {
      op: 'entity.transfer',
      writer_group: 0,
      entity_id: p.item_id,
      source_id: source,
      destination_id: destination,
    }) ||
    custody[p.item_id] !== source ||
    d.outcome !== (p.type === 'buy' ? 'bought' : 'sold') ||
    !same(d.narration, [{ key: p.type === 'buy' ? shop.bought : shop.sold }])
  )
    invalid();
  const acquired = d.events.filter((e) => e.payload.type === 'item_acquired');
  if (
    acquired.length !== 1 ||
    acquired[0].id !== id(world.context, command.id, 0) ||
    acquired[0].world_context_id !== world.context ||
    acquired[0].position !== 1 ||
    acquired[0].logical_time > world.state.clock ||
    acquired[0].causation_id !== (command.id as string) ||
    acquired[0].correlation_id !== (command.id as string) ||
    acquired[0].actor_id !== world.character ||
    !same(acquired[0].scope, { kind: 'player', character_id: world.character }) ||
    !same(acquired[0].payload, {
      type: 'item_acquired',
      item_id: p.item_id,
      holder_id: destination,
    })
  )
    invalid();
}

function dialoguePayment(world: World, command: Command) {
  const p = command.payload;
  if (p.type !== 'choose') invalid();
  const choice = world.state.choices?.[p.continuation_id];
  const dialogue = choice && world.cartridge.dialogues?.[refString(choice.source)];
  const payment = dialogue?.choices[p.choice_id]?.payment;
  const payer = choice?.roles.find((r) => r.role === payment?.from)?.entity_id;
  if (!payment || !payer || choice?.status !== 'resolved' || choice.choice_id !== p.choice_id)
    invalid();
  return { payer, amount: payment.amount };
}

function custodyEvidence(
  world: World,
  command: Command,
  d: Accepted,
  op: Extract<DeltaOp, { op: 'entity.transfer' }>,
) {
  const p = command.payload;
  if (p.type === 'buy' || p.type === 'sell') return true; // shopReceipt checked the entire exchange.
  if (['take', 'drop', 'put', 'give', 'wear', 'remove'].includes(p.type)) {
    if (!('item_id' in p) || p.item_id !== op.entity_id || op.writer_group !== 0) return false;
    if (p.type === 'take') return op.destination_id === world.body;
    if (p.type === 'drop')
      return op.source_id === world.body && Object.hasOwn(world.rooms, op.destination_id);
    if (p.type === 'put')
      return op.source_id === world.body && op.destination_id === p.container_id;
    if (p.type === 'give')
      return op.source_id === world.body && op.destination_id === p.recipient_id;
    if (p.type === 'wear')
      return op.source_id === world.body && Object.values(world.slots).includes(op.destination_id);
    if (p.type === 'remove')
      return (
        op.destination_id === world.body &&
        op.source_id !== null &&
        Object.values(world.slots).includes(op.source_id)
      );
  }
  return (
    ['attack', 'flee', 'elapsed'].includes(p.type) &&
    d.delta.ops.some((o) => o.op === 'entity.create' && o.identity.id === op.destination_id)
  );
}

function checkPayment(
  ops: readonly DeltaOp[],
  resource: DefinitionRef,
  payer: string,
  recipient: string,
  amount: number,
  balances: Record<string, number>,
  minimum: number,
  maximum: number,
) {
  if (
    balances[payer] === undefined ||
    balances[recipient] === undefined ||
    balances[payer] - amount < minimum ||
    balances[recipient] + amount > maximum ||
    ops.length !== 2 ||
    !same(ops[0], {
      op: 'resource.adjust',
      writer_group: 0,
      resource,
      entity_id: payer,
      from: balances[payer],
      to: balances[payer] - amount,
    }) ||
    !same(ops[1], {
      op: 'resource.adjust',
      writer_group: 0,
      resource,
      entity_id: recipient,
      from: balances[recipient],
      to: balances[recipient] + amount,
    })
  )
    invalid();
  balances[payer] -= amount;
  balances[recipient] += amount;
}
