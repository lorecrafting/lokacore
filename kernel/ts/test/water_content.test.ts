import assert from 'node:assert/strict';
import { test } from 'node:test';
import { bundle, prefix, ref } from './water_fixture.ts';
import { INSTALLED, loadCartridge } from '../src/index.ts';

// Breaks: water has unresolved skill/rooms, incompatible endpoints or blocked free Up, or silently lacks a required owner.
test('loader rejects malformed water references, pairing and free Surface while source short refs compile', () => {
  const controls = [
    (c: any) => {
      c.world.water.skill = ref('skill', 'absent');
    },
    (c: any) => {
      c.world.water.routes[0].bottom = ref('room', 'absent');
    },
    (c: any) => {
      c.world.water.routes[1].bottom = c.world.water.routes[0].bottom;
    },
    (c: any) => {
      c.rooms[`${prefix}:room/well_bottom`].exits.up.to = ref('room', 'village_green');
    },
    (c: any) => {
      c.rooms[`${prefix}:room/well_bottom`].exits.up.barrier = ref('barrier', 'trunk_lid');
    },
    (c: any) => {
      delete c.lock.capabilities.water;
      delete c.manifest.requires.capabilities.water;
    },
  ];
  const load = (b: ReturnType<typeof bundle>) =>
    loadCartridge(
      new TextEncoder().encode(`{"cartridge":${b.canonical},"content_hash":"${b.sha256}"}`),
      INSTALLED,
    );
  assert.equal(load(bundle()).ok, true);
  for (const mutate of controls) assert.equal(load(bundle(mutate)).ok, false);
});
