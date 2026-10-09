// Loka picker overlay, the preview side (design input section 1): a fixed capture layer while Pick is
// on, a hover outline with a component-chain chip, numbered pins. It adds nothing to the story's
// layout and never imports book/. Loaded by .storybook/preview.tsx.
import { addons } from 'storybook/preview-api';
import { PICK, PIN, PINS, READY, SHOT, type Box, type Picked } from './events.ts';

const BLUE = '#1EA7FD'; // Storybook blue, apart from every Book palette
const WHITE = '#FFFFFF';
// RNW building blocks and Storybook's own wrappers are not the owner's components.
const UNNAMED =
  /^(View|Text|Pressable|ScrollView|TextInput|Image|Button|SafeAreaView|TouchableOpacity|Animated\w*|ErrorBoundary|Fragment)$/;

const layer = document.createElement('div'); // the capture layer: all pointer events while on
layer.style.cssText = `position:fixed;inset:0;z-index:2147483647;display:none;cursor:crosshair`;
layer.setAttribute('aria-hidden', 'true');
const hover = mark();
// ponytail: pins do not follow a scroll or resize; re-pin after one.
const pinned = new Map<string, { el: Element; mark: HTMLDivElement }>();
let n = 0;

function mark() {
  const box = document.createElement('div');
  box.style.cssText = `position:absolute;display:none;pointer-events:none;border:2px solid ${BLUE}99;box-sizing:border-box`;
  const chip = document.createElement('div');
  chip.style.cssText = `position:absolute;left:-2px;padding:2px 6px;border-radius:2px;background:${BLUE};color:${WHITE};font:11px ui-monospace,monospace;white-space:nowrap`;
  box.append(chip);
  layer.append(box);
  return { box, chip };
}

const round = (r: DOMRect): Box => ({
  x: Math.round(r.left),
  y: Math.round(r.top),
  w: Math.round(r.width),
  h: Math.round(r.height),
});
const place = ({ box, chip }: ReturnType<typeof mark>, el: Element, label: string) => {
  const b = round(el.getBoundingClientRect());
  Object.assign(box.style, {
    display: 'block',
    left: `${b.x}px`,
    top: `${b.y}px`,
    width: `${b.w}px`,
    height: `${b.h}px`,
  });
  chip.textContent = label;
  chip.style.top = b.y < 20 ? '100%' : 'auto';
  chip.style.bottom = b.y < 20 ? 'auto' : '100%';
  chip.style.maxWidth = `${window.innerWidth - b.x - 4}px`; // clamped inside the viewport
  return b;
};

const name = (type: unknown): string | undefined =>
  typeof type === 'function'
    ? (type as { displayName?: string }).displayName || type.name
    : typeof type === 'object' && type
      ? name(
          (type as { render?: unknown; type?: unknown }).render ??
            (type as { type?: unknown }).type,
        )
      : undefined;
// The React dev fiber owner chain: who rendered this element, root-most first, at most 4 deep.
function chain(el: Element): string[] {
  const key = Object.keys(el).find((k) => k.startsWith('__reactFiber$'));
  type Fiber = { type: unknown; _debugOwner?: Fiber };
  let fiber = key ? (el as unknown as Record<string, Fiber>)[key] : undefined;
  const out: string[] = [];
  for (; fiber && out.length < 4; fiber = fiber._debugOwner) {
    const nm = name(fiber.type);
    if (nm && /^[A-Z]/.test(nm) && !UNNAMED.test(nm)) out.push(nm);
  }
  return out.reverse();
}
const label = (el: Element) => {
  const { w, h } = round(el.getBoundingClientRect());
  return `${chain(el).join(' › ') || el.tagName.toLowerCase()} · ${w}×${h}`;
};

// The story element under the pointer: the capture layer is skipped, nothing outside the root picks.
const root = () => document.getElementById('storybook-root');
const under = (e: MouseEvent) =>
  document
    .elementsFromPoint(e.clientX, e.clientY)
    .find((el) => !layer.contains(el) && root()?.contains(el));

const describe = (el: Element, key: string): Picked => {
  const cs = getComputedStyle(el);
  const computed = Object.fromEntries(
    ['padding', 'margin', 'fontFamily', 'fontSize', 'lineHeight', 'color', 'backgroundColor'].map(
      (p) => [p, cs[p as keyof CSSStyleDeclaration] as string],
    ),
  );
  const text = (el as HTMLElement).innerText?.trim() || null;
  const role = el.getAttribute('role') ?? (el.tagName === 'BUTTON' ? 'button' : null);
  return {
    key,
    chain: chain(el),
    box: round(el.getBoundingClientRect()),
    computed,
    text: text && text.slice(0, 200),
    role,
    name: el.getAttribute('aria-label') ?? (role === 'button' ? text : null),
    testId: el.getAttribute('data-testid'),
    png: null,
  };
};

// The crop (box + 24 px, device pixel ratio 2) with html-to-image, loaded on the first pin only, so
// the build and the smoke never bundle it. Unknown (a WebGL canvas, a font fetch) stays null.
const crop = async (el: Element): Promise<string | null> => {
  try {
    const { toCanvas } = await import('html-to-image');
    const full = await toCanvas(document.body, { pixelRatio: 2, filter: (n) => n !== layer });
    const b = round(el.getBoundingClientRect());
    const x = Math.max(0, b.x + window.scrollX - 24);
    const y = Math.max(0, b.y + window.scrollY - 24);
    const w = Math.min(b.w + 48, full.width / 2 - x);
    const h = Math.min(b.h + 48, full.height / 2 - y);
    const out = Object.assign(document.createElement('canvas'), { width: w * 2, height: h * 2 });
    out.getContext('2d')!.drawImage(full, x * 2, y * 2, w * 2, h * 2, 0, 0, w * 2, h * 2);
    return out.toDataURL('image/png');
  } catch {
    return null;
  }
};

const channel = addons.getChannel();
layer.addEventListener('pointermove', (e) => {
  const el = under(e);
  if (el) place(hover, el, label(el));
  else hover.box.style.display = 'none';
});
layer.addEventListener('pointerleave', () => (hover.box.style.display = 'none'));
layer.addEventListener('click', (e) => {
  const el = under(e);
  if (!el) return;
  // A pinned element unpins: the manager toggles a key it already holds.
  const key = [...pinned].find(([, p]) => p.el === el)?.[0] ?? `k${++n}`;
  if (pinned.has(key)) return channel.emit(PIN, { element: describe(el, key), add: true });
  pinned.set(key, { el, mark: mark().box });
  channel.emit(PIN, { element: describe(el, key), add: e.shiftKey });
  void crop(el).then((png) => channel.emit(SHOT, { key, png }));
});

channel.on(PICK, ({ on }: { on: boolean }) => {
  layer.style.display = on ? 'block' : 'none';
  hover.box.style.display = 'none';
  if (!layer.isConnected) document.body.append(layer); // first use; body end, fixed: no layout change
});
channel.on(PINS, ({ keys }: { keys: string[] }) => {
  for (const [key, p] of pinned) {
    const i = keys.indexOf(key);
    if (i < 0) {
      p.mark.remove();
      pinned.delete(key);
      continue;
    }
    const m = { box: p.mark, chip: p.mark.firstElementChild as HTMLDivElement };
    place(m, p.el, `${i + 1} ${label(p.el)}`);
    p.mark.style.borderColor = BLUE;
    p.mark.style.background = `${BLUE}1F`; // 12 % fill
  }
});
channel.emit(READY, {}); // a preview reload while Pick is on gets its layer back
