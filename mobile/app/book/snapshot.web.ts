// A picture of a mounted page for the page curl. Web: react-native-skia's makeImageFromView only
// calls back here, so the page's DOM is drawn through an SVG foreignObject with the document's
// stylesheets (react-native-web styles by class) and its @font-face files inlined.
// ponytail: draws the page from its top, not its scroll offset; a scrolled leaving page snaps up.
import type { View } from 'react-native';
import { Skia } from '@shopify/react-native-skia';

const fonts = new Map<string, Promise<string>>();

const dataUrl = async (url: string) => {
  const blob = await (await fetch(url)).blob();
  return new Promise<string>((done, fail) => {
    const reader = new FileReader();
    reader.onload = () => done(reader.result as string);
    reader.onerror = () => fail(reader.error);
    reader.readAsDataURL(blob);
  });
};

// Every stylesheet rule now (react-native-web adds rules as pages render), each @font-face url()
// made a data URL, fetched once: an SVG image loads nothing itself.
async function styles() {
  const rules = [...document.styleSheets].flatMap((sheet) => [...sheet.cssRules]);
  const text = await Promise.all(
    rules.map(async (rule) => {
      if (!(rule instanceof CSSFontFaceRule)) return rule.cssText;
      const url = /url\("?([^")]+)"?\)/.exec(rule.cssText)?.[1];
      if (!url) return rule.cssText;
      // A failed fetch is forgotten, so the next turn tries again.
      if (!fonts.has(url))
        fonts.set(
          url,
          dataUrl(url).catch((e) => (fonts.delete(url), Promise.reject(e))),
        );
      return rule.cssText.replace(url, await fonts.get(url)!);
    }),
  );
  return text.join('\n');
}

export async function snapshot(view: View) {
  const node = view as unknown as HTMLElement;
  const { width, height } = node.getBoundingClientRect();
  const scale = devicePixelRatio;
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width * scale}" height="${height * scale}">` +
    `<foreignObject width="${width}" height="${height}" transform="scale(${scale})">` +
    `<div xmlns="http://www.w3.org/1999/xhtml" style="width:${width}px;height:${height}px;display:flex">` +
    `<style><![CDATA[${await styles()}]]></style>${new XMLSerializer().serializeToString(node)}` +
    `</div></foreignObject></svg>`;
  const image = new Image();
  image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  await image.decode();
  return Skia.Image.MakeImageFromNativeBuffer(image);
}

// One throwaway picture ahead of the first turn: fetches and inlines the fonts and wakes the image
// decoder, so the first turn's picture is ready within motion.quick and the first web turn curls too.
export const warm = (view: View) =>
  snapshot(view).then(
    (image) => image?.dispose(),
    () => {}, // the turn itself retries; its fallback is the page changing without a curl
  );
