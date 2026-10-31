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
    blow: 'blow.m4a',
    coin: 'coin.m4a',
    pageTurn: 'turn.m4a',
    pickup: 'flick.m4a',
    chapter: 'theme.m4a',
  });
  return {
    ...mod,
    els,
    ramps,
    levels,
    resumes: () => resumes,
    gesture: () => listeners.pointerup!(),
  };
}

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
  assert.equal(b.ramps.length, 1);
  assert.ok(Math.abs(b.ramps[0]![0] - 0.501) < 0.001);
  assert.ok(Math.abs(b.ramps[0]![1] - 10.3) < 1e-9);
  b.els[2]!.onended!();
  b.els[2]!.onended!(); // a voice stopping twice must not release another's duck
  assert.equal(b.ramps.length, 1);
  b.els[3]!.onended!();
  assert.deepEqual(b.ramps[1], [1, 11.2]);
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
  assert.deepEqual(b.ramps[1], [1, 11.2]);
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
