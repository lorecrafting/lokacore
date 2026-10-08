// Breaks (each case): reopen accepts an on-time turn-in receipt forged as named.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  forge,
  forgeRows,
  only,
  otherId,
  otherPlayer as other,
  type Forged,
} from './__tests__/chandlers-setup.test.ts';

const axis = (r: Forged) => only(r, 'fact.assign', 'priory_fen_axis');
const axisEvent = (r: Forged) =>
  r.events.find(
    (e) =>
      e.payload.type === 'fact_changed' &&
      (e.payload.fact as { key: string }).key === 'priory_fen_axis',
  )!;
const turnIn = (forged: (r: Forged) => void) => forge('deliver', forged);
// Moves the saved axis, the turn-in's assignment and its event together.
const axisMoved = (expected: number, value: number) =>
  forgeRows('deliver', (rows, a) => {
    const [key] = Object.keys(rows.facts).filter(
      (k) => JSON.parse(k).fact.key === 'priory_fen_axis',
    );
    rows.facts[key] = value;
    const row = a.sql
      .prepare(
        "SELECT rowid,response FROM receipt WHERE json_extract(command,'$.payload.choice_id')='on_time'",
      )
      .get() as { rowid: number; response: string };
    const receipt = JSON.parse(row.response) as Forged;
    Object.assign(axis(receipt), { expected, value });
    Object.assign(axisEvent(receipt).payload, { old: expected, new: value });
    a.sql
      .prepare('UPDATE receipt SET response=? WHERE rowid=?')
      .run(JSON.stringify(receipt), row.rowid);
  });

const cases: [string, () => string][] = [
  [
    'resolved after the on-time window',
    () => turnIn((r) => r.events.forEach((e) => (e.logical_time = 151201))),
  ],
  [
    'whose choice resolution names another revision',
    () =>
      turnIn((r) => {
        only(r, 'choice.resolve').expected_revision = 99;
      }),
  ],
  ['with two axis assignments', () => turnIn((r) => r.delta.ops.push({ ...axis(r) }))],
  [
    'with the axis in another writer group',
    () =>
      turnIn((r) => {
        axis(r).writer_group = 1;
      }),
  ],
  [
    "with the axis at another player's scope",
    () =>
      turnIn((r) => {
        axis(r).scope = other;
      }),
  ],
  ['whose axis starts from a value other than its default', () => axisMoved(1, 3)],
  ['whose axis moves by another amount', () => axisMoved(0, 3)],
  [
    'whose axis event names another new value',
    () =>
      turnIn((r) => {
        (axisEvent(r).payload.new as number) += 1;
      }),
  ],
  [
    'with two axis events',
    () => turnIn((r) => r.events.push({ ...axisEvent(r), id: otherId } as never)),
  ],
  [
    'whose axis event names another actor',
    () =>
      turnIn((r) => {
        Object.assign(axisEvent(r), { actor_id: other.character_id });
      }),
  ],
  [
    'whose axis event has another cause',
    () =>
      turnIn((r) => {
        axisEvent(r).causation_id = otherId;
      }),
  ],
  [
    'whose axis event is at another time',
    () =>
      turnIn((r) => {
        axisEvent(r).logical_time += 1;
      }),
  ],
  [
    "whose axis event is at another player's scope",
    () =>
      turnIn((r) => {
        axisEvent(r).scope = other;
      }),
  ],
  [
    'whose axis event names another old value',
    () =>
      turnIn((r) => {
        (axisEvent(r).payload.old as number) += 1;
      }),
  ],
];
for (const [name, forged] of cases)
  test(`reopen refuses a turn-in receipt ${name}`, () => assert.equal(forged(), 'save_corrupt'));
