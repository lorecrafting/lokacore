// Named breaks for a room's sound in the browser module: beds, the weather layer, thunder, pieces.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { browser } from './__tests__/sound_rig.ts';

const urlsOf = (els: { url: string; paused: boolean }[]) =>
  els.filter((e) => !e.paused).map((e) => e.url);

// Breaks: a room plays no bed, a tag with no file throws or stays silent, or a blank tag is not wild.
test('a tag plays its bed, a blank or fileless tag plays wild', async () => {
  for (const [tag, file] of [
    ['inn', 'inn.m4a'],
    [undefined, 'wild.m4a'],
    ['', 'wild.m4a'],
    ['mill', 'wild.m4a'],
  ] as const) {
    const b = await browser();
    b.gesture();
    b.ambience(tag, undefined, true);
    assert.equal(b.els[0]!.url, file);
    assert.equal(b.els[0]!.loop, true);
  }
});

// Breaks: a same-tag walk restarts the loop, so the bed has a seam at every door.
test('the same tag carries on; a new tag cross-fades', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const b = await browser();
  b.gesture();
  b.ambience('inn', undefined, true);
  const at = b.els.length;
  b.ambience('inn', undefined, false);
  assert.equal(b.els.length, at);
  b.ambience('cave', undefined, false);
  assert.equal(b.els.at(-1)!.url, 'cave.m4a');
  assert.ok(
    b.els.find((e) => e.url === 'inn.m4a' && !e.paused),
    'the old bed plays through the fade',
  );
  t.mock.timers.tick(1000);
  assert.ok(b.els.find((e) => e.url === 'inn.m4a')!.paused);
});

// Breaks: a fight plays under the bed, Sound off leaves it, or Music off takes it.
test('a fight and Sound off stop beds; a fight ending and Sound on bring them back; Music off leaves them', async () => {
  const b = await browser();
  b.gesture();
  b.ambience('inn', undefined, true);
  b.setMuted('music', true);
  assert.ok(urlsOf(b.els).includes('inn.m4a'));
  b.setMuted('music', false);
  b.fight('open');
  assert.ok(!urlsOf(b.els).includes('inn.m4a'));
  b.fight('away');
  assert.ok(urlsOf(b.els).includes('inn.m4a'));
  b.setMuted('sound', true);
  assert.ok(!urlsOf(b.els).includes('inn.m4a'));
  b.setMuted('sound', false);
  assert.ok(urlsOf(b.els).includes('inn.m4a'));
});

// Breaks: a dry day plays rain, an exposed room muffles it, or an indoor one does not.
test('the weather layer: rain, wind and storm only; muffled when not exposed', async () => {
  const b = await browser();
  b.gesture();
  b.ambience('inn', 'clear', true);
  assert.ok(!urlsOf(b.els).includes('rain.m4a'));
  for (const phase of ['rain', 'wind', 'storm']) {
    b.ambience('inn', phase, true);
    assert.ok(urlsOf(b.els).includes('rain.m4a'), phase);
  }
  assert.equal(b.filters.length, 0);
  b.ambience('inn', 'storm', false);
  assert.equal(b.filters[0]!.type, 'lowpass');
  assert.equal(b.filters[0]!.frequency.value, 800);
});

// Breaks: a thunder through a wall is not muffled, or an open sky's is.
test('thunder passes through the filter only when muffled', async () => {
  const b = await browser();
  b.gesture();
  b.thunder(false);
  assert.equal(b.filters.length, 0);
  b.thunder(true);
  assert.equal(b.filters.length, 1);
  assert.equal(b.els.at(-1)!.url, 'thunder.m4a');
});

// Breaks: a piece repeats on re-entry, ignores the gap, or lowers nothing.
test('a piece plays once per tag and gap, and lowers beds by bedUnderMusic', async (t) => {
  let now = 1_000_000;
  t.mock.method(performance, 'now', () => now);
  const b = await browser();
  b.gesture();
  b.ambience('inn', undefined, true);
  assert.ok(urlsOf(b.els).includes('p-inn.m4a'));
  assert.equal(b.els.find((e) => e.url === 'p-inn.m4a')!.loop, false);
  assert.ok(Math.abs(b.ramps.at(-1)![0] - 0.501) < 0.001); // -6 dB
  b.els.find((e) => e.url === 'p-inn.m4a')!.onended!();
  assert.equal(b.ramps.at(-1)![0], 1); // back
  b.ambience('cave', undefined, true); // inside the gap: never heard, and its entry is spent
  assert.ok(!urlsOf(b.els).includes('p-cave.m4a'));
  now += 600_000;
  b.ambience('inn', undefined, true); // past the gap, a tag already entered
  assert.equal(b.els.filter((e) => e.url === 'p-inn.m4a').length, 1);
});

// Breaks: a chapter theme leaves beds up or a piece plays under it.
test('a chapter cuts the piece and ducks beds', async () => {
  const b = await browser();
  b.gesture();
  b.ambience('inn', undefined, true);
  b.play('chapter');
  assert.ok(!urlsOf(b.els).includes('p-inn.m4a'));
  assert.ok(Math.abs(b.ramps.at(-1)![0] - 0.501) < 0.001);
  assert.ok(urlsOf(b.els).includes('inn.m4a'));
});

// Breaks: every short sound plays at one pitch, or beds and music drift off pitch.
test('short sounds spread their pitch; a bed does not', async (t) => {
  t.mock.method(Math, 'random', () => 1);
  const b = await browser();
  b.gesture();
  b.play('coin');
  b.ambience('inn', undefined, true);
  const rate = (url: string) => (b.els.find((e) => e.url === url) as any).playbackRate;
  assert.equal(rate('coin.m4a'), 1.04);
  assert.equal(rate('inn.m4a'), undefined);
});

// Breaks: a first bed loads at a door, or the first gesture pulls every long piece over the network.
test('the first gesture caches the beds and leaves the pieces to stream', async (t) => {
  const b = await browser();
  const fetched: string[] = [];
  t.mock.method(globalThis, 'fetch', async (url: string) => {
    fetched.push(url);
    return new Response();
  });
  b.gesture();
  assert.ok(fetched.includes('inn.m4a'));
  assert.ok(!fetched.includes('p-inn.m4a'));
});

// Breaks: a return to the tab or Sound on restarts the bed over a death or a closed Book.
test('a cut stays silent until the Book names the room again', async () => {
  const b = await browser();
  b.gesture();
  b.ambience('inn', undefined, true);
  b.fight('cut');
  b.setMuted('sound', true);
  b.setMuted('sound', false);
  assert.deepEqual(urlsOf(b.els), []);
  b.ambience('inn', undefined, true);
  assert.deepEqual(urlsOf(b.els), ['inn.m4a']);
});
