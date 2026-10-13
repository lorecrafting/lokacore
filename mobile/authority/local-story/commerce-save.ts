// Reconcile conserved penny receipts and shelf custody at each original commit.
import type {
  Command,
  DecisionResult,
  DefinitionRef,
  DeltaOp,
  EntityId,
  Shop,
} from '../../../kernel/ts/src/contracts.gen.ts';
import { key, same } from '../../../kernel/ts/src/foundation/compose.ts';
import { validate } from '../../../kernel/ts/src/foundation/validate.ts';
import { refString, type World, type Accepted } from '../../../kernel/ts/src/runtime/decision.ts';
import type { Db, Meta } from './store.ts';
import { acquiredOnce } from './shop-event.ts';
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
    const custody = offerCustody(world, shop, provider as EntityId);
    for (const { command, decision } of receipts(world, db, meta, revision)) {
      const money = decision.delta.ops.filter(
        (o) => o.op === 'resource.adjust' && same(o.resource, shop.resource),
      );
      const p = command.payload;
      const shopped = p.type === 'buy' || p.type === 'sell';
      if (shopped) shopReceipt(world, provider, shop, custody, command, decision);
      const [payer, recipient] = p.type === 'buy' ? [world.body, provider] : [provider, world.body];
      const payments = shopped
        ? [{ payer, recipient, amount: p.quoted_price }]
        : money.length
          ? bankPayments(world, command, dialoguePayment(world, command, shop.resource))
          : [];
      if (money.length !== 2 * payments.length) invalid();
      payments.forEach((x, i) =>
        checkPayment(money.slice(2 * i, 2 * i + 2), shop.resource, x, balances, spec),
      );
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

// A stock offer's items (row W11) are not tracked: receiptHistory recomputes those exchanges, and a
// trade job may move them.
function offerCustody(world: World, shop: Shop, provider: EntityId): Record<string, EntityId> {
  return Object.fromEntries(
    shop.offers.filter((o) => !o.stock).map((o) => [world.entityIds[refString(o.item)], provider]),
  );
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

// Opted Buy quotes and stock offers (row W11) are already recomputed at their original revision by
// receiptHistory, so only the shape of a stock offer's move is checked here.
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
  const moved = (moves[0] as { entity_id: EntityId } | undefined)?.entity_id as EntityId;
  if (
    p.provider_id !== provider ||
    !offer ||
    (!(p.type === 'buy' && (shop.buy_discount || offer.stock)) &&
      p.quoted_price !== offer[p.type]) ||
    moves.length !== 1 ||
    (!offer.stock && (moved !== p.item_id || custody[moved] !== source)) ||
    !same(moves[0], {
      op: 'entity.transfer',
      writer_group: 0,
      entity_id: moved,
      source_id: source,
      destination_id: destination,
    }) ||
    d.outcome !== (p.type === 'buy' ? 'bought' : 'sold') ||
    !same(d.narration, [{ key: p.type === 'buy' ? shop.bought : shop.sold }])
  )
    invalid();
  if (!acquiredOnce(world, command, d, moved, destination)) invalid();
}

function dialoguePayment(world: World, command: Command, currency: DefinitionRef) {
  const p = command.payload;
  if (p.type === 'use_transport') {
    const route = world.cartridge.transports?.[refString(p.route)];
    if (!route || !same(route.currency, currency) || p.quoted_fare !== route.fare) invalid();
    return {
      payer: world.body,
      recipient: world.entityIds[refString(route.recipient)],
      amount: route.fare,
    };
  }
  if (p.type === 'use_service') {
    const service = world.cartridge.services?.[refString(p.service)];
    if (
      !service ||
      !same(service.currency, currency) ||
      p.quoted_price !== service.price ||
      world.entityIds[refString(service.provider)] !== p.provider_id
    )
      invalid();
    return { payer: world.body, recipient: p.provider_id, amount: service.price };
  }
  if (p.type !== 'choose') invalid();
  const choice = world.state.choices?.[p.continuation_id];
  const dialogue = choice && world.cartridge.dialogues?.[refString(choice.source)];
  const option = dialogue?.choices[p.choice_id];
  const lesson = option?.lesson_payment;
  const payment = option?.payment;
  if (lesson) {
    const recipient = choice?.roles.find((r) => r.role === lesson.to)?.entity_id;
    if (!recipient || choice?.status !== 'resolved' || choice.choice_id !== p.choice_id) invalid();
    return { payer: world.body, recipient, amount: lesson.amount };
  }
  const payer = choice?.roles.find((r) => r.role === payment?.from)?.entity_id;
  if (!payment || !payer || choice?.status !== 'resolved' || choice.choice_id !== p.choice_id)
    invalid();
  return { payer, recipient: world.body, amount: payment.amount };
}

function custodyEvidence(
  world: World,
  command: Command,
  d: Accepted,
  op: Extract<DeltaOp, { op: 'entity.transfer' }>,
) {
  const p = command.payload;
  if (p.type === 'buy' || p.type === 'sell') return true; // shopReceipt checked the entire exchange.
  // liquidSave already replayed the owned bottom corpse and every original root.
  if (p.type === 'recover_corpse')
    return (
      d.outcome === 'corpse_recovered' &&
      op.writer_group === 0 &&
      op.source_id === p.corpse_id &&
      op.destination_id === world.body
    );
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

/**
 * The fee with any bank pair (toolbox row 25): `amount` moves between the body and the vault after
 * a deposit's fee and before a withdraw's.
 */
function bankPayments(world: World, command: Command, fee: Payment) {
  const p = command.payload;
  const benefit =
    p.type === 'use_service' && world.cartridge.services?.[refString(p.service)]?.benefit;
  if (!benefit || (benefit.kind !== 'deposit' && benefit.kind !== 'withdraw')) return [fee];
  const vault = world.entityIds[refString(benefit.vault)];
  const deposit = benefit.kind === 'deposit';
  const [payer, recipient] = deposit ? [world.body, vault] : [vault, world.body];
  const bank = { payer, recipient, amount: benefit.amount };
  return deposit ? [fee, bank] : [bank, fee];
}

type Payment = { payer: string; recipient: string; amount: number };

function checkPayment(
  ops: readonly DeltaOp[],
  resource: DefinitionRef,
  { payer, recipient, amount }: Payment,
  balances: Record<string, number>,
  { minimum, maximum }: { minimum: number; maximum: number },
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
