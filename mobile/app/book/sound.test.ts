// Named breaks for the browser sound module, over a fake browser (the audio device is external).
import assert from 'node:assert/strict';
import { test } from 'node:test';

type El = {
  url: string;
  paused: boolean;
  onended?: () => void;
  onerror?: () => void;
};

// A module instance and browser of its own for each test: the module's state is per page.
let page = 0;
async function browser(opts: { refuse?: boolean; noAudio?: boolean } = {}) {
  const els: El[] = [];
  const ramps: [number, number][] = [];
  const levels: { value: number }[] = [];
  let resumes = 0;
  const listeners: Record<string, () => void> = {};
  Object.assign(globalThis, {
    addEventListener: (type: string, f: () => void) => (listeners[type] = f),
    AudioContext: class {
      constructor() {
        if (opts.noAudio) throw new Error('no audio');
      }
      currentTime = 10;
      destination = {};
      state = 'suspended';
      resume = async () => {
        resumes++;
      };
      createGain = () => {
        const gain = {
          value: 1,
          cancelScheduledValues: () => {},
          setValueAtTime: () => {},
          linearRampToValueAtTime: (v: number, t: number) => ramps.push([v, t]),
        };
        levels.push(gain);
        return { connect: () => {}, disconnect: () => {}, gain };
      };
      createMediaElementSource = () => ({ connect: () => {}, disconnect: () => {} });
    },
    Audio: class implements El {
      paused = false;
      loop = false;
      onended?: () => void;
      onerror?: () => void;
      url: string;
      constructor(url: string) {
        this.url = url;
        els.push(this);
      }
      pause() {
        this.paused = true;
      }
      play = () => (opts.refuse ? Promise.reject(new Error('NotAllowedError')) : Promise.resolve());
    },
  });
  const mod: typeof import('./sound.web.ts') = await import(`./sound.web.ts?page=${page++}`);
  mod.sources({
    blow: ['blow.m4a'],
    coin: ['coin.m4a'],
    pageTurn: ['turn.m4a', 'turn2.m4a'],
    pickup: ['flick.m4a'],
    tick: ['tick.m4a'],
    chapter: ['theme.m4a'],
    fightIn: ['in.m4a'],
    fightLoop: ['loop.m4a'],
    fightWon: ['won.m4a'],
  });
  return {
    ...mod,
    els,
    ramps,
    levels,
    resumes: () => resumes,
    gesture: (kind = 'pointerup') => listeners[kind]!(),
  };
}

// Breaks: one kind of gesture stops unlocking audio, so a keyboard or touch player has no sound all session.
for (const kind of ['pointerup', 'touchend', 'keydown'])
  test(`${kind} unlocks audio`, async () => {
    const b = await browser();
    b.gesture(kind);
    b.play('coin');
    assert.equal(b.els[0]!.url, 'coin.m4a');
  });

// Breaks: a sound plays before the browser allows it, or the first gesture does not unlock audio.
test('a sound before the first gesture is dropped; after it, it plays', async () => {
  const b = await browser();
  b.play('coin');
  assert.equal(b.els.length, 0);
  b.gesture();
  b.play('coin');
  assert.equal(b.els[0]!.url, 'coin.m4a');
});

// Breaks: only the first gesture tries, so a phone whose first press did not count stays silent.
test('a later gesture resumes audio that is still suspended', async () => {
  const b = await browser();
  b.gesture();
  b.gesture();
  assert.equal(b.resumes(), 2);
});

// Breaks: the tier's dB is used raw, or inverted (coin is whisper, -24 dB: 10^(-24/20)).
test('a sound plays at its tier', async () => {
  const b = await browser();
  b.gesture();
  b.play('coin');
  assert.ok(Math.abs(b.levels.at(-1)!.value - 0.0631) < 0.0001);
});

// Breaks: Sound off still plays, stops the theme cut, or leaves a playing sound running; Music off
// silences the rest; turning back on stays silent; a setting already on stops what plays.
test('Sound and Music mute their own sounds only', async () => {
  const b = await browser();
  b.gesture();
  b.play('coin');
  b.play('chapter');
  b.setMuted('sound', false); // already on: nothing stops
  assert.equal(b.els[0]!.paused, false);
  b.setMuted('sound', true);
  assert.deepEqual([b.els[0]!.paused, b.els[1]!.paused], [true, false]);
  b.play('coin');
  assert.equal(b.els.length, 2);
  b.setMuted('sound', false);
  b.play('coin');
  assert.equal(b.els.length, 3);
  b.setMuted('music', true);
  assert.deepEqual([b.els[1]!.paused, b.els[2]!.paused], [true, false]);
  b.play('chapter');
  assert.equal(b.els.length, 3);
});

// Breaks: the limit is off by one, a bus uses another's limit, or the newest is stolen. Sfx holds 4,
// ui 2 with the flick on it, music 1 (hand-copied from the plan's section 6).
test('over its limit a bus steals its oldest voice', async () => {
  for (const [name, limit] of [
    ['coin', 4],
    ['pageTurn', 2],
    ['pickup', 2],
    ['chapter', 1],
  ] as const) {
    const b = await browser();
    b.gesture();
    for (let i = 0; i < limit; i++) b.play(name);
    assert.ok(
      b.els.every((e) => !e.paused),
      name,
    );
    b.play(name);
    assert.deepEqual(
      b.els.map((e) => e.paused),
      [true, ...Array(limit).fill(false)],
      name,
    );
  }
});

// Breaks: a finished voice still holds its slot, so a later sound steals a live one.
test('a finished voice frees its slot', async () => {
  const b = await browser();
  b.gesture();
  b.play('pageTurn');
  b.play('pageTurn');
  b.els[0]!.onended!();
  b.play('pageTurn');
  assert.equal(b.els[1]!.paused, false);
});

// Breaks: a beat does not duck, a lesser tier or the theme ducks, the ramp's time or depth is wrong,
// or the release fires while another beat still plays. -6 dB is 0.501; 300 ms in, 1200 ms out.
test('a beat ducks ambience; the last one to end releases it', async () => {
  const b = await browser();
  b.gesture();
  b.play('coin');
  b.play('chapter');
  assert.deepEqual(b.ramps, []);
  b.play('blow');
  b.play('blow');
  assert.equal(b.ramps.length, 2);
  assert.ok(Math.abs(b.ramps[0]![0] - 0.501) < 0.001);
  assert.ok(Math.abs(b.ramps[0]![1] - 10.3) < 1e-9);
  assert.ok(Math.abs(b.ramps[1]![0] - 0.708) < 0.001); // the music's dip, -3 dB
  b.els[2]!.onended!();
  b.els[2]!.onended!(); // a voice stopping twice must not release another's duck
  assert.equal(b.ramps.length, 2);
  b.els[3]!.onended!();
  assert.deepEqual(b.ramps.slice(2), [
    [1, 11.2],
    [1, 11.2],
  ]);
});

// Breaks: a sample with no file, a browser refusing play, or a browser with no audio throws into
// the Book's press; a refused voice keeps its slot or its duck.
test('missing, refused and absent audio are silence', async () => {
  const b = await browser({ refuse: true });
  b.gesture();
  b.play('level'); // no source
  assert.equal(b.els.length, 0);
  b.play('blow');
  await new Promise((r) => setImmediate(r));
  assert.equal(b.els[0]!.paused, true);
  assert.deepEqual(b.ramps[2], [1, 11.2]);
  const none = await browser({ noAudio: true });
  none.gesture();
  none.play('coin');
  assert.equal(none.els.length, 0);
});

// Breaks: a throwing Audio constructor escapes play, or a full bus loses a voice for nothing.
test('an element the browser refuses to make is silence', async () => {
  const b = await browser();
  b.gesture();
  b.play('chapter');
  (globalThis as { Audio?: unknown }).Audio = class {
    constructor() {
      throw new Error('blocked');
    }
  };
  b.play('chapter');
  assert.equal(b.els[0]!.paused, false);
});

// Breaks: a variant is never reached, or the rotation restarts each play.
test('a name with several samples plays them in turn', async () => {
  const s = await browser();
  s.gesture();
  for (let i = 0; i < 3; i++) s.play('pageTurn');
  assert.deepEqual(
    s.els.map((e) => e.url),
    ['turn.m4a', 'turn2.m4a', 'turn.m4a'],
  );
});

// Breaks: a new name lands on the music bus, so Sound off leaves it playing; or the chapter cut
// moves to Sound and goes silent with it.
test('Sound off silences every effect; the chapter cut answers to Music', async () => {
  const b = await browser();
  b.gesture();
  b.setMuted('sound', true);
  for (const name of ['tick', 'pageTurn', 'blow', 'coin'] as const) b.play(name);
  assert.equal(b.els.length, 0);
  b.play('chapter');
  assert.equal(b.els.length, 1);
});

async function fightRig(t: any) {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let now = 1000;
  t.mock.method(performance, 'now', () => now);
  const b = await browser();
  b.gesture();
  const playing = () => b.els.filter((e) => !e.paused).map((e) => e.url);
  return {
    ...b,
    playing,
    pass: (ms: number) => {
      now += ms;
      t.mock.timers.tick(ms);
    },
  };
}

// Breaks: the stinger does not lead into a looping loop, or two music voices overlap.
test('a fight opens on the stinger, then one looping voice', async (t) => {
  const b = await fightRig(t);
  b.fight('open');
  assert.deepEqual(b.playing(), ['in.m4a']);
  b.els[0]!.onended!();
  assert.deepEqual(b.playing(), ['loop.m4a']);
  assert.equal(b.els.at(-1)!.loop, true);
});

// Breaks: the gap is ignored either way: 59.9 s after a fight skips the stinger, 60 s plays it.
test('a fight within the gap of the last is the loop alone', async (t) => {
  const b = await fightRig(t);
  b.fight('open');
  b.fight('away');
  b.pass(59_999);
  b.fight('open');
  assert.equal(b.els.at(-1)!.url, 'loop.m4a');
  b.fight('away');
  b.pass(60_000);
  b.fight('open');
  assert.equal(b.els.at(-1)!.url, 'in.m4a');
});

// Breaks: a reopened fight plays its stinger, or waits forever for a gesture that has passed.
test('a reopened fight is the loop alone, once audio unlocks', async () => {
  const b = await browser();
  b.fight('resume');
  assert.equal(b.els.length, 0);
  b.gesture();
  assert.deepEqual(
    b.els.map((e) => e.url),
    ['loop.m4a'],
  );
});

// Breaks: Music off leaves the loop, Music on restarts it outside a fight or not at all.
test('Music off stops the loop; on restarts it, in a fight only', async (t) => {
  const b = await fightRig(t);
  b.fight('resume');
  b.setMuted('music', true);
  assert.deepEqual(b.playing(), []);
  b.setMuted('music', false);
  assert.deepEqual(b.playing(), ['loop.m4a']);
  b.fight('cut');
  b.setMuted('music', true);
  b.setMuted('music', false);
  assert.deepEqual(b.playing(), []);
});

// Breaks: a win's cut takes too long or skips the fanfare; flight plays a fanfare or stops short of
// the palette time; a death waits on a fade.
test('how a fight ends is how its music ends', async (t) => {
  const b = await fightRig(t);
  b.fight('resume');
  b.fight('won');
  assert.deepEqual(b.ramps.at(-1), [0, 10.16]);
  b.pass(159);
  assert.deepEqual(b.playing(), ['loop.m4a']);
  b.pass(1);
  assert.deepEqual(b.playing(), ['won.m4a']);

  b.els.at(-1)!.onended!();
  b.fight('resume');
  b.fight('away');
  b.pass(1499);
  assert.deepEqual(b.playing(), ['loop.m4a']);
  b.pass(1);
  assert.deepEqual(b.playing(), []);

  b.fight('resume');
  b.fight('cut');
  assert.deepEqual(b.playing(), []);
});

// Breaks: a sound's thud is cut with the music (its bus is not the music's), or a fanfare fires after a
// new fight began during the fade.
test('a death spares the thud; a fight reopening during a fade drops the old voice', async (t) => {
  const b = await fightRig(t);
  b.play('blow');
  b.fight('resume');
  b.fight('cut');
  assert.deepEqual(b.playing(), ['blow.m4a']);
  b.fight('resume');
  b.fight('won');
  b.fight('resume');
  b.pass(1000);
  assert.deepEqual(b.playing(), ['blow.m4a', 'loop.m4a']);
});
