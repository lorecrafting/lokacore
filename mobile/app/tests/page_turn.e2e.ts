import { test } from '@e2e-dev/web';
import { expect } from 'e2e';
// @ts-expect-error the app has no Node types; the e2e runner is Node
import { readFileSync } from 'node:fs';

// In the page: press `from` and watch until the leaving page and its curl have gone (or it faded
// out); report whether the curl canvas drew and whether `to`, on the arriving page, received the
// pointer at its centre all the while, and how long (ms) the leaving page stayed over it. While both
// pages show: which text has focus, and whether `from` can take focus or is announced. `first`: the
// progress the curl shader is first built with (CanvasKit's, as the preview runs it).
const turn = async ({ from, to }: { from: string; to: string }) => {
  const frames = 600; // about 10 s at 60 fps
  for (let i = 0; i < frames && document.querySelector('canvas'); i++)
    await new Promise(requestAnimationFrame); // the previous turn's curl has gone
  const progress: number[] = ((globalThis as any).curlProgress = []); // filled by watchCurl
  (document.querySelector(`[aria-label="${from}"]`) as HTMLElement).click();
  let curl = false;
  let arrived: number | undefined; // the frame time the arriving page first showed
  let stayed: number | null = null; // how long the leaving page stayed after that
  let hit: boolean | null = null; // null until the arriving page has rendered
  let focused: string | null = null; // null until both pages show at once
  let reachable: boolean | null = null; // `from` can take focus or is announced while it leaves
  for (let i = 0; i < frames; i++) {
    const now = await new Promise<number>(requestAnimationFrame);
    const target = document.querySelector(`[aria-label="${to}"]`);
    if (target) {
      arrived ??= now;
      const box = target.getBoundingClientRect();
      const top = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
      hit = (hit ?? true) && !!top && target.contains(top);
      const leaving = document.querySelector<HTMLElement>(`[aria-label="${from}"]`);
      if (leaving && reachable === null) {
        focused = document.activeElement?.textContent ?? null;
        leaving.focus();
        reachable = document.activeElement === leaving || !leaving.closest('[aria-hidden="true"]');
      }
    }
    const canvas = document.querySelector('canvas');
    if (canvas) curl = true;
    if (!document.querySelector(`[aria-label="${from}"]`)) {
      stayed ??= now - (arrived ?? now);
      if (!canvas) break; // the leaving page and its curl have gone
    }
  }
  return { curl, hit, stayed, focused, reachable, first: progress[0] ?? null };
};

// Records the progress each curl shader is built with (CanvasKit's, as the preview runs it) into
// the array `turn` sets out.
const watchCurl = () => {
  const effect = (globalThis as any).CanvasKit.RuntimeEffect.prototype;
  const make = effect.makeShaderWithChildren;
  effect.makeShaderWithChildren = function (uniforms: number[], ...rest: unknown[]) {
    (globalThis as any).curlProgress?.push(uniforms[2]); // size.x, size.y, progress, ...
    return make.call(this, uniforms, ...rest);
  };
  return null;
};

// A cold Metro builds the preview's Skia chunk on first request; that once outlasted the default wait.
const COLD = 60_000;

// Breaks: the curl (or the leaving page held under it) takes the arriving page's touches, the
// leaving page's picture fails on web so nothing curls, a back turn breaks the next press, or a curl
// first draws with the last turn's finished progress (the leaf gone for a frame: a flash).
test('the page curl draws over a live arriving page, both ways', async ({
  app,
  screen,
  browser,
}) => {
  await app.open('/?preview=page-turn');
  await expect(screen.getByRole('button', 'Continue')).toBeVisible({ timeout: COLD });
  await browser.evaluate(watchCurl);
  const args = { from: 'Continue', to: 'Start over' };
  expect(await browser.evaluate(turn, args)).toMatchObject({ curl: true, hit: true, first: 0 });
  await app.screenshot('page-curl-forward');
  const back = { from: 'Start over', to: 'Continue' };
  expect(await browser.evaluate(turn, back)).toMatchObject({ curl: true, hit: true, first: 0 });
});

// Breaks: reduced motion still curls, its cross-fading leaving page takes the touches, keyboard
// focus or the screen reader, focus stays behind instead of moving to the arriving page's title, or
// the leaving page vanishes at once instead of fading over motion.fade (160 ms).
test('under reduced motion the pages cross-fade with no curl', async ({ app, screen, browser }) => {
  await browser.addInitScript(() => {
    const media = window.matchMedia.bind(window);
    window.matchMedia = (q) =>
      q.includes('prefers-reduced-motion')
        ? ({ ...media(q), matches: true } as MediaQueryList)
        : media(q);
  });
  await app.open('/?preview=page-turn');
  await expect(screen.getByRole('button', 'Continue')).toBeVisible({ timeout: COLD });
  const args = { from: 'Continue', to: 'Start over' };
  expect(await browser.evaluate(turn, args)).toMatchObject({
    curl: false,
    hit: true,
    focused: 'Settings',
    reachable: false,
  });
  // Timed on the way back: the first mount of a page can stall the frames past the whole fade.
  const back = await browser.evaluate(turn, { from: 'Start over', to: 'Continue' });
  expect(back).toMatchObject({ curl: false, hit: true });
  expect(back.stayed).toBeGreaterThanOrEqual(80);
});

// In the page, through the CanvasKit the preview loaded: draw page-curl.sksl once over an opaque grey
// leaf, a 400 x 200 page at progress 0.5, and read the alpha on the midline at x 40 and 360, at
// x 260 just past the roll and at its mirror 139 (by hand from the shader: the flat leaf, well past
// the roll's shadow, and the shadow at about 0.38 * (1 - 10/112)^2, alpha about 80).
const curlAlphas = ({ source, direction }: { source: string; direction: number }) => {
  const kit = (globalThis as any).CanvasKit;
  const surface = kit.MakeSurface(400, 200);
  const leaf = kit.Shader.MakeColor(kit.Color4f(0.5, 0.5, 0.5, 1), kit.ColorSpace.SRGB);
  const shader = kit.RuntimeEffect.Make(source).makeShaderWithChildren(
    [400, 200, 0.5, direction, 1, 1, 1],
    [leaf],
  );
  const paint = new kit.Paint();
  paint.setShader(shader);
  surface.getCanvas().drawPaint(paint);
  const pixels = surface.getCanvas().readPixels(0, 0, {
    width: 400,
    height: 200,
    colorType: kit.ColorType.RGBA_8888,
    alphaType: kit.AlphaType.Premul,
    colorSpace: kit.ColorSpace.SRGB,
  });
  const alpha = (x: number) => pixels[(100 * 400 + x) * 4 + 3];
  return { left: alpha(40), right: alpha(360), shadow: alpha(260), mirrored: alpha(139) };
};

// Breaks: the curl turns the wrong way (forward lifts the leaf from the right, a return from the
// left), or the arriving side loses the roll's shadow (the transparent-arriving bug) or is painted
// over instead of left live under it.
test('the curl turns forward from the right and back from the left, with only a shadow beyond', async ({
  app,
  screen,
  browser,
}) => {
  await app.open('/?preview=page-turn');
  await expect(screen.getByRole('button', 'Continue')).toBeVisible({ timeout: COLD });
  const source = readFileSync(new URL('../book/page-curl.sksl', import.meta.url), 'utf8');
  const forward = await browser.evaluate(curlAlphas, { source, direction: 1 });
  expect(forward).toMatchObject({ left: 255, right: 0 });
  expect(forward.shadow).toBeGreaterThan(40);
  expect(forward.shadow).toBeLessThan(98);
  const back = await browser.evaluate(curlAlphas, { source, direction: -1 });
  expect(back).toMatchObject({ left: 0, right: 255 });
  expect(back.mirrored).toBe(forward.shadow);
});

// Breaks: a failed CanvasKit load (no WebAssembly, as in Safari Lockdown Mode, or a failed fetch)
// leaves a blank page instead of a Book whose pages change without a curl.
test('without CanvasKit the pages change with no curl', async ({ app, screen, browser }) => {
  await browser.addInitScript(() => {
    const load = window.fetch.bind(window);
    window.fetch = (input, init) =>
      String(input instanceof Request ? input.url : input).includes('canvaskit')
        ? Promise.reject(new TypeError('blocked'))
        : load(input, init);
  });
  await app.open('/?preview=page-turn');
  await expect(screen.getByRole('button', 'Continue')).toBeVisible({ timeout: COLD });
  expect(await browser.evaluate(() => 'CanvasKit' in globalThis)).toBe(false);
  const args = { from: 'Continue', to: 'Start over' };
  expect(await browser.evaluate(turn, args)).toMatchObject({ curl: false, hit: true });
  await app.open('/'); // the app itself, not only the preview
  await expect(screen.getByText('Choose your ancestry')).toBeVisible({ timeout: COLD });
});
